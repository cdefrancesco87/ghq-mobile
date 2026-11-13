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

// The swipeable row of gesture-handler 3 listens to shared values that the Reanimated of the tests
// does not have. In the tests it is the row with its actions next to it, always reachable.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { createElement, useImperativeHandle } =
    jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const methods = { close: () => {}, openLeft: () => {}, openRight: () => {}, reset: () => {} };
  const progress = { value: 0, get: () => 0, set: () => {} };
  function Swipeable({
    ref,
    testID,
    children,
    renderLeftActions,
    renderRightActions,
  }: {
    ref?: import('react').Ref<typeof methods>;
    testID?: string;
    children?: import('react').ReactNode;
    renderLeftActions?: (...args: unknown[]) => import('react').ReactNode;
    renderRightActions?: (...args: unknown[]) => import('react').ReactNode;
  }) {
    useImperativeHandle(ref, () => methods);
    return createElement(
      View,
      { testID },
      renderLeftActions?.(progress, progress, methods),
      children,
      renderRightActions?.(progress, progress, methods),
    );
  }
  return { __esModule: true, default: Swipeable, SwipeDirection: { LEFT: 'left', RIGHT: 'right' } };
});

// The health libraries are native modules (Nitro on iPhone, a TurboModule on Android): the tests
// use the fake source of test/health.ts, so here they only need to load.
jest.mock('@kingstinct/react-native-healthkit', () => ({
  AuthorizationRequestStatus: { unknown: 0, shouldRequest: 1, unnecessary: 2 },
  CategoryValueSleepAnalysis: {
    inBed: 0,
    asleepUnspecified: 1,
    awake: 2,
    asleepCore: 3,
    asleepDeep: 4,
    asleepREM: 5,
  },
  isHealthDataAvailable: jest.fn(() => false),
  getRequestStatusForAuthorization: jest.fn(async () => 1),
  requestAuthorization: jest.fn(async () => false),
  queryStatisticsForQuantity: jest.fn(async () => ({ sources: [] })),
  queryCategorySamples: jest.fn(async () => []),
}));
jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
    SDK_AVAILABLE: 3,
  },
  getSdkStatus: jest.fn(async () => 1),
  initialize: jest.fn(async () => false),
  requestPermission: jest.fn(async () => []),
  getGrantedPermissions: jest.fn(async () => []),
  aggregateRecord: jest.fn(async () => ({})),
}));
