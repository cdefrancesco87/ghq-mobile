import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useSettingsStore } from '@/stores/settings';

/** «Riduci movimento»: the setting of the app, which by default follows the phone (A7). */
export function useReduceMotion(): boolean {
  const setting = useSettingsStore((state) => state.settings.reduce_motion);
  const [system, setSystem] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setSystem(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return setting === 'system' ? system : setting === 'on';
}
