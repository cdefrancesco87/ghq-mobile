import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { SCRIM, SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { Frame } from './Frame';
import { ThemedText } from './ThemedText';
import { MIN_TOUCH } from './touch';

/** Openings and closings last 250 ms (design-sezioni.md A7). */
export const SHEET_DURATION_MS = 250;

/** How far or how fast a sheet must be dragged down to close. */
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 800;

const ACTIVATE_ACTIONS = [{ name: 'activate' }];

export function shouldDismissSheet(translationY: number, velocityY: number): boolean {
  'worklet';
  return translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY;
}

export interface SheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** `half` follows the content up to half of the screen; `full` takes all of it. */
  readonly size?: 'half' | 'full';
  readonly title?: string;
  /** Stable prefix for the sheet, its backdrop and its handle. */
  readonly testID?: string;
}

/** A sheet from the bottom with a handle: close it by dragging, on the backdrop or with «back». */
export function Sheet({
  visible,
  onClose,
  children,
  size = 'half',
  title,
  testID = 'sheet',
}: SheetProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(height);
  // Stays on screen while it slides away after `visible` turns false.
  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    if (visible) {
      translateY.set(withTiming(0, { duration: SHEET_DURATION_MS }));
      return undefined;
    }
    translateY.set(withTiming(height, { duration: SHEET_DURATION_MS }));
    const timer = setTimeout(() => setRendered(false), SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [visible, height, translateY]);

  const drag = Gesture.Pan()
    .withTestId(`${testID}-drag`)
    .onUpdate((event) => {
      translateY.set(Math.max(event.translationY, 0));
    })
    .onEnd((event) => {
      if (shouldDismissSheet(event.translationY, event.velocityY)) {
        scheduleOnRN(onClose);
      } else {
        translateY.set(withTiming(0, { duration: SHEET_DURATION_MS }));
      }
    });

  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return (
    <Modal
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      visible={rendered}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* Only for the finger: the screen reader closes the sheet from the handle. */}
        <Pressable
          testID={`${testID}-backdrop`}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
          style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]}
        />
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={[
            styles.panel,
            size === 'full'
              ? { height: height - insets.top }
              : { maxHeight: height / 2 + insets.bottom },
            { paddingBottom: insets.bottom + 16 },
            slideStyle,
          ]}
        >
          <Frame
            shape={shape.sheet}
            edge="top"
            fill={colors.surfaceHigh}
            // The neon top edge of Cyberpunk (misure-componenti.md, correction 7).
            stroke={family === 'cyberpunk' ? colors.xp : colors.border}
            testID={`${testID}-frame`}
          />
          <GestureDetector gesture={drag}>
            <View testID={`${testID}-handle`} style={styles.handleArea}>
              {/* Beside the title, not around it: an accessible parent would hide it. */}
              <View
                testID={`${testID}-close`}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('shared.close')}
                // iOS activates through the tap, Android only through the `activate` action.
                onAccessibilityTap={onClose}
                accessibilityActions={ACTIVATE_ACTIONS}
                onAccessibilityAction={onClose}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
              {title === undefined ? null : (
                // Not accessible by default on Android: touching it would read the button behind it.
                <ThemedText
                  accessible
                  variant="sectionTitle"
                  accessibilityRole="header"
                  style={styles.title}
                >
                  {title}
                </ThemedText>
              )}
            </View>
          </GestureDetector>
          <ScrollView
            style={size === 'full' ? styles.fullContent : styles.halfContent}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  panel: { overflow: 'hidden' },
  handleArea: { minHeight: MIN_TOUCH, paddingTop: 8, paddingBottom: 8, paddingHorizontal: 16 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  title: { marginTop: 12 },
  fullContent: { flex: 1 },
  halfContent: { flexShrink: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
});
