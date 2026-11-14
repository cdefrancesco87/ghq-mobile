// The hero titles: 11 per theme, for levels 1, 5, 10 … 50 (titleIndex 0–10, design-sezioni.md
// 9.3). The two Minimal themes share the same titles. The texts are in the language files.
//
// Approved by Claudio on 14/11 (design/lessico-v2.json, `titoliEroe`) for Arcade, Fantasy, Cyberpunk
// and Lovecraft: the keys are the position `t0`–`t10`, the texts are in the language files. Minimal
// shows no title (only "Level N"): its keys and texts are an unused draft. German, French and
// Spanish are drafts to be reviewed (backlog C07).

export const TITLE_THEMES = ['arcade', 'fantasy', 'cyberpunk', 'lovecraft', 'minimal'] as const;
export type TitleTheme = (typeof TITLE_THEMES)[number];

const positions = Array.from({ length: 11 }, (_, index) => `t${index}`);

export const TITLE_KEYS: Readonly<Record<TitleTheme, readonly string[]>> = {
  arcade: positions,
  fantasy: positions,
  cyberpunk: positions,
  lovecraft: positions,
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
