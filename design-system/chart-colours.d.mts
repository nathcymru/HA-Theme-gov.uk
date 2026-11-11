export type ChartTone = 'vivid' | 'muted';
export type ChartMode = 'light' | 'dark';
export interface ChartColourOptions { tone?: ChartTone; mode?: ChartMode }
export type ChartPattern = 'solid' | 'diagonal' | 'reverse-diagonal' | 'cross' | 'horizontal' | 'vertical' | 'dots';
export interface ChartSeriesStyle { color: string; pattern: ChartPattern; lineDash: number[]; symbol: string; index: number }
export const CHART_COLOUR_SPEC: Readonly<{
  schemaVersion: number; algorithmVersion: string;
  minimumSurfaceContrast: number; contrastSearchTarget: number;
  surfaces: Readonly<Record<ChartMode, readonly string[]>>;
  roles: Readonly<Record<string, Readonly<{ anchor: string; index: number }>>>;
  patterns: readonly ChartPattern[];
  exampleKeys: readonly Readonly<{ key: string; label: string }>[];
  [key: string]: unknown;
}>;
export function chartColour(key: string, options?: ChartColourOptions): string;
export function chartSeriesStyle(key: string, options?: ChartColourOptions): ChartSeriesStyle;
export function chartContrast(one: string, two: string): number;
