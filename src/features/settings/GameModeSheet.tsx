import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/features/shared/Button';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import type { GameMode } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface GameModeSheetProps {
  readonly visible: boolean;
  /** The mode in use: the sheet offers the other one. */
  readonly current: GameMode;
  readonly onConfirm: (next: GameMode) => void;
  readonly onClose: () => void;
}

/**
 * The confirmation of the change of «Livello di gioco» (design-sezioni.md 10.4 ★; mockup D37A):
 * what goes away or comes back, and that no data is lost.
 */
export function GameModeSheet({ visible, current, onConfirm, onClose }: GameModeSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const next: GameMode = current === 'full' ? 'essential' : 'full';
  return (
    <Sheet
      testID="settings-game-mode-sheet"
      visible={visible}
      onClose={onClose}
      title={t(`settings.gameModeSheet.title.${next}`)}
    >
      <View style={styles.body}>
        <ThemedText variant="caption" color={colors.textMuted}>
          {t('settings.gameModeSheet.subtitle')}
        </ThemedText>
        <ThemedText testID="settings-game-mode-body">
          {t(`settings.gameModeSheet.body.${next}`)}
        </ThemedText>
        <ThemedText color={colors.textMuted}>{t('settings.gameModeSheet.noDataLost')}</ThemedText>
        <View style={styles.buttons}>
          <Button
            testID="settings-game-mode-confirm"
            label={t(`settings.gameModeSheet.confirm.${next}`)}
            onPress={() => onConfirm(next)}
          />
          <Button
            testID="settings-game-mode-cancel"
            variant="text"
            label={t('shared.cancel')}
            onPress={onClose}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 16 },
  buttons: { gap: 12 },
});
