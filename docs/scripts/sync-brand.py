#!/usr/bin/env python3
"""Copy the supplied civica.uk V3.2 artwork into the documentation unchanged."""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[2]
brand = root / 'brand/civica'
source = root / 'docs/source'
check = '--check' in sys.argv
mapping = {
    'images/civica-lockup.svg': 'core/lockup-on-blue.svg',
    'images/civica-emblem.svg': 'core/emblem-black.svg',
    'images/favicon.ico': 'icons/favicon.ico',
    'images/favicon.svg': 'icons/favicon.svg',
    'images/apple-touch-icon.png': 'icons/apple-touch-icon.png',
    'images/icon-192.png': 'icons/icon-192.png',
    'images/icon-512.png': 'icons/icon-512.png',
}
palettes = json.loads((root / 'design-system/palettes.json').read_text())
for palette in palettes['palettes']:
    for tone in palettes['tones']:
        for filename in ['lockup-on-primary.svg', 'lockup-on-canvas.svg', 'app-icon.svg']:
            path = f'themes/{palette["id"]}/{tone}/{filename}'
            mapping[f'images/{path}'] = path

records = []
for destination, original in sorted(mapping.items()):
    content = (brand / original).read_bytes()
    target = source / destination
    if check:
        if not target.exists() or target.read_bytes() != content:
            raise SystemExit(f'Stale documentation artwork: {destination}')
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    records.append({'publishedPath': destination, 'sourcePath': f'brand/civica/{original}', 'sha256': hashlib.sha256(content).hexdigest()})

manifest = {
    'schemaVersion': 1,
    'brandVersion': '3.2',
    'sourceArchive': 'civica_uk_brand_assets_v3.2.zip',
    'sourceArchiveSha256': '3c4e475fe54cf30c8f4ff19573193b690152645789703b90f8f41d2092608e3c',
    'sourcePackManifest': 'brand/civica/docs/SHA256SUMS.txt',
    'assetPolicy': 'Byte-for-byte supplied files; no geometry, dot colour or background changes.',
    'verificationScope': 'Checks copy fidelity only, not independent rights or accessibility certification.',
    'assets': records,
}
content = json.dumps(manifest, indent=2) + '\n'
path = source / 'reference/brand-assets.json'
if check:
    if not path.exists() or path.read_text() != content:
        raise SystemExit('Stale documentation artwork manifest')
else:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
print(f'{len(mapping)} documentation brand assets match V3.2.' if check else f'Copied {len(mapping)} supplied V3.2 documentation brand assets.')
