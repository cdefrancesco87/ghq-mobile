import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Dimensions, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { getAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { contrastRatio, pressedColour } from '@/theme/contrast';
import { SHAPES } from '@/theme/shapes';
import { THEMES, THEME_KEYS, type ThemeKey } from '@/theme/themes';
import { pixelFontSize } from '@/theme/textScale';
import { renderThemed } from '../../../test/render';
import { ActionSheet } from './ActionSheet';
import { Bar, barRatio, filledSegments } from './Bar';
import { Button, buttonColors } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { ConfirmDialog } from './ConfirmDialog';
import { Difficulty } from './Difficulty';
import { EmptyState } from './EmptyState';
import { cutFramePath, cutSheetFillPath, cutSheetStrokePath } from './Frame';
import { ScreenHeader } from './ScreenHeader';
import { SegmentedControl } from './SegmentedControl';
import { SHEET_DURATION_MS, Sheet, shouldDismissSheet } from './Sheet';
import { ThemedText } from './ThemedText';
import { MIN_TOUCH } from './touch';
import { UNDO_TOAST_MS, UndoToastProvider, useUndoToast } from './UndoToast';
import { useLargeText } from './useLargeText';

const styleOf = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(id).props.style as StyleProp<ViewStyle>) as ViewStyle;

/** The height computed by the animated style of an element. */
const animatedHeightOf = (id: string) =>
  (getAnimatedStyle as unknown as (component: unknown) => ViewStyle)(screen.getByTestId(id)).height;

/** The height of the touch area of an element, with its hit slop. */
function touchHeight(id: string): number {
  const element = screen.getByTestId(id);
  const { minHeight, height } = styleOf(id);
  const slop = element.props.hitSlop ?? { top: 0, bottom: 0 };
  return Number(minHeight ?? height) + slop.top + slop.bottom;
}

async function setFontScale(fontScale: number) {
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale },
      screen: { width: 390, height: 844, scale: 3, fontScale },
    });
  });
}

afterEach(() => setFontScale(1));

// The two themes that differ the most: rounded corners and frames made of pixels.
const THEMES_UNDER_TEST: readonly ThemeKey[] = ['minimal-chiaro', 'arcade'];

describe.each(THEMES_UNDER_TEST)('shared components in %s', (theme) => {
  it('Card draws the border of the theme', async () => {
    const { colors } = await renderThemed(
      <Card testID="card">
        <Text>Contenuto</Text>
      </Card>,
      { theme },
    );

    expect(screen.getByText('Contenuto')).toBeOnTheScreen();
    if (theme === 'arcade') {
      const bars = screen.getAllByTestId('card-frame-bar');
      expect(bars).toHaveLength(4);
      expect(StyleSheet.flatten(bars[0].props.style).backgroundColor).toBe(colors.border);
    } else {
      expect(styleOf('card-frame')).toMatchObject({
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      });
    }
  });

  it('Button is at least 48 high, is a named button and calls onPress', async () => {
    const onPress = jest.fn();
    await renderThemed(<Button label="Salva" onPress={onPress} testID="save" />, { theme });

    expect(touchHeight('save')).toBeGreaterThanOrEqual(48);
    await fireEvent.press(screen.getByRole('button', { name: 'Salva' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a disabled Button does not react and tells the reason to the screen reader', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <Button
        label="Salva"
        onPress={onPress}
        testID="save"
        disabled
        disabledReason="Scrivi un nome"
      />,
      { theme },
    );

    const button = screen.getByTestId('save');
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityHint).toBe('Scrivi un nome');
    expect(button).toBeDisabled();
  });

  it('Bar has the number beside it and the label for the screen reader', async () => {
    await renderThemed(<Bar kind="hp" label="Vita" value={32} max={50} testID="hp" />, { theme });

    expect(screen.getByText('32/50')).toBeOnTheScreen();
    const bar = screen.getByTestId('hp');
    expect(bar.props.accessibilityLabel).toBe('Vita 32 su 50');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 50, now: 32 });
  });

  it('Bar fills up to the value, in the shape of the theme', async () => {
    const { colors } = await renderThemed(
      <Bar kind="xp" label="XP" value={1} max={2} testID="xp" />,
      { theme },
    );

    if (theme === 'arcade') {
      // 100 wide: ten segments of 8 + 2 (the last gap is not needed).
      await fireEvent(screen.getByTestId('xp-track'), 'layout', {
        nativeEvent: { layout: { width: 98, height: 12, x: 0, y: 0 } },
      });
      expect(screen.getAllByTestId('xp-full')).toHaveLength(5);
      expect(screen.getAllByTestId('xp-empty')).toHaveLength(5);
    } else {
      expect(styleOf('xp-fill')).toMatchObject({ width: '50%', backgroundColor: colors.xp });
      expect(styleOf('xp-track').height).toBe(8);
    }
  });

  it('Difficulty shows the notches and the word, read also by the screen reader', async () => {
    await renderThemed(<Difficulty difficulty="medium" testID="difficulty" />, { theme });

    expect(screen.getAllByTestId('notch-full')).toHaveLength(2);
    expect(screen.getAllByTestId('notch-empty')).toHaveLength(1);
    expect(screen.getByText('Media')).toBeOnTheScreen();
    expect(screen.getByTestId('difficulty').props.accessibilityLabel).toBe('Media');
  });

  it('Difficulty can hide the word but not from the screen reader', async () => {
    await renderThemed(<Difficulty difficulty="hard" showWord={false} testID="difficulty" />, {
      theme,
    });

    expect(screen.getAllByTestId('notch-full')).toHaveLength(3);
    expect(screen.queryByText('Difficile')).toBeNull();
    expect(screen.getByTestId('difficulty').props.accessibilityLabel).toBe('Difficile');
  });

  it('Chip is 32 high with the touch area of the platform and a selected state', async () => {
    const onPress = jest.fn();
    await renderThemed(<Chip label="Salute" onPress={onPress} testID="chip" selected />, {
      theme,
    });

    expect(styleOf('chip').minHeight).toBe(32);
    expect(touchHeight('chip')).toBeGreaterThanOrEqual(MIN_TOUCH);
    const chip = screen.getByRole('button', { name: 'Salute', selected: true });
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('SegmentedControl is 40 high with the touch area of the platform', async () => {
    const onChange = jest.fn();
    await renderThemed(
      <SegmentedControl
        options={[
          { value: 'week', label: 'Settimana' },
          { value: 'month', label: 'Mese' },
        ]}
        value="week"
        onChange={onChange}
        testID="period"
        accessibilityLabel="Periodo"
      />,
      { theme },
    );

    expect(styleOf('period-week').minHeight).toBe(40);
    expect(touchHeight('period-week')).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(screen.getByRole('radio', { name: 'Settimana', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Mese', checked: false }));
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('SegmentedControl becomes a row of chips with very large text', async () => {
    await setFontScale(1.3);
    await renderThemed(
      <SegmentedControl
        options={[
          { value: 'week', label: 'Settimana' },
          { value: 'month', label: 'Mese' },
        ]}
        value="week"
        onChange={jest.fn()}
        testID="period"
        accessibilityLabel="Periodo"
      />,
      { theme },
    );

    expect(styleOf('period').flexWrap).toBe('wrap');
    expect(screen.getByRole('button', { name: 'Settimana', selected: true })).toBeOnTheScreen();
  });

  it('ScreenHeader shows the large title with its caption and a back button of 48', async () => {
    const onBack = jest.fn();
    await renderThemed(
      <ScreenHeader title="Oggi" caption="Domenica 8 novembre" onBack={onBack} />,
      {
        theme,
      },
    );

    expect(screen.getByRole('header', { name: 'Oggi' })).toBeOnTheScreen();
    expect(screen.getByText('Domenica 8 novembre')).toBeOnTheScreen();
    expect(styleOf('screen-header-back')).toMatchObject({ width: 48, height: 48 });
    await fireEvent.press(screen.getByRole('button', { name: 'Indietro' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('ScreenHeader goes from 96 to 56 while scrolling, plus the safe area', async () => {
    function Scrolled({ y }: { y: number }) {
      const scrollY = useSharedValue(y);
      return <ScreenHeader title="Oggi" scrollY={scrollY} testID={`header-${y}`} />;
    }
    const top = 47;
    await renderThemed(
      <>
        <Scrolled y={0} />
        <Scrolled y={20} />
        <Scrolled y={400} />
      </>,
      { theme },
    );

    expect(animatedHeightOf('header-0')).toBe(top + 96);
    expect(animatedHeightOf('header-20')).toBe(top + 76);
    expect(animatedHeightOf('header-400')).toBe(top + 56);
  });

  it('a compact ScreenHeader has one title, in the compact bar', async () => {
    await renderThemed(<ScreenHeader title="Boss" compact />, { theme });

    expect(screen.getByRole('header', { name: 'Boss' })).toBeOnTheScreen();
    expect(animatedHeightOf('screen-header')).toBe(47 + 56);
  });

  it('Sheet has a handle and closes from the backdrop', async () => {
    const onClose = jest.fn();
    await renderThemed(
      <Sheet visible onClose={onClose} title="Nuova missione">
        <Text>Contenuto</Text>
      </Sheet>,
      { theme },
    );

    expect(screen.getByText('Contenuto')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Nuova missione' })).toBeOnTheScreen();
    expect(screen.getByTestId('sheet-handle')).toBeOnTheScreen();
    // Hidden from the screen reader, which closes the sheet from the handle.
    await fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Sheet has a handle of the minimum size, even without a title', async () => {
    await renderThemed(
      <Sheet visible onClose={jest.fn()}>
        <Text>Contenuto</Text>
      </Sheet>,
      { theme },
    );

    expect(touchHeight('sheet-handle')).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('Sheet offers the screen reader one close button, working on iOS and Android', async () => {
    const onClose = jest.fn();
    await renderThemed(
      <Sheet visible onClose={onClose}>
        <Text>Contenuto</Text>
      </Sheet>,
      { theme },
    );

    // Throws if the backdrop is a second «Chiudi» (Android does not hide it behind the modal).
    const handle = screen.getByRole('button', { name: 'Chiudi', includeHiddenElements: true });
    expect(handle.props.testID).toBe('sheet-handle');
    expect(handle.props.accessibilityActions).toEqual([{ name: 'activate' }]);
    await fireEvent(handle, 'accessibilityTap');
    expect(onClose).toHaveBeenCalledTimes(1);
    await fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Sheet is half of the screen at most, or all of it below the safe area', async () => {
    await renderThemed(
      <>
        <Sheet visible onClose={jest.fn()} testID="half">
          <Text>Metà</Text>
        </Sheet>
        <Sheet visible onClose={jest.fn()} size="full" testID="full">
          <Text>Tutta</Text>
        </Sheet>
      </>,
      { theme },
    );

    const { height } = Dimensions.get('window');
    expect(styleOf('half').maxHeight).toBe(height / 2 + 34);
    expect(styleOf('full').height).toBe(height - 47);
  });

  it('Sheet stays on screen while it slides away, then disappears', async () => {
    jest.useFakeTimers();
    try {
      let hide = () => undefined as void;
      function Harness() {
        const [visible, setVisible] = useState(true);
        hide = () => setVisible(false);
        return (
          <Sheet visible={visible} onClose={jest.fn()}>
            <Text>Contenuto</Text>
          </Sheet>
        );
      }
      await renderThemed(<Harness />, { theme });
      expect(screen.getByText('Contenuto')).toBeOnTheScreen();

      await act(async () => hide());
      expect(screen.getByText('Contenuto')).toBeOnTheScreen();

      await act(async () => jest.advanceTimersByTime(SHEET_DURATION_MS));
      expect(screen.queryByText('Contenuto')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('ActionSheet has items of at least 52, and choosing one closes it', async () => {
    const onClose = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const { colors } = await renderThemed(
      <ActionSheet
        visible
        onClose={onClose}
        title="Leggi 20 pagine"
        items={[
          { key: 'edit', label: 'Modifica', onPress: onEdit },
          { key: 'delete', label: 'Elimina', onPress: onDelete, destructive: true },
          { key: 'pause', label: 'Pausa', onPress: jest.fn(), disabled: true },
        ]}
      />,
      { theme },
    );

    expect(touchHeight('action-sheet-edit')).toBeGreaterThanOrEqual(52);
    expect(StyleSheet.flatten(screen.getByText('Elimina').props.style).color).toBe(
      colors.dangerText,
    );

    await fireEvent.press(screen.getByTestId('action-sheet-pause'));
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('menuitem', { name: 'Modifica' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('ConfirmDialog confirms and cancels', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderThemed(
      <ConfirmDialog
        visible
        title="Eliminare «Corsa»?"
        message="La cronologia della missione si perde."
        confirmLabel="Elimina"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
      { theme },
    );

    expect(screen.getByRole('header', { name: 'Eliminare «Corsa»?' })).toBeOnTheScreen();
    expect(touchHeight('confirm-dialog-confirm')).toBeGreaterThanOrEqual(48);
    await fireEvent.press(screen.getByRole('button', { name: 'Annulla' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Elimina' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ConfirmDialog closes from the backdrop, which is not a second «Annulla»', async () => {
    const onCancel = jest.fn();
    await renderThemed(
      <ConfirmDialog
        visible
        title="Eliminare «Corsa»?"
        message="La cronologia della missione si perde."
        confirmLabel="Elimina"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
      { theme },
    );

    // Throws if the backdrop is a second «Annulla» (Android does not hide it behind the modal).
    const cancel = screen.getByRole('button', { name: 'Annulla', includeHiddenElements: true });
    expect(cancel.props.testID).toBe('confirm-dialog-cancel');
    await fireEvent.press(
      screen.getByTestId('confirm-dialog-backdrop', { includeHiddenElements: true }),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('ConfirmDialog stacks the buttons with very large text, the main action on top', async () => {
    await setFontScale(1.3);
    await renderThemed(
      <ConfirmDialog
        visible
        title="Eliminare?"
        message="Non si annulla."
        confirmLabel="Elimina"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
      { theme },
    );

    const actions = screen.getByTestId('confirm-dialog-actions');
    expect(StyleSheet.flatten(actions.props.style).flexDirection).toBeUndefined();
    expect(
      actions.children.map((child) => (typeof child === 'string' ? child : child.props.testID)),
    ).toEqual(['confirm-dialog-confirm', 'confirm-dialog-cancel']);
  });

  describe('UndoToast', () => {
    let toast: ReturnType<typeof useUndoToast>;
    function Screen() {
      toast = useUndoToast();
      return null;
    }

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const openProvider = () =>
      renderThemed(
        <UndoToastProvider>
          <Screen />
        </UndoToastProvider>,
        { theme },
      );

    it('disappears after 5 seconds, without undoing', async () => {
      const onUndo = jest.fn();
      await openProvider();

      await act(async () => toast.show({ message: 'Fatto · +25 XP', onUndo }));
      expect(screen.getByText('Fatto · +25 XP')).toBeOnTheScreen();

      await act(async () => jest.advanceTimersByTime(UNDO_TOAST_MS - 1));
      expect(screen.getByText('Fatto · +25 XP')).toBeOnTheScreen();

      await act(async () => jest.advanceTimersByTime(1));
      expect(screen.queryByText('Fatto · +25 XP')).toBeNull();
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('undoes from «Annulla», at least 48 high, and disappears', async () => {
      const onUndo = jest.fn();
      await openProvider();
      await act(async () => toast.show({ message: 'Fatto', onUndo }));

      expect(touchHeight('undo-toast-undo')).toBeGreaterThanOrEqual(48);
      await fireEvent.press(screen.getByRole('button', { name: 'Annulla' }));

      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Fatto')).toBeNull();
    });

    it('shows one at a time: a new one replaces the old and restarts the 5 seconds', async () => {
      await openProvider();
      await act(async () => toast.show({ message: 'Primo', onUndo: jest.fn() }));
      await act(async () => jest.advanceTimersByTime(3000));

      await act(async () => toast.show({ message: 'Secondo', onUndo: jest.fn() }));
      expect(screen.queryByText('Primo')).toBeNull();

      await act(async () => jest.advanceTimersByTime(UNDO_TOAST_MS - 1));
      expect(screen.getByText('Secondo')).toBeOnTheScreen();
      await act(async () => jest.advanceTimersByTime(1));
      expect(screen.queryByText('Secondo')).toBeNull();
    });
  });

  it('EmptyState shows the companion, the sentence and one action', async () => {
    const onAction = jest.fn();
    await renderThemed(
      <EmptyState
        companion={<Text>Compagno</Text>}
        message="Nessuna missione oggi."
        actionLabel="Crea una missione"
        onAction={onAction}
        testID="empty"
      />,
      { theme },
    );

    expect(screen.getByText('Compagno')).toBeOnTheScreen();
    expect(screen.getByText('Nessuna missione oggi.')).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('empty-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('useLargeText', () => {
  function Probe() {
    return <Text>{useLargeText() ? 'grande' : 'normale'}</Text>;
  }

  it('is true from a font scale of 1.3', async () => {
    await setFontScale(1.29);
    await renderThemed(<Probe />);
    expect(screen.getByText('normale')).toBeOnTheScreen();

    await setFontScale(1.3);
    expect(await screen.findByText('grande')).toBeOnTheScreen();
  });
});

describe('ThemedText', () => {
  it('stops titles at 150% and the other roles at 200%', async () => {
    await renderThemed(
      <>
        <ThemedText variant="screenTitle">Titolo</ThemedText>
        <ThemedText variant="body">Corpo</ThemedText>
      </>,
    );

    expect(screen.getByText('Titolo').props.maxFontSizeMultiplier).toBe(1.5);
    expect(screen.getByText('Corpo').props.maxFontSizeMultiplier).toBe(2);
  });

  it('scales Press Start 2P by itself, only to multiples of 2', async () => {
    await setFontScale(1.3);
    await renderThemed(<ThemedText variant="screenTitle">Titolo</ThemedText>, { theme: 'arcade' });

    const title = screen.getByText('Titolo');
    expect(title.props.allowFontScaling).toBe(false);
    // 14 × 1.3 = 18.2, rounded down to the multiple of 2.
    expect(StyleSheet.flatten(title.props.style).fontSize).toBe(18);
  });

  it('pixelFontSize never goes below the size of the theme and stops at the limit', () => {
    expect(pixelFontSize(11, 1, 2)).toBe(11);
    expect(pixelFontSize(11, 1.05, 2)).toBe(11);
    expect(pixelFontSize(11, 1.3, 2)).toBe(14);
    expect(pixelFontSize(14, 3, 1.5)).toBe(20);
  });
});

describe('colours of the buttons', () => {
  it.each(THEME_KEYS)('in %s pressed darkens by 18%% and disabled is track', (key) => {
    const { colors } = THEMES[key];

    expect(buttonColors(colors, 'primary', { pressed: true }).fill).toBe(
      pressedColour(colors.primary),
    );
    expect(buttonColors(colors, 'destructive', { disabled: true })).toEqual({
      fill: colors.track,
      stroke: colors.track,
      label: colors.textMuted,
    });
  });

  it.each(THEME_KEYS)('in %s every label is readable on its button', (key) => {
    const { colors } = THEMES[key];

    for (const variant of ['primary', 'destructive'] as const) {
      const { fill, label } = buttonColors(colors, variant);
      expect(contrastRatio(label, fill)).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrastRatio(buttonColors(colors, 'text').label, colors.surface),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(buttonColors(colors, 'secondary').stroke, colors.surface),
    ).toBeGreaterThanOrEqual(3);
  });

  it('pressedColour darkens each channel by 18%', () => {
    expect(pressedColour('#ffffff')).toBe('#d1d1d1');
  });
});

describe('measures of the bars', () => {
  it('barRatio stays between 0 and 1, also without a maximum', () => {
    expect(barRatio(32, 50)).toBe(0.64);
    expect(barRatio(60, 50)).toBe(1);
    expect(barRatio(-1, 50)).toBe(0);
    expect(barRatio(1, 0)).toBe(0);
  });

  it('filledSegments looks empty or full only when the value really is', () => {
    expect(filledSegments(0, 20)).toBe(0);
    expect(filledSegments(0.01, 20)).toBe(1);
    expect(filledSegments(0.5, 20)).toBe(10);
    expect(filledSegments(0.99, 20)).toBe(19);
    expect(filledSegments(1, 20)).toBe(20);
  });

  it('gives each theme the bar of misure-componenti.md', () => {
    expect(SHAPES.minimal.bar.height).toBe(8);
    expect(SHAPES.arcade.bar.height).toBe(12);
    expect(SHAPES.arcade.bar.segments).toEqual({ kind: 'fixed', width: 8, gap: 2 });
    expect(SHAPES.fantasy.bar).toMatchObject({ height: 10, outlineWidth: 1 });
    expect(SHAPES.cyberpunk.bar).toMatchObject({
      height: 6,
      glow: 4,
      segments: { kind: 'count', count: 20, gap: 2 },
    });
    expect(SHAPES.lovecraft.bar.height).toBe(4);
  });
});

describe('shapes of the other themes', () => {
  it('Cyberpunk draws its cut corners as a path, once the size is known', async () => {
    await renderThemed(
      <Card testID="card">
        <Text>Contenuto</Text>
      </Card>,
      { theme: 'cyberpunk' },
    );

    await fireEvent(screen.getByTestId('card-frame'), 'layout', {
      nativeEvent: { layout: { width: 200, height: 100, x: 0, y: 0 } },
    });

    expect(screen.getByTestId('card-frame').children).toHaveLength(1);
    expect(cutFramePath(200, 100, 12, 1)).toBe(
      'M12 0.5 L199.5 0.5 L199.5 87.5 L187.5 99.5 L0.5 99.5 L0.5 12 Z',
    );
  });

  it('a Cyberpunk sheet has only the top left corner cut and the top edge in xp', () => {
    expect(cutSheetFillPath(200, 100, 12)).toBe('M12 0 L200 0 L200 100 L0 100 L0 12 Z');
    expect(cutSheetStrokePath(200, 12, 1)).toBe('M0 12.5 L12 0.5 L200 0.5');
  });

  it.each(['fantasy', 'lovecraft'] as const)('%s adds the inner rule at 3', async (theme) => {
    await renderThemed(
      <Card testID="card">
        <Text>Contenuto</Text>
      </Card>,
      { theme },
    );

    expect(styleOf('card-frame-rule').top).toBe(3);
  });

  it('Lovecraft and Fantasy cards are drawn in the shapes of the table', () => {
    expect(SHAPES.fantasy.card).toEqual({
      kind: 'rounded',
      radius: 8,
      borderWidth: 1,
      innerRuleAt: 3,
    });
    expect(SHAPES.lovecraft.chip).toEqual({ kind: 'rounded', radius: 0, borderWidth: 1 });
  });
});

describe('dragging a sheet', () => {
  it('closes after a long or fast drag, otherwise it goes back', () => {
    expect(shouldDismissSheet(97, 0)).toBe(true);
    expect(shouldDismissSheet(10, 801)).toBe(true);
    expect(shouldDismissSheet(96, 800)).toBe(false);
  });
});
