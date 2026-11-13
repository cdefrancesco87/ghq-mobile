import type { GameMode } from '@/rules/types';
import { useSettingsStore } from '@/stores/settings';

/**
 * The game mode of the `game_mode` setting (design-sezioni.md A9): `full`, or `essential`, where
 * health, bosses, shop and coins are hidden and level and experience stay small. The data are the
 * same in both modes: only what the screens show changes.
 */
export function useGameMode(): GameMode {
  return useSettingsStore((state) => state.settings.game_mode);
}

/** Whether the Essential mode is on. */
export function useEssential(): boolean {
  return useGameMode() === 'essential';
}
