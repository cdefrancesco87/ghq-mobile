import { desc } from 'drizzle-orm';
import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listTodayMissions, type Mission } from '@/db/repositories/missions';
import { gameDayOf, getSetting } from '@/db/repositories/settings';
import { events } from '@/db/schema';
import type { Db } from '@/db/types';
import { scheduleReminder } from '@/features/notifications/reminders';
import { requestNotificationPermission, systemScheduler } from '@/features/notifications/system';
import { useAppStore } from '@/stores/app';
import { useTheme } from '@/theme/ThemeProvider';

// Test screen of the prototype of the notifications (docs/prova-notifiche.md). It exists only in
// development builds and is in English, like the rest of the developer tools.

const DELAY_MS = 10_000;
const EVENTS_SHOWN = 15;

interface EventLine {
  readonly seq: number;
  readonly type: string;
  readonly source: string;
  readonly idemKey: string | null;
  readonly occurredAt: number;
}

const EMPTY: { missions: Mission[]; log: EventLine[] } = { missions: [], log: [] };

function read(db: Db) {
  const now = Date.now();
  const day = gameDayOf(now, -new Date(now).getTimezoneOffset(), getSetting(db, 'day_change'));
  const log: EventLine[] = db
    .select({
      seq: events.seq,
      type: events.type,
      source: events.source,
      idemKey: events.idemKey,
      occurredAt: events.occurredAt,
    })
    .from(events)
    .orderBy(desc(events.seq))
    .limit(EVENTS_SHOWN)
    .all();
  return { missions: listTodayMissions(db, day), log };
}

export default function NotificationsTest() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <NotificationsTestScreen />;
}

function NotificationsTestScreen() {
  const db = useAppStore((state) => state.db);
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('Ready.');
  // Changing the counter reads the missions and the events again.
  const [reads, setReads] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `reads` only forces a new read
  const { missions, log } = useMemo(() => (db === null ? EMPTY : read(db)), [db, reads]);
  const refresh = () => setReads((count) => count + 1);

  async function schedule() {
    if (db === null || selected === null) {
      return;
    }
    try {
      if (!(await requestNotificationPermission())) {
        setStatus('Notification permission denied.');
        return;
      }
      const now = Date.now();
      const osId = await scheduleReminder(db, systemScheduler, {
        missionId: selected,
        fireAt: now + DELAY_MS,
        now,
        tzOffset: -new Date(now).getTimezoneOffset(),
      });
      setStatus(`Scheduled ${osId} for ${new Date(now + DELAY_MS).toLocaleTimeString()}.`);
    } catch (error) {
      setStatus(`Error: ${String(error)}`);
    }
  }

  const button = [styles.button, { backgroundColor: colors.primary }];
  const buttonText = { color: colors.onPrimary };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Notifications prototype</Text>
      <Text style={{ color: colors.textMuted }}>Pick a mission of today:</Text>
      {missions.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>No mission due today.</Text>
      ) : null}
      {missions.map((mission) => (
        <Pressable
          key={mission.id}
          accessibilityRole="button"
          onPress={() => setSelected(mission.id)}
          style={[
            styles.row,
            { borderColor: mission.id === selected ? colors.primary : colors.border },
          ]}
        >
          <Text style={{ color: colors.text }}>{mission.name}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={schedule} style={button}>
        <Text style={buttonText}>Notify in 10 seconds</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={refresh} style={button}>
        <Text style={buttonText}>Refresh events</Text>
      </Pressable>
      <Text style={{ color: colors.text }}>{status}</Text>
      <View style={styles.log}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Last events</Text>
        {log.map((line) => (
          <Text key={line.seq} style={{ color: colors.textMuted }}>
            {`#${line.seq} ${line.type} · source: ${line.source}${
              line.idemKey === null ? '' : ` · ${line.idemKey}`
            }`}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  row: { borderWidth: 2, borderRadius: 8, padding: 12 },
  button: { borderRadius: 8, padding: 14, alignItems: 'center' },
  log: { gap: 4, marginTop: 8 },
});
