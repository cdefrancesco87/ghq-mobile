import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';

import { BADGE_LIST } from '@/content/badges';
import type { ThemeKey } from '@/theme/themes';
import { renderThemed } from '../../../test/render';
import { useBadgeTexts } from './badgeTexts';

function Probe({ keys }: { readonly keys: readonly string[] }) {
  const { find, nameOf, conditionOf } = useBadgeTexts();
  return (
    <>
      {keys.map((key) => {
        const badge = find(key);
        return badge === undefined ? null : (
          <Text key={key} testID={key}>
            {`${nameOf(badge)} | ${conditionOf(badge)}`}
          </Text>
        );
      })}
    </>
  );
}

const STRENGTH = ['stat_strength_3', 'stat_strength_6', 'stat_strength_10'];

async function namesIn(theme: ThemeKey, keys = STRENGTH, language: 'it' | 'en' = 'it') {
  await renderThemed(<Probe keys={keys} />, { theme, language });
  return keys.map((key) => screen.getByTestId(key).props.children as string);
}

describe('names of the stat badges (backlog T84)', () => {
  it('has three badges for each of the six stats', () => {
    expect(BADGE_LIST.filter((badge) => badge.metric.startsWith('stat_'))).toHaveLength(18);
  });

  it('names the ranks and the stat in the lexicon of the theme', async () => {
    expect(await namesIn('fantasy')).toEqual([
      'Recluta di Forza | Porta Forza al livello 3',
      'Veterano di Forza | Porta Forza al livello 6',
      'Campione di Forza | Porta Forza al livello 10',
    ]);
  });

  it('changes the names with the theme', async () => {
    expect((await namesIn('arcade'))[2]).toMatch(/^Leggenda di /);
    screen.unmount();
    expect((await namesIn('cyberpunk'))[1]).toMatch(/^Specialista di /);
    screen.unmount();
    expect(await namesIn('lovecraft', ['stat_wisdom_10'])).toEqual([
      'Custode di Lucidità | Porta Lucidità al livello 10',
    ]);
    screen.unmount();
    expect(await namesIn('minimal-chiaro', ['stat_strength_3', 'stat_wisdom_10'])).toEqual([
      'Movimento · Bronzo | Porta Movimento al livello 3',
      'Equilibrio · Oro | Porta Equilibrio al livello 10',
    ]);
  });

  it('has the names in English too', async () => {
    expect(await namesIn('fantasy', ['stat_strength_10'], 'en')).toEqual([
      'Champion of Strength | Bring Strength to level 10',
    ]);
  });
});
