import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { TEMPLATE_CATEGORIES } from '@/content/templates';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { categoryIcon, MISSION_ICONS, type IconName } from '@/features/shared/icons';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';
import { ChoiceButton } from './ChoiceButton';

const ICON_SIZE = 52;

export interface CategoryChoice {
  readonly category: string | null;
  /** Null follows the icon of the category. */
  readonly iconKey: string | null;
}

export interface CategorySheetProps {
  readonly visible: boolean;
  readonly value: CategoryChoice;
  readonly onDone: (choice: CategoryChoice) => void;
  readonly onClose: () => void;
}

/** The icon shown for a choice: the chosen one, or that of the category (design-sezioni.md 4.9). */
export function shownIcon({ category, iconKey }: CategoryChoice): IconName {
  return (MISSION_ICONS as readonly string[]).includes(iconKey ?? '')
    ? (iconKey as IconName)
    : categoryIcon(category);
}

/** A category known to the app; a key it does not know reads as «Nessuna». */
export function knownCategory(category: string | null): string | null {
  return (TEMPLATE_CATEGORIES as readonly (string | null)[]).includes(category) ? category : null;
}

/**
 * «Categoria e icona» (design-sezioni.md 4.9): Salute, Mente, Lavoro e studio, Casa, Nessuna, then
 * the grid of the icons. The default icon is that of the category: choosing it again keeps the
 * mission following its category.
 */
export function CategorySheet({ visible, value, onDone, onClose }: CategorySheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [choice, setChoice] = useState(value);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setChoice(value);
  }
  const icon = shownIcon(choice);
  const categories: readonly (string | null)[] = [...TEMPLATE_CATEGORIES, null];
  const selectedCategory = knownCategory(choice.category);

  const chooseIcon = (name: IconName) =>
    setChoice((current) => ({
      ...current,
      iconKey: name === categoryIcon(current.category) ? null : name,
    }));

  return (
    <Sheet
      testID="editor-category"
      visible={visible}
      onClose={onClose}
      size="full"
      title={t('editor.category')}
    >
      <View style={styles.content}>
        <ThemedText variant="label" color={colors.textMuted}>
          {t('editor.categoryTitle')}
        </ThemedText>
        <Card style={styles.list}>
          {categories.map((key, index) => {
            const selected = key === selectedCategory;
            return (
              <Fragment key={key ?? 'none'}>
                {index > 0 ? (
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                ) : null}
                <Pressable
                  testID={`editor-category-${key ?? 'none'}`}
                  onPress={() => setChoice((current) => ({ ...current, category: key }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={styles.row}
                >
                  <Icon name={categoryIcon(key)} size={20} color={colors.textMuted} />
                  <ThemedText style={styles.flex}>
                    {key === null ? t('editor.noCategory') : t(`templateCategories.${key}`)}
                  </ThemedText>
                  {selected ? <Icon name="completa" size={20} color={colors.primary} /> : null}
                </Pressable>
              </Fragment>
            );
          })}
        </Card>
        <ThemedText variant="label" color={colors.textMuted}>
          {t('editor.icon')}
        </ThemedText>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('editor.icon')}
          style={styles.grid}
        >
          {MISSION_ICONS.map((name) => (
            <ChoiceButton
              key={name}
              testID={`editor-icon-${name}`}
              selected={name === icon}
              onPress={() => chooseIcon(name)}
              accessibilityLabel={t(`editor.icons.${name}`)}
              style={styles.icon}
            >
              {(color) => <Icon name={name} size={20} color={color} />}
            </ChoiceButton>
          ))}
        </View>
        <Button
          testID="editor-category-done"
          label={t('editor.done')}
          onPress={() => onDone(choice)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  list: { paddingVertical: 0 },
  row: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  icon: { width: ICON_SIZE, paddingHorizontal: 0 },
});
