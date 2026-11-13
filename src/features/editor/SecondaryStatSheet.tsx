import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/features/shared/Icon';
import { statIcon } from '@/features/shared/icons';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { STATS } from '@/rules/config';
import { STAT_KEYS, type StatKey } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { ChoiceButton } from './ChoiceButton';

const STAT_SIZE = 52;

export interface SecondaryStatSheetProps {
  readonly visible: boolean;
  readonly primary: StatKey | null;
  readonly value: StatKey | null;
  readonly onChoose: (stat: StatKey | null) => void;
  readonly onClose: () => void;
}

/**
 * «Statistica secondaria» (design-sezioni.md 4.4): the same row of buttons as the main stat, with
 * the main one disabled, «Nessuna» and the note on its share of the points. Without a main stat it
 * gets nothing, so every button is disabled until one is chosen.
 */
export function SecondaryStatSheet({
  visible,
  primary,
  value,
  onChoose,
  onClose,
}: SecondaryStatSheetProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const statName = (key: StatKey) => t(`stats.${key}`, { context: family });
  const total = STAT_KEYS.length + 1;

  return (
    <Sheet
      testID="editor-secondary"
      visible={visible}
      onClose={onClose}
      title={t('editor.statSecondary')}
    >
      <View style={styles.content}>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('editor.statSecondary')}
          style={styles.stats}
        >
          {STAT_KEYS.map((key, index) => (
            <ChoiceButton
              key={key}
              testID={`editor-secondary-${key}`}
              selected={key === value}
              disabled={primary === null || key === primary}
              onPress={() => onChoose(key)}
              accessibilityLabel={t('editor.statLabel', {
                stat: statName(key),
                position: index + 1,
                total,
              })}
              style={styles.stat}
            >
              {(color) => <Icon name={statIcon(key)} size={20} color={color} />}
            </ChoiceButton>
          ))}
          <ChoiceButton
            testID="editor-secondary-none"
            selected={value === null}
            onPress={() => onChoose(null)}
            accessibilityLabel={t('editor.statLabel', {
              stat: t('editor.noSecondary'),
              position: total,
              total,
            })}
          >
            {(color) => (
              <ThemedText variant="label" color={color}>
                {t('editor.noSecondary')}
              </ThemedText>
            )}
          </ChoiceButton>
        </View>
        <ThemedText testID="editor-secondary-note" variant="caption" color={colors.textMuted}>
          {primary === null
            ? t('editor.statSecondaryNeedsPrimary')
            : t('editor.statSecondaryNote', { percent: Math.round(STATS.secondaryShare * 100) })}
        </ThemedText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: STAT_SIZE, paddingHorizontal: 0 },
});
