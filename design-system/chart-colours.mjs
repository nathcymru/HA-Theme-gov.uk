import specification from './chart-colours.json' with { type: 'json' };

// Original civica.uk identity algorithm. Oklab conversion follows CSS Color 4;
// the palette policy, stable hashes and tone ranges are specified in the JSON.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const CHART_COLOUR_SPEC = freeze(specification);
const colourCache = new Map();
const CACHE_LIMIT = 2048;
const TAU = Math.PI * 2;
const roleFor = (key) => Object.hasOwn(CHART_COLOUR_SPEC.roles, key) ? CHART_COLOUR_SPEC.roles[key] : undefined;
const normalise = (key) => {
  if (typeof key !== 'string' || !key.trim()) throw new TypeError('A non-empty stable chart identity is required');
  return key.trim().normalize('NFC');
};
function hash(key) {
  let value = 2166136261;
  for (let i = 0; i < key.length; i++) value = Math.imul(value ^ key.charCodeAt(i), 16777619);
  value ^= value >>> 16; value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13; value = Math.imul(value, 0xc2b2ae35);
  return (value ^ value >>> 16) >>> 0;
}
const fraction = (key, salt) => hash(`${key}\0${salt}`) / 4294967296;
const interpolate = (range, position) => range[0] + (range[1] - range[0]) * position;
const decode = (channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const encode = (channel) => channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
const channels = (colour) => colour.match(/[\da-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
const luminance = (colour) => channels(colour).map(decode).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
export function chartContrast(one, two) {
  const a = luminance(one), b = luminance(two);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function fromHex(colour) {
  const [r, g, b] = channels(colour).map(decode);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: lightness, c: Math.hypot(a, bb), h: (Math.atan2(bb, a) + TAU) % TAU };
}
function linearRgb({ l, c, h }) {
  const a = c * Math.cos(h), b = c * Math.sin(h);
  const ll = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const ss = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * ll - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * ll + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * ll - 0.7034186147 * mm + 1.707614701 * ss];
}
const inGamut = (rgb) => rgb.every((channel) => channel >= -1e-8 && channel <= 1 + 1e-8);
function toHex(lch) {
  let rgb = linearRgb(lch);
  if (!inGamut(rgb)) {
    let low = 0, high = lch.c;
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2;
      if (inGamut(linearRgb({ ...lch, c: middle }))) low = middle;
      else high = middle;
    }
    rgb = linearRgb({ ...lch, c: low });
  }
  return '#' + rgb.map((channel) => Math.round(255 * encode(Math.max(0, Math.min(1, channel)))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function candidate(key, tone, mode) {
  const family = key.includes(':') ? key.slice(0, key.indexOf(':')) : '';
  const anchor = roleFor(key) ?? roleFor(family);
  if (anchor) {
    const colour = fromHex(anchor.anchor);
    if (mode !== 'light' || tone !== 'vivid') {
      const transform = CHART_COLOUR_SPEC.anchorTransformation[mode + (tone === 'vivid' ? 'Vivid' : 'Muted')];
      colour.l = mode === 'light' ? Math.min(transform.maximumLightness, colour.l + transform.lightnessOffset)
        : transform.lightnessBase + colour.l * transform.anchorLightnessMultiplier;
      colour.c *= transform.chromaMultiplier;
    }
    if (family) {
      const variation = CHART_COLOUR_SPEC.familyVariation;
      colour.l = Math.max(0.15, Math.min(0.9, colour.l + interpolate(variation.lightnessOffset, fraction(key, 'lightness'))));
      colour.c *= interpolate(variation.chromaMultiplier, fraction(key, 'chroma'));
    }
    return colour;
  }
  const range = CHART_COLOUR_SPEC.generated[mode][tone];
  return { h: fraction(key, 'hue') * TAU, l: interpolate(range.lightness, fraction(key, 'lightness')), c: interpolate(range.chroma, fraction(key, 'chroma')) };
}
function resolve(key, { tone = 'vivid', mode = 'light' } = {}) {
  if (!['vivid', 'muted'].includes(tone) || !['light', 'dark'].includes(mode)) throw new TypeError('Chart tone and mode must be vivid/muted and light/dark');
  const cacheKey = JSON.stringify([key, tone, mode]);
  if (colourCache.has(cacheKey)) return colourCache.get(cacheKey);
  const remember = (value) => {
    if (colourCache.size >= CACHE_LIMIT) colourCache.delete(colourCache.keys().next().value);
    colourCache.set(cacheKey, value);
    return value;
  };
  const colour = candidate(key, tone, mode);
  const surfaces = CHART_COLOUR_SPEC.surfaces[mode];
  const passes = (hex) => surfaces.every((surface) => chartContrast(hex, surface) >= CHART_COLOUR_SPEC.contrastSearchTarget);
  let result = toHex(colour);
  if (passes(result)) return remember(result);
  // Search toward black on light surfaces, white on dark surfaces. Contrast
  // is checked on the quantised sRGB output, not an unrenderable OKLCH target.
  let failing = colour.l, passing = mode === 'light' ? 0 : 1;
  result = toHex({ ...colour, l: passing });
  for (let i = 0; i < 24; i++) {
    const middle = (failing + passing) / 2;
    const trial = toHex({ ...colour, l: middle });
    if (passes(trial)) { passing = middle; result = trial; }
    else failing = middle;
  }
  return remember(result);
}

export function chartColour(key, options = {}) {
  return resolve(normalise(key), options);
}

export function chartSeriesStyle(key, options = {}) {
  key = normalise(key);
  const roleIndex = roleFor(key)?.index;
  const index = roleIndex ?? hash(key);
  const patternIndex = (roleIndex ?? hash(`${key}\0pattern`)) % CHART_COLOUR_SPEC.patterns.length;
  const dashIndex = (roleIndex ?? hash(`${key}\0line`)) % CHART_COLOUR_SPEC.lineDashes.length;
  const symbolIndex = (roleIndex ?? hash(`${key}\0symbol`)) % CHART_COLOUR_SPEC.symbols.length;
  return {
    color: resolve(key, options), index,
    pattern: CHART_COLOUR_SPEC.patterns[patternIndex],
    lineDash: key === 'consumption' ? [7, 2] : [...CHART_COLOUR_SPEC.lineDashes[dashIndex]],
    symbol: CHART_COLOUR_SPEC.symbols[symbolIndex],
  };
}
