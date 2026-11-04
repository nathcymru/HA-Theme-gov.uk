// lighting/engine/discovery.ts
var RESERVED_LABEL = "govuk_lighting_reserved";
var isReserved = (s, id) => !!s.entities[id]?.labels?.includes(RESERVED_LABEL);
var isLight = (id) => id.startsWith("light.");
var members = (s, id) => {
  const e = s.states[id]?.attributes?.entity_id;
  return Array.isArray(e) && e.length ? e : null;
};
function effectiveArea(s, id) {
  const e = s.entities[id];
  if (!e) return null;
  return e.area_id ?? (e.device_id ? s.devices[e.device_id]?.area_id ?? null : null);
}
function expand(s, id, seen = /* @__PURE__ */ new Set()) {
  if (seen.has(id)) return [];
  seen.add(id);
  const m = members(s, id);
  return m ? m.filter(isLight).flatMap((x) => expand(s, x, seen)) : [id];
}
function resolveRoomMembers(s, room) {
  const out = /* @__PURE__ */ new Set();
  const add = (id) => expand(s, id).forEach((x) => out.add(x));
  const candidates = new Set([...Object.keys(s.entities), ...Object.keys(s.states)].filter(isLight));
  if (room.area) for (const id of candidates) {
    const reg = s.entities[id];
    if (reg?.disabled_by || reg?.hidden_by) continue;
    if (effectiveArea(s, id) === room.area) add(id);
  }
  (room.entities ?? []).forEach(add);
  (room.include ?? []).forEach(add);
  for (const x of room.exclude ?? []) expand(s, x).forEach((m) => out.delete(m));
  return [...out].filter((id) => isLight(id) && (s.states[id] || s.entities[id])).sort();
}
var resolveRoomLights = (s, room) => resolveRoomMembers(s, room).filter((id) => !isReserved(s, id));
var resolveReserved = (s, room) => resolveRoomMembers(s, room).filter((id) => isReserved(s, id));

// lighting/engine/capabilities.ts
var COLOR_MODES = ["hs", "xy", "rgb", "rgbw", "rgbww"];
function lightCapability(s, id) {
  const st = s.states[id];
  const reg = s.entities[id];
  const dev = reg?.device_id ? s.devices[reg.device_id] : void 0;
  const base = { entityId: id, manufacturer: dev?.manufacturer, model: dev?.model, platform: reg?.platform };
  if (!st) return { ...base, status: "unknown", color: false, colorTemp: false, dimmable: false, onOffOnly: false };
  const modes = st.attributes.supported_color_modes ?? [];
  if (st.state === "unavailable" || st.state === "unknown") {
    return { ...base, status: st.state === "unavailable" ? "unavailable" : "unknown", ...flags(modes), ...range(st.attributes) };
  }
  return { ...base, status: "available", ...flags(modes), ...range(st.attributes) };
}
function flags(modes) {
  const color = modes.some((m) => COLOR_MODES.includes(m));
  const colorTemp = modes.includes("color_temp");
  const dimmable = color || colorTemp || modes.includes("brightness") || modes.includes("white");
  return { color, colorTemp, dimmable, onOffOnly: modes.length > 0 && !dimmable };
}
function range(a) {
  const r = {};
  if (typeof a.min_color_temp_kelvin === "number") r.minKelvin = a.min_color_temp_kelvin;
  if (typeof a.max_color_temp_kelvin === "number") r.maxKelvin = a.max_color_temp_kelvin;
  return r;
}
function recipeAvailability(caps, r) {
  const mk = (availability, reason) => ({ recipeId: r.id, availability, reason });
  if (caps.length === 0) return mk("unsupported", "no_lights");
  const live = caps.filter((c) => c.status === "available");
  if (live.length === 0) return mk("unsupported", "all_unavailable");
  const colour = live.filter((c) => c.color).length;
  if (r.category === "color") {
    if (live.length < caps.length) return mk("unsupported", "members_unavailable");
    return colour === live.length ? mk("full") : mk("unsupported", "needs_all_colour");
  }
  if (r.category === "white") {
    const useful = live.filter((c) => c.colorTemp || c.color || c.dimmable);
    if (!useful.length) return mk("unsupported", "no_dimmable_lights");
    const full = live.length === caps.length && live.every((c) => c.colorTemp || c.color);
    return full ? mk("full") : mk("adaptive", "some_lights_cannot_change_temperature");
  }
  const need = r.minColorLights ?? 1;
  if (colour < need) return mk("unsupported", "needs_colour_light");
  return colour === live.length && live.length === caps.length ? mk("full") : mk("adaptive", "adapts_to_available_lights");
}
function assessRoom(s, room, recipes) {
  const caps = resolveRoomLights(s, room).map((id) => lightCapability(s, id));
  const live = caps.filter((c) => c.status === "available");
  return {
    roomId: room.id,
    totalLights: caps.length,
    reservedLights: resolveReserved(s, room).length,
    availableLights: live.length,
    unavailableLights: caps.filter((c) => c.status === "unavailable").length,
    unknownLights: caps.filter((c) => c.status === "unknown").length,
    colorLights: live.filter((c) => c.color).length,
    colorTemperatureLights: live.filter((c) => c.colorTemp).length,
    dimmableLights: live.filter((c) => c.dimmable).length,
    onOffOnlyLights: live.filter((c) => c.onOffOnly).length,
    allSupportColor: live.length > 0 && live.every((c) => c.color),
    someSupportColor: live.some((c) => c.color),
    allSupportColorTemperature: live.length > 0 && live.every((c) => c.colorTemp || c.color),
    lightCapabilities: caps,
    availableRecipes: recipes.map((r) => recipeAvailability(caps, r))
  };
}

// lighting/engine/plan.ts
var defaultBrandOf = (c) => {
  const m = (c.manufacturer ?? "").toLowerCase();
  if (/signify|philips/.test(m)) return "hue";
  if (/innr/.test(m)) return "innr";
  return "default";
};
var hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
var pick = (e, b) => b === "innr" ? e.innr : e.hue;
var clamp = (k, c) => Math.min(c.maxKelvin ?? k, Math.max(c.minKelvin ?? k, k));
function buildPlan(recipe, caps, brandOf = defaultBrandOf) {
  const av = recipeAvailability(caps, { id: recipe.id, category: recipe.category, label: recipe.label, minColorLights: recipe.minColorLights });
  const live = caps.filter((c) => c.status === "available").sort((a, b) => a.entityId.localeCompare(b.entityId));
  const skipped = caps.filter((c) => c.status !== "available").map((c) => c.entityId);
  const plan = { roomId: "", recipeId: recipe.id, availability: av.availability, steps: [], effectivePalette: [], skipped, transitionS: recipe.transitionS ?? 1 };
  if (av.availability === "unsupported") return plan;
  const whiteStep = (c, kelvin, pct = 100) => {
    if (c.colorTemp || c.color) {
      const k = c.colorTemp ? clamp(kelvin, c) : kelvin;
      return { entityId: c.entityId, kind: "white", sequence: [{ kelvin: k, brightnessPct: pct, adjusted: k !== kelvin ? `clamped ${kelvin}K to ${k}K` : void 0 }] };
    }
    return { entityId: c.entityId, kind: c.dimmable ? "brightness" : "onoff", sequence: [{ brightnessPct: pct }] };
  };
  if (recipe.category === "white") {
    const target = recipe.kelvin;
    for (const c of live) plan.steps.push(whiteStep(c, pick({ hue: target.hue, innr: target.innr }, brandOf(c)), recipe.brightnessPct));
    plan.effectivePalette = live.some((c) => c.colorTemp || c.color) ? [recipe.preview] : ["#FFFFFF"];
    return plan;
  }
  if (recipe.category === "color") {
    for (const c of live) {
      const rgb = pick(recipe, brandOf(c));
      plan.steps.push({ entityId: c.entityId, kind: "color", sequence: [{ rgb, brightnessPct: 100 }] });
    }
    plan.effectivePalette = [recipe.preview];
    return plan;
  }
  const colourEntries = recipe.palette.filter((p) => !p.kelvin);
  const whiteEntry = recipe.palette.find((p) => p.kelvin);
  const colourLights = live.filter((c) => c.color);
  colourLights.forEach((c, i) => {
    const b = brandOf(c);
    const seq = colourEntries.length ? colourEntries.map((_, k) => colourEntries[(i + k) % colourEntries.length]) : [];
    plan.steps.push({ entityId: c.entityId, kind: "color", sequence: seq.map((p) => ({ hex: pick(p, b), rgb: hexToRgb(pick(p, b)), brightnessPct: p.brightnessPct ?? 100 })) });
  });
  live.filter((c) => !c.color).forEach((c) => {
    const k = whiteEntry?.kelvin ?? 2700;
    plan.steps.push(whiteStep(c, k, 60));
  });
  const used = new Set(plan.steps.filter((s) => s.kind === "color").flatMap((s) => s.sequence.map((q) => q.hex.toUpperCase())));
  plan.effectivePalette = [...used];
  if (plan.steps.some((s) => s.kind !== "color") && whiteEntry) plan.effectivePalette.push("#FFFFFF");
  return plan;
}

// lighting/generated/recipes.json
var recipes_default = [
  {
    id: "candlelight",
    version: 1,
    category: "white",
    label: "Candlelight",
    preview: "#FF8912",
    slug: "candlelight",
    kelvin: {
      hue: 2e3,
      innr: 1800
    },
    brightnessPct: 30
  },
  {
    id: "warm_white",
    version: 1,
    category: "white",
    label: "Warm white",
    preview: "#FFB76C",
    slug: "warm_white",
    kelvin: {
      hue: 2700,
      innr: 2700
    },
    brightnessPct: 100
  },
  {
    id: "daylight",
    version: 1,
    category: "white",
    label: "Daylight",
    preview: "#FFE4CE",
    slug: "daylight",
    kelvin: {
      hue: 4e3,
      innr: 4e3
    },
    brightnessPct: 100
  },
  {
    id: "cool_white",
    version: 1,
    category: "white",
    label: "Cool white",
    preview: "#C9E2FF",
    slug: "cool_white",
    kelvin: {
      hue: 6500,
      innr: 6500
    },
    brightnessPct: 100
  },
  {
    id: "red",
    version: 1,
    category: "color",
    label: "Red",
    previewCss: "#FF0000",
    slug: "red",
    preview: "#FF0000",
    hue: [
      255,
      0,
      0
    ],
    innr: [
      255,
      0,
      0
    ]
  },
  {
    id: "orange",
    version: 1,
    category: "color",
    label: "Orange",
    previewCss: "#FF5E00",
    slug: "orange",
    preview: "#FF5E00",
    hue: [
      255,
      94,
      0
    ],
    innr: [
      255,
      80,
      0
    ]
  },
  {
    id: "yellow",
    version: 1,
    category: "color",
    label: "Yellow",
    previewCss: "#FFD900",
    slug: "yellow",
    preview: "#FFD900",
    hue: [
      255,
      217,
      0
    ],
    innr: [
      255,
      200,
      0
    ]
  },
  {
    id: "green",
    version: 1,
    category: "color",
    label: "Green",
    previewCss: "#00FF00",
    slug: "green",
    preview: "#00FF00",
    hue: [
      0,
      255,
      0
    ],
    innr: [
      0,
      255,
      0
    ]
  },
  {
    id: "cyan",
    version: 1,
    category: "color",
    label: "Cyan",
    previewCss: "#00F2FF",
    slug: "cyan",
    preview: "#00F2FF",
    hue: [
      0,
      242,
      255
    ],
    innr: [
      0,
      230,
      255
    ]
  },
  {
    id: "blue",
    version: 1,
    category: "color",
    label: "Blue",
    previewCss: "#002BFF",
    slug: "blue",
    preview: "#002BFF",
    hue: [
      0,
      43,
      255
    ],
    innr: [
      0,
      20,
      255
    ]
  },
  {
    id: "purple",
    version: 1,
    category: "color",
    label: "Purple",
    previewCss: "#D400FF",
    slug: "purple",
    preview: "#D400FF",
    hue: [
      212,
      0,
      255
    ],
    innr: [
      212,
      0,
      255
    ]
  },
  {
    id: "rugby",
    version: 1,
    category: "scene",
    previewCss: "linear-gradient(90deg, #D30A24 0%, #00FF00 50%, #FFFFFF 100%)",
    slug: "rugby",
    label: "Welsh Rugby",
    transitionS: 5,
    stops: [
      [
        0,
        "#D30A24"
      ],
      [
        50,
        "#00FF00"
      ],
      [
        100,
        "#FFFFFF"
      ]
    ],
    palette: [
      {
        name: "Welsh red",
        hue: "#D30A24",
        innr: "#FF0000"
      },
      {
        name: "Field green",
        hue: "#008000",
        innr: "#00FF00"
      },
      {
        name: "White",
        kelvin: 5e3
      }
    ],
    distribution: "even_rotate"
  },
  {
    id: "football",
    version: 1,
    category: "scene",
    previewCss: "linear-gradient(90deg, #004D98 0%, #FFFFFF 50%, #00FF00 100%)",
    slug: "football",
    label: "Everton Football",
    transitionS: 15,
    stops: [
      [
        0,
        "#004D98"
      ],
      [
        50,
        "#FFFFFF"
      ],
      [
        100,
        "#00FF00"
      ]
    ],
    palette: [
      {
        name: "Royal blue",
        hue: "#004D98",
        innr: "#002BFF"
      },
      {
        name: "Kit white",
        kelvin: 4e3
      },
      {
        name: "Pitch green",
        hue: "#00FF00",
        innr: "#00FF00"
      }
    ],
    distribution: "roles"
  },
  {
    id: "halloween",
    version: 1,
    category: "scene",
    previewCss: "linear-gradient(90deg, #FF5E00 0%, #800080 50%, #00FF00 100%)",
    slug: "halloween",
    label: "Halloween",
    transitionS: 8,
    stops: [
      [
        0,
        "#FF5E00"
      ],
      [
        50,
        "#800080"
      ],
      [
        100,
        "#00FF00"
      ]
    ],
    palette: [
      {
        name: "Pumpkin orange",
        hue: "#FF5E00",
        innr: "#FF5E00"
      },
      {
        name: "Witches purple",
        hue: "#800080",
        innr: "#800080"
      },
      {
        name: "Slime green",
        hue: "#00FF00",
        innr: "#00FF00"
      }
    ],
    distribution: "even_rotate",
    optionalEffects: {
      lightning: {
        defaultEnabled: false,
        minIntervalS: 30,
        maxIntervalS: 90,
        flashKelvin: 6500,
        dimPct: 10
      }
    }
  },
  {
    id: "christmas",
    version: 1,
    category: "scene",
    previewCss: "linear-gradient(90deg, #FF0000 0%, #008000 25%, #FFD700 50%, #C0C0C0 75%, #FFFFFF 100%)",
    slug: "christmas",
    label: "Christmas",
    transitionS: 20,
    stops: [
      [
        0,
        "#FF0000"
      ],
      [
        25,
        "#008000"
      ],
      [
        50,
        "#FFD700"
      ],
      [
        75,
        "#C0C0C0"
      ],
      [
        100,
        "#FFFFFF"
      ]
    ],
    palette: [
      {
        name: "Festive red",
        hue: "#FF0000",
        innr: "#FF0000"
      },
      {
        name: "Pine green",
        hue: "#008000",
        innr: "#008000"
      },
      {
        name: "Warm gold",
        hue: "#FFD700",
        innr: "#FFA500"
      },
      {
        name: "Ornament silver",
        hue: "#E0E0E0",
        innr: "#E0E0E0",
        brightnessPct: 60
      },
      {
        name: "Cosy white",
        kelvin: 2700
      }
    ],
    distribution: "even_rotate"
  },
  {
    id: "emergency",
    version: 1,
    category: "scene",
    previewCss: "linear-gradient(90deg, #FF0000 0%, #0000FF 100%)",
    slug: "emergency",
    label: "Emergency (police pulse)",
    transitionS: 0,
    intervalS: 0.5,
    stops: [
      [
        0,
        "#FF0000"
      ],
      [
        100,
        "#0000FF"
      ]
    ],
    palette: [
      {
        name: "Police red",
        hue: "#FF0000",
        innr: "#FF0000"
      },
      {
        name: "Police blue",
        hue: "#0000FF",
        innr: "#0000FF"
      }
    ],
    distribution: "opposed",
    safety: {
      flashing: true,
      disabledByDefault: true,
      requiresOptIn: true,
      maxRuntimeS: 60
    }
  }
];

// card/src/rooms.json
var rooms_default = {
  image: {
    file: "assets/floorplan.png",
    width: 1448,
    height: 1086,
    sha256: "3d35a6d91cbddb794eff5d631edeb1af53301d9b9a3a050410e3afb2e6b8bb98"
  },
  regions: {
    lounge: [
      [
        98,
        40
      ],
      [
        590,
        40
      ],
      [
        590,
        420
      ],
      [
        670,
        420
      ],
      [
        670,
        610
      ],
      [
        98,
        610
      ]
    ],
    bathroom: [
      [
        592,
        40
      ],
      [
        858,
        40
      ],
      [
        858,
        410
      ],
      [
        595,
        410
      ]
    ],
    kitchen: [
      [
        862,
        40
      ],
      [
        1345,
        40
      ],
      [
        1340,
        412
      ],
      [
        875,
        412
      ]
    ],
    hall: [
      [
        672,
        412
      ],
      [
        782,
        412
      ],
      [
        782,
        962
      ],
      [
        585,
        962
      ],
      [
        585,
        632
      ],
      [
        672,
        632
      ]
    ],
    study: [
      [
        80,
        628
      ],
      [
        552,
        628
      ],
      [
        552,
        962
      ],
      [
        80,
        962
      ]
    ],
    bedroom: [
      [
        785,
        435
      ],
      [
        1342,
        435
      ],
      [
        1375,
        958
      ],
      [
        812,
        958
      ]
    ]
  },
  rooms: [
    {
      id: "lounge",
      name: "Lounge",
      area: "lounge"
    },
    {
      id: "kitchen",
      name: "Kitchen",
      area: "kitchen"
    },
    {
      id: "bathroom",
      name: "Bathroom",
      area: "bathroom"
    },
    {
      id: "hall",
      name: "Hallway",
      area: "hall"
    },
    {
      id: "study",
      name: "Office / Second bedroom",
      area: "study"
    },
    {
      id: "bedroom",
      name: "Main bedroom",
      area: "bedroom"
    }
  ],
  _note: "regions: hand-traced against the approved image (see docs); rooms: default room->HA area mapping, overridable in card config."
};

// card/src/styles.ts
var STYLES = `
:host { display: block; }
ha-card { font-family: var(--ha-font-family-body); color: var(--primary-text-color); }
.body { padding: 16px; }
.title { margin: 0 0 8px; font-size: var(--ha-card-header-font-size, 24px); font-weight: var(--ha-font-weight-heading, 700); }
.status { margin: 0 0 16px; color: var(--secondary-text-color); }
.actions { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.btn { font: inherit; font-weight: 700; min-height: 44px; padding: 8px 16px; cursor: pointer; border: 2px solid var(--primary-color); border-radius: 0;
  background: var(--primary-color); color: var(--text-primary-color); box-shadow: 0 2px 0 var(--ha-color-primary-10); }
.btn:hover { background: var(--ha-color-primary-30); border-color: var(--ha-color-primary-30); }
.btn--secondary { background: var(--card-background-color); color: var(--primary-text-color); border-color: var(--primary-text-color); box-shadow: none; }
.btn--secondary:hover { background: var(--divider-color); }
.btn--warning { background: var(--error-color); border-color: var(--error-color); color: var(--text-primary-color); }
.btn--small { min-width: 88px; }
.btn:disabled, .tile:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:focus-visible, .link:focus-visible, .tab:focus-visible, .tile:focus-visible { outline: var(--wa-focus-ring-width, 3px) solid var(--ha-color-focus); outline-offset: 0; box-shadow: 0 4px 0 var(--primary-text-color); }
.rooms { margin: 0 0 24px; padding: 0; }
.row { display: grid; grid-template-columns: 1fr; gap: 4px 16px; padding: 12px 0; border-bottom: 1px solid var(--divider-color); }
@media (min-width: 480px) { .row { grid-template-columns: 30% 1fr auto; align-items: center; } }
.key { font-weight: 700; margin: 0; }
.value { margin: 0; }
.act { margin: 0; display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.link { font: inherit; background: none; border: 0; padding: 8px 0; color: var(--primary-color); text-decoration: underline; cursor: pointer; min-height: 44px; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.plan { display: block; width: 100%; height: auto; }
.shade { transition: opacity 0.3s; }
.shade--off { fill: var(--primary-text-color); opacity: 0.45; }
.shade--lit { opacity: 0.28; mix-blend-mode: soft-light; }
.hit { fill: transparent; stroke: none; cursor: pointer; }
.hit:hover { fill: var(--ha-color-focus); fill-opacity: 0.18; }
.hit:focus-visible { outline: none; stroke: var(--ha-color-focus); stroke-width: 8px; fill: var(--ha-color-focus); fill-opacity: 0.18; }
.dlg { max-width: min(640px, 92vw); border: var(--ha-border-width-lg, 4px) solid var(--primary-text-color); border-radius: 0; padding: 24px; background: var(--card-background-color); color: var(--primary-text-color); font-family: var(--ha-font-family-body); }
.dlg::backdrop { background: var(--primary-text-color); opacity: 0.6; }
.dlg-title { margin: 0 0 16px; font-size: 24px; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid var(--divider-color); margin-bottom: 16px; }
.tab { font: inherit; padding: 12px 16px; min-height: 44px; border: 1px solid var(--divider-color); border-bottom: 0; border-radius: 0; background: var(--secondary-background-color); color: var(--primary-text-color); cursor: pointer; }
.tab[aria-selected=true] { background: var(--card-background-color); font-weight: 700; border-top: 4px solid var(--primary-color); }
.tiles { list-style: none; margin: 0 0 24px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.tile { width: 100%; font: inherit; text-align: left; display: block; padding: 0; cursor: pointer; background: var(--card-background-color); color: var(--primary-text-color); border: 2px solid var(--divider-color); border-radius: 0; }
.tile[aria-pressed=true] { border-color: var(--primary-text-color); border-width: 4px; }
.swatch { display: block; height: 48px; border-bottom: 2px solid var(--divider-color); }
.tile-label { display: block; padding: 8px; font-weight: 700; }
.note { margin: 4px 0 0; font-size: 14px; color: var(--secondary-text-color); }
`;

// card/src/card.ts
var SVG = "http://www.w3.org/2000/svg";
var RECIPE_LIST = recipes_default;
var CATS = [["white", "Whites"], ["color", "Solid colours"], ["scene", "Dynamic scenes"]];
var REASONS = {
  no_lights: "This room has no lights this card can control.",
  all_unavailable: "All lights in this room are unavailable.",
  members_unavailable: "Some lights are unavailable, so the whole room cannot be set to one colour.",
  needs_all_colour: "Every light in this room must be able to show colour.",
  needs_colour_light: "This room needs at least one colour light.",
  no_dimmable_lights: "No light in this room can be dimmed."
};
var ADAPT = "This scene will adapt to the lights in this room.";
var SAFE_CSS = /^(#[0-9A-Fa-f]{6}|linear-gradient\(90deg(, #[0-9A-Fa-f]{6} \d{1,3}%)+\))$/;
var safeCss = (v) => SAFE_CSS.test(v) ? v : "transparent";
var previewOf = (r) => safeCss(r.previewCss ?? r.preview);
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== void 0 && v !== false) e.setAttribute(k, v === true ? "" : String(v));
  }
  e.append(...kids);
  return e;
}
var svg = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};
var GovukHouseLightingCard = class extends HTMLElement {
  _hass;
  config;
  root;
  views = /* @__PURE__ */ new Map();
  dialog;
  current;
  reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  onMotion = () => this.paintAll();
  status;
  list;
  plan;
  built = false;
  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }
  static getStubConfig() {
    return { type: "custom:govuk-house-lighting-card" };
  }
  setConfig(config) {
    if (!config || config.type === void 0) throw new Error('govuk-house-lighting-card: "type" is required');
    const rooms = config.rooms ?? rooms_default.rooms;
    if (!Array.isArray(rooms) || !rooms.length) throw new Error('"rooms" must be a non-empty list');
    const ids = /* @__PURE__ */ new Set();
    for (const r of rooms) {
      if (!r.id || !/^[a-z][a-z0-9_]*$/.test(r.id)) throw new Error(`room id "${r.id}" is invalid (lowercase letters, digits, underscore)`);
      if (ids.has(r.id)) throw new Error(`duplicate room id "${r.id}"`);
      ids.add(r.id);
      if (!r.area && !r.entities?.length) throw new Error(`room "${r.id}" needs an "area" or "entities"`);
      if (!(r.id in rooms_default.regions)) throw new Error(`room "${r.id}" has no floor-plan region (known: ${Object.keys(rooms_default.regions).join(", ")})`);
    }
    this.config = { ...config, rooms, title: config.title ?? "House lighting" };
    this.built = false;
    this.views.clear();
    if (this._hass) this.set_hass(this._hass);
  }
  getCardSize() {
    return 8;
  }
  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }
  set hass(h) {
    this.set_hass(h);
  }
  set_hass(h) {
    this._hass = h;
    if (!this.config) return;
    if (!this.built) this.build();
    this.refresh();
  }
  connectedCallback() {
    this.reduceMotion.addEventListener("change", this.onMotion);
  }
  disconnectedCallback() {
    this.reduceMotion.removeEventListener("change", this.onMotion);
    this.dialog?.close();
  }
  snapshot() {
    const h = this._hass;
    return { entities: h.entities ?? {}, devices: h.devices ?? {}, states: h.states };
  }
  build() {
    this.built = true;
    const style = el("style");
    style.textContent = STYLES;
    const title = el("h2", { class: "title" }, this.config.title);
    this.status = el("p", { class: "status", role: "status" });
    const all = el(
      "div",
      { class: "actions" },
      el("button", { class: "btn", type: "button", onclick: () => this.all(true) }, "Turn all on"),
      el("button", { class: "btn btn--secondary", type: "button", onclick: () => this.all(false) }, "Turn all off")
    );
    this.list = el("dl", { class: "rooms" });
    this.plan = this.buildPlan();
    this.root.replaceChildren(style, el("ha-card", {}, el("div", { class: "body" }, title, this.status, all, this.list, this.plan)));
    for (const cfg of this.config.rooms) this.views.set(cfg.id, { cfg, caps: void 0, sig: "", on: 0, owner: "" });
    for (const v of this.views.values()) this.list.append(this.buildRow(v));
    this.dialog = this.buildDialog();
    this.root.append(this.dialog);
  }
  buildPlan() {
    const { width, height } = rooms_default.image;
    const s = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "plan", role: "group", "aria-label": "Floor plan. Select a room to change its lighting." });
    const base = this.config.image ?? new URL(`../${rooms_default.image.file}`, import.meta.url).href;
    const img = svg("image", { href: base, x: 0, y: 0, width, height });
    s.append(img);
    for (const cfg of this.config.rooms) {
      const pts = rooms_default.regions[cfg.id].map((p) => p.join(",")).join(" ");
      s.append(svg("polygon", { points: pts, class: "shade", "data-room": cfg.id, "pointer-events": "none" }));
    }
    for (const cfg of this.config.rooms) {
      const pts = rooms_default.regions[cfg.id].map((p) => p.join(",")).join(" ");
      const hit = svg("polygon", { points: pts, class: "hit", tabindex: 0, role: "button", "data-room": cfg.id });
      hit.addEventListener("click", () => this.open(cfg.id));
      hit.addEventListener("keydown", (e) => {
        const k = e.key;
        if (k === "Enter" || k === " ") {
          e.preventDefault();
          this.open(cfg.id);
        }
      });
      s.append(hit);
    }
    return s;
  }
  buildRow(v) {
    const name = v.cfg.name ?? v.cfg.id;
    const state = el("dd", { class: "value", "data-role": "state" });
    const toggle = el("button", { class: "btn btn--small", type: "button", onclick: () => this.toggle(v) });
    const settings = el("button", { class: "link", type: "button", onclick: (e) => this.open(v.cfg.id, e.currentTarget) }, "Settings", el("span", { class: "vh" }, ` for ${name}`));
    const stop = el("button", { class: "link", type: "button", hidden: true, onclick: () => this.stop(v, false) }, "Stop scene", el("span", { class: "vh" }, ` in ${name}`));
    const row = el("div", { class: "row", "data-room": v.cfg.id }, el("dt", { class: "key" }, name), state, el("dd", { class: "act" }, toggle, stop, settings));
    v.row = row;
    return row;
  }
  buildDialog() {
    const d = el("dialog", { class: "dlg", "aria-labelledby": "dlg-title" });
    d.addEventListener("close", () => {
      this.current = void 0;
    });
    return d;
  }
  open(roomId, opener) {
    this.current = roomId;
    this.renderDialog();
    if (!this.dialog.open) this.dialog.showModal();
    void opener;
  }
  renderDialog(tab = "white") {
    const v = this.views.get(this.current), d = this.dialog;
    const avail = new Map(v.caps.availableRecipes.map((a) => [a.recipeId, a]));
    const tabs = el("div", { role: "tablist", class: "tabs", "aria-label": "Lighting type" });
    const panels = el("div");
    CATS.forEach(([cat, label]) => {
      const t = el("button", {
        role: "tab",
        type: "button",
        class: "tab",
        id: `tab-${cat}`,
        "aria-controls": `panel-${cat}`,
        "aria-selected": String(cat === tab),
        tabindex: cat === tab ? 0 : -1,
        onclick: () => this.renderDialog(cat),
        onkeydown: (e) => {
          const i = CATS.findIndex((c) => c[0] === cat);
          const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
          if (n >= 0) {
            e.preventDefault();
            this.renderDialog(CATS[(n + CATS.length) % CATS.length][0]);
            this.dialog.querySelector("[aria-selected=true]").focus();
          }
        }
      }, label);
      tabs.append(t);
      const p = el("div", { role: "tabpanel", id: `panel-${cat}`, "aria-labelledby": `tab-${cat}`, hidden: cat !== tab });
      const grid = el("ul", { class: "tiles" });
      for (const r of RECIPE_LIST.filter((x) => x.category === cat)) {
        const a = avail.get(r.id);
        const off = a.availability === "unsupported";
        const note = off ? REASONS[a.reason ?? ""] ?? "Not available in this room." : a.availability === "adaptive" ? ADAPT : "";
        const swatch = el("span", { class: "swatch" });
        swatch.style.background = previewOf(r);
        const selected = v.owner === r.id;
        const btn = el("button", { class: "tile", type: "button", disabled: off, "aria-pressed": String(selected), "aria-describedby": note ? `n-${r.id}` : void 0, onclick: () => this.pick(v, r) }, swatch, el("span", { class: "tile-label" }, r.label));
        grid.append(el("li", {}, btn, note ? el("p", { id: `n-${r.id}`, class: "note" }, note) : ""));
      }
      p.append(grid);
      panels.append(p);
    });
    d.replaceChildren(
      el("h3", { id: "dlg-title", class: "dlg-title" }, `${v.cfg.name ?? v.cfg.id} lighting`),
      tabs,
      panels,
      el("button", { class: "btn btn--secondary", type: "button", onclick: () => d.close() }, "Close")
    );
  }
  async pick(v, r) {
    if (r.safety?.flashing) {
      const ok = await this.confirmFlashing(r);
      if (!ok) return;
      await this._hass.callService("input_boolean", "turn_on", {}, { entity_id: "input_boolean.govuk_lights_allow_flashing" });
    }
    try {
      await this._hass.callService("script", "govuk_lights_apply", { room: v.cfg.id, recipe: r.id });
      this.dialog.close();
    } catch (e) {
      this.toast(`Could not apply ${r.label}: ${e.message}`);
    }
  }
  confirmFlashing(r) {
    return new Promise((res) => {
      const c = el(
        "dialog",
        { class: "dlg", "aria-labelledby": "w-title" },
        el("h3", { id: "w-title", class: "dlg-title" }, "Warning: flashing lights"),
        el("p", {}, `${r.label} flashes red and blue quickly. It can trigger seizures in people with photosensitive epilepsy. It stops by itself after ${r.safety.maxRuntimeS} seconds, or when you select Stop scene.`),
        el(
          "div",
          { class: "actions" },
          el("button", { class: "btn btn--warning", type: "button", onclick: () => {
            c.close("yes");
          } }, "Start flashing"),
          el("button", { class: "btn btn--secondary", type: "button", autofocus: true, onclick: () => c.close("no") }, "Cancel")
        )
      );
      c.addEventListener("close", () => {
        res(c.returnValue === "yes");
        c.remove();
      });
      this.root.append(c);
      c.showModal();
    });
  }
  toast(msg) {
    if (this.status) this.status.textContent = msg;
  }
  async toggle(v) {
    if (v.on > 0) return this.stop(v, true);
    const ids = v.caps.lightCapabilities.map((c) => c.entityId);
    if (!ids.length) return;
    try {
      await this._hass.callService("light", "turn_on", {}, { entity_id: ids });
    } catch (e) {
      this.toast(`Could not turn on ${v.cfg.name}: ${e.message}`);
    }
  }
  async stop(v, off) {
    try {
      await this._hass.callService("script", "govuk_lights_stop", { room: v.cfg.id, turn_off: off });
    } catch (e) {
      this.toast(`Could not stop ${v.cfg.name}: ${e.message}`);
    }
  }
  async all(on) {
    for (const v of this.views.values()) if (on ? v.on === 0 : v.on > 0) await this.toggle(v);
  }
  /** Recompute only rooms whose inputs changed. */
  refresh() {
    const snap = this.snapshot();
    let changed = false;
    for (const v of this.views.values()) {
      const caps = assessRoom(snap, v.cfg, RECIPE_LIST);
      const owner = snap.states[`input_text.govuk_lights_${v.cfg.id}`]?.state ?? "";
      const on = caps.lightCapabilities.filter((c) => snap.states[c.entityId]?.state === "on").length;
      const sig = JSON.stringify([caps.reservedLights, caps.lightCapabilities.map((c) => [c.entityId, c.status, c.color, c.colorTemp, c.dimmable, snap.states[c.entityId]?.state]), owner]);
      if (sig === v.sig) continue;
      Object.assign(v, { caps, owner, on, sig });
      changed = true;
      this.paintRoom(v);
    }
    if (changed) {
      this.paintSummary();
      if (this.dialog?.open && this.current) {
        const t = this.dialog.querySelector("[aria-selected=true]")?.id.replace("tab-", "") ?? "white";
        const f = this.root.activeElement;
        this.renderDialog(t);
        if (f?.id) this.dialog.querySelector(`#${CSS.escape(f.id)}`)?.focus();
      }
    }
  }
  paintAll() {
    for (const v of this.views.values()) if (v.caps) this.paintRoom(v);
  }
  describe(v) {
    const c = v.caps;
    if (c.totalLights === 0) return c.reservedLights > 0 ? "Managed by another automation" : "No lights";
    if (c.availableLights === 0) return "Unavailable";
    if (v.on === 0) return "Off";
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    const part = v.on < c.availableLights ? " (some lights off)" : "";
    return (rec ? `On, ${rec.label}` : "On, custom") + part;
  }
  paintRoom(v) {
    const st = v.row.querySelector("[data-role=state]");
    st.textContent = this.describe(v);
    const btn = v.row.querySelector(".btn");
    btn.textContent = v.on > 0 ? "Turn off" : "Turn on";
    btn.disabled = v.caps.availableLights === 0;
    btn.setAttribute("aria-label", `${v.on > 0 ? "Turn off" : "Turn on"} ${v.cfg.name ?? v.cfg.id}`);
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    v.row.querySelectorAll(".link")[0].hidden = !(rec?.category === "scene" && v.on > 0);
    const shade = this.plan.querySelector(`.shade[data-room=${v.cfg.id}]`);
    const hit = this.plan.querySelector(`.hit[data-room=${v.cfg.id}]`);
    hit.setAttribute("aria-label", `${v.cfg.name ?? v.cfg.id}, ${this.describe(v)}. Open lighting settings.`);
    shade.replaceChildren();
    shade.removeAttribute("style");
    if (v.on === 0) {
      shade.setAttribute("class", "shade shade--off");
      return;
    }
    shade.setAttribute("class", "shade shade--lit");
    let palette = [];
    if (rec) palette = buildPlan(rec, v.caps.lightCapabilities).effectivePalette;
    if (!palette.length) palette = ["#FFB76C"];
    palette = palette.filter((p) => /^#[0-9A-Fa-f]{6}$/.test(p));
    shade.setAttribute("fill", palette[0]);
    if (palette.length > 1 && !this.reduceMotion.matches) {
      const a = svg("animate", { attributeName: "fill", values: [...palette, palette[0]].join(";"), dur: `${Math.max(4, palette.length * 3)}s`, repeatCount: "indefinite" });
      shade.append(a);
    } else if (palette.length > 1) shade.setAttribute("fill", palette[0]);
  }
  paintSummary() {
    const vs = [...this.views.values()];
    const on = vs.filter((v) => v.on > 0).length;
    this.status.textContent = `${on} of ${vs.length} rooms on`;
  }
};
if (!customElements.get("govuk-house-lighting-card")) customElements.define("govuk-house-lighting-card", GovukHouseLightingCard);
window.customCards = window.customCards ?? [];
window.customCards.push({ type: "govuk-house-lighting-card", name: "GOV.UK house lighting", description: "Room lighting with floor plan, whites, colours and dynamic scenes." });
