import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/features/shared/Icon';
import type { IconName } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import { useTheme } from '@/theme/ThemeProvider';

/** Rows at least 52 high (design-sezioni.md 10.1). */
export const SETTINGS_ROW_HEIGHT = 52;

export interface SettingsRowProps {
  readonly testID: string;
  readonly icon: IconName;
  readonly label: string;
  /** The value in force, at the right in muted text (under the name with very large text). */
  readonly value?: string;
  /** How the screen reader says the value, when it differs from the text («dalle 22 alle 7»). */
  readonly valueLabel?: string;
  /** A line under the name, like «Dal 7 novembre» for a change that counts from tomorrow. */
  readonly caption?: string;
  /** A row that opens something: it shows the arrow. */
  readonly onPress?: () => void;
  /** A row with a switch instead of the arrow. */
  readonly switchValue?: boolean;
  readonly onSwitch?: (value: boolean) => void;
  readonly last?: boolean;
}

/**
 * A row of the Settings: icon, name, value and arrow, or a switch (design-sezioni.md 10.1). The
 * screen reader hears name, value and type («Promemoria, attivo, interruttore», 10.12); with very
 * large text the value goes under the name.
 */
export function SettingsRow({
  testID,
  icon,
  label,
  value,
  valueLabel,
  caption,
  onPress,
  switchValue,
  onSwitch,
  last = false,
}: SettingsRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const largeText = useLargeText();
  const spoken = [valueLabel ?? value, caption].filter((part) => part !== undefined).join(', ');
  const separator = last
    ? null
    : { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border };

  const body = (
    <>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name={icon} size={20} color={colors.textMuted} />
      </View>
      <View testID={`${testID}-text`} style={[styles.text, largeText ? null : styles.inline]}>
        <View style={styles.flex}>
          <ThemedText variant="body">{label}</ThemedText>
          {caption === undefined ? null : (
            <ThemedText testID={`${testID}-caption`} variant="caption" color={colors.textMuted}>
              {caption}
            </ThemedText>
          )}
        </View>
        {value === undefined ? null : (
          <ThemedText
            testID={`${testID}-value`}
            variant="label"
            color={colors.textMuted}
            style={largeText ? null : styles.value}
          >
            {value}
          </ThemedText>
        )}
      </View>
    </>
  );

  if (onSwitch !== undefined) {
    return (
      <View style={[styles.row, separator]}>
        {body}
        <Switch
          testID={testID}
          value={switchValue ?? false}
          onValueChange={onSwitch}
          accessibilityLabel={
            spoken === '' ? label : t('settings.rowLabel', { label, value: spoken })
          }
          trackColor={{ false: colors.track, true: colors.primary }}
          thumbColor={colors.surfaceHigh}
        />
      </View>
    );
  }
  if (onPress === undefined) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={
          spoken === '' ? label : t('settings.rowLabel', { label, value: spoken })
        }
        style={[styles.row, separator]}
      >
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={spoken === '' ? label : t('settings.rowLabel', { label, value: spoken })}
      onPress={onPress}
      style={[styles.row, separator]}
    >
      {body}
      <Icon name="avanti" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: SETTINGS_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  text: { flex: 1, gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flexShrink: 1, flexGrow: 1 },
  value: { flexShrink: 0, maxWidth: '50%', textAlign: 'right' },
});
