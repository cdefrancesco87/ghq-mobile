import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { SettingValue } from '@/db/repositories/settings';
import { SHAPES } from '@/theme/shapes';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import type { ThemeFamily } from '@/theme/themes';
import { Chip } from './Chip';
import { CompanionSprite } from './CompanionSprite';
import { Glyph, emptyGlyph } from './CompletionControl';
import { Frame } from './Frame';
import { ThemedText } from './ThemedText';
import { useReduceMotion } from './useReduceMotion';

type ThemeSetting = SettingValue<'theme'>;

/** The themes in the order of design-sezioni.md 1.4. */
const FAMILIES: readonly ThemeFamily[] = ['arcade', 'fantasy', 'cyberpunk', 'lovecraft', 'minimal'];
const MINIMAL_MODES = [
  { theme: 'minimal', mode: 'automatic' },
  { theme: 'minimal-chiaro', mode: 'light' },
  { theme: 'minimal-scuro', mode: 'dark' },
] as const;
/** The missions of the preview: two of those recommended at the first launch. */
const SAMPLE_TEMPLATES = ['drink_water', 'read_pages'] as const;

const CARD_WIDTH_RATIO = 0.65;
const CARD_MIN_HEIGHT = 340;
const CARD_GAP = 12;
const EGG_SIZE = 64;
const DOT_SIZE = 8;

function familyOf(theme: ThemeSetting): ThemeFamily {
  return theme.startsWith('minimal') ? 'minimal' : (theme as ThemeFamily);
}

export interface ThemeCarouselProps {
  /** The `theme` setting. */
  readonly value: ThemeSetting;
  readonly onChange: (theme: ThemeSetting) => void;
  /** The name written in the previews. */
  readonly heroName: string;
}

/**
 * The cards of the themes, each a preview of Today (design-sezioni.md 1.4): the card in the centre
 * is the chosen theme. Minimal has its three chips under the card.
 */
export function ThemeCarousel({ value, onChange, heroName }: ThemeCarouselProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const family = familyOf(value);
  // Coming back to Minimal finds the chip chosen before.
  const [minimalMode, setMinimalMode] = useState<ThemeSetting>(
    family === 'minimal' ? value : 'minimal',
  );
  // While a tap brings a card to the centre, the cards it passes are not chosen.
  const pressedIndex = useRef<number | null>(null);

  const cardWidth = Math.round(width * CARD_WIDTH_RATIO);
  const interval = cardWidth + CARD_GAP;
  const [initialOffset] = useState({ x: FAMILIES.indexOf(family) * interval, y: 0 });

  const choose = (next: ThemeFamily) => {
    if (next !== family) {
      onChange(next === 'minimal' ? minimalMode : next);
    }
  };
  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.min(
      Math.max(Math.round(nativeEvent.contentOffset.x / interval), 0),
      FAMILIES.length - 1,
    );
    if (pressedIndex.current === null) {
      choose(FAMILIES[index]);
    } else if (pressedIndex.current === index) {
      pressedIndex.current = null;
    }
  };
  const onPressCard = (next: ThemeFamily) => {
    if (next === family) {
      return;
    }
    pressedIndex.current = FAMILIES.indexOf(next);
    scroll.current?.scrollTo({ x: pressedIndex.current * interval, animated: !reduceMotion });
    choose(next);
  };
  const chooseMode = (theme: ThemeSetting) => {
    setMinimalMode(theme);
    onChange(theme);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scroll}
        testID="theme-carousel"
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={interval}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          pressedIndex.current = null;
        }}
        contentOffset={initialOffset}
        accessibilityRole="radiogroup"
        contentContainerStyle={[
          styles.cards,
          { paddingHorizontal: (width - cardWidth) / 2, gap: CARD_GAP },
        ]}
      >
        {FAMILIES.map((item) => (
          <ThemeProvider key={item} theme={item === 'minimal' ? minimalMode : item}>
            <ThemeCard
              family={item}
              heroName={heroName}
              width={cardWidth}
              selected={item === family}
              onPress={() => onPressCard(item)}
            />
          </ThemeProvider>
        ))}
      </ScrollView>
      <View style={styles.caption}>
        <ThemedText variant="sectionTitle" style={styles.centered}>
          {t(`shared.themeCarousel.themes.${family}.name`)}
        </ThemedText>
        <ThemedText color={colors.textMuted} style={styles.centered}>
          {t(`shared.themeCarousel.themes.${family}.tone`)}
        </ThemedText>
      </View>
      <View
        style={styles.dots}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {FAMILIES.map((item) => (
          <View
            key={item}
            style={[
              styles.dot,
              { backgroundColor: item === family ? colors.primary : colors.track },
            ]}
          />
        ))}
      </View>
      {family === 'minimal' ? (
        <View style={styles.modes}>
          {MINIMAL_MODES.map(({ theme, mode }) => (
            <Chip
              key={mode}
              testID={`theme-mode-${mode}`}
              label={t(`shared.themeCarousel.modes.${mode}`)}
              selected={value === theme}
              onPress={() => chooseMode(theme)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface ThemeCardProps {
  readonly family: ThemeFamily;
  readonly heroName: string;
  readonly width: number;
  readonly selected: boolean;
  readonly onPress: () => void;
}

/** A preview drawn in its own theme: the screen reader reads only the description of the card. */
function ThemeCard({ family, heroName, width, selected, onPress }: ThemeCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const shape = SHAPES[family];
  return (
    <Pressable
      testID={`theme-card-${family}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={t(`shared.themeCarousel.themes.${family}.description`)}
      accessibilityState={{ selected }}
      style={[styles.card, { width }]}
    >
      <Frame
        shape={shape.card}
        fill={colors.background}
        stroke={selected ? colors.primary : colors.border}
      />
      <ThemedText variant="caption" color={colors.textMuted}>
        {t('nav.today')}
      </ThemedText>
      <ThemedText variant="sectionTitle">
        {t('shared.greeting', { context: family, name: heroName })}
      </ThemedText>
      <View style={styles.hero}>
        <Frame shape={shape.card} fill={colors.surface} stroke={colors.primary} />
        <CompanionSprite stage="egg" mood="normal" size={EGG_SIZE} />
      </View>
      {SAMPLE_TEMPLATES.map((key) => (
        <View key={key} style={styles.sample}>
          <Glyph>{emptyGlyph(family, colors.primary)}</Glyph>
          <ThemedText style={styles.sampleName}>{t(`templates.${key}.name`)}</ThemedText>
        </View>
      ))}
      <ThemedText variant="label" color={colors.primary} style={styles.cardFoot}>
        {t(`shared.themeCarousel.themes.${family}.name`)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  cards: { paddingVertical: 4 },
  card: { minHeight: CARD_MIN_HEIGHT, padding: 16, gap: 8 },
  hero: { height: 80, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  sample: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sampleName: { flexShrink: 1 },
  cardFoot: { marginTop: 'auto' },
  caption: { paddingHorizontal: 16, gap: 2 },
  centered: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 8 },
});
