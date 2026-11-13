import { RESOURCES, type Language } from '../../i18n';

// The texts of the tale of the companion (design-sezioni.md 6.14) in the language files:
// `tale.<voice>.<situation>.<mood>.<n>` in the morning, `tale.<voice>.<situation>.<n>` in the
// evening. Any number of variants works: they are read from the files, not counted in the code.
// The numbers stand between `**` for the bold of the bubble (racconto-compagno-testi.md).

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

type Tree = { readonly [key: string]: string | Tree };

/** The keys of the variants of a group (`tale.cloudy.fullDay.happy`) in a language, in order. */
export function taleVariants(language: Language): (group: string) => string[] {
  return (group) => {
    let node: string | Tree | undefined = RESOURCES[language].translation as unknown as Tree;
    for (const part of group.split('.')) {
      node = typeof node === 'object' ? node[part] : undefined;
    }
    if (typeof node !== 'object') {
      return [];
    }
    const names = new Set(
      Object.entries(node)
        .filter(([, value]) => typeof value === 'string')
        .map(([name]) => name.replace(PLURAL_SUFFIX, '')),
    );
    return [...names]
      .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
      .map((name) => `${group}.${name}`);
  };
}

export interface TaleSegment {
  readonly text: string;
  readonly bold: boolean;
}

/** A text of the tale in pieces, the ones between `**` in bold. */
export function taleSegments(text: string): TaleSegment[] {
  return text
    .split('**')
    .map((piece, index) => ({ text: piece, bold: index % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}

/** A text of the tale without the marks of the bold: for notifications and the screen reader. */
export function plainTale(text: string): string {
  return text.split('**').join('');
}
