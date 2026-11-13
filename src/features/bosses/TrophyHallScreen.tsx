import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Trophy } from '@/db/repositories/trophies';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';
import { Pedestal, TROPHY_SIZE, TrophyTile } from './TrophyTile';

const COLUMNS = 3;

export interface TrophyGridProps {
  readonly trophies: readonly Trophy[];
  readonly testID: string;
}

/** The trophies in rows of 3 (design-sezioni.md 5.7); a touch opens the detail of one. */
export function TrophyGrid({ trophies, testID }: TrophyGridProps) {
  const router = useRouter();
  const rows = Array.from({ length: Math.ceil(trophies.length / COLUMNS) }, (_, index) =>
    trophies.slice(index * COLUMNS, index * COLUMNS + COLUMNS),
  );
  return (
    <View testID={testID} style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((trophy) => (
            <TrophyTile
              key={trophy.boss.id}
              testID={`${testID}-${trophy.boss.id}`}
              trophy={trophy}
              onOpen={() => router.push({ pathname: '/boss/[id]', params: { id: trophy.boss.id } })}
            />
          ))}
          {/* The last row keeps the width of the columns. */}
          {Array.from({ length: COLUMNS - row.length }, (_, filler) => (
            <View key={`filler-${filler}`} style={styles.filler} />
          ))}
        </View>
      ))}
    </View>
  );
}

export interface TrophyHallScreenProps {
  readonly trophies: readonly Trophy[];
}

/**
 * La Sala dei trofei (analisi-funzionale.md US-BOSS-04; design-sezioni.md 5.7; mockup D25), named
 * in the lexicon of the theme: the defeated bosses from the most recent, in a grid of 3 columns;
 * empty, a pedestal and «Il primo trofeo ti aspetta».
 */
export function TrophyHallScreen({ trophies }: TrophyHallScreenProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  return (
    <View testID="trophies-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="trophies-header"
        title={t('lexicon.trophyHall', { context: family })}
        compact
        onBack={() => router.back()}
      />
      {trophies.length === 0 ? (
        <View testID="trophies-empty" style={styles.empty}>
          <Pedestal width={TROPHY_SIZE} />
          <ThemedText variant="label" style={styles.center}>
            {t('bosses.trophies.empty')}
          </ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <TrophyGrid testID="trophies-grid" trophies={trophies} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
  grid: { gap: 16 },
  row: { flexDirection: 'row', gap: 8 },
  filler: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  center: { textAlign: 'center' },
});
