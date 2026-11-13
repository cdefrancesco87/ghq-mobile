import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { BackupErrorCode } from '@/db/repositories/settings';
import { SettingsRow } from '@/features/settings/SettingsRow';
import { wipeAppData } from '@/features/settings/wipeAppData';
import { WipeDataSheets } from '@/features/settings/WipeDataSheets';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { Sheet, SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';
import {
  backUpNow,
  changeAutoBackup,
  findBackup,
  isFromNewerApp,
  restoreBackup,
} from './appBackup';
import type { BackupSummary } from './backupFile';
import { backupErrorCode, cloudProviderOf } from './cloudStore';
import { backupWhen, CLOUD_NAMES } from './format';

/** The sheet of «Ripristina», from the search of the backup to the end. */
type RestoreStep =
  | { readonly step: 'searching' }
  | { readonly step: 'none' }
  | { readonly step: 'preview'; readonly summary: BackupSummary }
  | { readonly step: 'restoring'; readonly summary: BackupSummary }
  | {
      readonly step: 'error';
      readonly code: BackupErrorCode;
      /** The backup found, when the error came while restoring it: «Riprova» restores again. */
      readonly summary: BackupSummary | null;
    };

type WipeSheet = 'warning' | 'confirm' | null;

/**
 * Backup e ripristino (US-IMP-03, US-IMP-05; design-sezioni.md 10.8; mockups D38, D39): where the
 * backups go and when the last one was made, the daily automatic backup (off until the user turns
 * it on), «Fai un backup ora», «Ripristina da un backup» with a preview (date, missions, level)
 * and, under «Zona delicata», «Elimina tutti i dati». A failed backup is explained in one line
 * with «Riprova»; after a restore the app starts again on Today.
 */
export function BackupScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const backup = useSettingsStore((state) => state.settings.backup);
  const provider = cloudProviderOf();
  const cloud = CLOUD_NAMES[provider];
  const language = i18n.language;
  const [backingUp, setBackingUp] = useState(false);
  const [restore, setRestore] = useState<RestoreStep | null>(null);
  const [wipeSheet, setWipeSheet] = useState<WipeSheet>(null);
  // The second confirmation waits for the first sheet to slide away: on iOS a modal shown while
  // another one is still closing may never appear (as in Habits).
  const [queued, setQueued] = useState<WipeSheet>(null);
  const [wiping, setWiping] = useState(false);
  // A second tap before the button turns off must not start a second wipe.
  const wipeStarted = useRef(false);
  // The screen may close while the cloud answers (a restore, a wipe): no state after that.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (queued === null || wipeSheet !== null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setWipeSheet(queued);
      setQueued(null);
    }, SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [queued, wipeSheet]);

  const when = (at: number) => backupWhen(at, getSession().clock(), language, t);
  const errorLine = (code: BackupErrorCode) =>
    t(`backup.errors.${code}`, { cloud, context: provider });

  const backUp = async () => {
    if (backingUp) {
      return;
    }
    setBackingUp(true);
    try {
      await backUpNow();
    } catch {
      // The data closed meanwhile («Elimina tutti i dati», a restore): nothing to record.
    } finally {
      if (mounted.current) {
        setBackingUp(false);
      }
    }
  };

  const search = async () => {
    setRestore({ step: 'searching' });
    try {
      const summary = await findBackup();
      if (!mounted.current) {
        return;
      }
      if (summary === null) {
        setRestore({ step: 'none' });
      } else if (isFromNewerApp(summary)) {
        setRestore({ step: 'error', code: 'newer', summary: null });
      } else {
        setRestore({ step: 'preview', summary });
      }
    } catch (error) {
      if (mounted.current) {
        setRestore({ step: 'error', code: backupErrorCode(error), summary: null });
      }
    }
  };

  const restoreFrom = async (summary: BackupSummary) => {
    setRestore({ step: 'restoring', summary });
    try {
      const outcome = await restoreBackup(summary);
      if (outcome === 'restored') {
        // The stores already read the restored data: the app starts again on Today.
        router.replace('/');
      } else if (outcome === 'failed' && mounted.current) {
        setRestore({ step: 'error', code: 'corrupt', summary: null });
      }
      // On `error` the root layout shows what went wrong.
    } catch (error) {
      if (mounted.current) {
        setRestore({ step: 'error', code: backupErrorCode(error), summary });
      }
    }
  };

  const wipe = async () => {
    if (wipeStarted.current) {
      return;
    }
    wipeStarted.current = true;
    setWiping(true);
    // On success the stores already read the new empty database: the app starts again from the
    // first launch. On failure the root layout shows the error.
    if (await wipeAppData()) {
      router.replace('/onboarding');
    }
  };

  const restoring = restore?.step === 'restoring';
  const lastError = backup.lastError;

  return (
    <View testID="backup-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="backup-header"
        title={t('backup.title')}
        compact
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {lastError === null ? null : (
          <Card testID="backup-error" style={styles.errorCard}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Icon name="avviso" size={20} color={colors.dangerText} />
            </View>
            <View style={styles.errorText}>
              <ThemedText variant="label" accessibilityRole="alert">
                {t('backup.failed')}
              </ThemedText>
              <ThemedText testID="backup-error-line" variant="caption" color={colors.textMuted}>
                {errorLine(lastError.code)}
              </ThemedText>
              <Button
                testID="backup-retry"
                variant="secondary"
                label={t('backup.retry')}
                accessibilityLabel={t('backup.retryBackup')}
                disabled={backingUp}
                onPress={() => void backUp()}
                style={styles.retry}
              />
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <SettingsRow
            testID="backup-provider"
            icon="backup"
            label={t('backup.where')}
            value={cloud}
          />
          <SettingsRow
            testID="backup-last"
            icon="timer"
            label={t('backup.last')}
            value={backup.lastBackupAt === null ? t('backup.none') : when(backup.lastBackupAt)}
          />
          <SettingsRow
            testID="backup-auto"
            icon="ripeti"
            label={t('backup.auto')}
            switchValue={backup.auto}
            onSwitch={changeAutoBackup}
            last
          />
        </Card>

        <View style={styles.buttons}>
          <Button
            testID="backup-now"
            label={backingUp ? t('backup.running') : t('backup.now')}
            disabled={backingUp || restoring}
            disabledReason={backingUp ? t('backup.running') : undefined}
            onPress={() => void backUp()}
          />
          <Button
            testID="backup-restore"
            variant="secondary"
            label={t('backup.restore')}
            disabled={backingUp}
            onPress={() => void search()}
          />
        </View>

        <View style={styles.group}>
          <ThemedText
            variant="caption"
            color={colors.textMuted}
            accessibilityRole="header"
            accessibilityLabel={t('backup.danger')}
          >
            {t('backup.danger').toLocaleUpperCase(language)}
          </ThemedText>
          <Card style={styles.card}>
            <SettingsRow
              testID="settings-wipe"
              icon="avviso"
              label={t('settings.wipe')}
              danger
              onPress={() => setWipeSheet('warning')}
              last
            />
          </Card>
        </View>
      </ScrollView>

      <Sheet
        testID="backup-restore-sheet"
        visible={restore !== null}
        onClose={() => {
          // A restore in progress cannot be stopped half way.
          if (!restoring) {
            setRestore(null);
          }
        }}
        title={t('backup.restoreTitle')}
      >
        <View style={styles.sheet}>
          {restore?.step === 'searching' ? (
            <ThemedText testID="backup-restore-searching" color={colors.textMuted}>
              {t('backup.searching', { cloud })}
            </ThemedText>
          ) : null}
          {restore?.step === 'none' ? (
            <ThemedText testID="backup-restore-none">{t('backup.notFound', { cloud })}</ThemedText>
          ) : null}
          {restore?.step === 'preview' || restore?.step === 'restoring' ? (
            <>
              <View
                testID="backup-restore-preview"
                accessible
                accessibilityLabel={`${t('backup.madeOn', { when: when(restore.summary.createdAt) })}, ${t('backup.counts', { count: restore.summary.missions, level: restore.summary.level })}`}
              >
                <ThemedText variant="label">
                  {t('backup.madeOn', { when: when(restore.summary.createdAt) })}
                </ThemedText>
                <ThemedText color={colors.textMuted}>
                  {t('backup.counts', {
                    count: restore.summary.missions,
                    level: restore.summary.level,
                  })}
                </ThemedText>
              </View>
              <ThemedText>{t('backup.replaces')}</ThemedText>
              <Button
                testID="backup-restore-confirm"
                variant="destructive"
                label={restoring ? t('backup.restoring') : t('backup.restoreConfirm')}
                disabled={restoring}
                disabledReason={restoring ? t('backup.restoring') : undefined}
                onPress={() => {
                  if (restore.step === 'preview') {
                    void restoreFrom(restore.summary);
                  }
                }}
              />
            </>
          ) : null}
          {restore?.step === 'error' ? (
            <>
              <ThemedText testID="backup-restore-error" accessibilityRole="alert">
                {restore.code === 'corrupt' && restore.summary === null
                  ? t('backup.restoreFailed')
                  : errorLine(restore.code)}
              </ThemedText>
              {restore.code === 'newer' ? null : (
                <Button
                  testID="backup-restore-retry"
                  variant="secondary"
                  label={t('backup.retry')}
                  onPress={() => {
                    if (restore.summary === null) {
                      void search();
                    } else {
                      void restoreFrom(restore.summary);
                    }
                  }}
                />
              )}
            </>
          ) : null}
        </View>
      </Sheet>

      <WipeDataSheets
        step={wipeSheet}
        busy={wiping}
        onClose={() => setWipeSheet(null)}
        onBackup={() => {
          setWipeSheet(null);
          void backUp();
        }}
        onContinue={() => {
          setWipeSheet(null);
          setQueued('confirm');
        }}
        onWipe={() => void wipe()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
  card: { paddingVertical: 0 },
  errorCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  errorText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  retry: { marginTop: 8 },
  buttons: { gap: 12 },
  group: { gap: 8, marginTop: 8 },
  sheet: { gap: 16, paddingBottom: 16 },
});
