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
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 15px; margin-bottom: 8px; }
.title { margin: 0; font-size: var(--ha-card-header-font-size, 24px); font-weight: var(--ha-font-weight-heading, 700); }
.status { margin: 0 0 16px; font-size: var(--ha-font-size-s, 14px); color: var(--secondary-text-color); }
.actions { display: flex; flex-wrap: wrap; gap: 15px; }
/* GOV.UK button: theme body size (19px), weight 400, 2px border, padding 8px 10px 7px = 38px + 2px shadow, matching --ha-button-height. */
.btn { font: inherit; font-size: var(--ha-font-size-m, 19px); font-weight: 400; line-height: 1; box-sizing: border-box; position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin: 0; padding: 8px 10px 7px; cursor: pointer; text-align: center; vertical-align: top; border: 2px solid transparent; border-radius: 0;
  background: var(--primary-color); color: var(--text-primary-color); box-shadow: 0 2px 0 var(--ha-color-primary-10); }
.btn:hover { background: var(--ha-color-primary-30); }
.btn:active { top: 2px; }
.btn--secondary { background: var(--secondary-background-color); color: var(--primary-text-color); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 41%, var(--secondary-background-color)); }
.btn--secondary:hover { background: color-mix(in srgb, var(--primary-text-color) 10%, var(--secondary-background-color)); }
.btn--warning { background: var(--error-color); color: var(--text-primary-color); box-shadow: 0 2px 0 color-mix(in srgb, var(--primary-text-color) 55%, var(--error-color)); }
.btn--warning:hover { background: color-mix(in srgb, var(--primary-text-color) 20%, var(--error-color)); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:disabled:hover { background: var(--primary-color); }
.btn--secondary:disabled:hover { background: var(--secondary-background-color); }
.btn:disabled:active { top: 0; }
.btn-icon { flex: none; }
.btn[hidden] { display: none; }
.btn:focus-visible:not(:active):not(:hover), .btn:focus:not(:active):not(:hover) { outline: 3px solid transparent; border-color: var(--ha-color-focus); color: var(--primary-text-color); background: var(--ha-color-focus); box-shadow: 0 2px 0 var(--primary-text-color); }
.tab:focus-visible, .tile:focus-visible { outline: 3px solid transparent; background: var(--ha-color-focus); color: var(--primary-text-color); box-shadow: 0 -2px var(--ha-color-focus), 0 4px var(--primary-text-color); }
.tile:focus-visible { outline: var(--wa-focus-ring-width, 3px) solid var(--ha-color-focus); box-shadow: 0 4px 0 var(--primary-text-color); }
.rooms { margin: 0 0 24px; padding: 0; }
.row { display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--divider-color); }
.key { font-weight: 700; margin: 0; }
.sub { display: block; font-weight: 400; font-size: var(--ha-font-size-s, 14px); line-height: 1.25; color: var(--secondary-text-color); }
.sub:empty { display: none; }
.act { margin: 0; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.plan { display: block; width: 100%; height: auto; }
.shade { transition: opacity 0.3s; }
.shade--off { fill: var(--primary-text-color); opacity: 0.45; }
.shade--lit { opacity: 0.28; mix-blend-mode: soft-light; }
.hit { fill: transparent; stroke: none; cursor: pointer; }
.hit:hover { fill: var(--ha-color-focus); fill-opacity: 0.18; }
.hit:focus-visible { outline: none; stroke: var(--ha-color-focus); stroke-width: 8px; fill: var(--ha-color-focus); fill-opacity: 0.18; }
.dlg { width: min(640px, 92vw); height: min(520px, 90vh); box-sizing: border-box; flex-direction: column; max-width: none; border: var(--ha-border-width-lg, 4px) solid var(--primary-text-color); border-radius: 0; padding: 24px; background: var(--card-background-color); color: var(--primary-text-color); font-family: var(--ha-font-family-body); }
.dlg[open] { display: flex; }
.dlg--auto { height: auto; }
.dlg::backdrop { background: var(--primary-text-color); opacity: 0.6; }
.dlg-title { margin: 0 0 16px; font-size: 24px; }
.tabs { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0 5px; padding: 5px 0 0; border-bottom: 1px solid var(--divider-color); margin-bottom: 16px; }
.tab { font: inherit; font-size: var(--ha-font-size-m, 19px); line-height: 1.25; padding: 10px 20px; border: 0; border-radius: 0; background: var(--secondary-background-color); color: var(--primary-text-color); text-decoration: underline; text-underline-offset: 0.1578em; cursor: pointer; }
.tab:hover { text-decoration-thickness: max(3px, 0.1875rem, 0.12em); }
.tab[aria-selected=true] { margin: -5px 0 -1px; padding: 14px 19px 16px; border: 1px solid var(--divider-color); border-bottom: 0; background: var(--card-background-color); text-decoration: none; }
.panels { flex: 1; min-height: 0; overflow: auto; padding: 8px; }
.tiles { list-style: none; margin: 0 0 16px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, 64px); gap: 12px; }
.tile:disabled { opacity: 0.5; cursor: not-allowed; }
.tile { position: relative; display: block; width: 64px; height: 64px; padding: 0; cursor: pointer; overflow: hidden; background: var(--card-background-color); border: 2px solid var(--primary-text-color); border-radius: 0; }
.tile[aria-pressed=true] { outline: 4px solid var(--primary-text-color); outline-offset: 2px; }
.swatch { position: absolute; inset: 0; display: block; }
.tile-icon { position: absolute; inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); object-fit: contain; pointer-events: none; }
.error-summary { padding: 15px; margin-bottom: 30px; border: 5px solid var(--error-color); color: var(--primary-text-color); }
.error-summary:focus { outline: 3px solid var(--ha-color-focus); }
.error-summary__title { margin: 0 0 15px; font-size: 18px; line-height: 1.1111; font-weight: 700; }
.error-summary__list { margin: 0; padding: 0; list-style: none; font-weight: 700; }
.error-summary__list li { margin: 0; }
.acc { margin-top: 24px; border-top: 1px solid var(--divider-color); border-bottom: 1px solid var(--divider-color); }
.acc-heading { margin: 0; }
.acc-btn { font: inherit; font-weight: 700; display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 15px; box-sizing: border-box; padding: 15px 0; border: 0; border-radius: 0; background: none; color: var(--primary-text-color); text-align: left; cursor: pointer; }
.acc-btn:hover { background: var(--secondary-background-color); }
.acc-btn:focus-visible { outline: 3px solid transparent; background: var(--ha-color-focus); box-shadow: inset 0 -4px 0 var(--primary-text-color); }
.acc-state { font-weight: 400; color: var(--link-color); text-decoration: underline; }
.rooms--unavailable { margin: 0; }
.rooms--unavailable .row:last-child { border-bottom: 0; }
.hint { margin: 0 0 16px; font-size: 14px; color: var(--secondary-text-color); }
.dlg-close { align-self: flex-start; margin-top: 16px; }
.actions--dialog { margin-top: 16px; }
`;

// card/src/card.ts
var SVG = "http://www.w3.org/2000/svg";
var RECIPE_LIST = recipes_default;
var CATS = [["light", "Whites and colours", ["white", "color"]], ["scene", "Scenes", ["scene"]]];
var COG = "M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.86,17.38L11.25,20H12.75L13.12,17.4C14.32,17.14 15.38,16.5 16.15,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.38C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z";
var REASONS = {
  no_lights: "This room has no lights this card can control.",
  all_unavailable: "All lights in this room are unavailable.",
  members_unavailable: "Some lights are unavailable, so the whole room cannot be set to one colour.",
  needs_all_colour: "Every light in this room must be able to show colour.",
  needs_colour_light: "This room needs at least one colour light.",
  no_dimmable_lights: "No light in this room can be dimmed."
};
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
  dialog;
  current;
  reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  onMotion = () => this.paintAll();
  status;
  errorSlot;
  errors = [];
  list;
  unavail;
  unavailBox;
  unavailBtn;
  unavailOpen = false;
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
    this.errorSlot = el("div", { class: "error-slot" });
    const all = el(
      "div",
      { class: "actions" },
      el("button", { class: "btn btn--secondary", type: "button", onclick: () => this.all(true) }, "All on"),
      el("button", { class: "btn btn--secondary", type: "button", onclick: () => this.all(false) }, "All off")
    );
    this.list = el("dl", { class: "rooms" });
    this.unavail = el("dl", { class: "rooms rooms--unavailable", id: "unavailable-rooms", hidden: true });
    this.unavailBtn = el("button", { class: "acc-btn", type: "button", "aria-expanded": "false", "aria-controls": "unavailable-rooms", onclick: () => this.setUnavailable(!this.unavailOpen) });
    this.unavailBox = el("div", { class: "acc", hidden: true }, el("h3", { class: "acc-heading" }, this.unavailBtn), this.unavail);
    this.plan = this.buildPlan();
    this.root.replaceChildren(style, el("ha-card", {}, el("div", { class: "body" }, el("div", { class: "head" }, title, all), this.errorSlot, this.status, this.plan, this.list, this.unavailBox)));
    for (const cfg of this.config.rooms) this.views.set(cfg.id, { cfg, caps: void 0, sig: "", on: 0, owner: "" });
    for (const v of this.views.values()) this.list.append(this.buildRow(v));
    this.layoutRooms();
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
      hit.addEventListener("click", () => {
        if (this.usable(this.views.get(cfg.id))) this.open(cfg.id);
      });
      hit.addEventListener("keydown", (e) => {
        const k = e.key;
        if (k === "Enter" || k === " ") {
          e.preventDefault();
          if (this.usable(this.views.get(cfg.id))) this.open(cfg.id);
        }
      });
      s.append(hit);
    }
    return s;
  }
  buildRow(v) {
    const name = v.cfg.name ?? v.cfg.id;
    const toggle = el("button", { class: "btn", type: "button", "data-role": "toggle", onclick: () => this.toggle(v) });
    const icon = svg("svg", { viewBox: "0 0 24 24", width: 19, height: 19, class: "btn-icon", "aria-hidden": "true", focusable: "false" });
    icon.append(svg("path", { d: COG, fill: "currentColor" }));
    const settings = el("button", { class: "btn btn--secondary", type: "button", "data-role": "settings", title: "Settings", onclick: (e) => this.open(v.cfg.id, e.currentTarget) }, icon, el("span", { class: "vh" }, `Settings for ${name}`));
    const row = el("div", { class: "row", "data-room": v.cfg.id }, el("dt", { class: "key" }, name, el("span", { class: "sub", "data-role": "sub" })), el("dd", { class: "act" }, toggle, settings));
    v.row = row;
    return row;
  }
  usable(v) {
    return !!v.caps && v.caps.availableLights > 0;
  }
  setUnavailable(open) {
    this.unavailOpen = open;
    this.unavailBtn.setAttribute("aria-expanded", String(open));
    this.unavail.hidden = !open;
    this.unavailBtn.querySelector("[data-role=acc-state]").textContent = open ? "Hide" : "Show";
  }
  /** Rooms with no controllable lights live in the "Unavailable" accordion; everything else stays in the main list. */
  layoutRooms() {
    const off = [];
    for (const v of this.views.values()) {
      const dest = !v.caps || this.usable(v) ? this.list : this.unavail;
      if (v.row.parentElement !== dest) dest.append(v.row);
      if (v.caps && !this.usable(v)) off.push(v);
    }
    this.unavailBox.hidden = off.length === 0;
    this.unavailBtn.replaceChildren(`Unavailable (${off.length})`, el("span", { class: "acc-state", "data-role": "acc-state" }, this.unavailOpen ? "Hide" : "Show"));
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
  renderDialog(tab = CATS[0][0]) {
    const v = this.views.get(this.current), d = this.dialog;
    const avail = new Map(v.caps.availableRecipes.map((a) => [a.recipeId, a]));
    const tabs = el("div", { role: "tablist", class: "tabs", "aria-label": "Lighting type" });
    const panels = el("div", { class: "panels" });
    CATS.forEach(([cat, label, kinds]) => {
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
      let anyOff = false;
      for (const r of RECIPE_LIST.filter((x) => kinds.includes(x.category))) {
        const a = avail.get(r.id);
        const off = a.availability === "unsupported";
        anyOff = anyOff || off;
        const reason = off ? REASONS[a.reason ?? ""] ?? "Not available in this room." : "";
        const tip = reason ? `${r.label}: ${reason}` : r.label;
        const swatch = el("span", { class: "swatch" });
        if (r.category === "scene") this.animateSwatch(swatch, r, v);
        else swatch.style.background = previewOf(r);
        const kids = [swatch];
        if (r.category === "scene") kids.push(el("img", { class: "tile-icon", src: new URL(`../assets/icons/${r.id}.svg`, import.meta.url).href, alt: "", loading: "lazy" }));
        const btn = el("button", { class: "tile", type: "button", disabled: off, title: tip, "aria-label": tip, "aria-pressed": String(v.owner === r.id), onclick: () => this.pick(v, r) }, ...kids);
        grid.append(el("li", {}, btn));
      }
      p.append(grid);
      if (anyOff) p.append(el("p", { class: "hint" }, "Faded options cannot be used in this room. Hover over one to see why."));
      panels.append(p);
    });
    d.replaceChildren(
      el("h3", { id: "dlg-title", class: "dlg-title" }, `${v.cfg.name ?? v.cfg.id} lighting`),
      this.errorSummary() ?? "",
      tabs,
      panels,
      el("button", { class: "btn btn--secondary dlg-close", type: "button", onclick: () => d.close() }, "Close")
    );
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
  async pick(v, r) {
    if (r.safety?.flashing) {
      const ok = await this.confirmFlashing(r);
      if (!ok) return;
      await this._hass.callService("input_boolean", "turn_on", {}, { entity_id: "input_boolean.govuk_lights_allow_flashing" });
    }
    this.clearErrors();
    try {
      await this._hass.callService("script", "govuk_lights_apply", { room: v.cfg.id, recipe: r.id });
      this.dialog.close();
    } catch (e) {
      console.error("govuk-house-lighting-card", e);
      this.showError(`${r.label} could not be applied in ${v.cfg.name ?? v.cfg.id}. Try again. If it keeps failing, check the Home Assistant log.`);
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
  /** GOV.UK error summary: shown at the top of the card, or of the open dialog, with focus moved to it. */
  errorSummary() {
    if (!this.errors.length) return void 0;
    return el(
      "div",
      { class: "error-summary", tabindex: -1, "data-role": "error-summary" },
      el(
        "div",
        { role: "alert" },
        el("h2", { class: "error-summary__title" }, "There is a problem"),
        el("ul", { class: "error-summary__list" }, ...this.errors.map((m) => el("li", {}, m)))
      )
    );
  }
  showError(msg) {
    if (!this.errors.includes(msg)) this.errors.push(msg);
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
    if (this.dialog?.open && this.current) this.renderDialog(this.dialog.querySelector("[aria-selected=true]")?.id.replace("tab-", "") ?? CATS[0][0]);
    if (!focus) return;
    const target = this.dialog?.open ? this.dialog : this.errorSlot;
    target?.querySelector("[data-role=error-summary]")?.focus();
  }
  async toggle(v) {
    this.clearErrors();
    if (v.on > 0) return this.stop(v, true);
    const ids = v.caps.lightCapabilities.map((c) => c.entityId);
    if (!ids.length) return;
    try {
      await this._hass.callService("light", "turn_on", {}, { entity_id: ids });
    } catch (e) {
      {
        console.error("govuk-house-lighting-card", e);
        this.showError(`${v.cfg.name ?? v.cfg.id} could not be turned on. Try again.`);
      }
      ;
    }
  }
  async stop(v, off) {
    try {
      await this._hass.callService("script", "govuk_lights_stop", { room: v.cfg.id, turn_off: off });
    } catch (e) {
      {
        console.error("govuk-house-lighting-card", e);
        this.showError(`${v.cfg.name ?? v.cfg.id} could not be turned off. Try again.`);
      }
      ;
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
      this.layoutRooms();
      this.paintSummary();
      if (this.dialog?.open && this.current) {
        const t = this.dialog.querySelector("[aria-selected=true]")?.id.replace("tab-", "") ?? CATS[0][0];
        const f = this.root.activeElement;
        this.renderDialog(t);
        if (f?.id) this.dialog.querySelector(`#${CSS.escape(f.id)}`)?.focus();
      }
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
    v.row.querySelector("[data-role=sub]").textContent = total > 0 ? this.count(v) : "";
    v.row.querySelector("[data-role=settings]").disabled = !usable;
    const btn = v.row.querySelector("[data-role=toggle]");
    btn.hidden = !usable;
    btn.textContent = v.on > 0 ? "Turn off" : "Turn on";
    btn.disabled = !usable;
    btn.setAttribute("aria-label", `${v.on > 0 ? "Turn off" : "Turn on"} ${v.cfg.name ?? v.cfg.id}`);
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
    const vs = [...this.views.values()];
    const on = vs.filter((v) => v.on > 0).length;
    this.status.textContent = `${on} of ${vs.length} rooms on`;
  }
};
if (!customElements.get("govuk-house-lighting-card")) customElements.define("govuk-house-lighting-card", GovukHouseLightingCard);
window.customCards = window.customCards ?? [];
window.customCards.push({ type: "govuk-house-lighting-card", name: "GOV.UK house lighting", description: "Room lighting with floor plan, whites, colours and dynamic scenes." });
