import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { BadgeItem, BadgesView } from '@/db/repositories/badges';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { BadgeSheet } from './BadgeSheet';
import { BadgeTile } from './BadgeTile';

const COLUMNS = 3;

export interface BadgeGridProps {
  readonly items: readonly BadgeItem[];
  readonly onOpen: (item: BadgeItem) => void;
  readonly testID: string;
}

/** Badges in rows of 3 (design-sezioni.md 9.6); the last row keeps the width of the columns. */
export function BadgeGrid({ items, onOpen, testID }: BadgeGridProps) {
  const rows = Array.from({ length: Math.ceil(items.length / COLUMNS) }, (_, index) =>
    items.slice(index * COLUMNS, index * COLUMNS + COLUMNS),
  );
  return (
    <View testID={testID} style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((item) => (
            <BadgeTile
              key={item.badge.key}
              testID={`${testID}-${item.badge.key}`}
              item={item}
              onOpen={() => onOpen(item)}
            />
          ))}
          {Array.from({ length: COLUMNS - row.length }, (_, filler) => (
            <View key={`filler-${filler}`} style={styles.filler} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Opens the detail of a badge in a sheet; the badge stays while the sheet slides away. */
export function useBadgeSheet() {
  const [item, setItem] = useState<BadgeItem | null>(null);
  const [open, setOpen] = useState(false);
  return {
    open: (badge: BadgeItem) => {
      setItem(badge);
      setOpen(true);
    },
    sheet: <BadgeSheet visible={open} item={item} onClose={() => setOpen(false)} />,
  };
}

export interface BadgesScreenProps {
  readonly view: BadgesView;
}

/**
 * Every badge (analisi-funzionale.md US-PROF-02; design-sezioni.md 9.6; mockup D34A): «Badge · 4
 * di 9» in the header, a grid of 3 columns in the order of the content; a touch opens the detail.
 */
export function BadgesScreen({ view }: BadgesScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { open, sheet } = useBadgeSheet();
  return (
    <View testID="badges-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="badges-header"
        title={t('badges.counter', { unlocked: view.unlocked, total: view.total })}
        compact
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <BadgeGrid testID="badges-grid" items={view.badges} onOpen={open} />
      </ScrollView>
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  grid: { gap: 16 },
  row: { flexDirection: 'row', gap: 8 },
  filler: { flex: 1 },
});
