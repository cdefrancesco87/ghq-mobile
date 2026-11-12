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

import {
  MAX_TEMPLATES,
  MIN_TEMPLATES,
  MISSION_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type MissionTemplate,
  type TemplateCategory,
} from '@/content/templates';
import { announceOnIos } from '@/features/shared/announce';
import { Card } from '@/features/shared/Card';
import { CHIP_BADGE_OVERLAP, Chip } from '@/features/shared/Chip';
import { Glyph, doneGlyph, emptyGlyph } from '@/features/shared/CompletionControl';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { Difficulty } from '@/features/shared/Difficulty';
import { Icon } from '@/features/shared/Icon';
import { categoryIcon } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { useUndoToast } from '@/features/shared/UndoToast';
import { useReduceMotion } from '@/features/shared/useReduceMotion';
import { useTheme } from '@/theme/ThemeProvider';
import { OnboardingStep, StepButton } from './OnboardingStep';

const ROW_MIN_HEIGHT = 64;

export interface MissionsStepProps {
  readonly selected: readonly string[];
  readonly onChangeSelected: (keys: string[]) => void;
  readonly onBack: () => void;
  readonly onSkip: () => void;
  readonly onContinue: () => void;
}

/**
 * The templates of a category, with the number chosen in each one on its chip. A swipe on the list
 * goes to the next or the previous category. A choice stays in its own category, so that a template
 * never leaves the list when it is unchecked. Frequency and difficulty change later (1.5).
 */
export function MissionsStep({
  selected,
  onChangeSelected,
  onBack,
  onSkip,
  onContinue,
}: MissionsStepProps) {
  const { t, i18n } = useTranslation();
  const { family } = useTheme();
  const [category, setCategory] = useState<TemplateCategory>(TEMPLATE_CATEGORIES[0]);
  const toast = useUndoToast();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const pages = useRef<ComponentRef<typeof ScrollView>>(null);
  const chips = useRef<ComponentRef<typeof ScrollView>>(null);
  const chipLayouts = useRef<Partial<Record<TemplateCategory, { x: number; width: number }>>>({});
  const chipsWidth = useRef(0);
  // While a tap brings a category into view, the categories it passes are not opened.
  const pressedIndex = useRef<number | null>(null);

  // The chip of the open category stays in view, as near the centre as the row allows.
  const open = (next: TemplateCategory) => {
    setCategory(next);
    const chip = chipLayouts.current[next];
    if (chip !== undefined) {
      const centred = chip.x + chip.width / 2 - width / 2;
      const x = Math.min(Math.max(centred, 0), Math.max(chipsWidth.current - width, 0));
      chips.current?.scrollTo({ x, animated: !reduceMotion });
    }
  };
  const onSwipe = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.min(
      Math.max(Math.round(nativeEvent.contentOffset.x / width), 0),
      TEMPLATE_CATEGORIES.length - 1,
    );
    if (pressedIndex.current === index) {
      pressedIndex.current = null;
    } else if (pressedIndex.current === null && TEMPLATE_CATEGORIES[index] !== category) {
      open(TEMPLATE_CATEGORIES[index]);
    }
  };
  const onPressCategory = (next: TemplateCategory) => {
    if (next === category) {
      return;
    }
    pressedIndex.current = TEMPLATE_CATEGORIES.indexOf(next);
    pages.current?.scrollTo({ x: pressedIndex.current * width, animated: !reduceMotion });
    open(next);
  };

  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChangeSelected(selected.filter((item) => item !== key));
    } else if (selected.length >= MAX_TEMPLATES) {
      const message = t('onboarding.missions.limit', { max: MAX_TEMPLATES });
      toast.show({ message });
      announceOnIos(message);
    } else {
      onChangeSelected([...selected, key]);
    }
  };

  const missionsWord = t('lexicon.missions_pl', { context: family });

  return (
    <OnboardingStep
      name="missions"
      title={t('onboarding.missions.title', {
        min: MIN_TEMPLATES,
        max: MAX_TEMPLATES,
        // German writes its nouns with a capital letter.
        missions: i18n.language === 'de' ? missionsWord : missionsWord.toLowerCase(),
      })}
      titleAlign="left"
      onBack={onBack}
      onSkip={onSkip}
      footer={
        <StepButton
          testID="onboarding-continue"
          label={t('onboarding.missions.continue', {
            count: selected.length,
            max: MAX_TEMPLATES,
          })}
          onPress={onContinue}
          disabled={selected.length < MIN_TEMPLATES}
          disabledReason={t('onboarding.missions.disabledReason')}
        />
      }
    >
      <ScrollView
        ref={chips}
        testID="onboarding-categories"
        horizontal
        onContentSizeChange={(contentWidth) => {
          chipsWidth.current = contentWidth;
        }}
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesList}
        contentContainerStyle={styles.categories}
      >
        {TEMPLATE_CATEGORIES.map((item) => {
          const label = t(`templateCategories.${item}`);
          const count = MISSION_TEMPLATES.filter(
            (template) => template.category === item && selected.includes(template.key),
          ).length;
          return (
            <View
              key={item}
              onLayout={({ nativeEvent }) => {
                chipLayouts.current[item] = nativeEvent.layout;
              }}
            >
              <Chip
                testID={`onboarding-category-${item}`}
                label={label}
                accessibilityLabel={
                  count === 0
                    ? undefined
                    : t('onboarding.missions.categoryLabel', { name: label, count })
                }
                icon={categoryIcon(item)}
                selected={item === category}
                badge={count}
                onPress={() => onPressCategory(item)}
              />
            </View>
          );
        })}
      </ScrollView>
      <ScrollView
        ref={pages}
        testID="onboarding-template-pages"
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onSwipe}
        onScrollBeginDrag={() => {
          pressedIndex.current = null;
        }}
      >
        {TEMPLATE_CATEGORIES.map((item) => (
          <View
            key={item}
            // The screen reader stays on the open category and changes it from the chips.
            accessibilityElementsHidden={item !== category}
            importantForAccessibility={item === category ? 'auto' : 'no-hide-descendants'}
            style={{ width }}
          >
            <Card style={styles.list}>
              {MISSION_TEMPLATES.filter((template) => template.category === item).map(
                (template, index) => (
                  <TemplateRow
                    key={template.key}
                    template={template}
                    selected={selected.includes(template.key)}
                    first={index === 0}
                    onPress={() => toggle(template.key)}
                  />
                ),
              )}
            </Card>
          </View>
        ))}
      </ScrollView>
    </OnboardingStep>
  );
}

interface TemplateRowProps {
  readonly template: MissionTemplate;
  readonly selected: boolean;
  readonly first: boolean;
  readonly onPress: () => void;
}

function TemplateRow({ template, selected, first, onPress }: TemplateRowProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const name = t(`templates.${template.key}.name`);
  const frequency = describeFrequency(template.frequency, t);
  return (
    <Pressable
      testID={`onboarding-template-${template.key}`}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={t('onboarding.missions.templateLabel', {
        name,
        frequency,
        difficulty: t(`shared.difficulty.${template.difficulty}`),
      })}
      accessibilityState={{ checked: selected }}
      style={[styles.row, first ? null : { borderTopWidth: 1, borderTopColor: colors.border }]}
    >
      <Icon name={categoryIcon(template.category)} size={20} color={colors.textMuted} />
      <View style={styles.texts}>
        <ThemedText>{name}</ThemedText>
        <View style={styles.meta}>
          <ThemedText variant="caption" color={colors.textMuted}>
            {frequency}
          </ThemedText>
          <Difficulty difficulty={template.difficulty} showWord={false} />
        </View>
      </View>
      <Glyph>{selected ? doneGlyph(family, colors) : emptyGlyph(family, colors.textMuted)}</Glyph>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The list clips what comes out of it: the room for the numbers does not move the chips.
  categoriesList: { marginTop: -CHIP_BADGE_OVERLAP },
  categories: { paddingHorizontal: 16, paddingTop: CHIP_BADGE_OVERLAP, gap: 8 },
  list: { marginHorizontal: 16, paddingVertical: 0 },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  texts: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
});
