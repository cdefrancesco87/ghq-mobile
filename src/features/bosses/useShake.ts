import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/features/shared/useReduceMotion';
import type { BossHit } from './BossCard';

const SHAKE = 4;
const SHAKE_STEP_MS = 50;

/** The shake of the boss at every hit (design-sezioni.md 5.4); none with «Riduci movimento». */
export function useShake(hit: BossHit | null) {
  const reduceMotion = useReduceMotion();
  const shake = useSharedValue(0);

  useEffect(() => {
    if (hit === null || reduceMotion) {
      return;
    }
    const step = { duration: SHAKE_STEP_MS };
    shake.set(
      withSequence(
        withTiming(SHAKE, step),
        withTiming(-SHAKE, step),
        withTiming(SHAKE, step),
        withTiming(0, step),
      ),
    );
  }, [hit, reduceMotion, shake]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
}
