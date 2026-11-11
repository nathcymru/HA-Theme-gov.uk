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
    label: "Welsh rugby",
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
    label: "Everton football",
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
      name: "Office or second bedroom",
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
:host { display: block; min-width: 0; }
*, *::before, *::after { box-sizing: border-box; }
ha-card { display: block; font-family: var(--ha-font-family-body, Arial, sans-serif); font-size: var(--civica-font-size-body, 19px); line-height: 1.5; color: var(--primary-text-color); background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 0; box-shadow: none; }
.body { padding: 15px; }
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 15px; margin-bottom: 15px; }
.title { margin: 0; font-size: var(--ha-card-header-font-size, 24px); font-weight: var(--ha-font-weight-heading, 700); }
.status { margin: 0 0 20px; font-size: var(--civica-font-size-small, 16px); color: var(--secondary-text-color); }
.actions { display: flex; flex-wrap: wrap; gap: 15px; }
/* GOV.UK button: theme body size (19px), weight 400, 2px border, padding 8px 10px 7px = 38px + 2px shadow, matching --ha-button-height. */
.btn { font: inherit; font-size: var(--civica-font-size-body, 19px); font-weight: 400; line-height: 1.3; min-width: 44px; min-height: 44px; box-sizing: border-box; position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin: 0; padding: 8px 10px 7px; cursor: pointer; text-align: center; vertical-align: top; border: 2px solid transparent; border-radius: 0;
  background: var(--primary-color); color: var(--text-primary-color); box-shadow: 0 2px 0 var(--ha-color-primary-10); }
.btn:hover { background: var(--civica-action-hover, var(--dark-primary-color)); }
.btn:active { top: 2px; }
.btn--secondary { background: var(--secondary-background-color); color: var(--primary-text-color); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 41%, var(--secondary-background-color)); }
.btn--secondary:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, var(--secondary-background-color)); }
.btn--warning { background: var(--civica-danger-fill, var(--error-color)); color: var(--civica-on-danger, var(--text-primary-color)); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 55%, var(--civica-danger-fill, var(--error-color))); }
.btn--warning:hover { background: color-mix(in srgb, var(--primary-text-color) 20%, var(--civica-danger-fill, var(--error-color))); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:disabled:hover { background: var(--primary-color); }
.btn--secondary:disabled:hover { background: var(--secondary-background-color); }
.btn:disabled:active { top: 0; }
.btn-icon { flex: none; }
.btn[hidden] { display: none; }
.btn:focus-visible { outline: 3px solid transparent; border-color: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); background: var(--ha-color-focus); box-shadow: 0 2px 0 var(--civica-focus-text, var(--black-color)); }
.rooms { margin: 0 0 20px; padding: 0; }
.row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px 15px; align-items: center; padding: 15px 0; border-bottom: 1px solid var(--divider-color); }
@media (min-width: 540px) { .row { grid-template-columns: minmax(0, 1fr) auto; } }
@media (min-width: 641px) { .body { padding: 20px; } .rooms { margin-bottom: 30px; } }
.row > * { min-width: 0; overflow-wrap: anywhere; }
.row[hidden] { display: none; }
.key { font-weight: 700; margin: 0; }
.sub { display: block; font-weight: 400; font-size: var(--civica-font-size-small, 16px); line-height: 1.5; color: var(--secondary-text-color); }
.sub:empty { display: none; }
.act { margin: 0; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.plan { display: block; width: 100%; height: auto; margin-bottom: 15px; }
.shade { transition: opacity 0.3s; }
.shade--off { fill: var(--primary-text-color); opacity: 0.45; }
.shade--lit { opacity: 0.28; mix-blend-mode: soft-light; }
.hit { fill: transparent; stroke: none; cursor: pointer; }
.hit:hover { fill: var(--ha-color-focus); fill-opacity: 0.18; }
.hit:focus-visible { outline: none; stroke: var(--ha-color-focus); stroke-width: 8px; fill: var(--ha-color-focus); fill-opacity: 0.18; }
.dlg { width: min(640px, 92vw); box-sizing: border-box; flex-direction: column; max-width: calc(100vw - 32px); max-height: calc(100dvh - 32px); overflow-y: auto; border: var(--ha-border-width-lg, 4px) solid var(--primary-text-color); border-radius: 0; padding: 24px; background: var(--card-background-color); color: var(--primary-text-color); font-family: var(--ha-font-family-body); }
.dlg[open] { display: flex; }
.dlg-title { margin: 0 0 16px; font-size: var(--civica-font-size-heading, 24px); }
.dlg::backdrop { background: var(--primary-text-color); opacity: 0.6; }
.error-summary { padding: 15px; margin-bottom: 30px; border: 5px solid var(--error-color); color: var(--primary-text-color); }
.error-summary:focus { outline: 3px solid var(--ha-color-focus); outline-offset: 2px; }
.form-group--error:focus { outline: 3px solid var(--ha-color-focus); outline-offset: 2px; }
.error-summary__title { margin: 0 0 15px; font-size: var(--civica-font-size-heading, 24px); line-height: 1.25; font-weight: 700; }
.error-summary__list { margin: 0; padding: 0; list-style: none; font-weight: 700; }
.error-summary__list li { margin: 0; }
.error-summary__list .link { color: var(--error-color); }
/* GOV.UK details component */
.details { display: block; margin: 15px 0 0; font-size: var(--civica-font-size-body, 19px); line-height: 1.3157894737; }
.details-summary { position: relative; display: block; width: fit-content; min-height: 44px; padding-top: 8px; padding-bottom: 8px; margin-top: 15px; padding-left: 25px; color: var(--link-color); cursor: pointer; list-style: none; }
.details-summary::-webkit-details-marker { display: none; }
.details-summary::before { content: ""; position: absolute; top: -1px; bottom: 0; left: 0; margin: auto; display: block; width: 0; height: 0; clip-path: polygon(0 0, 100% 50%, 0 100%); border-style: solid; border-color: transparent; border-width: 7px 0 7px 12.124px; border-left-color: inherit; }
.details[open] > .details-summary { margin-bottom: 5px; }
.details[open] > .details-summary::before { clip-path: polygon(0 0, 50% 100%, 100% 0); border-width: 12.124px 7px 0; border-left-color: transparent; border-top-color: inherit; }
.details-summary-text { text-decoration: underline; text-decoration-thickness: max(1px, 0.0625rem); text-underline-offset: 0.1578em; }
.details-summary:hover .details-summary-text { text-decoration-thickness: max(3px, 0.1875rem, 0.12em); text-decoration-skip-ink: none; }
.details-summary:focus-visible { outline: 3px solid transparent; color: var(--civica-focus-text, var(--black-color)); background: var(--ha-color-focus); box-shadow: 0 -2px var(--ha-color-focus), 0 4px var(--primary-text-color); }
.details-summary:focus-visible .details-summary-text { text-decoration: none; }
.details-text { padding: 15px 0 15px 20px; border-left: 5px solid var(--divider-color); }
.details-text p { margin: 0 0 20px; }
.details-text > :last-child { margin-bottom: 0; }
.link { color: var(--link-color); text-decoration: underline; text-underline-offset: 0.1578em; }
.link:hover { text-decoration-thickness: max(3px, 0.1875rem, 0.12em); }
.link:focus-visible { outline: 3px solid transparent; color: var(--civica-focus-text, var(--black-color)); background: var(--ha-color-focus); box-shadow: 0 -2px var(--ha-color-focus), 0 4px var(--primary-text-color); text-decoration: none; }
.scenes-slot { grid-column: 1 / -1; margin: 0; padding: 4px; }
.scenes-slot:empty { display: none; }
/* GOV.UK error message component, with its left-hand error border. */
.form-group--error { padding-left: 15px; border-left: 5px solid var(--error-color); }
.error-message { margin: 0 0 15px; font-weight: 700; color: var(--error-color); }
@media (prefers-reduced-motion: reduce) { .shade { transition: none; } }
@media (forced-colors: active) { .btn:focus-visible, .link:focus-visible, .details-summary:focus-visible { outline: 3px solid Highlight; } .hit:focus-visible { stroke: Highlight; } .btn { border: 2px solid ButtonText; } }
`;

// card/src/dialog.ts
var SCENES_CSS = `
.civica-scenes { margin-block: 30px 20px; color: var(--primary-text-color); font: var(--civica-font-size-body, 19px)/1.5 var(--ha-font-family-body, Arial, sans-serif); }
.civica-scenes h3 { margin: 0 0 15px; font: inherit; font-weight: 700; }
.civica-scenes ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 15px; }
.civica-scenes li { min-width: 0; max-width: 100%; }
.civica-scene { display: flex; align-items: center; gap: 10px; position: relative; min-width: 44px; min-height: 44px; max-width: 100%; box-sizing: border-box; padding: 8px 10px 11px; cursor: pointer; background: var(--secondary-background-color); color: var(--primary-text-color); border: 2px solid transparent; border-radius: 0; box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 41%, var(--secondary-background-color)); font: inherit; line-height: 1.3; text-align: start; overflow-wrap: anywhere; }
.civica-scene:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, var(--secondary-background-color)); }
.civica-scene:active { top: 2px; }
.civica-scene:disabled { cursor: wait; opacity: .65; }
.civica-scene:focus-visible { outline: 3px solid transparent; border-color: var(--ha-color-focus); background: var(--ha-color-focus); color: var(--civica-focus-text, var(--black-color)); box-shadow: 0 2px 0 var(--civica-focus-text, var(--black-color)); }
.civica-scene-icon { flex: 0 0 24px; width: 24px; height: 24px; --mdc-icon-size: 24px; color: inherit; pointer-events: none; }
/* Scene colours describe the lights, not the icon or action. Keep labels and
   monochrome Home Assistant icons readable throughout the preview animation. */
.civica-swatch { position: absolute; inset-inline: 0; bottom: 0; height: 3px; display: block; pointer-events: none; }
.civica-scene:focus-visible .civica-swatch { visibility: hidden; }
.civica-scene-status { margin: 15px 0 0; }
.civica-scene-status:empty { display: none; }
@media (forced-colors: active) { .civica-scene { border-color: ButtonText; } .civica-scene:focus-visible { outline-color: Highlight; } .civica-swatch { display: none; } }
`;
function findDeep(root, selector) {
  const hit = root.querySelector(selector);
  if (hit) return hit;
  for (const e of Array.from(root.querySelectorAll("*"))) {
    if (e.shadowRoot) {
      const found = findDeep(e.shadowRoot, selector);
      if (found) return found;
    }
  }
  return null;
}
var cancelPending;
function tuneMoreInfo(spec) {
  cancelPending?.();
  const started = performance.now();
  let cancelled = false, frame = 0;
  let cleanup;
  const cancel = () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    cleanup?.();
    cleanup = void 0;
  };
  cancelPending = cancel;
  const tick = () => {
    if (cancelled) return;
    const ha = document.querySelector("home-assistant");
    const dlg = ha?.shadowRoot ? findDeep(ha.shadowRoot, "ha-more-info-dialog") : null;
    const control = dlg?.shadowRoot ? findDeep(dlg.shadowRoot, "more-info-light") : null;
    const root = control?.shadowRoot;
    if (dlg && control && root && control.stateObj?.entity_id === spec.entityId && root.querySelector(".controls")) {
      if (!spec.scenes.length) return;
      const style = document.createElement("style");
      style.textContent = SCENES_CSS;
      const section = document.createElement("section");
      section.className = "civica-scenes";
      section.setAttribute("aria-label", `Scenes for ${spec.title}`);
      const heading = document.createElement("h3");
      heading.textContent = `Scenes for ${spec.title}`;
      const list = document.createElement("ul");
      const status = document.createElement("p");
      status.className = "civica-scene-status";
      status.setAttribute("role", "status");
      for (const scene of spec.scenes) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "civica-scene";
        const icon = document.createElement("ha-icon");
        icon.className = "civica-scene-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.setAttribute("icon", scene.icon);
        const swatch = document.createElement("span");
        swatch.className = "civica-swatch";
        swatch.setAttribute("aria-hidden", "true");
        scene.fill(swatch);
        const label = document.createElement("span");
        label.textContent = scene.label;
        button.append(icon, label, swatch);
        button.addEventListener("click", async () => {
          if (cancelled || control.stateObj?.entity_id !== spec.entityId) return;
          const buttons = Array.from(section.querySelectorAll("button"));
          for (const b of buttons) b.disabled = true;
          status.textContent = "";
          try {
            const accepted = await spec.onPick(scene.id);
            if (!cancelled && accepted) status.textContent = `${scene.label} requested. Check the lights to confirm the change.`;
          } catch {
            if (!cancelled) status.textContent = `${scene.label} could not be applied. Try again.`;
          } finally {
            for (const b of buttons) b.disabled = false;
          }
        });
        item.append(button);
        list.append(item);
      }
      section.append(heading, list, status);
      root.append(style);
      root.querySelector(".controls").after(section);
      const observer = new MutationObserver(() => {
        if (!control.isConnected || control.stateObj?.entity_id !== spec.entityId) cancel();
      });
      observer.observe(root, { childList: true, subtree: true });
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      const reduceMotion = () => {
        if (motion.matches) section.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      };
      motion.addEventListener("change", reduceMotion);
      const closed = () => cancel();
      dlg.addEventListener("dialog-closed", closed);
      dlg.addEventListener("closed", closed);
      cleanup = () => {
        observer.disconnect();
        motion.removeEventListener("change", reduceMotion);
        style.remove();
        section.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        section.remove();
        dlg.removeEventListener("dialog-closed", closed);
        dlg.removeEventListener("closed", closed);
      };
      return;
    }
    if (performance.now() - started < 6e3) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return cancel;
}

// card/src/card.ts
var SVG = "http://www.w3.org/2000/svg";
var RECIPE_LIST = recipes_default;
var SCENE_ICONS = { christmas: "mdi:string-lights", football: "mdi:soccer", rugby: "mdi:rugby", halloween: "mdi:halloween", emergency: "mdi:alarm-light-outline" };
var COG = "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.86,17.38L11.25,20H12.75L13.12,17.4C14.32,17.14 15.38,16.5 16.15,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.38C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z";
var AREAS_DOCS = "https://www.home-assistant.io/docs/organizing/areas/";
var SAFE_CSS = /^(#[0-9A-Fa-f]{6}|linear-gradient\(90deg(, #[0-9A-Fa-f]{6} \d{1,3}%)+\))$/;
var safeCss = (v) => SAFE_CSS.test(v) ? v : "transparent";
var previewOf = (r) => safeCss(r.previewCss ?? r.preview);
var HEX = /^#[0-9A-Fa-f]{6}$/;
var paletteSeconds = (n) => Math.max(4, n * 3);
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
  reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  onMotion = () => this.paintAll();
  cancelMoreInfo;
  actionPending = false;
  status;
  errorSlot;
  errors = [];
  list;
  plan;
  built = false;
  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }
  static getStubConfig() {
    return { type: "custom:civica-house-lighting-card" };
  }
  setConfig(config) {
    this.cancelMoreInfo?.();
    if (!config || config.type === void 0) throw new Error('civica-house-lighting-card: "type" is required');
    const rooms = config.rooms ?? rooms_default.rooms;
    if (!Array.isArray(rooms) || !rooms.length) throw new Error('"rooms" must be a non-empty list');
    const ids = /* @__PURE__ */ new Set();
    for (const r of rooms) {
      if (!r.id || !/^[a-z][a-z0-9_]*$/.test(r.id)) throw new Error(`room id "${r.id}" is invalid (lowercase letters, digits, underscore)`);
      if (ids.has(r.id)) throw new Error(`duplicate room id "${r.id}"`);
      ids.add(r.id);
      if (r.group && !/^light\.[a-z0-9_]+$/.test(r.group)) throw new Error(`room "${r.id}" group must be a light entity ID`);
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
    this.cancelMoreInfo?.();
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
    this.errorSlot = el("div", { class: "error-slot" });
    const all = el(
      "div",
      { class: "actions" },
      el("button", { class: "btn btn--secondary", type: "button", "data-role": "all-on", onclick: () => this.all(true) }, "Turn all on"),
      el("button", { class: "btn btn--secondary", type: "button", "data-role": "all-off", onclick: () => this.all(false) }, "Turn all off")
    );
    this.list = el("dl", { class: "rooms" });
    this.plan = this.buildPlan();
    this.root.replaceChildren(style, el("ha-card", {}, el("div", { class: "body" }, el("div", { class: "head" }, title, all), this.errorSlot, this.status, this.plan, this.list, this.buildHelp())));
    for (const cfg of this.config.rooms) this.views.set(cfg.id, { cfg, caps: void 0, sig: "", on: 0, owner: "" });
    for (const v of this.views.values()) this.list.append(this.buildRow(v));
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
      hit.addEventListener("click", () => {
        if (this.usable(this.views.get(cfg.id))) this.openMoreInfo(cfg.id);
      });
      hit.addEventListener("keydown", (e) => {
        const k = e.key;
        if (k === "Enter" || k === " ") {
          e.preventDefault();
          if (this.usable(this.views.get(cfg.id))) this.openMoreInfo(cfg.id);
        }
      });
      s.append(hit);
    }
    return s;
  }
  buildRow(v) {
    const name = v.cfg.name ?? v.cfg.id;
    const toggle = el("button", { class: "btn", type: "button", "data-role": "toggle", onclick: () => this.toggle(v) });
    const icon = svg("svg", { viewBox: "0 0 24 24", width: 24, height: 24, class: "btn-icon", "aria-hidden": "true", focusable: "false" });
    icon.append(svg("path", { d: COG, fill: "currentColor" }));
    const settings = el("button", { class: "btn btn--secondary", type: "button", "data-role": "settings", title: "Settings", onclick: () => this.openMoreInfo(v.cfg.id) }, icon, el("span", { class: "vh" }, `Settings for ${name}`));
    const row = el("div", { class: "row", "data-room": v.cfg.id }, el("dt", { class: "key" }, name, el("span", { class: "sub", "data-role": "sub" })), el("dd", { class: "act" }, toggle, settings), el("dd", { class: "scenes-slot", "data-role": "scenes" }));
    v.row = row;
    return row;
  }
  usable(v) {
    return !!v.caps && v.caps.availableLights > 0;
  }
  /** GOV.UK details component: help for lights or rooms that do not appear. Copy follows the GOV.UK A to Z style guide. */
  buildHelp() {
    const strong = (t) => el("strong", {}, t);
    return el(
      "details",
      { class: "details" },
      el("summary", { class: "details-summary" }, el("span", { class: "details-summary-text" }, "Missing lights or rooms?")),
      el(
        "div",
        { class: "details-text" },
        el("p", {}, "Lights might not appear in a room if they are not smart bulbs, are in the wrong area or are offline."),
        el("p", {}, "To fix this, select ", strong("Settings"), ", then ", strong("Devices and services"), ". Check your connected devices and make sure each light is in the correct area."),
        el(
          "p",
          {},
          "If you still have trouble, select ",
          strong("Settings"),
          ", then ",
          strong("System"),
          ", then ",
          strong("Logs"),
          " to find error details. You can also read the ",
          el("a", { class: "link", href: AREAS_DOCS, target: "_blank", rel: "noreferrer noopener" }, "Home Assistant areas documentation (opens in new tab)"),
          " for help organising your home."
        )
      )
    );
  }
  /** Settings opens Home Assistant's own more-info dialog (slider, colour wheel and temperature) for the room's light group. */
  openMoreInfo(roomId) {
    const v = this.views.get(roomId);
    const managed = new Set(v.caps.lightCapabilities.map((capability) => capability.entityId));
    const safeMembers = (id, seen = /* @__PURE__ */ new Set()) => {
      if (seen.has(id) || !id.startsWith("light.") || !this._hass.states[id]) return false;
      const members2 = this._hass.states[id].attributes?.entity_id;
      if (!Array.isArray(members2)) return managed.has(id);
      const visited = new Set(seen).add(id);
      return members2.length > 0 && members2.every((member) => typeof member === "string" && safeMembers(member, visited));
    };
    const candidates = v.cfg.group ? [v.cfg.group] : [`light.govuk_lights_${roomId}`, `light.lights_${roomId}`];
    const group = candidates.find((id) => {
      const state = this._hass.states[id];
      return state && !["unknown", "unavailable"].includes(state.state) && Array.isArray(state.attributes?.entity_id) && safeMembers(id);
    });
    const entityId = group ?? v.caps.lightCapabilities.find((c) => c.status === "available")?.entityId;
    if (!entityId) {
      this.showError(`${v.cfg.name ?? v.cfg.id} has no light to open.`, roomId);
      return;
    }
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
    const avail = new Map(v.caps.availableRecipes.map((a) => [a.recipeId, a]));
    const scenes = this.usable(v) ? RECIPE_LIST.filter((r) => r.category === "scene" && avail.get(r.id)?.availability !== "unsupported") : [];
    this.cancelMoreInfo = tuneMoreInfo({
      entityId,
      title: v.cfg.name ?? v.cfg.id,
      scenes: scenes.map((r) => ({
        id: r.id,
        label: r.label,
        pressed: v.owner === r.id,
        icon: SCENE_ICONS[r.id] ?? "mdi:lightbulb-outline",
        fill: (swatch) => this.animateSwatch(swatch, r, v)
      })),
      onPick: async (id) => {
        const r = scenes.find((x) => x.id === id);
        return r ? this.pick(v, r) : false;
      }
    });
  }
  /** Cycles the room's effective scene palette at the same pace as the floor-plan tint. Static when motion is reduced. */
  animateSwatch(swatch, r, v) {
    const palette = buildPlan(r, v.caps.lightCapabilities).effectivePalette.filter((c) => HEX.test(c));
    if (!palette.length) {
      swatch.style.background = previewOf(r);
      return;
    }
    swatch.style.backgroundColor = palette[0];
    if (palette.length < 2 || this.reduceMotion.matches || typeof swatch.animate !== "function") return;
    swatch.animate([...palette, palette[0]].map((c) => ({ backgroundColor: c })), { duration: paletteSeconds(palette.length) * 1e3, iterations: Infinity, easing: "linear" });
  }
  /** Per-room slot for the GOV.UK inline error message. Scenes are not shown on the card unless Nathan asks for them. */
  paintScenes(v) {
    const slot = v.row.querySelector("[data-role=scenes]");
    const err = this.errors.filter((e) => e.room === v.cfg.id);
    const body = err.length ? [el("div", { class: "form-group--error", tabindex: -1, id: `error-${v.cfg.id}` }, ...err.map((e) => el("p", { class: "error-message" }, el("span", { class: "vh" }, "Error:"), ` ${e.msg}`)))] : [];
    slot.replaceChildren(...body);
  }
  async pick(v, r) {
    this.clearErrors();
    try {
      if (r.safety?.flashing) {
        if (!await this.confirmFlashing(r)) return false;
        await this._hass.callService("input_boolean", "turn_on", {}, { entity_id: "input_boolean.govuk_lights_allow_flashing" });
      }
      await this._hass.callService("script", "govuk_lights_apply", { room: v.cfg.id, recipe: r.id });
      return true;
    } catch (e) {
      console.error("civica-house-lighting-card", e);
      this.showError(`${r.label} could not be applied in ${v.cfg.name ?? v.cfg.id}. Try again. If it keeps failing, check the Home Assistant log.`, v.cfg.id);
      throw e;
    }
  }
  confirmFlashing(r) {
    return new Promise((res) => {
      const c = el(
        "dialog",
        { class: "dlg dlg--auto", "aria-labelledby": "w-title" },
        el("h3", { id: "w-title", class: "dlg-title" }, "Warning: flashing lights"),
        el("p", {}, `${r.label} flashes red and blue quickly. It can trigger seizures in people with photosensitive epilepsy. It stops by itself after ${r.safety.maxRuntimeS} seconds, or when you turn the room off.`),
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
  /** GOV.UK error summary at the top of the card; each item links to the room it concerns, which also shows the inline error message. */
  errorSummary() {
    if (!this.errors.length) return void 0;
    const link = (e) => e.room ? el("a", { class: "link", href: `#error-${e.room}`, onclick: (ev) => {
      ev.preventDefault();
      this.root.querySelector(`#error-${e.room}`)?.focus();
    } }, e.msg) : e.msg;
    return el(
      "div",
      { class: "error-summary", tabindex: -1, "data-role": "error-summary" },
      el(
        "div",
        { role: "alert" },
        el("h2", { class: "error-summary__title" }, "There is a problem"),
        el("ul", { class: "error-summary__list" }, ...this.errors.map((e) => el("li", {}, link(e))))
      )
    );
  }
  showError(msg, room) {
    if (!this.errors.some((e) => e.msg === msg && e.room === room)) this.errors.push({ room, msg });
    this.paintErrors(true);
  }
  clearErrors() {
    if (this.errors.length) {
      this.errors = [];
      this.paintErrors(false);
    }
  }
  paintErrors(focus) {
    const card = this.errorSummary();
    this.errorSlot?.replaceChildren(...card ? [card] : []);
    for (const v of this.views.values()) if (v.caps) this.paintScenes(v);
    if (focus) this.errorSlot?.querySelector("[data-role=error-summary]")?.focus();
  }
  async toggle(v, preserveErrors = false) {
    if (!this.usable(v)) return;
    if (!preserveErrors) this.clearErrors();
    if (v.on > 0) return this.stop(v, true);
    return this.turnOn(v);
  }
  async turnOn(v) {
    const ids = v.caps.lightCapabilities.filter((c) => c.status === "available").map((c) => c.entityId);
    if (!ids.length) return;
    try {
      await this._hass.callService("light", "turn_on", {}, { entity_id: ids });
    } catch (e) {
      console.error("govuk-house-lighting-card", e);
      this.showError(`${v.cfg.name ?? v.cfg.id} could not be turned on. Try again.`, v.cfg.id);
    }
  }
  async stop(v, off) {
    try {
      await this._hass.callService("script", "govuk_lights_stop", { room: v.cfg.id, turn_off: off });
    } catch (e) {
      console.error("govuk-house-lighting-card", e);
      this.showError(`${v.cfg.name ?? v.cfg.id} could not be turned off. Try again.`, v.cfg.id);
    }
  }
  async all(on) {
    if (this.actionPending) return;
    this.actionPending = true;
    this.clearErrors();
    this.paintSummary();
    try {
      for (const v of this.views.values()) if (this.usable(v)) {
        if (on) await this.turnOn(v);
        else if (v.on > 0) await this.stop(v, true);
      }
    } finally {
      this.actionPending = false;
      this.paintSummary();
    }
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
    }
  }
  paintAll() {
    for (const v of this.views.values()) if (v.caps) this.paintRoom(v);
  }
  /** "2 of 3 lights on" or "0 of 3 lights on": lights this card can control. Reserved lights are not counted. */
  count(v) {
    const total = v.caps.availableLights, word = `light${total === 1 ? "" : "s"}`;
    return v.on > 0 ? `${v.on} of ${total} ${word} on` : `${total} of ${total} ${word} off`;
  }
  describe(v) {
    if (!this.usable(v)) return "unavailable";
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    return `${this.count(v)}${v.on > 0 && rec ? `, ${rec.label}` : ""}`;
  }
  paintRoom(v) {
    const usable = this.usable(v), total = v.caps.availableLights;
    v.row.hidden = false;
    v.row.querySelector("[data-role=sub]").textContent = total > 0 ? this.count(v) : v.caps.totalLights === 0 ? "No lights assigned" : "Lights unavailable";
    v.row.querySelector("[data-role=settings]").disabled = !usable;
    const btn = v.row.querySelector("[data-role=toggle]");
    btn.hidden = false;
    btn.textContent = !usable ? "Unavailable" : v.on > 0 ? "Turn off" : "Turn on";
    btn.disabled = !usable;
    btn.setAttribute("aria-label", `${!usable ? "Unavailable:" : v.on > 0 ? "Turn off" : "Turn on"} ${v.cfg.name ?? v.cfg.id}`);
    this.paintScenes(v);
    const rec = RECIPE_LIST.find((r) => r.id === v.owner);
    const shade = this.plan.querySelector(`.shade[data-room=${v.cfg.id}]`);
    const hit = this.plan.querySelector(`.hit[data-room=${v.cfg.id}]`);
    hit.setAttribute("aria-label", `${v.cfg.name ?? v.cfg.id}, ${this.describe(v)}.${this.usable(v) ? " Open lighting settings." : ""}`);
    hit.setAttribute("aria-disabled", String(!this.usable(v)));
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
    palette = palette.filter((p) => HEX.test(p));
    shade.setAttribute("fill", palette[0]);
    if (palette.length > 1 && !this.reduceMotion.matches) {
      const a = svg("animate", { attributeName: "fill", values: [...palette, palette[0]].join(";"), dur: `${paletteSeconds(palette.length)}s`, repeatCount: "indefinite" });
      shade.append(a);
    } else if (palette.length > 1) shade.setAttribute("fill", palette[0]);
  }
  paintSummary() {
    const vs = [...this.views.values()].filter((v) => this.usable(v));
    const on = vs.filter((v) => v.on > 0).length;
    this.status.textContent = vs.length ? `${on} of ${vs.length} available rooms on` : "No lights are available. Check the rooms below.";
    for (const b of this.root.querySelectorAll("[data-role=all-on], [data-role=all-off]")) b.disabled = this.actionPending || !vs.length;
  }
};
if (!customElements.get("govuk-house-lighting-card")) customElements.define("govuk-house-lighting-card", GovukHouseLightingCard);
window.customCards = window.customCards ?? [];
if (!customElements.get("civica-house-lighting-card")) customElements.define("civica-house-lighting-card", class extends GovukHouseLightingCard {
});
window.customCards.push({ type: "civica-house-lighting-card", name: "civica.uk house lighting", description: "Room lighting with floor plan, whites, colours and dynamic scenes." });
