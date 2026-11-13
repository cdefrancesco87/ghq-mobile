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
import { useEssential } from '@/features/shared/useGameMode';
import { useMissionActions } from '@/features/today/useMissionActions';
import { orderChains } from '@/rules/chain';
import { BOSS } from '@/rules/config';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { BossCard } from './BossCard';
import { useBossTexts } from './bossTexts';
import { TrophyGrid } from './TrophyHallScreen';
import { useBossStep } from './useBossStep';

const SLOT_HEIGHT = 88;
/** The line that joins the bosses of a chain (design 5.8), under the middle of the sprite. */
const CHAIN_LINE = { width: 2, height: 16, left: 16 + 48 - 1 } as const;
/** The preview of the Hall of trophies under the bosses (design-sezioni.md 5.1 ★). */
const TROPHY_PREVIEW = 3;

export interface GoalsScreenProps {
  readonly view: GoalsView;
}

/**
 * Obiettivi (design-sezioni.md 5.1, 5.9, 5.11; mockups B3a, D22): the name of the theme with
 * «2 di 3 attivi», «Nuovo» and «Altro» with the archived goals; the large cards of the active
 * bosses with the next step; the free places up to 3 as dashed cards, or the note of the limit.
 * A touch on a card opens the card of the boss. The Main Quest has a crown; the bosses of a chain
 * are joined by a line, the locked ones with a padlock under the boss they wait for (5.8, T83).
 * Under the bosses, once there is one, the preview of the Hall of trophies with the last 3 and
 * «Vedi tutti». In the Essential mode a list of goals divided in steps, without the Hall of
 * trophies (5.10, 9.9).
 */
export function GoalsScreen({ view }: GoalsScreenProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const toast = useUndoToast();
  const actions = useMissionActions();
  const step = useBossStep(actions.completeStep, view);
  const [menu, setMenu] = useState(false);
  const essential = useEssential();
  const { nameOf } = useBossTexts();
  const { active, archived, trophies } = view;
  // The bosses of a chain one under the other, the locked ones after the boss they wait for (5.8).
  const all = [...active, ...view.locked];
  const ordered = orderChains(
    all.map((item) => ({ ...item, id: item.boss.id, chainPrevId: item.boss.chainPrevId })),
  );
  const lockedAfter = (chainPrevId: string | null) => {
    const previous = all.find((item) => item.boss.id === chainPrevId);
    return previous === undefined ? '' : nameOf(previous.boss);
  };
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
        title={essential ? t('essential.goals') : t('lexicon.boss_pl', { context: family })}
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
        {ordered.map((item, index) => {
          const chained = index > 0 && item.chainPrevId === ordered[index - 1].id;
          return (
            <View key={item.id} style={chained ? styles.chained : undefined}>
              {chained ? (
                <View
                  testID={`goals-chain-line-${item.id}`}
                  style={[styles.chainLine, { backgroundColor: colors.textMuted }]}
                />
              ) : null}
              <BossCard
                testID={`goals-boss-${item.id}`}
                variant="large"
                item={item}
                day={view.day}
                crowned={item.boss.isMain}
                lockedAfter={item.boss.status === 'locked' ? lockedAfter(item.chainPrevId) : null}
                hit={step.hitOf(item.id)}
                onCompleteStep={() => step.completeStep(item)}
                onOpen={() => router.push({ pathname: '/boss/[id]', params: { id: item.id } })}
              />
            </View>
          );
        })}
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
        {trophies.length === 0 || essential ? null : (
          <View testID="goals-trophies" style={styles.trophies}>
            <View style={styles.trophiesHeader}>
              <ThemedText variant="sectionTitle" accessibilityRole="header" style={styles.flex}>
                {t('lexicon.trophyHall', { context: family })}
              </ThemedText>
              <Pressable
                testID="goals-trophies-all"
                accessibilityRole="button"
                onPress={() => router.push('/trophies')}
                style={styles.seeAll}
              >
                <ThemedText variant="label" color={colors.primary}>
                  {t('bosses.trophies.seeAll')}
                </ThemedText>
              </Pressable>
            </View>
            <TrophyGrid testID="goals-trophy" trophies={trophies.slice(0, TROPHY_PREVIEW)} />
          </View>
        )}
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
  // The line takes the place of the gap between two bosses of a chain.
  chained: { marginTop: -16 },
  chainLine: { width: CHAIN_LINE.width, height: CHAIN_LINE.height, marginLeft: CHAIN_LINE.left },
  flex: { flex: 1 },
  trophies: { gap: 8, paddingTop: 8 },
  trophiesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seeAll: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 8 },
});
