// In the tests Reanimated runs in JavaScript: there is no UI runtime for gesture-handler to bind to.
jest.mock(
  'react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings',
  () => ({ installUIRuntimeBindings: jest.fn() }),
);

// The system bars are native UI with nothing to test here. React Native's StatusBar also batches
// its updates on timers, which hangs the tests that use fake timers. Only the parts the app uses are
// replaced: expo-router needs the rest of expo-status-bar.
jest.mock('expo-status-bar', () => ({
  ...jest.requireActual('expo-status-bar'),
  StatusBar: jest.fn(() => null),
}));
jest.mock('expo-navigation-bar', () => ({
  ...jest.requireActual('expo-navigation-bar'),
  NavigationBar: jest.fn(() => null),
}));
jest.mock('expo-system-ui', () => ({
  ...jest.requireActual('expo-system-ui'),
  setBackgroundColorAsync: jest.fn(async () => undefined),
}));
