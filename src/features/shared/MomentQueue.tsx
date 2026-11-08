import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { EventRow } from '@/db/repositories/events';
import { useTheme } from '@/theme/ThemeProvider';
import { MomentScreen } from './MomentScreen';
import { addMoments, momentsFromEvents, type Moment } from './moments';
import { useReduceMotion } from './useReduceMotion';

/** A moment lasts at most 2.5 seconds (design-sezioni.md A7). */
export const MOMENT_MAX_MS = 2500;

/** The storyboard C2a: the action ends on the screen, then at 300 ms the screen dims in 200 ms. */
const DIM_DELAY_MS = 300;
const DIM_MS = 200;
const REDUCED_FADE_MS = 150;

interface MomentQueueApi {
  /** Queues the moments among the events returned by an action of the repositories. */
  readonly enqueue: (events: readonly EventRow[]) => void;
}

const MomentQueueContext = createContext<MomentQueueApi | null>(null);

/** Gives `useMomentQueue` to the screens and shows the moments above them, one at a time. */
export function MomentQueueProvider({ children }: { readonly children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [queue, setQueue] = useState<readonly Moment[]>([]);
  const current = queue[0];
  const currentId = current?.id;

  const api = useMemo<MomentQueueApi>(
    () => ({
      enqueue: (events) => {
        const moments = momentsFromEvents(events);
        if (moments.length > 0) {
          setQueue((waiting) => addMoments(waiting, moments));
        }
      },
    }),
    [],
  );

  const next = () => setQueue((waiting) => waiting.slice(1));

  useEffect(() => {
    if (currentId === undefined) {
      return undefined;
    }
    const timer = setTimeout(() => setQueue((waiting) => waiting.slice(1)), MOMENT_MAX_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  return (
    <MomentQueueContext value={api}>
      {children}
      {current === undefined ? null : (
        <Modal
          transparent
          statusBarTranslucent
          navigationBarTranslucent
          animationType="none"
          onRequestClose={next}
        >
          <MomentBackground reduceMotion={reduceMotion}>
            <MomentScreen
              key={current.id}
              moment={current}
              reduceMotion={reduceMotion}
              onSkip={next}
            />
          </MomentBackground>
        </Modal>
      )}
    </MomentQueueContext>
  );
}

/** Queues the moments of an action: level up, victory over a boss, companion stage, badge. */
export function useMomentQueue(): MomentQueueApi {
  const api = useContext(MomentQueueContext);
  if (api === null) {
    throw new Error('useMomentQueue must be used inside a MomentQueueProvider');
  }
  return api;
}

function MomentBackground({
  reduceMotion,
  children,
}: {
  readonly reduceMotion: boolean;
  readonly children: ReactNode;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.set(
      reduceMotion
        ? withTiming(1, { duration: REDUCED_FADE_MS })
        : withDelay(DIM_DELAY_MS, withTiming(1, { duration: DIM_MS })),
    );
  }, [opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
