import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  archiveBoss,
  markMissedDeadlineSeen,
  pendingMissedDeadlines,
  setBossDeadline,
  type MissedDeadline,
} from '@/db/repositories/boss';
import { gameDayOf, getSetting } from '@/db/repositories/settings';
import { DueDaySheet } from '@/features/editor/DueDaySheet';
import { BossSprite } from '@/features/shared/BossSprite';
import { Button } from '@/features/shared/Button';
import { Sheet, SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { useUndoToast } from '@/features/shared/UndoToast';
import { termInSentence } from '@/i18n/lexicon';
import type { GameDay } from '@/rules/types';
import { runAction } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useTheme } from '@/theme/ThemeProvider';
import { useBossTexts } from './bossTexts';

const SPRITE_SIZE = 64;

/**
 * The sheet of a missed deadline (analisi-funzionale.md US-BOSS-03; design-sezioni.md 5.6 ★;
 * mockup D24), at the first opening after the theft, once: the boss with its line in the tone of
 * the theme, the coins stolen, «I tuoi 5 passi restano», «Fissa una nuova scadenza» in evidence
 * and «Archivia l'obiettivo» as text. Closing it in any way marks it seen; the sheets of several
 * bosses come one after the other.
 */
export function MissedDeadlineSheet() {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const { nameOf } = useBossTexts();
  const toast = useUndoToast();
  const hero = useHeroStore((state) => state.hero);
  // The boss whose new deadline is being chosen, once its sheet has closed.
  const [choosing, setChoosing] = useState<{ bossId: string; today: GameDay } | null>(null);
  const [picker, setPicker] = useState(false);
  // Read again after every action, which reloads the hero.
  const missed = useMemo<MissedDeadline | null>(
    () => (hero === null ? null : (pendingMissedDeadlines(getSession().db)[0] ?? null)),
    [hero],
  );
  // The sheet keeps its content while it slides away after being marked seen.
  const [content, setContent] = useState<MissedDeadline | null>(missed);
  if (missed !== null && choosing === null && missed !== content) {
    setContent(missed);
  }

  const seen = (item: MissedDeadline, then?: (db: ReturnType<typeof getSession>['db']) => void) =>
    runAction((db, clock) => {
      markMissedDeadlineSeen(db, item.seq, clock.now);
      then?.(db);
    });

  const close = () => {
    if (missed !== null) {
      seen(missed);
    }
  };

  const newDeadline = () => {
    if (missed === null) {
      return;
    }
    const { db, clock } = getSession();
    const now = clock();
    const today = gameDayOf(now.now, now.tzOffset, getSetting(db, 'day_change'));
    setChoosing({ bossId: missed.boss.id, today });
    seen(missed);
    // The picker waits for the sheet to slide away (two modals at once fail on iOS).
    setTimeout(() => setPicker(true), SHEET_DURATION_MS);
  };

  const archive = () => {
    if (missed === null) {
      return;
    }
    const bossId = missed.boss.id;
    try {
      runAction((db, clock) => {
        markMissedDeadlineSeen(db, missed.seq, clock.now);
        archiveBoss(db, bossId, clock);
      });
    } catch {
      toast.show({ message: t('today.missions.errors.failed') });
      return;
    }
    toast.show({ message: t('bosses.sheet.archivedToast') });
  };

  const moveDeadline = (day: GameDay | null) => {
    setPicker(false);
    const target = choosing;
    setChoosing(null);
    if (target === null) {
      return;
    }
    try {
      runAction((db, clock) => setBossDeadline(db, target.bossId, day, clock));
    } catch {
      toast.show({ message: t('today.missions.errors.failed') });
      return;
    }
    toast.show({ message: t('bosses.sheet.deadlineToast') });
  };

  const name = content === null ? '' : nameOf(content.boss);
  const coins = content?.coins ?? 0;
  const coinsTerm = termInSentence(
    t(coins === 1 ? 'lexicon.coins' : 'lexicon.coins_pl', { context: family }),
    i18n.language,
  );

  return (
    <>
      <Sheet
        testID="missed-deadline"
        visible={missed !== null && choosing === null}
        onClose={close}
      >
        {content === null ? null : (
          <View style={styles.content}>
            <BossSprite
              kind={content.boss.kind === 'starter' ? 'quest' : content.boss.difficulty}
              size={SPRITE_SIZE}
            />
            <ThemedText variant="sectionTitle" accessibilityRole="header" style={styles.center}>
              {t('bosses.missed.title')}
            </ThemedText>
            <ThemedText color={colors.textMuted} style={styles.center}>
              {t('bosses.missed.expired', { name })}
            </ThemedText>
            <ThemedText testID="missed-deadline-taunt" style={styles.center}>
              {t('bosses.missed.taunt', { context: family, coins })}
            </ThemedText>
            <ThemedText
              testID="missed-deadline-coins"
              variant="numbers"
              color={colors.dangerText}
              style={styles.center}
            >
              {t('bosses.missed.coins', { coins, coinsTerm })}
            </ThemedText>
            <ThemedText testID="missed-deadline-steps" style={styles.center}>
              {t('bosses.missed.stepsKept', { count: content.stepsDone })}
            </ThemedText>
            <Button
              testID="missed-deadline-new"
              label={t('bosses.missed.newDeadline')}
              onPress={newDeadline}
              style={styles.wide}
            />
            <Button
              testID="missed-deadline-archive"
              variant="text"
              label={t('bosses.missed.archive')}
              onPress={archive}
            />
          </View>
        )}
      </Sheet>
      {choosing === null ? null : (
        <DueDaySheet
          visible={picker}
          value={null}
          today={choosing.today}
          onClose={() => {
            setPicker(false);
            setChoosing(null);
          }}
          onDone={moveDeadline}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 12, paddingBottom: 16 },
  center: { textAlign: 'center' },
  wide: { alignSelf: 'stretch' },
});
