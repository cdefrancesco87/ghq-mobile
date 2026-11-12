import { uuidv7 } from 'uuidv7';

import {
  MAX_TEMPLATES,
  MIN_TEMPLATES,
  MISSION_TEMPLATES,
  type MissionTemplate,
} from '../../content/templates';
import { applyBossDamage, bossHpMax } from '../../rules/boss';
import { BOSS, HP } from '../../rules/config';
import { STAT_KEYS } from '../../rules/types';
import { boss, bossSteps, companion, hero, heroStats, missions } from '../schema';
import type { Db } from '../types';
import { appendEvent } from './events';
import { goalColumns } from './missions';
import {
  SETTING_DEFAULTS,
  clearOnboardingDraft,
  getOnboardingDraft,
  setOnboardingDraft,
  setSetting,
  type OnboardingDraft,
  type SettingValue,
} from './settings';

// The first launch (analisi-funzionale.md, section 1): the hero, the stats, the egg, the chosen
// missions and the quest of the first launch, all in one transaction and all in the event log
// (modello-dati.md, section 8: no seed data).

/** The missions already selected at the first launch (design 1.5), also what «Salta» leaves. */
export const RECOMMENDED_TEMPLATE_KEYS = MISSION_TEMPLATES.filter(
  (template) => template.recommended,
).map((template) => template.key);

/** The first launch left halfway, or a new one from the first step (design 1.1). */
export function loadOnboardingDraft(db: Db): OnboardingDraft {
  return (
    getOnboardingDraft(db) ?? {
      step: 1,
      name: '',
      theme: SETTING_DEFAULTS.theme,
      templateKeys: RECOMMENDED_TEMPLATE_KEYS,
    }
  );
}

/** Saves the choices of the first launch; a value that is not valid throws. */
export function saveOnboardingDraft(db: Db, draft: OnboardingDraft, now: number): void {
  setOnboardingDraft(db, draft, now);
}

/**
 * The quest of the first launch: a small boss of 3 steps. Name and step titles are keys: the
 * screens show them in the language and with the lexicon of the theme (design 1.8).
 * DRAFT to be reviewed by Claudio: the documents do not give its difficulty.
 */
export const STARTER_QUEST = {
  name: 'starter_quest.name',
  difficulty: 'easy',
  steps: [
    'starter_quest.steps.create_habit',
    'starter_quest.steps.complete_habit',
    'starter_quest.steps.open_stats',
  ],
} as const;

export interface ProfileInput {
  readonly name: string;
  readonly language: SettingValue<'language'>;
  readonly theme: SettingValue<'theme'>;
  /** Keys of the chosen templates, from 1 to 5. */
  readonly templateKeys: readonly string[];
}

export interface ProfileContext {
  /** UTC instant of the creation, in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC (local time = UTC + offset). */
  readonly tzOffset: number;
  /** Translates a text key into the chosen language; the missions keep the translated name. */
  readonly translate?: (key: string) => string;
}

function templatesFor(keys: readonly string[]): MissionTemplate[] {
  if (keys.length < MIN_TEMPLATES || keys.length > MAX_TEMPLATES) {
    throw new RangeError(
      `Choose from ${MIN_TEMPLATES} to ${MAX_TEMPLATES} templates: ${keys.length}`,
    );
  }
  if (new Set(keys).size !== keys.length) {
    throw new RangeError(`A template is chosen twice: ${keys.join(', ')}`);
  }
  return keys.map((key) => {
    const template = MISSION_TEMPLATES.find((candidate) => candidate.key === key);
    if (template === undefined) {
      throw new RangeError(`Unknown template: ${key}`);
    }
    return template;
  });
}

/** True when the first launch has already created the profile. */
export function hasProfile(db: Db): boolean {
  return db.select({ id: hero.id }).from(hero).get() !== undefined;
}

/**
 * Creates the profile of the first launch in one transaction: the hero, the six stats, the
 * companion egg, the settings chosen, the missions from the templates and the quest of the
 * first launch, whose first step («crea la prima abitudine») is already done (design 1.7).
 */
export function createProfile(db: Db, input: ProfileInput, context: ProfileContext): void {
  const name = input.name.trim();
  if (name === '') {
    throw new RangeError('The hero needs a name');
  }
  const templates = templatesFor(input.templateKeys);
  const { now, tzOffset, translate = (key: string) => key } = context;
  const base = { occurredAt: now, tzOffset, source: 'app' } as const;

  db.transaction((tx) => {
    // Throws if the hero already exists: the first launch happens only once.
    tx.insert(hero).values({ id: 'hero', name, hp: HP.max, createdAt: now, updatedAt: now }).run();
    appendEvent(tx, { ...base, type: 'hero.created', deltas: { hp: HP.max }, payload: { name } });
    tx.insert(heroStats)
      .values(STAT_KEYS.map((statKey) => ({ statKey, points: 0 })))
      .run();
    tx.insert(companion).values({ id: 'companion', stage: 'egg', completionsTotal: 0 }).run();
    setSetting(tx, 'language', input.language, now);
    setSetting(tx, 'theme', input.theme, now);
    clearOnboardingDraft(tx);

    templates.forEach((template, index) => {
      const missionId = uuidv7();
      tx.insert(missions)
        .values({
          id: missionId,
          kind: 'habit',
          name: translate(`templates.${template.key}.name`),
          difficulty: template.difficulty,
          frequency: template.frequency,
          ...goalColumns(template.goal),
          statPrimary: template.stat,
          templateKey: template.key,
          categoryKey: template.category,
          healthMetric: template.healthMetric ?? null,
          sortOrder: index + 1,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      appendEvent(tx, {
        ...base,
        type: 'mission.created',
        missionId,
        payload: { templateKey: template.key },
      });
    });

    const bossId = uuidv7();
    const hpMax = bossHpMax(STARTER_QUEST.steps.length);
    const firstStep = applyBossDamage(
      { hp: hpMax, stepsLeft: STARTER_QUEST.steps.length - 1 },
      BOSS.stepDamage,
    );
    tx.insert(boss)
      .values({
        id: bossId,
        name: STARTER_QUEST.name,
        kind: 'starter',
        difficulty: STARTER_QUEST.difficulty,
        hpMax,
        hp: firstStep.hp,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    const stepIds = STARTER_QUEST.steps.map(() => uuidv7());
    tx.insert(bossSteps)
      .values(
        STARTER_QUEST.steps.map((title, position) => ({
          id: stepIds[position],
          bossId,
          position,
          title,
          doneAt: position === 0 ? now : null,
        })),
      )
      .run();
    appendEvent(tx, {
      ...base,
      type: 'boss.created',
      bossId,
      payload: { kind: 'starter', steps: STARTER_QUEST.steps.length, hpMax },
    });
    appendEvent(tx, {
      ...base,
      type: 'boss.step_done',
      bossId,
      payload: { stepId: stepIds[0], position: 0, damage: BOSS.stepDamage, hp: firstStep.hp },
    });
  });
}
