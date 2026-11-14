import { screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { COLORBLIND } from '@/theme/colorblind';
import { THEMES } from '@/theme/themes';

import { renderThemed } from '../../../test/render';
import { ColumnChart, type ChartColumn } from './ColumnChart';
import { DayMarks } from './DayMarks';

// «Colori per daltonici» (design-sezioni.md A4, 10.2): the bars, the line and the missed days of
// the charts move to the blue–orange scale like the heatmap, in every theme.

const COLUMNS: ChartColumn[] = [
  { key: 'a', label: 'L', spoken: 'lunedì', value: 2, text: '2' },
  { key: 'b', label: 'M', spoken: 'martedì', value: 4, text: '4' },
];

const chart = (line: boolean) => (
  <ColumnChart
    testID="chart"
    title="Andamento"
    columns={COLUMNS}
    max={4}
    ticks={[{ value: 0, text: '0' }]}
    description="Due giorni"
    line={line}
  />
);

/** react-native-svg keeps its colours as ARGB integers. */
const svgColor = (hex: string) => ({
  type: 0,
  payload: (0xff000000 | parseInt(hex.slice(1), 16)) >>> 0,
});
const fillOf = (id: string) => screen.getByTestId(id).props.fill as unknown;
const strokeOf = (id: string) => screen.getByTestId(id).props.stroke as unknown;

describe('charts with the colour-blind palette', () => {
  beforeEach(() => {
    // Normal text: the charts, not the tables of very large text.
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale: 1 },
      screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
    });
  });

  it('draws the bars with the colour-blind scale, and with the theme colour when it is off', async () => {
    await renderThemed(chart(false), { theme: 'fantasy', colorblind: true });
    expect(fillOf('chart-bar-a')).toEqual(svgColor(COLORBLIND.chart));
    screen.unmount();

    await renderThemed(chart(false), { theme: 'fantasy' });
    expect(fillOf('chart-bar-a')).toEqual(svgColor(THEMES.fantasy.colors.primary));
  });

  it('draws the line and its points with the colour-blind scale', async () => {
    await renderThemed(chart(true), { theme: 'cyberpunk', colorblind: true });
    expect(strokeOf('chart-line')).toEqual(svgColor(COLORBLIND.chart));
    expect(fillOf('chart-point-a')).toEqual(svgColor(COLORBLIND.chart));
  });

  it('marks a missed day in orange', async () => {
    await renderThemed(
      <DayMarks
        testID="marks"
        title="Settimana"
        columns={[
          { day: '2026-11-09', mark: 'missed' },
          { day: '2026-11-10', mark: 'done' },
        ]}
      />,
      { theme: 'fantasy', colorblind: true },
    );
    expect(screen.getByTestId('marks-2026-11-09-missed')).toHaveStyle({
      borderColor: COLORBLIND.orange,
    });
    expect(screen.getByTestId('marks-2026-11-10-done')).toHaveStyle({
      backgroundColor: COLORBLIND.blue,
    });
  });
});
