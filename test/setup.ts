// In the tests Reanimated runs in JavaScript: there is no UI runtime for gesture-handler to bind to.
jest.mock(
  'react-native-gesture-handler/lib/module/handlers/gestures/installUIRuntimeBindings',
  () => ({ installUIRuntimeBindings: jest.fn() }),
);
