import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { GoalsView } from '@/db/repositories/goalsView';
import { ActionSheet } from '@/features/shared/ActionSheet';
import { Button } from '@/features/shared/Button';
import { Icon } from '@/features/shared/Icon';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useUndoToast } from '@/features/shared/UndoToast';
import { useMissionActions } from '@/features/today/useMissionActions';
import { BOSS } from '@/rules/config';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { BossCard } from './BossCard';
import { useBossStep } from './useBossStep';

const SLOT_HEIGHT = 88;

export interface GoalsScreenProps {
  readonly view: GoalsView;
}

/**
 * Obiettivi (design-sezioni.md 5.1, 5.9, 5.11; mockups B3a, D22): the name of the theme with
 * «2 di 3 attivi», «Nuovo» and «Altro» with the archived goals; the large cards of the active
 * bosses with the next step; the free places up to 3 as dashed cards, or the note of the limit.
 * A touch on a card opens the card of the boss. The Hall of trophies comes with T65.
 */
export function GoalsScreen({ view }: GoalsScreenProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const toast = useUndoToast();
  const actions = useMissionActions();
  const step = useBossStep(actions.completeStep, view);
  const [menu, setMenu] = useState(false);
  const { active, archived } = view;
  const free = Math.max(BOSS.maxActive - active.length, 0);
  const shape = SHAPES[family].card;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;

  // With 3 bosses «Nuovo» stays and explains the limit (5.1).
  const openEditor = () =>
    free === 0
      ? toast.show({ message: t('goals.full', { context: family, max: BOSS.maxActive }) })
      : router.push('/goal-editor');

  return (
    <View testID="goals-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="goals-header"
        title={t('lexicon.boss_pl', { context: family })}
        caption={t('goals.active', { count: active.length, max: BOSS.maxActive })}
        actions={
          <>
            <Button
              testID="goals-new"
              label={t('goals.new')}
              accessibilityLabel={t('goals.newLabel')}
              onPress={openEditor}
            />
            <Pressable
              testID="goals-more"
              accessibilityRole="button"
              accessibilityLabel={t('goals.more')}
              onPress={() => setMenu(true)}
              style={styles.more}
            >
              <Icon name="altro" color={colors.text} />
            </Pressable>
          </>
        }
      />
      <ScrollView testID="goals-scroll" contentContainerStyle={styles.content}>
        {active.map((item) => (
          <BossCard
            key={item.boss.id}
            testID={`goals-boss-${item.boss.id}`}
            variant="large"
            item={item}
            day={view.day}
            hit={step.hitOf(item.boss.id)}
            onCompleteStep={() => step.completeStep(item)}
            onOpen={() => router.push({ pathname: '/boss/[id]', params: { id: item.boss.id } })}
          />
        ))}
        {Array.from({ length: free }, (_, index) => (
          <Pressable
            key={index}
            testID={`goals-slot-${index}`}
            accessibilityRole="button"
            accessibilityLabel={t('goals.newLabel')}
            onPress={openEditor}
            style={[styles.slot, { borderColor: colors.textMuted, borderRadius: radius }]}
          >
            <Icon name="aggiungi" size={20} color={colors.primary} />
            <ThemedText variant="label" color={colors.primary}>
              {t('goals.newGoal')}
            </ThemedText>
          </Pressable>
        ))}
        {free === 0 ? (
          <View
            testID="goals-full"
            style={[styles.slot, { borderColor: colors.border, borderRadius: radius }]}
          >
            <ThemedText color={colors.textMuted} style={styles.center}>
              {t('goals.full', { context: family, max: BOSS.maxActive })}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
      <ActionSheet
        testID="goals-menu"
        visible={menu}
        onClose={() => setMenu(false)}
        items={[
          {
            key: 'archived',
            label: t('goals.archivedCount', { count: archived.length }),
            icon: <Icon name="archivio" size={20} color={colors.text} />,
            onPress: () => router.push('/goals-archived'),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingBottom: 120 },
  more: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  slot: {
    minHeight: SLOT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  center: { textAlign: 'center' },
});
