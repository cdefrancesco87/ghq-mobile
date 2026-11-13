import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parseAllDocuments } from 'yaml';

import appConfig from '../app.json';

// The Maestro flows (.maestro/) run only on an emulator, by hand (task C16): here they are checked
// without a phone. Every file must read as YAML, every `id` it cites must be a testID of the code
// and every subflow it runs must exist.

const ROOT = join(__dirname, '..');
const FLOWS = join(ROOT, '.maestro');
const SOURCES = ['app', 'src'].map((folder) => join(ROOT, folder));

function filesIn(folder: string, keep: (name: string) => boolean): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return filesIn(path, keep);
    }
    return keep(entry.name) ? [path] : [];
  });
}

const flowFiles = filesIn(FLOWS, (name) => /\.ya?ml$/.test(name));
const flows = flowFiles.map((path) => ({
  name: relative(FLOWS, path),
  path,
  documents: parseAllDocuments(readFileSync(path, 'utf8')),
}));
/** The flows `maestro test .maestro/` runs: the subflows sit in a folder of their own. */
const mainFlows = flows.filter((flow) => dirname(flow.path) === FLOWS);

/** The values of every `key` in a parsed document, at any depth. */
function valuesOf(node: unknown, key: string): unknown[] {
  if (Array.isArray(node)) {
    return node.flatMap((item) => valuesOf(item, key));
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([name, value]) => [
      ...(name === key ? [value] : []),
      ...valuesOf(value, key),
    ]);
  }
  return [];
}

const commandsOf = (flow: (typeof flows)[number]): unknown => flow.documents.at(-1)?.toJS();

// The testIDs of the code: the string literals on the lines that set a testID, or that prepare
// one in a constant (`const id = `boss-step-${index}``). A template becomes a pattern: `${…}`
// stands for any text, and one that starts with `${…}` (`${testID}-control`) adds its end to the
// testID given to the component, so its start must be a testID of the code too.

interface Pattern {
  readonly regex: RegExp;
  /** The pattern is the end of a testID that starts with another one. */
  readonly suffix: boolean;
}

const CARRIES_ID = /[tT]estID|\bconst \w*(?:id|ID) = /;
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g;
const EXPRESSION = /\$\{[^}]*\}/;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function patternOf(text: string, template: boolean): Pattern | null {
  if (!template || !EXPRESSION.test(text)) {
    return /^[\w-]+$/.test(text) ? { regex: new RegExp(`^${escape(text)}$`), suffix: false } : null;
  }
  const chunks = text.split(EXPRESSION);
  const suffix = text.startsWith('${');
  const kept = suffix ? chunks.slice(1) : chunks;
  // A template made only of expressions says nothing about the testID.
  if (kept.join('') === '') {
    return null;
  }
  return { regex: new RegExp(`^${kept.map(escape).join('.+')}$`), suffix };
}

const patterns: Pattern[] = SOURCES.flatMap((folder) =>
  filesIn(folder, (name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)),
).flatMap((path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => CARRIES_ID.test(line))
    .flatMap((line) =>
      [...line.matchAll(LITERAL)].flatMap(([, single, double, template]) => {
        const pattern =
          template === undefined
            ? patternOf(single ?? double ?? '', false)
            : patternOf(template, true);
        return pattern === null ? [] : [pattern];
      }),
    ),
);

/**
 * Whether a testID cited by a flow is in the code. The flows may use a regular expression for the
 * part made of an id of the database (`today-mission-.*-control`): it stands for a `${…}`.
 */
function inCode(id: string, depth = 3): boolean {
  return patterns.some((pattern) => {
    if (!pattern.suffix) {
      return pattern.regex.test(id);
    }
    if (depth === 0) {
      return false;
    }
    for (let cut = 1; cut < id.length; cut += 1) {
      if (pattern.regex.test(id.slice(cut)) && inCode(id.slice(0, cut), depth - 1)) {
        return true;
      }
    }
    return false;
  });
}

const citedIds = [
  ...new Set(
    flows.flatMap((flow) =>
      valuesOf(commandsOf(flow), 'id').filter((id): id is string => typeof id === 'string'),
    ),
  ),
].sort();

describe('Maestro flows', () => {
  it('has a flow for each journey of the task', () => {
    expect(mainFlows.map((flow) => flow.name).sort()).toEqual([
      '01-first-launch.yaml',
      '02-complete-and-undo.yaml',
      '03-create-mission.yaml',
      '04-boss-victory.yaml',
      '05-potion.yaml',
      '06-theme-and-language.yaml',
      '07-wipe-data.yaml',
    ]);
  });

  it.each(flows.map((flow) => [flow.name, flow] as const))('%s reads as YAML', (_, flow) => {
    expect(flow.documents.flatMap((document) => document.errors)).toEqual([]);
    expect(flow.documents.flatMap((document) => document.warnings)).toEqual([]);
    // The configuration, then the commands.
    expect(flow.documents).toHaveLength(2);
    expect(Array.isArray(commandsOf(flow))).toBe(true);
  });

  it.each(flows.map((flow) => [flow.name, flow] as const))('%s drives this app', (_, flow) => {
    const config = flow.documents[0].toJS() as { appId?: unknown };
    expect(config.appId).toBe(appConfig.expo.android.package);
    expect(config.appId).toBe(appConfig.expo.ios.bundleIdentifier);
  });

  it.each(mainFlows.map((flow) => [flow.name, flow] as const))(
    '%s starts from an app without data',
    (_, flow) => {
      expect((commandsOf(flow) as unknown[])[0]).toEqual({ runFlow: 'subflows/start.yaml' });
    },
  );

  it.each(flows.map((flow) => [flow.name, flow] as const))(
    '%s runs only subflows that exist',
    (_, flow) => {
      const files = valuesOf(commandsOf(flow), 'runFlow').map((value) =>
        typeof value === 'string' ? value : (value as { file?: unknown }).file,
      );
      for (const file of files.filter((value) => value !== undefined)) {
        expect(typeof file).toBe('string');
        expect(existsSync(join(dirname(flow.path), file as string))).toBe(true);
      }
    },
  );

  it('cites testIDs', () => {
    expect(citedIds.length).toBeGreaterThan(30);
  });

  it.each(citedIds)('cites %s, which is a testID of the code', (id) => {
    expect(inCode(id)).toBe(true);
  });

  it('tells a testID of the code from one that is not there', () => {
    expect(inCode('onboarding-continue')).toBe(true);
    expect(inCode('tab-goals')).toBe(true);
    expect(inCode('today-mission-menu-undo')).toBe(true);
    expect(inCode('boss-step-2-control')).toBe(true);
    expect(inCode('onboarding-nowhere')).toBe(false);
    expect(inCode('no-such-button')).toBe(false);
    expect(inCode('nowhere-control')).toBe(false);
  });
});
