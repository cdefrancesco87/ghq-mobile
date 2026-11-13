import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/features/shared/Button';
import { Frame } from '@/features/shared/Frame';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';

const FIELD_HEIGHT = 48;

/** The sheet on screen: what is lost first, then the word to type (design-sezioni.md 10.8). */
export type WipeStep = 'warning' | 'confirm';

export interface WipeDataSheetsProps {
  readonly step: WipeStep | null;
  readonly onClose: () => void;
  /** «Fai prima un backup». */
  readonly onBackup: () => void;
  /** «Continua»: on to the second confirmation. */
  readonly onContinue: () => void;
  /** «Elimina tutto», once the word is typed. */
  readonly onWipe: () => void;
  /** True while the data are being deleted: the button stays off. */
  readonly busy?: boolean;
}

/**
 * The two confirmations of «Elimina tutti i dati» (US-IMP-05; design-sezioni.md 10.8; mockups
 * D39): a sheet that says what is lost and offers a backup, then a sheet where the button turns
 * on only after typing the word of the language (ELIMINA), in capitals or not.
 */
export function WipeDataSheets({
  step,
  onClose,
  onBackup,
  onContinue,
  onWipe,
  busy = false,
}: WipeDataSheetsProps) {
  const { t, i18n } = useTranslation();
  const { colors, family, typography } = useTheme();
  const [typed, setTyped] = useState('');
  // Every time the second sheet opens, the field starts empty.
  if (step !== 'confirm' && typed !== '') {
    setTyped('');
  }

  const word = t('settings.wipeWord');
  const matches = typed.trim().toLocaleUpperCase(i18n.language) === word;

  return (
    <>
      <Sheet
        testID="settings-wipe-sheet"
        visible={step === 'warning'}
        onClose={onClose}
        title={t('settings.wipeTitle')}
      >
        <View style={styles.body}>
          <ThemedText variant="caption" color={colors.textMuted}>
            {t('settings.wipeSubtitle')}
          </ThemedText>
          <ThemedText>{t('settings.wipeBody')}</ThemedText>
          <View style={styles.buttons}>
            <Button
              testID="settings-wipe-backup"
              label={t('settings.wipeBackupFirst')}
              onPress={onBackup}
            />
            <Button
              testID="settings-wipe-continue"
              variant="secondary"
              label={t('settings.wipeContinue')}
              onPress={onContinue}
            />
          </View>
        </View>
      </Sheet>
      <Sheet
        testID="settings-wipe-confirm-sheet"
        visible={step === 'confirm'}
        onClose={onClose}
        title={t('settings.wipeConfirmTitle')}
      >
        <View style={styles.body}>
          <ThemedText>{t('settings.wipeConfirmBody', { word })}</ThemedText>
          <View style={styles.field}>
            <Frame shape={SHAPES[family].control} fill={colors.surface} stroke={colors.textMuted} />
            <TextInput
              testID="settings-wipe-input"
              value={typed}
              onChangeText={setTyped}
              selectionColor={colors.primary}
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="done"
              accessibilityLabel={t('settings.wipeField')}
              accessibilityHint={t('settings.wipeConfirmBody', { word })}
              style={[styles.input, textStyleOf(typography.body), { color: colors.text }]}
            />
          </View>
          <Button
            testID="settings-wipe-confirm"
            variant="destructive"
            label={t('settings.wipeConfirm')}
            disabled={!matches || busy}
            disabledReason={matches ? undefined : t('settings.wipeDisabled', { word })}
            onPress={onWipe}
          />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 16 },
  buttons: { gap: 12 },
  field: { minHeight: FIELD_HEIGHT, justifyContent: 'center', paddingHorizontal: 12 },
  input: { minHeight: FIELD_HEIGHT },
});
