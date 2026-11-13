import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { COLORBLIND } from '@/theme/colorblind';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { THEMES } from '@/theme/themes';

function ThemeName() {
  const theme = useTheme();
  return <Text testID="theme">{`${theme.key} ${theme.colors.background}`}</Text>;
}

describe('ThemeProvider', () => {
  it('gives the chosen theme and redraws when it changes', async () => {
    const { rerender } = await render(
      <ThemeProvider theme="fantasy">
        <ThemeName />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('fantasy #efe3c8');
    await rerender(
      <ThemeProvider theme="arcade">
        <ThemeName />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('arcade #1a1c2c');
  });

  it('lets Minimal follow the light or dark mode of the phone', async () => {
    const { rerender } = await render(
      <ThemeProvider theme="minimal" colorScheme="light">
        <ThemeName />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('minimal-chiaro #f7f7f5');
    await rerender(
      <ThemeProvider theme="minimal" colorScheme="dark">
        <ThemeName />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('minimal-scuro #111214');
  });

  it('moves heatmap, bars and states to the colour-blind scale, also in nested themes', async () => {
    function Colours() {
      const { colors } = useTheme();
      return (
        <Text testID="colours">{`${colors.done} ${colors.hp} ${colors.heatmap.join(' ')}`}</Text>
      );
    }
    const plain = THEMES.arcade.colors;
    const { rerender } = await render(
      <ThemeProvider theme="arcade" colorblind={false}>
        <Colours />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('colours')).toHaveTextContent(
      `${plain.done} ${plain.hp} ${plain.heatmap.join(' ')}`,
    );
    await rerender(
      <ThemeProvider theme="arcade" colorblind>
        <ThemeProvider theme="fantasy">
          <Colours />
        </ThemeProvider>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('colours')).toHaveTextContent(
      [
        COLORBLIND.blue,
        COLORBLIND.orange,
        THEMES.fantasy.colors.heatmap[0],
        ...COLORBLIND.heatmap,
      ].join(' '),
    );
  });

  it('reads the mode of the phone when it is not given', async () => {
    await render(
      <ThemeProvider theme="minimal">
        <ThemeName />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent(/^minimal-(chiaro|scuro) /);
  });

  it('refuses useTheme outside the provider', async () => {
    const silence = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<ThemeName />)).rejects.toThrow('inside a ThemeProvider');
    silence.mockRestore();
  });
});
