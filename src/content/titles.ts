// The hero titles: 11 per theme, for levels 1, 5, 10 … 50 (titleIndex 0–10, design-sezioni.md
// 9.3). The two Minimal themes share the same titles. The texts are in the language files.
//
// DRAFT to be reviewed by Claudio (CLAUDE.md, choice 7): the first three titles of every theme
// are the examples of the design; the others are a proposal.

export const TITLE_THEMES = ['arcade', 'fantasy', 'cyberpunk', 'lovecraft', 'minimal'] as const;
export type TitleTheme = (typeof TITLE_THEMES)[number];

export const TITLE_KEYS: Readonly<Record<TitleTheme, readonly string[]>> = {
  arcade: [
    'newbie',
    'player',
    'pro',
    'veteran',
    'combo_master',
    'high_scorer',
    'champion',
    'boss_slayer',
    'grand_master',
    'hall_of_famer',
    'legend',
  ],
  fantasy: [
    'squire',
    'knight',
    'paladin',
    'champion',
    'guardian',
    'captain',
    'lord',
    'warden',
    'hero',
    'king',
    'legend',
  ],
  cyberpunk: [
    'street_kid',
    'runner',
    'netrunner',
    'fixer',
    'solo',
    'edgerunner',
    'ghost',
    'icon',
    'kingpin',
    'living_legend',
    'myth',
  ],
  lovecraft: [
    'curious',
    'scholar',
    'investigator',
    'occultist',
    'archivist',
    'seer',
    'adept',
    'keeper',
    'arcanist',
    'elder',
    'dreamer',
  ],
  minimal: [
    'beginner',
    'steady',
    'expert',
    'dedicated',
    'reliable',
    'disciplined',
    'accomplished',
    'master',
    'mentor',
    'role_model',
    'legend',
  ],
};
