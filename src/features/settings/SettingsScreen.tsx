import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { exportCsv } from '@/db/repositories/exportCsv';
import { setDayChange, setSetting, setWeekRules } from '@/db/repositories/settings';
import { cloudProviderOf } from '@/features/backup/cloudStore';
import { backupWhen, CLOUD_NAMES } from '@/features/backup/format';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { formatClock } from '@/features/shared/formatClock';
import { Frame } from '@/features/shared/Frame';
import { Icon } from '@/features/shared/Icon';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { searchable } from '@/features/shared/searchable';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { LANGUAGE_NAMES, type Language } from '@/i18n';
import type { Weekday } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { runAction } from '@/stores/app';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';
import { ChoiceSheet } from './ChoiceSheet';
import { GameModeSheet } from './GameModeSheet';
import { GeneralPauseSheet } from './GeneralPauseSheet';
import { DAY_CHANGE_TIMES, dayAndMonth, quietTimes, restDaysText, weekdayName } from './format';
import { RestDaysSheet } from './RestDaysSheet';
import { csvFileName, shareCsv } from './shareCsv';
import { SettingsRow } from './SettingsRow';
import { TimeSheet } from './TimeSheet';
import { useNotificationPermission, useSettingsView } from './useSettingsView';

const GROUPS = [
  'appearance',
  'game',
  'day',
  'notifications',
  'accessibility',
  'data',
  'about',
] as const;
type Group = (typeof GROUPS)[number];
type OpenSheet =
  | 'language'
  | 'dayChange'
  | 'weekStart'
  | 'restDays'
  | 'eveningTime'
  | 'weeklyDay'
  | 'weeklyTime'
  | 'privacy'
  | 'licenses'
  | 'gameMode'
  | 'reduceMotion'
  | 'pause'
  | null;

const FIELD_HEIGHT = 48;
const LANGUAGES = Object.keys(LANGUAGE_NAMES) as Language[];
const WEEK_STARTS: readonly Weekday[] = [1, 7];
const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const REDUCE_MOTION = ['system', 'on', 'off'] as const;

interface RowSpec {
  readonly key: string;
  readonly group: Group;
  /** The words the search looks in: the name of the row. */
  readonly label: string;
  /** More words that find the row: what its page holds. */
  readonly keywords?: readonly string[];
  readonly render: (last: boolean) => ReactElement;
}

/**
 * Impostazioni (analisi-funzionale.md section 10; design-sezioni.md 10.1–10.3, 10.5, 10.6, 10.9,
 * 10.10, 10.12; mockups D36): one page in groups (Aspetto, Giornata, Notifiche, Dati, Informazioni)
 * with a search that filters the rows while typing. Theme and «Non disturbare» open their page;
 * language, day and times open a sheet. The changes of the group Giornata count from tomorrow and
 * the row says so («Dal 7 novembre»). Every change that touches the reminders goes through
 * `runAction`, which schedules them again. The row Backup says where and when the last backup was
 * made and opens «Backup e ripristino», which also holds «Elimina tutti i dati» (mockups D38, D39);
 * the search finds it there too. The last row of Giornata is «Pausa generale» (10.5), with its
 * sheet. Gioco holds «Livello di gioco», Completo or Essenziale, changed
 * through a sheet that says what goes away (10.4, 10.11; mockup D37A). Accessibilità (10.7) holds
 * «Riduci movimento» (Come il telefono, Sì, No, read by `useReduceMotion`) and «Vibrazioni» (read by
 * the celebrations). «Colori per daltonici» (10.2) sits in Aspetto under the theme; Accessibilità
 * repeats the same switch for who looks for it there (10.7). Dati ends with «Esporta in CSV» (10.8),
 * which writes missions and log and opens the share sheet of the system.
 */
export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, family, typography } = useTheme();
  const router = useRouter();
  const { settings, theme, day, pause, todayPause } = useSettingsView();
  const { permission, ask } = useNotificationPermission();
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const language = i18n.language;

  const from = (fromDay: GameDay) => t('settings.from', { date: dayAndMonth(fromDay, language) });
  const close = () => setSheet(null);

  // Giornata: what counts today, and the change waiting for tomorrow.
  const dayChange = day.next.dayChange?.value ?? day.dayChange;
  const nextWeek = day.next.weekRules;
  const weekStart = nextWeek?.weekStart ?? day.weekRules.weekStart;
  const restDays = nextWeek?.restDays ?? day.weekRules.restDays;
  const sameDays = (a: readonly Weekday[], b: readonly Weekday[]) =>
    a.length === b.length && a.every((item) => b.includes(item));
  const restDaysValue =
    restDays.length === 0
      ? t('settings.restDaysNone')
      : restDaysText(restDays, weekStart, language);

  // Pausa generale: «No», «Fino al 20 nov», «Senza data», or «Dal 20 nov» before it starts.
  const pauseValue =
    pause === null
      ? t('pause.value.none')
      : pause.fromDay > day.today
        ? t('pause.value.from', { date: dayAndMonth(pause.fromDay, language, true) })
        : pause.untilDay === null
          ? t('pause.value.open')
          : t('pause.value.until', { date: dayAndMonth(pause.untilDay, language, true) });
  const pauseLabel =
    pause === null
      ? pauseValue
      : pause.fromDay > day.today
        ? t('pause.value.from', { date: dayAndMonth(pause.fromDay, language) })
        : pause.untilDay === null
          ? pauseValue
          : t('pause.value.until', { date: dayAndMonth(pause.untilDay, language) });

  const themeFamily = theme.startsWith('minimal') ? 'minimal' : theme;
  const themeMode =
    theme === 'minimal-chiaro' ? 'light' : theme === 'minimal-scuro' ? 'dark' : 'automatic';
  const themeValue =
    themeFamily === 'minimal'
      ? `${t('shared.themeCarousel.themes.minimal.name')} · ${t(`shared.themeCarousel.modes.${themeMode}`)}`
      : t(`shared.themeCarousel.themes.${themeFamily}.name`);

  const quiet = settings.quiet_hours.map((interval) => quietTimes(interval, language));
  const evening = settings.evening_summary;
  const weekly = settings.weekly_recap;

  const chooseLanguage = (next: Language) => {
    useSettingsStore.getState().update('language', next);
    void i18n.changeLanguage(next);
    close();
  };
  const setReminders = (enabled: boolean) => {
    runAction((db, clock) => setSetting(db, 'reminders_enabled', enabled, clock.now));
    if (enabled && permission === 'undetermined') {
      void ask();
    }
  };

  const setColorblind = (enabled: boolean) =>
    useSettingsStore.getState().update('colorblind', enabled);
  const exportData = async () => {
    if (exporting) {
      return;
    }
    setExporting(true);
    setExportFailed(false);
    try {
      const csv = exportCsv(getSession().db);
      await shareCsv(csvFileName(day.today), csv, t('settings.exportCsvTitle'));
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const rows: RowSpec[] = [
    {
      key: 'theme',
      group: 'appearance',
      label: t('settings.theme'),
      render: (last) => (
        <SettingsRow
          testID="settings-theme"
          icon="tema"
          label={t('settings.theme')}
          value={themeValue}
          onPress={() => router.push('/settings/theme')}
          last={last}
        />
      ),
    },
    {
      key: 'colorblind',
      group: 'appearance',
      label: t('settings.colorblind'),
      keywords: [t('settings.colorblindCaption')],
      render: (last) => (
        <SettingsRow
          testID="settings-colorblind"
          icon="tema"
          label={t('settings.colorblind')}
          caption={t('settings.colorblindCaption')}
          switchValue={settings.colorblind}
          onSwitch={setColorblind}
          last={last}
        />
      ),
    },
    {
      key: 'language',
      group: 'appearance',
      label: t('settings.language'),
      render: (last) => (
        <SettingsRow
          testID="settings-language"
          icon="lingua"
          label={t('settings.language')}
          value={LANGUAGE_NAMES[settings.language]}
          onPress={() => setSheet('language')}
          last={last}
        />
      ),
    },
    {
      key: 'textSize',
      group: 'appearance',
      label: t('settings.textSize'),
      render: (last) => (
        <SettingsRow
          testID="settings-text-size"
          icon="accessibilita"
          label={t('settings.textSize')}
          value={t('settings.textSizeValue')}
          onPress={() => void Linking.openSettings()}
          last={last}
        />
      ),
    },
    {
      key: 'gameMode',
      group: 'game',
      label: t('settings.gameMode'),
      keywords: [t('settings.gameModes.full'), t('settings.gameModes.essential')],
      render: (last) => (
        <SettingsRow
          testID="settings-game-mode"
          icon="play"
          label={t('settings.gameMode')}
          value={t(`settings.gameModes.${settings.game_mode}`)}
          caption={t(`settings.gameModeCaption.${settings.game_mode}`)}
          onPress={() => setSheet('gameMode')}
          last={last}
        />
      ),
    },
    {
      key: 'dayChange',
      group: 'day',
      label: t('settings.dayChange'),
      render: (last) => (
        <SettingsRow
          testID="settings-day-change"
          icon="sole"
          label={t('settings.dayChange')}
          value={formatClock(dayChange, language)}
          caption={day.next.dayChange === null ? undefined : from(day.next.dayChange.fromDay)}
          onPress={() => setSheet('dayChange')}
          last={last}
        />
      ),
    },
    {
      key: 'weekStart',
      group: 'day',
      label: t('settings.weekStart'),
      render: (last) => (
        <SettingsRow
          testID="settings-week-start"
          icon="calendario"
          label={t('settings.weekStart')}
          value={weekdayName(weekStart, language)}
          caption={
            nextWeek === null || nextWeek.weekStart === day.weekRules.weekStart
              ? undefined
              : from(nextWeek.fromDay)
          }
          onPress={() => setSheet('weekStart')}
          last={last}
        />
      ),
    },
    {
      key: 'restDays',
      group: 'day',
      label: t('settings.restDays'),
      render: (last) => (
        <SettingsRow
          testID="settings-rest-days"
          icon="riposo"
          label={t('settings.restDays')}
          value={restDaysValue}
          caption={
            nextWeek === null || sameDays(nextWeek.restDays, day.weekRules.restDays)
              ? undefined
              : from(nextWeek.fromDay)
          }
          onPress={() => setSheet('restDays')}
          last={last}
        />
      ),
    },
    {
      key: 'generalPause',
      group: 'day',
      label: t('settings.generalPause'),
      render: (last) => (
        <SettingsRow
          testID="settings-pause"
          icon="pausa"
          label={t('settings.generalPause')}
          value={pauseValue}
          valueLabel={pauseLabel}
          onPress={() => setSheet('pause')}
          last={last}
        />
      ),
    },
    {
      key: 'reminders',
      group: 'notifications',
      label: t('settings.reminders'),
      render: (last) =>
        permission === 'denied' ? (
          <View
            testID="settings-reminders-blocked"
            style={[
              styles.blocked,
              last ? null : { borderBottomWidth: StyleSheet.hairlineWidth },
              { borderColor: colors.border },
            ]}
          >
            <View style={styles.blockedTitle}>
              <Icon name="notifiche-bloccate" size={20} color={colors.dangerText} />
              <ThemedText variant="label" style={styles.flex}>
                {t('settings.blocked')}
              </ThemedText>
            </View>
            <ThemedText variant="caption" color={colors.textMuted}>
              {t('settings.blockedBody')}
            </ThemedText>
            <Button
              testID="settings-open-system"
              variant="text"
              label={t('settings.openSystemSettings')}
              onPress={() => void Linking.openSettings()}
            />
          </View>
        ) : (
          <SettingsRow
            testID="settings-reminders"
            icon="promemoria"
            label={t('settings.reminders')}
            switchValue={settings.reminders_enabled}
            onSwitch={setReminders}
            last={last}
          />
        ),
    },
    {
      key: 'eveningSummary',
      group: 'notifications',
      label: t('settings.eveningSummary'),
      render: (last) => (
        <SettingsRow
          testID="settings-evening"
          icon="sole"
          label={t('settings.eveningSummary')}
          switchValue={evening.enabled}
          onSwitch={(enabled) =>
            runAction((db, clock) =>
              setSetting(db, 'evening_summary', { ...evening, enabled }, clock.now),
            )
          }
          last={last}
        />
      ),
    },
    {
      key: 'eveningTime',
      group: 'notifications',
      label: t('settings.eveningTime'),
      render: (last) => (
        <SettingsRow
          testID="settings-evening-time"
          icon="timer"
          label={t('settings.eveningTime')}
          value={formatClock(evening.time, language)}
          onPress={() => setSheet('eveningTime')}
          last={last}
        />
      ),
    },
    {
      key: 'recall',
      group: 'notifications',
      label: t('settings.recall'),
      render: (last) => (
        <SettingsRow
          testID="settings-recall"
          icon="compagno"
          label={t('settings.recall')}
          switchValue={settings.recall_enabled}
          onSwitch={(enabled) =>
            runAction((db, clock) => setSetting(db, 'recall_enabled', enabled, clock.now))
          }
          last={last}
        />
      ),
    },
    {
      key: 'weeklyRecap',
      group: 'notifications',
      label: t('settings.weeklyRecap'),
      render: (last) => (
        <SettingsRow
          testID="settings-weekly"
          icon="statistiche"
          label={t('settings.weeklyRecap')}
          switchValue={weekly.enabled}
          onSwitch={(enabled) =>
            runAction((db, clock) =>
              setSetting(db, 'weekly_recap', { ...weekly, enabled }, clock.now),
            )
          }
          last={last}
        />
      ),
    },
    {
      key: 'weeklyDay',
      group: 'notifications',
      label: t('settings.weeklyRecapDay'),
      render: (last) => (
        <SettingsRow
          testID="settings-weekly-day"
          icon="calendario"
          label={t('settings.weeklyRecapDay')}
          value={weekdayName(weekly.weekday, language)}
          onPress={() => setSheet('weeklyDay')}
          last={last}
        />
      ),
    },
    {
      key: 'weeklyTime',
      group: 'notifications',
      label: t('settings.weeklyRecapTime'),
      render: (last) => (
        <SettingsRow
          testID="settings-weekly-time"
          icon="timer"
          label={t('settings.weeklyRecapTime')}
          value={formatClock(weekly.time, language)}
          onPress={() => setSheet('weeklyTime')}
          last={last}
        />
      ),
    },
    {
      key: 'quietHours',
      group: 'notifications',
      label: t('settings.quietHours'),
      render: (last) => (
        <SettingsRow
          testID="settings-quiet-hours"
          icon="non-disturbare"
          label={t('settings.quietHours')}
          value={
            quiet.length === 0
              ? t('settings.quietNone')
              : quiet.map((times) => t('settings.quietRange', times)).join(', ')
          }
          valueLabel={
            quiet.length === 0
              ? t('settings.quietNone')
              : quiet.map((times) => t('settings.quietRangeLabel', times)).join(', ')
          }
          onPress={() => router.push('/settings/quiet-hours')}
          last={last}
        />
      ),
    },
    {
      key: 'reduceMotion',
      group: 'accessibility',
      label: t('settings.reduceMotion'),
      keywords: [t('settings.reduceMotionCaption')],
      render: (last) => (
        <SettingsRow
          testID="settings-reduce-motion"
          icon="accessibilita"
          label={t('settings.reduceMotion')}
          value={t(`settings.reduceMotionChoices.${settings.reduce_motion}`)}
          caption={t('settings.reduceMotionCaption')}
          onPress={() => setSheet('reduceMotion')}
          last={last}
        />
      ),
    },
    {
      key: 'vibrations',
      group: 'accessibility',
      label: t('settings.vibrations'),
      render: (last) => (
        <SettingsRow
          testID="settings-vibrations"
          icon="promemoria"
          label={t('settings.vibrations')}
          switchValue={settings.vibrations}
          onSwitch={(enabled) => useSettingsStore.getState().update('vibrations', enabled)}
          last={last}
        />
      ),
    },
    {
      key: 'colorblindAlso',
      group: 'accessibility',
      label: t('settings.colorblind'),
      keywords: [t('settings.colorblindCaption')],
      render: (last) => (
        <SettingsRow
          testID="settings-colorblind-accessibility"
          icon="tema"
          label={t('settings.colorblind')}
          caption={t('settings.colorblindAlso')}
          switchValue={settings.colorblind}
          onSwitch={setColorblind}
          last={last}
        />
      ),
    },
    {
      key: 'backup',
      group: 'data',
      label: t('settings.backup'),
      keywords: [t('backup.title'), t('backup.restore'), t('settings.wipe')],
      render: (last) => (
        <SettingsRow
          testID="settings-backup"
          icon="backup"
          label={t('settings.backup')}
          value={
            settings.backup.lastBackupAt === null
              ? t('backup.none')
              : backupWhen(settings.backup.lastBackupAt, getSession().clock(), language, t)
          }
          caption={CLOUD_NAMES[cloudProviderOf()]}
          onPress={() => router.push('/settings/backup')}
          last={last}
        />
      ),
    },
    {
      key: 'exportCsv',
      group: 'data',
      label: t('settings.exportCsv'),
      keywords: ['CSV', t('settings.exportCsvCaption')],
      render: (last) => (
        <SettingsRow
          testID="settings-export"
          icon="esporta"
          label={t('settings.exportCsv')}
          caption={exportFailed ? t('settings.exportCsvError') : t('settings.exportCsvCaption')}
          onPress={() => void exportData()}
          last={last}
        />
      ),
    },
    {
      key: 'version',
      group: 'about',
      label: t('settings.version'),
      render: (last) => (
        <SettingsRow
          testID="settings-version"
          icon="informazioni"
          label={t('settings.version')}
          value={Constants.expoConfig?.version ?? '–'}
          last={last}
        />
      ),
    },
    {
      key: 'privacy',
      group: 'about',
      label: t('settings.privacy'),
      render: (last) => (
        <SettingsRow
          testID="settings-privacy"
          icon="lucchetto"
          label={t('settings.privacy')}
          onPress={() => setSheet('privacy')}
          last={last}
        />
      ),
    },
    {
      key: 'licenses',
      group: 'about',
      label: t('settings.licenses'),
      render: (last) => (
        <SettingsRow
          testID="settings-licenses"
          icon="nota"
          label={t('settings.licenses')}
          onPress={() => setSheet('licenses')}
          last={last}
        />
      ),
    },
  ];

  const needle = searchable(query.trim());
  const visible = rows.filter(
    (row) =>
      needle === '' ||
      [row.label, ...(row.keywords ?? [])].some((word) => searchable(word).includes(needle)) ||
      searchable(t(`settings.groups.${row.group}`)).includes(needle),
  );

  return (
    <View testID="settings-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="settings-header"
        title={t('settings.title', { context: family })}
        compact
        onBack={() => router.back()}
      />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.search}>
          <Frame shape={SHAPES[family].control} fill={colors.surface} stroke={colors.textMuted} />
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="cerca" size={20} color={colors.textMuted} />
          </View>
          <TextInput
            testID="settings-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t('settings.search')}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={t('settings.search')}
            style={[styles.input, textStyleOf(typography.body), { color: colors.text }]}
          />
          {query === '' ? null : (
            <Pressable
              testID="settings-search-clear"
              accessibilityRole="button"
              accessibilityLabel={t('settings.clearSearch')}
              onPress={() => setQuery('')}
              style={styles.clear}
            >
              <Icon name="chiudi" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {visible.length === 0 ? (
          <ThemedText testID="settings-no-results" color={colors.textMuted} style={styles.center}>
            {t('settings.noResults')}
          </ThemedText>
        ) : null}
        {GROUPS.map((group) => {
          const groupRows = visible.filter((row) => row.group === group);
          if (groupRows.length === 0) {
            return null;
          }
          return (
            <View key={group} testID={`settings-group-${group}`} style={styles.group}>
              <ThemedText
                variant="caption"
                color={colors.textMuted}
                accessibilityRole="header"
                accessibilityLabel={t(`settings.groups.${group}`)}
              >
                {t(`settings.groups.${group}`).toLocaleUpperCase(language)}
              </ThemedText>
              <Card style={styles.card}>
                {groupRows.map((row, index) => (
                  <View key={row.key}>{row.render(index === groupRows.length - 1)}</View>
                ))}
              </Card>
            </View>
          );
        })}
      </ScrollView>

      <ChoiceSheet
        testID="settings-language-sheet"
        visible={sheet === 'language'}
        title={t('settings.language')}
        choices={LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }))}
        selected={settings.language}
        onChoose={chooseLanguage}
        onClose={close}
      />
      <ChoiceSheet
        testID="settings-reduce-motion-sheet"
        visible={sheet === 'reduceMotion'}
        title={t('settings.reduceMotion')}
        choices={REDUCE_MOTION.map((value) => ({
          value,
          label: t(`settings.reduceMotionChoices.${value}`),
        }))}
        selected={settings.reduce_motion}
        notes={[t('settings.reduceMotionCaption')]}
        onChoose={(value) => {
          useSettingsStore.getState().update('reduce_motion', value);
          close();
        }}
        onClose={close}
      />
      <ChoiceSheet
        testID="settings-day-change-sheet"
        visible={sheet === 'dayChange'}
        title={t('settings.dayChange')}
        choices={DAY_CHANGE_TIMES.map((value) => ({ value, label: formatClock(value, language) }))}
        selected={dayChange}
        notes={[
          dayChange === '00:00'
            ? t('settings.dayChangeMidnight')
            : t('settings.dayChangeExample', { time: formatClock(dayChange, language) }),
          t('settings.fromTomorrow'),
        ]}
        onChoose={(time) => {
          runAction((db, clock) => setDayChange(db, time, { today: day.today, now: clock.now }));
          close();
        }}
        onClose={close}
      />
      <ChoiceSheet
        testID="settings-week-start-sheet"
        visible={sheet === 'weekStart'}
        title={t('settings.weekStart')}
        choices={WEEK_STARTS.map((value) => ({ value, label: weekdayName(value, language) }))}
        selected={weekStart}
        notes={[t('settings.fromTomorrow')]}
        onChoose={(value) => {
          runAction((db, clock) =>
            setWeekRules(db, { weekStart: value as 1 | 7 }, { today: day.today, now: clock.now }),
          );
          close();
        }}
        onClose={close}
      />
      <RestDaysSheet
        visible={sheet === 'restDays'}
        weekStart={weekStart}
        value={restDays}
        onDone={(days) => {
          runAction((db, clock) =>
            setWeekRules(db, { restDays: [...days] }, { today: day.today, now: clock.now }),
          );
          close();
        }}
        onClose={close}
      />
      <TimeSheet
        testID="settings-evening-time-sheet"
        visible={sheet === 'eveningTime'}
        title={t('settings.eveningTime')}
        value={evening.time}
        onDone={(time) => {
          runAction((db, clock) =>
            setSetting(db, 'evening_summary', { ...evening, time }, clock.now),
          );
          close();
        }}
        onClose={close}
      />
      <ChoiceSheet
        testID="settings-weekly-day-sheet"
        visible={sheet === 'weeklyDay'}
        title={t('settings.weeklyRecapDay')}
        choices={WEEKDAYS.map((value) => ({ value, label: weekdayName(value, language) }))}
        selected={weekly.weekday}
        onChoose={(weekday) => {
          runAction((db, clock) =>
            setSetting(db, 'weekly_recap', { ...weekly, weekday }, clock.now),
          );
          close();
        }}
        onClose={close}
      />
      <TimeSheet
        testID="settings-weekly-time-sheet"
        visible={sheet === 'weeklyTime'}
        title={t('settings.weeklyRecapTime')}
        value={weekly.time}
        onDone={(time) => {
          runAction((db, clock) => setSetting(db, 'weekly_recap', { ...weekly, time }, clock.now));
          close();
        }}
        onClose={close}
      />
      <GeneralPauseSheet
        visible={sheet === 'pause'}
        today={day.today}
        pause={pause}
        todayPause={todayPause}
        onClose={close}
      />
      <GameModeSheet
        visible={sheet === 'gameMode'}
        current={settings.game_mode}
        onConfirm={(mode) => {
          runAction((db, clock) => setSetting(db, 'game_mode', mode, clock.now));
          close();
        }}
        onClose={close}
      />
      <Sheet
        testID="settings-privacy-sheet"
        visible={sheet === 'privacy'}
        onClose={close}
        title={t('settings.privacy')}
      >
        <ThemedText style={styles.sheetText}>{t('settings.privacyBody')}</ThemedText>
      </Sheet>
      <Sheet
        testID="settings-licenses-sheet"
        visible={sheet === 'licenses'}
        onClose={close}
        title={t('settings.licenses')}
      >
        <View style={styles.sheetText}>
          <ThemedText>{t('settings.licensesFonts')}</ThemedText>
          <ThemedText>{t('settings.licensesOther')}</ThemedText>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 24, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
  search: {
    minHeight: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  input: { flex: 1, minHeight: FIELD_HEIGHT },
  clear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  group: { gap: 8 },
  card: { paddingVertical: 0 },
  blocked: { gap: 4, paddingVertical: 12, alignItems: 'flex-start' },
  blockedTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flexShrink: 1 },
  sheetText: { gap: 12, paddingBottom: 16 },
});
