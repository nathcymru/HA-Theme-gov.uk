#!/usr/bin/env python3
"""Copy accepted supplied civica artwork into the documentation unchanged."""
from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[2]
brand = root / 'brand/civica'
source = root / 'docs/source'
check = '--check' in sys.argv
accepted = json.loads((brand / 'docs/accepted-assets.json').read_text())
accepted_files = {record['path']: record for record in accepted['files']}
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
    record = accepted_files.get(original)
    if not record or record['sha256'] != hashlib.sha256(content).hexdigest():
        raise SystemExit(f'Unverified supplied artwork: {original}')
    target = source / destination
    if check:
        if not target.exists() or target.read_bytes() != content:
            raise SystemExit(f'Stale documentation artwork: {destination}')
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    records.append({'publishedPath': destination, 'sourcePath': f'brand/civica/{original}', 'sha256': hashlib.sha256(content).hexdigest()})

manifest = {
    'schemaVersion': 2,
    'brandName': 'civica',
    'brandVersion': accepted['brandVersion'],
    'reviewedOn': accepted['reviewedOn'],
    'sourceArchive': accepted['sourceArchive'],
    'sourceArchiveSha256': accepted['sourceArchiveSha256'],
    'sourcePackManifest': f'brand/civica/{accepted["sourcePackManifest"]}',
    'acceptedPackManifest': 'brand/civica/docs/accepted-assets.json',
    'acceptedPackManifestSha256': hashlib.sha256((brand / 'docs/accepted-assets.json').read_bytes()).hexdigest(),
    'assetPolicy': accepted['assetPolicy'],
    'sourceCounts': accepted['counts'],
    'sourceExclusions': accepted['exclusions'],
    'sourceMetadataCorrections': accepted['metadataCorrections'],
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
print(f'{len(mapping)} documentation brand assets match the accepted revised pack.' if check else f'Copied {len(mapping)} accepted revised documentation brand assets.')
