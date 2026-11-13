import { formatAmount, incrementLabel, unitName } from './amount';

describe('amounts of measurable missions', () => {
  it('uses the decimals of the language', () => {
    expect(formatAmount(1.25, 'liter', 'it')).toBe('1,25 L');
    expect(formatAmount(1.25, 'liter', 'en')).toBe('1.25 L');
  });

  it('translates the unit keys and keeps a custom unit as typed', () => {
    expect(unitName('page', 'it')).toBe('pagine');
    expect(unitName('time', 'en')).toBe('times');
    expect(unitName('tazze', 'it')).toBe('tazze');
  });

  it('labels the Complete button of a notification with the increment', () => {
    expect(incrementLabel(250, 'milliliter', 'it')).toBe('+250 ml');
    expect(incrementLabel(0.25, 'liter', 'it')).toBe('+0,25 L');
  });
});
