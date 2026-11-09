import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
import { Chip } from '@/features/shared/Chip';
import { Glyph, doneGlyph, emptyGlyph } from '@/features/shared/CompletionControl';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { Difficulty } from '@/features/shared/Difficulty';
import { Icon } from '@/features/shared/Icon';
import { categoryIcon } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { useUndoToast } from '@/features/shared/UndoToast';
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
 * The templates of a category and, after them, those already chosen in the other categories, so
 * that the choices stay in sight (mockup D04). Frequency and difficulty change later (1.5).
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

  const visible = [
    ...MISSION_TEMPLATES.filter((template) => template.category === category),
    ...MISSION_TEMPLATES.filter(
      (template) => template.category !== category && selected.includes(template.key),
    ),
  ];
  const missionsWord = t('lexicon.missions_pl', {
    context: family === 'minimal' ? undefined : family,
  });

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
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {TEMPLATE_CATEGORIES.map((item) => (
          <Chip
            key={item}
            testID={`onboarding-category-${item}`}
            label={t(`templateCategories.${item}`)}
            icon={categoryIcon(item)}
            selected={item === category}
            onPress={() => setCategory(item)}
          />
        ))}
      </ScrollView>
      <Card style={styles.list}>
        {visible.map((template, index) => (
          <TemplateRow
            key={template.key}
            template={template}
            selected={selected.includes(template.key)}
            first={index === 0}
            onPress={() => toggle(template.key)}
          />
        ))}
      </Card>
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
  categories: { paddingHorizontal: 16, gap: 8 },
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
