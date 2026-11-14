// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_initial_schema.sql';
import m0001 from './0001_boss_active_index.sql';
import m0002 from './0002_events_append_only.sql';
import m0003 from './0003_day_summaries_is_paused.sql';
import m0004 from './0004_rewards.sql';
import m0005 from './0005_boss_main_quest_and_chains.sql';
import m0006 from './0006_scheduled_reminders_content_hash.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006
    }
  }
  