import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { THEME_KEYS, type ThemeKey } from '@/theme/themes';
import { renderThemed } from '../../../test/render';
import { COMPLETION_CONTROL_SIZE } from './CompletionControl';
import { categoryIcon } from './icons';
import { MissionRow, type MissionRowProps } from './MissionRow';
import { ringDash } from './ProgressRing';

const HIDDEN = { includeHiddenElements: true };

const styleOf = (id: string) =>
  StyleSheet.flatten(
    screen.getByTestId(id, HIDDEN).props.style as StyleProp<TextStyle>,
  ) as TextStyle;

async function setFontScale(fontScale: number) {
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale },
      screen: { width: 390, height: 844, scale: 3, fontScale },
    });
  });
}

afterEach(() => setFontScale(1));

const common = {
  testID: 'row',
  name: 'Meditazione',
  difficulty: 'medium',
  detail: 'Ogni giorno',
} as const;

const today: MissionRowProps = {
  ...common,
  variant: 'today',
  icon: 'mente',
  xp: 25,
  onComplete: () => undefined,
};
const priority: MissionRowProps = {
  ...common,
  variant: 'priority',
  position: 2,
  xp: 35,
  onComplete: () => undefined,
};
const list: MissionRowProps = {
  ...common,
  variant: 'list',
  icon: 'mente',
  streak: 12,
  completionRate: 80,
};
const done: MissionRowProps = {
  ...common,
  variant: 'done',
  icon: 'mente',
  doneTime: '07:42',
};

const THEMES_UNDER_TEST: readonly ThemeKey[] = ['minimal-chiaro', 'arcade'];

describe.each(THEMES_UNDER_TEST)('MissionRow in %s', (theme) => {
  it('today: shows name, frequency, XP and a 48×48 control on the right', async () => {
    const onComplete = jest.fn();
    await renderThemed(<MissionRow {...today} onComplete={onComplete} />, { theme });

    expect(screen.getByText('Meditazione')).toBeOnTheScreen();
    expect(screen.getByText('Ogni giorno')).toBeOnTheScreen();
    expect(screen.getByText('+25')).toBeOnTheScreen();
    expect(styleOf('row').minHeight).toBe(64);

    const control = styleOf('row-control');
    expect(COMPLETION_CONTROL_SIZE).toBe(48);
    expect(control.minWidth).toBe(48);
    expect(control.minHeight).toBe(48);
    const row = screen.getByTestId('row');
    expect(row.children.at(-1)).toBe(screen.getByTestId('row-control'));

    await fireEvent.press(screen.getByTestId('row-control'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('today: the name stops at two lines', async () => {
    await renderThemed(<MissionRow {...today} />, { theme });

    expect(screen.getByText('Meditazione').props.numberOfLines).toBe(2);
    expect(screen.getByText('Meditazione').props.ellipsizeMode ?? 'tail').toBe('tail');
  });

  it('priority: taller, with the number instead of the icon', async () => {
    await renderThemed(<MissionRow {...priority} />, { theme });

    expect(styleOf('row').minHeight).toBe(72);
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(screen.queryByTestId('row-icon', HIDDEN)).toBeNull();
    expect(screen.getByText('+35')).toBeOnTheScreen();
    expect(screen.getByTestId('row-control')).toBeOnTheScreen();
  });

  it('list: streak and 30-day rate instead of the control', async () => {
    await renderThemed(<MissionRow {...list} />, { theme });

    expect(screen.getByText('12')).toBeOnTheScreen();
    expect(screen.getByText('80%')).toBeOnTheScreen();
    expect(screen.queryByTestId('row-control')).toBeNull();
    expect(screen.queryByText('+25')).toBeNull();
  });

  it.each([
    [105, 100],
    [-3, 0],
  ])('list: a rate of %i shows %i in the text and in the label', async (rate, shown) => {
    await renderThemed(<MissionRow {...list} completionRate={rate} />, { theme });

    expect(screen.getByText(`${shown}%`)).toBeOnTheScreen();
    const label: string = screen.getByTestId('row-body').props.accessibilityLabel;
    expect(label).toContain(`${shown}%`);
    expect(label).not.toContain(`${rate}%`);
  });

  it('keeps the icon in a column of 24, whatever the size of the drawing', async () => {
    await renderThemed(<MissionRow {...today} icon="salute" />, { theme });
    expect(styleOf('row-icon').width).toBe(24);
    await renderThemed(<MissionRow {...today} icon="missioni" testID="other" />, { theme });
    expect(styleOf('other-icon').width).toBe(24);
  });

  it('done: muted, struck-through text with the time and no XP', async () => {
    const { colors } = await renderThemed(<MissionRow {...done} />, { theme });

    const name = StyleSheet.flatten(screen.getByText('Meditazione').props.style);
    expect(name.color).toBe(colors.textMuted);
    expect(name.textDecorationLine).toBe('line-through');
    expect(screen.getByText('fatta alle 07:42')).toBeOnTheScreen();
    expect(screen.queryByText('Ogni giorno')).toBeNull();
    expect(screen.getByTestId('row-control', HIDDEN).props.onPress).toBeUndefined();
  });

  it('with a goal: the ring shows the percentage and the detail the progress', async () => {
    await renderThemed(
      <MissionRow {...today} name="Bevi 2 litri d'acqua" detail="1,25 di 2 L" progress={0.625} />,
      { theme },
    );

    expect(screen.getByText('62%', HIDDEN)).toBeOnTheScreen();
    expect(screen.getByText('1,25 di 2 L')).toBeOnTheScreen();
    const ring = theme === 'arcade' ? 'row-control-ring-square' : 'row-control-ring-round';
    expect(screen.getByTestId(ring, HIDDEN)).toBeOnTheScreen();
  });

  it('with a goal beyond the target: the percentage stops at 100', async () => {
    await renderThemed(<MissionRow {...today} progress={1.2} />, { theme });

    expect(screen.getByText('100%', HIDDEN)).toBeOnTheScreen();
  });
});

describe('MissionRow themes', () => {
  it.each(THEME_KEYS)('draws the empty and the done control in %s', async (theme) => {
    await renderThemed(
      <>
        <MissionRow {...today} testID="todo" />
        <MissionRow {...done} testID="fatta" />
      </>,
      { theme },
    );

    expect(screen.getByTestId('todo-control')).toBeOnTheScreen();
    expect(screen.getByTestId('fatta-control', HIDDEN)).toBeOnTheScreen();
  });

  it('a done mission in Arcade says CLEAR!', async () => {
    await renderThemed(<MissionRow {...done} />, { theme: 'arcade' });

    expect(screen.getByText('CLEAR!', HIDDEN)).toBeOnTheScreen();
  });

  it('a done mission in Cyberpunk writes the time as a timestamp', async () => {
    await renderThemed(<MissionRow {...done} doneTime="07:42:13" />, { theme: 'cyberpunk' });

    expect(screen.getByText('fatta alle [07:42:13]')).toBeOnTheScreen();
  });
});

describe('MissionRow screen reader', () => {
  it('reads the whole mission on the control of a mission to do', async () => {
    await renderThemed(<MissionRow {...today} />);

    expect(screen.getByTestId('row-control').props.accessibilityLabel).toBe(
      'Meditazione, media, 25 XP, da fare. Tocca due volte per completare',
    );
  });

  it('reads the term of the theme for the XP', async () => {
    await renderThemed(<MissionRow {...today} />, { theme: 'lovecraft' });

    expect(screen.getByTestId('row-control').props.accessibilityLabel).toContain(
      '25 Conoscenze proibite',
    );
  });

  it('reads the progress of a mission with a goal', async () => {
    await renderThemed(
      <MissionRow {...today} name="Bevi 2 litri d'acqua" detail="1,25 di 2 L" progress={0.625} />,
    );

    expect(screen.getByTestId('row-control').props.accessibilityLabel).toBe(
      "Bevi 2 litri d'acqua, media, 25 XP, 1,25 di 2 L. Tocca due volte per aggiungere",
    );
  });

  it('reads the position of a priority', async () => {
    await renderThemed(<MissionRow {...priority} />);

    expect(screen.getByTestId('row-control').props.accessibilityLabel).toBe(
      'Priorità 2, Meditazione, media, 35 XP, da fare. Tocca due volte per completare',
    );
  });

  it('the body of a row to do opens the detail', async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    await renderThemed(<MissionRow {...today} onPress={onPress} onLongPress={onLongPress} />);

    const body = screen.getByTestId('row-body');
    expect(body.props.accessibilityLabel).toBe(
      'Meditazione, Ogni giorno. Tocca due volte per aprire il dettaglio',
    );
    await fireEvent.press(body);
    expect(onPress).toHaveBeenCalledTimes(1);
    await fireEvent(body, 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('reads a list row as design-sezioni.md 3.11', async () => {
    await renderThemed(<MissionRow {...list} />);

    expect(screen.getByTestId('row-body').props.accessibilityLabel).toBe(
      'Meditazione, Ogni giorno, media, serie 12 giorni, 80% negli ultimi 30 giorni',
    );
  });

  it('reads the streak of a list row in the right unit', async () => {
    await renderThemed(<MissionRow {...list} streak={1} streakUnit="weeks" />);

    expect(screen.getByTestId('row-body').props.accessibilityLabel).toContain('serie 1 settimana');
  });

  it('reads a done row with its time', async () => {
    await renderThemed(<MissionRow {...done} />);

    expect(screen.getByTestId('row-body').props.accessibilityLabel).toBe(
      'Meditazione, media, fatta alle 07:42',
    );
  });

  it('runs on the control the actions passed by the parent', async () => {
    const onAction = jest.fn();
    await renderThemed(
      <MissionRow {...today} actions={[{ name: 'skip', label: 'Salta oggi', onAction }]} />,
    );

    const control = screen.getByTestId('row-control');
    expect(control.props.accessibilityActions).toEqual([{ name: 'skip', label: 'Salta oggi' }]);
    await fireEvent(control, 'accessibilityAction', { nativeEvent: { actionName: 'skip' } });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('runs on the body the actions of a row without a control', async () => {
    const onAction = jest.fn();
    await renderThemed(
      <MissionRow {...list} actions={[{ name: 'edit', label: 'Modifica', onAction }]} />,
    );

    const body = screen.getByTestId('row-body');
    expect(body.props.accessibilityActions).toEqual([{ name: 'edit', label: 'Modifica' }]);
    await fireEvent(body, 'accessibilityAction', { nativeEvent: { actionName: 'edit' } });
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('MissionRow with very large text', () => {
  it('moves XP and difficulty under the name, keeping the control on the right', async () => {
    await setFontScale(1.3);
    await renderThemed(<MissionRow {...today} />);

    const under = within(screen.getByTestId('row-under'));
    expect(under.getByText('+25')).toBeOnTheScreen();
    expect(under.getByLabelText('Media')).toBeOnTheScreen();
    expect(screen.getByText('Meditazione').props.numberOfLines).toBe(3);
    expect(screen.queryByTestId('row-trailing')).toBeNull();
    const row = screen.getByTestId('row');
    expect(row.children.at(-1)).toBe(screen.getByTestId('row-control'));
  });

  it('keeps the normal layout below the threshold', async () => {
    await setFontScale(1.29);
    await renderThemed(<MissionRow {...today} />);

    expect(within(screen.getByTestId('row-trailing')).getByText('+25')).toBeOnTheScreen();
    expect(screen.queryByTestId('row-under')).toBeNull();
    expect(screen.getByText('Meditazione').props.numberOfLines).toBe(2);
  });

  it('drops the percentage in the ring but keeps the progress', async () => {
    await setFontScale(1.3);
    await renderThemed(<MissionRow {...today} detail="1,25 di 2 L" progress={0.625} />);

    expect(screen.queryByText('62%', HIDDEN)).toBeNull();
    expect(screen.getByText('1,25 di 2 L')).toBeOnTheScreen();
  });

  it('moves streak and rate of a list row under the name', async () => {
    await setFontScale(1.3);
    await renderThemed(<MissionRow {...list} />);

    const under = within(screen.getByTestId('row-under'));
    expect(under.getByText('12')).toBeOnTheScreen();
    expect(under.getByText('80%')).toBeOnTheScreen();
    expect(screen.queryByTestId('row-trailing')).toBeNull();
  });

  it('rounds the pixel font of Arcade down to a multiple of 2', async () => {
    await setFontScale(1.3);
    await renderThemed(<MissionRow {...today} />, { theme: 'arcade' });

    const { fontFamily, fontSize } = StyleSheet.flatten(screen.getByText('+25').props.style);
    expect(fontFamily).toContain('PressStart2P');
    expect(Number(fontSize) % 2).toBe(0);
  });
});

describe('ringDash', () => {
  it('fills the part of the perimeter of the progress', () => {
    expect(ringDash(0.5, 100)).toEqual([50, 100]);
  });

  it('stays between empty and full', () => {
    expect(ringDash(-1, 100)).toEqual([0, 100]);
    expect(ringDash(2, 100)).toEqual([100, 100]);
  });
});

describe('categoryIcon', () => {
  it('gives the icon of a category', () => {
    expect(categoryIcon('health')).toBe('salute');
    expect(categoryIcon('mind')).toBe('mente');
    expect(categoryIcon('work_study')).toBe('lavoro-studio');
    expect(categoryIcon('home')).toBe('casa');
  });

  it('falls back to the mission icon without a known category', () => {
    expect(categoryIcon(null)).toBe('missioni');
    expect(categoryIcon('unknown')).toBe('missioni');
  });
});
