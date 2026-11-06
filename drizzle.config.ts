import { defineConfig } from 'drizzle-kit';

// `npx drizzle-kit generate` writes a new numbered SQL migration in drizzle/ after a change to
// the schema. The `expo` driver also writes drizzle/migrations.js, which bundles the SQL files
// for the app.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
