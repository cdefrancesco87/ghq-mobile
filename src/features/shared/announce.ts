import { AccessibilityInfo, Platform } from 'react-native';

/** VoiceOver ignores live regions: on the iPhone a change is said aloud, on Android the region does it. */
export function announceOnIos(message: string): void {
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(message);
  }
}
