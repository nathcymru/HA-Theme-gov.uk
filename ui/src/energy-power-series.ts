type Series = { id?: unknown; type?: unknown; data?: any[]; [key: string]: any };
const values = (point: any): any[] | undefined => Array.isArray(point) ? point : Array.isArray(point?.value) ? point.value : undefined;

/**
 * HA splits signed grid/battery power into max(0, y) and min(0, y) solely to
 * work around stacked-area interpolation. An individual line needs the one
 * signed reading. Select that existing sample; never add, interpolate, fill
 * missing points, alter the source, or guess at unfamiliar series shapes.
 * The secondary ID remains present for HA's native paired legend actions.
 */
export function projectPowerSeries<T extends Series>(source: readonly T[]): T[] {
  const output = [...source];
  for (const id of ['grid', 'battery']) {
    const positiveIndex = source.findIndex(series => series.id === id);
    const negativeIndex = source.findIndex(series => series.id === `${id}-negative`);
    const positive = source[positiveIndex], negative = source[negativeIndex];
    if (positive?.type !== 'line' || negative?.type !== 'line'
      || !positive.data?.length || positive.data.length !== negative.data?.length) continue;
    let previousTime = -Infinity;
    const valid = positive.data.every((point, index) => {
      const a = values(point), b = values(negative.data![index]);
      if (!a || !b || a.length < 2 || a.length !== b.length || !Number.isFinite(a[0])
        || a[0] !== b[0] || a[0] <= previousTime || a.slice(2).some((value, i) => value !== b[i + 2])) return false;
      previousTime = a[0];
      if (a[1] == null || b[1] == null) return a[1] == null && b[1] == null;
      return Number.isFinite(a[1]) && Number.isFinite(b[1]) && a[1] >= 0 && b[1] <= 0 && (a[1] === 0 || b[1] === 0);
    });
    if (!valid) continue;
    const data = positive.data.map((point, index) => {
      const a = values(point)!, b = values(negative.data![index])!;
      if (a[1] !== 0 || b[1] === 0) return point;
      const value = [...a]; value[1] = b[1];
      return Array.isArray(point) ? value : { ...point, value };
    });
    output[positiveIndex] = { ...positive, data };
    output[negativeIndex] = { ...negative, data: [] };
  }
  return output;
}
