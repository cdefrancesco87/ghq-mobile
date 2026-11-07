import { setSetting } from '@/db/repositories/settings';

import { createTestDb } from '../../test/db';
import { useSettingsStore } from './settings';

// The phone is in Italian here (CLAUDE.md, choice 19).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'it', languageTag: 'it-IT' }],
}));

beforeEach(() => useSettingsStore.getState().reset());

describe('language of the settings store', () => {
  it('starts in the language of the phone, before and after loading a new database', () => {
    expect(useSettingsStore.getState().settings.language).toBe('it');
    useSettingsStore.getState().load(createTestDb());
    expect(useSettingsStore.getState().settings.language).toBe('it');
  });

  it('keeps the saved language', () => {
    const db = createTestDb();
    setSetting(db, 'language', 'fr', Date.UTC(2026, 10, 6, 9));
    useSettingsStore.getState().load(db);
    expect(useSettingsStore.getState().settings.language).toBe('fr');
  });
});
