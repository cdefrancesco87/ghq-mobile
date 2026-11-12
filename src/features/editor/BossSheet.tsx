import { Fragment, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { listActiveBosses } from '@/db/repositories/boss';
import { useBossTexts } from '@/features/bosses/bossTexts';
import { BossSprite } from '@/features/shared/BossSprite';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { getSession } from '@/stores/session';
import { useTheme } from '@/theme/ThemeProvider';

const SPRITE_SIZE = 40;

export interface BossSheetProps {
  readonly visible: boolean;
  readonly value: string | null;
  readonly onChoose: (bossId: string | null) => void;
  readonly onCreateGoal: () => void;
  readonly onClose: () => void;
}

/**
 * «Boss collegato» (design-sezioni.md 4.9, mockup D15): the active bosses with sprite and health,
 * and «Nessuno». A mission hits one boss at a time (US-EDT-05). Without active bosses, the way to
 * Obiettivi.
 */
export function BossSheet({ visible, value, onChoose, onCreateGoal, onClose }: BossSheetProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const { nameOf } = useBossTexts();
  const bosses = useMemo(() => (visible ? listActiveBosses(getSession().db) : []), [visible]);

  const row = (key: string, selected: boolean, onPress: () => void, content: ReactNode) => (
    <Pressable
      testID={`editor-boss-${key}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={styles.row}
    >
      {content}
      {selected ? <Icon name="completa" size={20} color={colors.primary} /> : null}
    </Pressable>
  );

  return (
    <Sheet
      testID="editor-boss"
      visible={visible}
      onClose={onClose}
      title={t('editor.linkedBoss', { context: family })}
    >
      <View style={styles.content}>
        {bosses.length === 0 ? (
          <Pressable
            testID="editor-boss-create"
            accessibilityRole="button"
            onPress={onCreateGoal}
            style={styles.row}
          >
            <ThemedText style={styles.flex}>{t('editor.noBoss', { context: family })}</ThemedText>
            <Icon name="avanti" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Card style={styles.list}>
            {bosses.map((item) => (
              <Fragment key={item.id}>
                {row(
                  item.id,
                  item.id === value,
                  () => onChoose(item.id),
                  <>
                    <BossSprite
                      kind={item.kind === 'starter' ? 'quest' : item.difficulty}
                      size={SPRITE_SIZE}
                    />
                    <View style={styles.flex}>
                      <ThemedText>{nameOf(item)}</ThemedText>
                      <ThemedText variant="caption" color={colors.textMuted}>
                        {t('editor.bossHp', { hp: item.hp, max: item.hpMax })}
                      </ThemedText>
                    </View>
                  </>,
                )}
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              </Fragment>
            ))}
            {row(
              'none',
              value === null,
              () => onChoose(null),
              <ThemedText style={styles.flex}>{t('editor.none')}</ThemedText>,
            )}
          </Card>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  list: { paddingVertical: 0 },
  row: { minHeight: MIN_TOUCH + 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
});
