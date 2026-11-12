#!/usr/bin/env python3
"""Publish the canonical palette reference without maintaining a second specification."""
from pathlib import Path
import json
import sys
root = Path(__file__).resolve().parents[2]
source = root / 'design-system/palettes.json'
data = json.loads(source.read_text())
lines = ['---', 'title: Colour', 'description: Ten civica.uk palettes, Vivid and Muted variants, and independent semantic colours.', 'last_reviewed_on: 2026-11-12', 'review_in: 3 months', '---', '', '# Colour', '', 'Choose one of ten palettes and a Vivid or Muted variant. These choices change the interface primary and canvas while keeping status and data meanings consistent.', '', 'This page is generated from `design-system/palettes.json`. The [machine-readable palette reference](../reference/palettes.json) preserves every supplied hex, RGB, RGBA, CMYK and RAL or descriptive reference. Hex values in sRGB are authoritative for screens. CMYK and RAL entries reproduce the supplied specification; they are not measured colour-match guarantees.', '', 'Read the [colour roles and accessibility guidance](brand-colour.html) for colour roles, combinations, proportion and accessible use. The exact supplied palette values below remain the screen-colour authority.', '', '## Palette overview', '', '| Palette | Vivid primary | Vivid canvas | Muted primary | Muted canvas |', '| --- | --- | --- | --- | --- |']
for p in data['palettes']:
    lines.append('| '+p['name']+' | '+' | '.join('`'+p[tone][role]['hex']+'`' for tone in ['vivid','muted'] for role in ['primary','canvas'])+' |')
lines += ['', '## Try the variants', '', 'This demonstration changes only the example. To change Home Assistant, use [the profile colour controls](../get-started/colour-settings.html).', '', '<div class="c-demo" data-palette-demo>', '<div class="c-demo__header"><strong>Morgan household</strong></div>', '<label for="palette-preview">Colour palette</label>', '<select id="palette-preview">']
for p in data['palettes']:
    lines.append(f'<option data-palette-id="{p["id"]}" data-vivid="{p["vivid"]["primary"]["hex"]}" data-muted="{p["muted"]["primary"]["hex"]}" data-canvas="{p["muted"]["canvas"]["hex"]}">{p["name"]}</option>')
lines += ['</select>', '<label><input type="checkbox"> Muted colours</label>', '<p>This preview uses an invented household name. A logo is optional.</p>', '<p>Living room temperature: <strong>21 °C</strong></p>', '<p class="c-status">All monitored devices are available.</p>', '<p role="status">Civic Cobalt, Vivid preview. These choices affect this example only.</p>', '</div>', '', 'The preview changes interface colours without changing the household name or the meaning of any state. Follow [personalisation](../get-started/personalisation.html) for optional names, crests and logos. The separate [project artwork manifest](../reference/brand-assets.json) records supplied civica.uk assets for documentation and promotion.', '', '## Light and dark modes', '', 'Vivid and Muted are colour-strength variants, independent of Home Assistant’s light, dark or automatic mode. Light mode uses the exact supplied primary and canvas. Dark mode uses neutral dark surfaces and lighter interactive tints derived from the selected primary, while retaining the supplied primary in the brand header. This is an explicit accessibility adaptation; the supplied off-white canvas is not represented as a dark colour.', '', 'The generator blends interaction tints 72% towards white in dark mode. Dark tokens are tested against their actual surfaces. The selected native mode is preserved when the palette changes.', '', '## Keep functional colours stable', '', '| Role | Light-mode base | Rule |', '| --- | --- | --- |', '| Main text | `#0B0C0C` | Use against the tested light canvas or card surface |', '| Secondary text | `#484949` | Keep readable; do not fade with arbitrary opacity |', '| Structural border | `#CECECE` | Quiet card edges and dividers, normally 1px |', '| Input border | `#0B0C0C` | Strong editable-field boundary, normally 2px |', '| Error | `#CA3535` | Error text/icon role; use dedicated fill/on-fill pair for banners |', '| Success | `#0F7A52` | Confirmed success; independent of palette |', '| Warning text | `#8A6100` | Dark ochre is a local contrast adaptation |', '| Focus | Yellow `#FFDD00` and ink `#0B0C0C` | Custom controls use both colours; yellow alone is insufficient on white |', '', 'See [Layout and spacing](layout.html#surfaces-and-borders) for structural, interactive and input boundary roles. The [notification badge](../components/notification-badge.html) keeps its MOJ red and rounded geometry across palettes; it is not a status tag.', '', 'Native Home Assistant controls that expose only one outline colour use ink on light surfaces and yellow on dark surfaces. Dark brand masthead controls receive a scoped yellow treatment. Preserve native circle/pill shapes for switches, radio controls, avatars and gauges where their meaning depends on them.', '', 'Use `civica-danger-fill` with `civica-on-danger`, and the equivalent success, warning and notice pairs, for persistent banners. The lighter `error-color` in dark mode is intended for text/icons and is not automatically a safe white-text button fill.', '', 'Chart colours are generated from stable series identities, with separate Vivid/Muted and Light/Dark values. They stay independent of the chosen brand palette. At least 24 fallback colours are supplied, with no 24-series cap for the identity-based generator. Labels, line patterns and data tables supplement colour. See [Chart colour](chart-colour.html) and [Charts and tables](../components/charts.html).', '', '## Exact colour references', '', 'RGB and RGBA values refer to screen colours. Print and paint references are supplied metadata. Do not replace the screen hex with an approximate RAL lookup.', '']
for p in data['palettes']:
    lines += ['### '+p['name'], '', '| Variant and role | Hex | RGB | RGBA | CMYK | Supplied reference |', '| --- | --- | --- | --- | --- | --- |']
    for tone in ['vivid','muted']:
        for role in ['primary','canvas']:
            v=p[tone][role]
            lines.append('| '+tone.title()+' '+role+' | `'+v['hex']+'` | '+', '.join(map(str,v['rgb']))+' | '+', '.join(map(str,v['rgba']))+' | '+', '.join(map(str,v['cmyk']))+' | '+v['reference']+' |')
    lines += ['']
lines += ['## Maintain the tokens', '', 'Edit the canonical JSON, then run `node scripts/generate-themes.mjs` and `python3 docs/scripts/sync-palettes.py` from the repository root. Commit the generated YAML, theme JSON and this colour reference together. Use `--check` on both generators to detect drift.', '', 'The native theme name is `civica {palette name} {Vivid|Muted}`. The `govuk` entry is a compatibility alias for Civic Cobalt Vivid. Existing companion identity behaviour is described in [Compatibility](../get-started/compatibility.html#household-identity-transition); this colour reference does not require a project logo inside a household interface.', '', 'The semantic role approach follows [GOV.UK colour guidance](https://design-system.service.gov.uk/styles/colour/). The ten named palettes and theme toggle are local civica.uk decisions.', '']
page_content = '\n'.join(lines)
example_section = """## Examples

These isolated examples illustrate the decisions on this page. Any household values are invented, and demonstration actions do not control a home. Open an example to inspect it at full width or view its exact HTML.

<%= example('local-colour-vivid') %>

<%= example('local-colour-muted') %>

"""
position = page_content.index('\n## ')
page_content = page_content[:position] + '\n\n' + example_section + page_content[position:]
outputs = {
    root/'docs/source/reference/chart-colours.json': (root/'design-system/chart-colours.json').read_text(),
    root/'docs/source/styles/colour.html.md.erb': page_content,
    root/'docs/source/reference/palettes.json': source.read_text(),
    root/'docs/source/reference/upstream-sources.json': (root/'design-system/upstream-sources.json').read_text()
}
check = '--check' in sys.argv
for path, content in outputs.items():
    if check:
        if not path.exists() or path.read_text()!=content:
            raise SystemExit(f'Stale generated documentation: {path.relative_to(root)}')
    else:
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(content)
print('Palette documentation is current.' if check else 'Updated palette documentation and machine-readable references.')
