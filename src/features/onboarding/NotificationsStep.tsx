import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestNotificationPermission } from '@/features/notifications/system';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';
import { OnboardingStep, StepButton } from './OnboardingStep';

const NOTIFICATION_ICON_SIZE = 38;

function SampleNotification({
  time,
  title,
  body,
}: {
  readonly time: string;
  readonly title: string;
  readonly body: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card surface="high" style={styles.sample}>
      <View style={[styles.sampleIcon, { backgroundColor: colors.primary }]}>
        <Icon name="completa" size={20} color={colors.onPrimary} />
      </View>
      <View style={styles.sampleTexts}>
        <View style={styles.sampleHead}>
          <ThemedText variant="caption">{t('shared.appName')}</ThemedText>
          <ThemedText variant="caption" color={colors.textMuted}>
            {time}
          </ThemedText>
        </View>
        <ThemedText variant="label">{title}</ThemedText>
        <ThemedText variant="caption">{body}</ThemedText>
      </View>
    </Card>
  );
}

export interface NotificationsStepProps {
  readonly onBack: () => void;
  /** The end of the first launch, with or without the permission. */
  readonly onFinish: () => void;
}

/** Explains what will arrive; the permission of the system is asked only from here (US-ONB-05). */
export function NotificationsStep({ onBack, onFinish }: NotificationsStepProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [asking, setAsking] = useState(false);

  // Without the permission (or if the request fails) the app simply works without notices.
  const enable = async () => {
    setAsking(true);
    await requestNotificationPermission().catch(() => false);
    onFinish();
  };

  return (
    <OnboardingStep
      name="notifications"
      title={t('onboarding.notifications.title')}
      art={<CompanionSprite stage="egg" mood="normal" />}
      onBack={asking ? undefined : onBack}
      onSkip={asking ? undefined : onFinish}
      footer={
        <>
          <StepButton
            testID="onboarding-enable-notifications"
            label={t('onboarding.notifications.enable')}
            onPress={() => void enable()}
            disabled={asking}
          />
          <Button
            testID="onboarding-not-now"
            variant="text"
            label={t('onboarding.notifications.later')}
            onPress={onFinish}
            disabled={asking}
          />
        </>
      }
    >
      <ThemedText color={colors.textMuted} style={styles.body}>
        {t('onboarding.notifications.body')}
      </ThemedText>
      <Card style={styles.samples}>
        <SampleNotification
          time={t('onboarding.notifications.reminderTime')}
          title={t('templates.meditation.name')}
          body={t('onboarding.notifications.reminderBody')}
        />
        <SampleNotification
          time={t('onboarding.notifications.summaryTime')}
          title={t('onboarding.notifications.summaryTitle')}
          body={t('onboarding.notifications.summaryBody')}
        />
      </Card>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, textAlign: 'center' },
  samples: { marginHorizontal: 16, gap: 12 },
  sample: { flexDirection: 'row', gap: 12 },
  sampleIcon: {
    width: NOTIFICATION_ICON_SIZE,
    height: NOTIFICATION_ICON_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleTexts: { flex: 1, gap: 2 },
  sampleHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
