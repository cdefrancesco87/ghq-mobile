/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Reanimated and worklets run in JavaScript, without their native modules.
  resolver: 'react-native-reanimated/jest/resolver',
  setupFiles: ['react-native-gesture-handler/jestSetup.js', '<rootDir>/test/setup.ts'],
  // Same aliases as tsconfig.json (the more specific one first).
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/**/*.d.ts'],
  // The game rules are the most important part of the app: 90% of their lines must be tested.
  coverageThreshold: {
    './src/rules/': { lines: 90 },
  },
};
