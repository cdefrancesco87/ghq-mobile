import { render } from '@testing-library/react-native';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { setBackgroundColorAsync } from 'expo-system-ui';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { SystemBars } from './SystemBars';

// expo-status-bar, expo-navigation-bar and expo-system-ui are mocked in test/setup.ts.

/** The style given to a bar component in its last render. */
function lastStyle(bar: unknown): unknown {
  const calls = (bar as jest.Mock).mock.calls;
  return calls[calls.length - 1][0].style;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SystemBars', () => {
  it('follows the theme when it changes', async () => {
    const { rerender } = await render(
      <ThemeProvider theme="fantasy">
        <SystemBars />
      </ThemeProvider>,
    );
    expect(lastStyle(StatusBar)).toBe('dark');
    expect(lastStyle(NavigationBar)).toBe('light');
    expect(setBackgroundColorAsync).toHaveBeenLastCalledWith('#efe3c8');

    await rerender(
      <ThemeProvider theme="arcade">
        <SystemBars />
      </ThemeProvider>,
    );
    expect(lastStyle(StatusBar)).toBe('light');
    expect(lastStyle(NavigationBar)).toBe('dark');
    expect(setBackgroundColorAsync).toHaveBeenLastCalledWith('#1a1c2c');
  });

  it('follows the light or dark mode of the phone with automatic Minimal', async () => {
    const { rerender } = await render(
      <ThemeProvider theme="minimal" colorScheme="light">
        <SystemBars />
      </ThemeProvider>,
    );
    expect(lastStyle(StatusBar)).toBe('dark');
    expect(setBackgroundColorAsync).toHaveBeenLastCalledWith('#f7f7f5');

    await rerender(
      <ThemeProvider theme="minimal" colorScheme="dark">
        <SystemBars />
      </ThemeProvider>,
    );
    expect(lastStyle(StatusBar)).toBe('light');
    expect(lastStyle(NavigationBar)).toBe('dark');
    expect(setBackgroundColorAsync).toHaveBeenLastCalledWith('#111214');
  });
});
