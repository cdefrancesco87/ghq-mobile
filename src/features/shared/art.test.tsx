import { screen } from '@testing-library/react-native';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { COMPANION_STAGES } from '@/rules/companion';
import { SHAPES } from '@/theme/shapes';
import { THEME_KEYS, type ThemeFamily, type ThemeKey } from '@/theme/themes';
import { renderThemed } from '../../../test/render';
import { BossSprite } from './BossSprite';
import { CompanionSprite } from './CompanionSprite';
import { LINE_ICON_BODIES, PIXEL_ICON_BODIES, VECTOR_SVGS } from './generated/svgData';
import { Icon } from './Icon';
import { ICON_NAMES, iconXml, type IconName } from './icons';
import { Logo } from './Logo';
import { EVOLUTION_STEPS, LOGO_PLACEHOLDERS, evolutionSpriteKey } from './placeholders';
import { hasSprite } from './Sprite';
import { bossSpriteKey, companionSpriteKey, spriteSide, type BossKind } from './sprites';

const FAMILIES: readonly ThemeFamily[] = ['minimal', 'arcade', 'fantasy', 'cyberpunk', 'lovecraft'];
const LINE_FAMILIES = FAMILIES.filter((family) => family !== 'arcade');
const BOSS_KINDS: readonly BossKind[] = ['quest', 'easy', 'medium', 'hard'];
const DESIGN = 'assets/design/lotto1';

function sourceFiles(folder: string): string[] {
  return readdirSync(folder, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(folder, file));
}

/** The icon names written in the code: `<Icon name="…"` and `icon: '…'` in a table of icons. */
function iconNamesInCode(): string[] {
  const code = [...sourceFiles('app'), ...sourceFiles('src')]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  return [...code.matchAll(/<Icon\b[^>]*?\bname="([^"]+)"|\bicon: '([^']+)'/g)].map(
    (match) => match[1] ?? match[2],
  );
}

describe('icon files', () => {
  it('finds the icons of the tab bar in the code', () => {
    expect(iconNamesInCode()).toEqual(
      expect.arrayContaining(['oggi', 'abitudini', 'aggiungi', 'boss', 'profilo']),
    );
  });

  it('has a file for every icon used in the app', () => {
    for (const name of iconNamesInCode()) {
      expect(ICON_NAMES).toContain(name);
    }
  });

  it('keeps every line icon backed by the file of each stroke', () => {
    for (const name of Object.keys(LINE_ICON_BODIES)) {
      for (const family of LINE_FAMILIES) {
        expect(existsSync(join(DESIGN, 'linea', `icona-${name}-${family}.svg`))).toBe(true);
      }
    }
  });

  it('keeps every pixel icon backed by its file', () => {
    for (const name of Object.keys(PIXEL_ICON_BODIES)) {
      expect(existsSync(join(DESIGN, 'pixel', `icona-${name}-arcade.svg`))).toBe(true);
    }
  });

  it('has a line file for every icon', () => {
    expect(ICON_NAMES.filter((name) => !(name in LINE_ICON_BODIES))).toEqual([]);
  });
});

describe('iconXml', () => {
  it('uses the stroke written in the files of each theme', () => {
    for (const family of LINE_FAMILIES) {
      const file = readFileSync(join(DESIGN, 'linea', `icona-cerca-${family}.svg`), 'utf8');
      const { width, linecap, linejoin } = SHAPES[family].icon;
      expect(file).toContain(`stroke-width="${width}"`);
      expect(file).toContain(`stroke-linecap="${linecap}"`);
      expect(file).toContain(`stroke-linejoin="${linejoin}"`);
      expect(iconXml('cerca', family)).toContain(`stroke-width="${width}"`);
    }
  });

  it('draws in pixels in Arcade and with a line elsewhere', () => {
    expect(iconXml('cerca', 'arcade')).toContain('viewBox="0 0 12 12"');
    expect(iconXml('cerca', 'minimal')).toContain('viewBox="0 0 24 24"');
  });

  it('draws Today from its line file outside Arcade and its pixel file in Arcade', () => {
    expect(iconXml('oggi', 'minimal')).toContain(LINE_ICON_BODIES.oggi);
    expect(iconXml('oggi', 'arcade')).toContain('viewBox="0 0 12 12"');
  });

  it('draws the shield with its line file outside Arcade', () => {
    expect(iconXml('scudo', 'fantasy')).toContain(LINE_ICON_BODIES.scudo);
  });

  it('falls back on the only drawing an icon has', () => {
    expect(iconXml('profilo', 'arcade')).toContain('viewBox="0 0 24 24"');
  });

  it('never carries the metadata of the files', () => {
    for (const name of ICON_NAMES) {
      expect(iconXml(name, 'arcade')).not.toMatch(/metadata|c2pa|<title>/);
    }
  });
});

describe('Icon', () => {
  it('is skipped by the screen reader unless it has a label', async () => {
    await renderThemed(<Icon name="cerca" testID="icon" />);
    expect(screen.getByTestId('icon', { includeHiddenElements: true }).props.accessible).toBe(
      false,
    );
  });

  it('is read when it has a label', async () => {
    await renderThemed(<Icon name="cerca" accessibilityLabel="Cerca" size={16} />, {
      theme: 'arcade',
    });
    expect(screen.getByLabelText('Cerca')).toBeTruthy();
  });

  // Parses every SVG 6 times: with the coverage on, it can take longer than the default 5 seconds.
  it('renders every icon in every theme', async () => {
    const names: readonly IconName[] = ICON_NAMES;
    for (const theme of THEME_KEYS) {
      await renderThemed(
        <>
          {names.map((name) => (
            <Icon key={name} name={name} />
          ))}
        </>,
        { theme },
      );
    }
  }, 30_000);
});

describe('sprite files', () => {
  const pixelThemes = THEME_KEYS.filter((theme) => !theme.startsWith('minimal'));

  it('has a drawing for every stage and pose of the companion in all 6 themes', () => {
    for (const theme of THEME_KEYS) {
      for (const stage of COMPANION_STAGES) {
        for (const pose of ['happy', 'normal', 'sad', 'cheering'] as const) {
          expect(hasSprite(companionSpriteKey(theme, stage, pose))).toBe(true);
        }
      }
    }
  });

  it('has a drawing for every boss of the pixel themes and none in Minimal', () => {
    for (const theme of pixelThemes) {
      for (const kind of BOSS_KINDS) {
        expect(hasSprite(bossSpriteKey(theme as ThemeFamily, kind) as string)).toBe(true);
      }
    }
    expect(bossSpriteKey('minimal', 'hard')).toBeNull();
  });

  it('has the placeholders of the evolution and of the logo', () => {
    for (const family of FAMILIES) {
      for (const step of EVOLUTION_STEPS) {
        expect(hasSprite(evolutionSpriteKey(family, step))).toBe(true);
      }
    }
    for (const logo of Object.values(LOGO_PLACEHOLDERS)) {
      expect(VECTOR_SVGS).toHaveProperty(logo.light);
      expect(VECTOR_SVGS).toHaveProperty(logo.dark);
    }
  });

  it('keeps the metadata of the files out of the vector art', () => {
    for (const svg of Object.values(VECTOR_SVGS)) {
      expect(svg).not.toMatch(/metadata|c2pa/);
    }
  });

  it('writes a declared PNG for every pixel sprite', () => {
    expect(existsSync('assets/sprites/compagno-arcade-uovo.png')).toBe(true);
    expect(existsSync('assets/sprites/boss-lovecraft-difficile.png')).toBe(true);
  });
});

describe('spriteSide', () => {
  it('scales only to whole multiples of the grid', () => {
    expect(spriteSide(32, 96)).toBe(96);
    expect(spriteSide(32, 100)).toBe(96);
    expect(spriteSide(32, 127)).toBe(96);
    expect(spriteSide(32, 128)).toBe(128);
  });

  it('fills the box of 64 of the Arcade companion at each resolution', () => {
    expect(spriteSide(8, 64)).toBe(64);
    expect(spriteSide(16, 64)).toBe(64);
    expect(spriteSide(32, 64)).toBe(64);
  });

  it('never goes below the original grid', () => {
    expect(spriteSide(32, 20)).toBe(32);
  });
});

describe('CompanionSprite', () => {
  const cases: readonly (readonly [ThemeKey, string])[] = [
    ['arcade', 'Pixel, cucciolo, felice'],
    ['fantasy', 'Rocky, cucciolo, felice'],
    ['minimal-chiaro', 'Cloudy, cucciolo, felice'],
  ];

  it.each(cases)('describes the companion to the screen reader in %s', async (theme, label) => {
    await renderThemed(<CompanionSprite stage="baby" mood="happy" />, { theme });
    expect(screen.getByLabelText(label)).toBeTruthy();
  });

  it('reads the stage and the mood', async () => {
    await renderThemed(<CompanionSprite stage="adult" mood="sad" />, { theme: 'lovecraft' });
    expect(screen.getByLabelText('Lumin, adulto, triste')).toBeTruthy();
  });

  it('does not read a mood for the egg', async () => {
    await renderThemed(<CompanionSprite stage="egg" mood="happy" />, { theme: 'cyberpunk' });
    expect(screen.getByLabelText('Glitchy, uovo')).toBeTruthy();
  });

  it('follows the language', async () => {
    await renderThemed(<CompanionSprite stage="adult" mood="cheering" />, {
      theme: 'arcade',
      language: 'en',
    });
    expect(screen.getByLabelText('Pixel, adult, cheering')).toBeTruthy();
  });

  it('can show another theme than the one in use', async () => {
    await renderThemed(<CompanionSprite stage="baby" mood="normal" theme="fantasy" />, {
      theme: 'arcade',
    });
    expect(screen.getByLabelText('Rocky, cucciolo, normale')).toBeTruthy();
  });

  it('keeps the box of the requested size', async () => {
    await renderThemed(<CompanionSprite stage="baby" mood="normal" size={100} testID="pet" />, {
      theme: 'fantasy',
    });
    const box = StyleSheet.flatten(
      screen.getByTestId('pet').props.style as StyleProp<ViewStyle>,
    ) as ViewStyle;
    expect(box.width).toBe(100);
    expect(box.height).toBe(100);
  });
});

describe('BossSprite', () => {
  it('names the boss of a pixel theme', async () => {
    await renderThemed(<BossSprite kind="hard" />, { theme: 'fantasy' });
    expect(screen.getByLabelText('Ignis, drago rosso')).toBeTruthy();
  });

  it('names the boss of the starter quest', async () => {
    await renderThemed(<BossSprite kind="quest" />, { theme: 'arcade' });
    expect(screen.getByLabelText('Dring, sveglia ribelle')).toBeTruthy();
  });

  it('draws a circle in Minimal, with the goal and its difficulty', async () => {
    await renderThemed(<BossSprite kind="easy" size={80} testID="boss" />);
    expect(screen.getByLabelText('Grande obiettivo, Facile')).toBeTruthy();
    const circle = StyleSheet.flatten(
      screen.getByTestId('boss').props.style as StyleProp<ViewStyle>,
    ) as ViewStyle;
    expect(circle.borderRadius).toBe(40);
  });

  it('reads only the goal for the quest in Minimal', async () => {
    await renderThemed(<BossSprite kind="quest" />, { theme: 'minimal-scuro' });
    expect(screen.getByLabelText('Grande obiettivo')).toBeTruthy();
  });
});

describe('Logo', () => {
  it('is read as the name of the app, on a light and on a dark background', async () => {
    await renderThemed(<Logo variant="horizontal" height={40} />);
    expect(screen.getByLabelText('Good Habits Quest')).toBeTruthy();
    await renderThemed(<Logo variant="horizontal" height={40} />, { theme: 'minimal-scuro' });
    expect(screen.getByLabelText('Good Habits Quest')).toBeTruthy();
  });
});
