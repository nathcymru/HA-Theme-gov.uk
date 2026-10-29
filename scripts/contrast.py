#!/usr/bin/env python3
"""Check WCAG 2.x contrast ratios for the colour pairings used in themes/govuk.yaml.

Usage: python3 scripts/contrast.py
Exits non-zero if any pairing falls below its required threshold.
"""
import sys


def lum(hexcol):
    h = hexcol.lstrip("#")
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(fg, bg):
    a, b = sorted((lum(fg), lum(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)


# (label, foreground, background, minimum required ratio)
# 4.5 = WCAG AA text, 3.0 = AA non-text/large text, 7.0 = AAA text.
LIGHT = [
    ("Text on white card", "#0b0c0c", "#ffffff", 7.0),
    ("Text on light grey page", "#0b0c0c", "#f3f2f1", 7.0),
    ("Secondary text on white", "#505a5f", "#ffffff", 4.5),
    ("Secondary text on light grey", "#505a5f", "#f3f2f1", 4.5),
    ("White on green button", "#ffffff", "#00703c", 4.5),
    ("White on green hover", "#ffffff", "#005a30", 7.0),
    ("Link blue on white", "#1d70b8", "#ffffff", 4.5),
    ("Link hover on white", "#003078", "#ffffff", 7.0),
    ("Black on focus yellow", "#0b0c0c", "#ffdd00", 7.0),
    ("Sidebar white on black", "#ffffff", "#0b0c0c", 7.0),
    ("Sidebar selected yellow on black", "#ffdd00", "#0b0c0c", 7.0),
    ("Red error text on white", "#d4351c", "#ffffff", 4.5),
    ("Input border black on white", "#0b0c0c", "#ffffff", 3.0),
    ("Border grey on white (decorative)", "#b1b4b6", "#ffffff", 1.0),
    ("Banner: white on black", "#ffffff", "#0b0c0c", 7.0),
    ("Banner: white on red", "#ffffff", "#d4351c", 4.5),
    ("Banner: white on green", "#ffffff", "#00703c", 4.5),
]
DARK = [
    ("Text on charcoal", "#ffffff", "#1d2021", 7.0),
    ("Text on dark card", "#ffffff", "#2a2e30", 7.0),
    ("Secondary text on charcoal", "#c6c9ca", "#1d2021", 7.0),
    ("Secondary text on dark card", "#c6c9ca", "#2a2e30", 7.0),
    ("White on dark green button", "#ffffff", "#00703c", 4.5),
    ("Link on charcoal", "#8cbbe3", "#1d2021", 7.0),
    ("Yellow focus on charcoal", "#ffdd00", "#1d2021", 7.0),
    ("Yellow focus on dark card", "#ffdd00", "#2a2e30", 7.0),
    ("Input border on charcoal", "#b1b4b6", "#1d2021", 3.0),
    ("Error text on charcoal", "#ff8a75", "#1d2021", 7.0),
    ("Success text on charcoal", "#6fd39a", "#1d2021", 7.0),
]

failures = 0
for name, pairs in (("LIGHT", LIGHT), ("DARK", DARK)):
    print(f"\n{name} mode")
    for label, fg, bg, need in pairs:
        r = ratio(fg, bg)
        ok = r >= need
        failures += not ok
        print(f"  {'PASS' if ok else 'FAIL'}  {r:5.2f}:1 (need {need})  {label}  {fg} on {bg}")
sys.exit(1 if failures else 0)
