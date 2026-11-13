import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  MISSION_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type MissionTemplate,
  type TemplateCategory,
} from '@/content/templates';
import { Card } from '@/features/shared/Card';
import { Chip } from '@/features/shared/Chip';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { Difficulty } from '@/features/shared/Difficulty';
import { Frame } from '@/features/shared/Frame';
import { Icon } from '@/features/shared/Icon';
import { categoryIcon, statIcon } from '@/features/shared/icons';
import { searchable } from '@/features/shared/searchable';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';

const FIELD_HEIGHT = 48;
const ROW_MIN_HEIGHT = 64;

export interface TemplateLibraryProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  /** The template and its name in the language of the app. */
  readonly onChoose: (template: MissionTemplate, name: string) => void;
}

/**
 * «Usa un modello» (design-sezioni.md 4.11, mockup D17): the library at full height, with the
 * search at the top, the 4 categories and the cards of the templates. While something is typed the
 * search looks in every category, and the chips are not selected; a chip clears the search.
 */
export function TemplateLibrary({ visible, onClose, onChoose }: TemplateLibraryProps) {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  const [category, setCategory] = useState<TemplateCategory>(TEMPLATE_CATEGORIES[0]);
  const [query, setQuery] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setQuery('');
  }

  const needle = searchable(query.trim());
  const nameOf = (template: MissionTemplate) => t(`templates.${template.key}.name`);
  const shown = MISSION_TEMPLATES.filter((template) =>
    needle === '' ? template.category === category : searchable(nameOf(template)).includes(needle),
  );

  return (
    <Sheet
      testID="editor-library"
      visible={visible}
      onClose={onClose}
      size="full"
      title={t('editor.library.title')}
    >
      <View style={styles.content}>
        <View style={styles.search}>
          <Frame shape={SHAPES[family].control} fill={colors.surface} stroke={colors.textMuted} />
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="cerca" size={20} color={colors.textMuted} />
          </View>
          <TextInput
            testID="editor-library-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t('editor.library.search')}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('editor.library.search')}
            style={[styles.input, textStyleOf(typography.body), { color: colors.text }]}
          />
          {query === '' ? null : (
            <Pressable
              testID="editor-library-search-clear"
              accessibilityRole="button"
              accessibilityLabel={t('editor.library.clear')}
              onPress={() => setQuery('')}
              style={styles.clear}
            >
              <Icon name="chiudi" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <View style={styles.chips}>
          {TEMPLATE_CATEGORIES.map((item) => (
            <Chip
              key={item}
              testID={`editor-library-category-${item}`}
              label={t(`templateCategories.${item}`)}
              icon={categoryIcon(item)}
              selected={needle === '' && item === category}
              onPress={() => {
                setQuery('');
                setCategory(item);
              }}
            />
          ))}
        </View>
        {shown.length === 0 ? (
          <ThemedText testID="editor-library-empty" color={colors.textMuted} style={styles.center}>
            {t('editor.library.noResults')}
          </ThemedText>
        ) : (
          <Card testID="editor-library-list" style={styles.list}>
            {shown.map((template, index) => (
              <TemplateCard
                key={template.key}
                template={template}
                name={nameOf(template)}
                first={index === 0}
                onPress={() => onChoose(template, nameOf(template))}
              />
            ))}
          </Card>
        )}
      </View>
    </Sheet>
  );
}

interface TemplateCardProps {
  readonly template: MissionTemplate;
  readonly name: string;
  readonly first: boolean;
  readonly onPress: () => void;
}

/** Icon, name, frequency, difficulty and stat of a template (4.11). */
function TemplateCard({ template, name, first, onPress }: TemplateCardProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const frequency = describeFrequency(template.frequency, t);
  const stat = t(`stats.${template.stat}`, { context: family });
  return (
    <Pressable
      testID={`editor-library-template-${template.key}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('editor.library.templateLabel', {
        name,
        frequency,
        difficulty: t(`shared.difficulty.${template.difficulty}`),
        stat,
      })}
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
          <Icon name={statIcon(template.stat)} size={16} color={colors.textMuted} />
        </View>
      </View>
      <Icon name="avanti" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  search: {
    minHeight: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  input: { flex: 1, minHeight: FIELD_HEIGHT },
  clear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  center: { textAlign: 'center' },
  list: { paddingVertical: 0 },
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
