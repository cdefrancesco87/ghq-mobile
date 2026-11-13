import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { StarterQuestView } from '@/db/repositories/todayView';
import { BossSprite } from '@/features/shared/BossSprite';
import { Card } from '@/features/shared/Card';
import { DoneMark, emptyGlyph, Glyph } from '@/features/shared/CompletionControl';
import { ThemedText } from '@/features/shared/ThemedText';
import { termInSentence } from '@/i18n/lexicon';
import { STARTER_QUEST_REWARD } from '@/rules/config';
import { useTheme } from '@/theme/ThemeProvider';

/** The small boss of the theme (design 1.7): 32×32 at 2×. */
const SPRITE_SIZE = 64;

export interface StarterQuestCardProps {
  readonly quest: StarterQuestView;
}

/**
 * The quest of the first launch in Today, in place of the bosses (design-sezioni.md 1.7, mockup
 * D06): the name of the theme, «1 di 3», the small boss of the theme (none in Minimal), the 3
 * steps and the reward. The steps are done by playing, not by touching them; the card opens the
 * sheet of the quest.
 */
export function StarterQuestCard({ quest }: StarterQuestCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const name = t('starter_quest.name', { context: family });
  const done = quest.steps.filter((step) => step.done).length;
  const total = quest.steps.length;
  const reward = t('today.starter.reward', {
    levelTerm: termInSentence(t('lexicon.level', { context: family }), i18n.language),
    level: STARTER_QUEST_REWARD.xpToLevel,
    coins: STARTER_QUEST_REWARD.coins,
    coinsTerm: termInSentence(t('lexicon.coins_pl', { context: family }), i18n.language),
  });

  return (
    <Card testID="today-starter">
      <Pressable
        testID="today-starter-open"
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${t('bosses.card.stepsSummary', { done, total })}`}
        accessibilityHint={t('bosses.card.openHint')}
        onPress={() => router.push({ pathname: '/boss/[id]', params: { id: quest.bossId } })}
        style={styles.head}
      >
        {family === 'minimal' ? null : <BossSprite kind="quest" size={SPRITE_SIZE} />}
        <ThemedText
          testID="today-starter-name"
          variant="sectionTitle"
          accessibilityRole="header"
          style={styles.flex}
        >
          {name}
        </ThemedText>
        <ThemedText testID="today-starter-count" variant="caption" color={colors.textMuted}>
          {t('today.progress', { done, total })}
        </ThemedText>
      </Pressable>
      <View style={styles.steps}>
        {quest.steps.map((step, index) => {
          const title = t(step.title);
          return (
            <View
              key={step.title}
              testID={`today-starter-step-${index}`}
              accessible
              accessibilityLabel={
                step.done
                  ? t('today.starter.stepDone', { step: title })
                  : t('bosses.sheet.todoLabel', { step: title })
              }
              style={styles.step}
            >
              {step.done ? (
                <DoneMark testID={`today-starter-step-${index}-done`} />
              ) : (
                <View style={styles.mark}>
                  <Glyph>{emptyGlyph(family, colors.textMuted)}</Glyph>
                </View>
              )}
              <ThemedText
                color={step.done ? colors.textMuted : colors.text}
                style={[styles.flex, step.done ? styles.struck : null]}
              >
                {title}
              </ThemedText>
            </View>
          );
        })}
      </View>
      <ThemedText testID="today-starter-reward" variant="caption" color={colors.textMuted}>
        {reward}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  flex: { flex: 1 },
  steps: { marginVertical: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  struck: { textDecorationLine: 'line-through' },
});
