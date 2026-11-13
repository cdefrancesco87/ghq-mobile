import { BADGE_LIST, NAMED_BADGES } from '@/content/badges';
import { BADGE_METRICS } from '@/rules/badges';
import { COMPANION_STAGES } from '@/rules/companion';
import { SHOP_ITEMS } from '@/content/shop';
import { MISSION_TEMPLATES, TEMPLATE_CATEGORIES } from '@/content/templates';
import { TITLE_KEYS, TITLE_THEMES } from '@/content/titles';
import { HERO_LEVELS, SHOP, STATS } from '@/rules/config';
import { frequencySchema } from '@/rules/frequency';
import { DIFFICULTIES, STAT_KEYS } from '@/rules/types';

describe('mission templates', () => {
  it('has at least 12 templates in the 4 categories of US-ONB-03', () => {
    expect(TEMPLATE_CATEGORIES).toEqual(['health', 'mind', 'work_study', 'home']);
    expect(MISSION_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    for (const category of TEMPLATE_CATEGORIES) {
      expect(MISSION_TEMPLATES.some((template) => template.category === category)).toBe(true);
    }
  });

  it('validates every frequency with the frequency schema', () => {
    for (const template of MISSION_TEMPLATES) {
      expect({
        key: template.key,
        valid: frequencySchema.safeParse(template.frequency).success,
      }).toEqual({ key: template.key, valid: true });
    }
  });

  it('gives every template a valid stat and difficulty', () => {
    for (const template of MISSION_TEMPLATES) {
      expect(STAT_KEYS).toContain(template.stat);
      expect(DIFFICULTIES).toContain(template.difficulty);
    }
  });

  it('gives every measurable template a target and an increment', () => {
    for (const template of MISSION_TEMPLATES) {
      const { goal } = template;
      if (goal.type !== 'none') {
        expect(goal.target).toBeGreaterThan(0);
        expect(goal.increment).toBeGreaterThan(0);
        expect(goal.increment).toBeLessThanOrEqual(goal.target);
      }
    }
  });

  it('has a different key for every template', () => {
    const keys = MISSION_TEMPLATES.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('recommends the 3 templates of the first launch', () => {
    const recommended = MISSION_TEMPLATES.filter((template) => template.recommended);
    expect(recommended.map(({ key, stat }) => ({ key, stat }))).toEqual([
      { key: 'drink_water', stat: 'constitution' },
      { key: 'read_pages', stat: 'intelligence' },
      { key: 'meditation', stat: 'wisdom' },
    ]);
  });

  it('uses the stats of the examples in statistiche-eroe.md', () => {
    const statOf = (key: string) =>
      MISSION_TEMPLATES.find((template) => template.key === key)?.stat;
    expect(statOf('run')).toBe('strength');
    expect(statOf('healthy_meal')).toBe('constitution');
    expect(statOf('study_hour')).toBe('intelligence');
    expect(statOf('journal')).toBe('wisdom');
    expect(statOf('call_friend')).toBe('charisma');
    expect(statOf('inbox_zero')).toBe('discipline');
  });
});

describe('shop', () => {
  it('sells the potion and the shield at the prices of the configuration', () => {
    expect(SHOP_ITEMS).toEqual([
      { key: 'potion', group: 'helps', price: SHOP.potion.price, maxOwned: null },
      { key: 'shield', group: 'helps', price: SHOP.shield.price, maxOwned: SHOP.shield.maxOwned },
    ]);
  });
});

describe('hero titles', () => {
  it('has 11 different title keys for every theme', () => {
    expect(TITLE_THEMES).toEqual(['arcade', 'fantasy', 'cyberpunk', 'lovecraft', 'minimal']);
    for (const theme of TITLE_THEMES) {
      expect(TITLE_KEYS[theme]).toHaveLength(11);
      expect(new Set(TITLE_KEYS[theme]).size).toBe(11);
    }
  });

  it('starts from the examples of design-sezioni.md 9.3', () => {
    expect(TITLE_KEYS.arcade.slice(0, 3)).toEqual(['newbie', 'player', 'pro']);
    expect(TITLE_KEYS.fantasy.slice(0, 3)).toEqual(['squire', 'knight', 'paladin']);
    expect(TITLE_KEYS.cyberpunk.slice(0, 3)).toEqual(['street_kid', 'runner', 'netrunner']);
    expect(TITLE_KEYS.lovecraft.slice(0, 3)).toEqual(['curious', 'scholar', 'investigator']);
    expect(TITLE_KEYS.minimal.slice(0, 3)).toEqual(['beginner', 'steady', 'expert']);
  });
});

describe('badges', () => {
  it('has at least 20 badges with unique keys and positive targets (US-PROF-02)', () => {
    expect(BADGE_LIST.length).toBeGreaterThanOrEqual(20);
    expect(new Set(BADGE_LIST.map((badge) => badge.key)).size).toBe(BADGE_LIST.length);
    for (const badge of BADGE_LIST) {
      expect(BADGE_METRICS).toContain(badge.metric);
      expect(Number.isInteger(badge.target) && badge.target > 0).toBe(true);
    }
  });

  it('names only badges of the list', () => {
    const keys = BADGE_LIST.map((badge) => badge.key);
    for (const key of NAMED_BADGES) {
      expect(keys).toContain(key);
    }
  });

  it('keeps the targets within reach: levels, stats and companion stages', () => {
    const highest = (metric: string) =>
      Math.max(...BADGE_LIST.filter((b) => b.metric === metric).map((b) => b.target));
    expect(highest('level')).toBeLessThanOrEqual(HERO_LEVELS.max);
    expect(highest('statLevelMax')).toBeLessThanOrEqual(STATS.levelMax);
    expect(highest('companionStage')).toBe(COMPANION_STAGES.length - 1);
  });
});
