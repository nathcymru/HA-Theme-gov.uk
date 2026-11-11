#!/usr/bin/env python3
"""Check generated documentation links and fragment destinations offline."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

root = Path('docs/build').resolve()
assert (root / 'index.html').exists(), 'Build the Middleman documentation first'

class Links(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links = []
        self.ids = set()
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs: self.ids.add(attrs['id'])
        for key in ('href', 'src'):
            if attrs.get(key): self.links.append(attrs[key])

pages = {p: Links(p.read_text()) for p in root.rglob('*.html')}
errors = []
for page, data in pages.items():
    for link in data.links:
        url = urlparse(urljoin('https://docs.invalid/' + page.relative_to(root).as_posix(), link))
        if url.netloc != 'docs.invalid' or url.scheme != 'https': continue
        dest = root / unquote(url.path).lstrip('/')
        if dest.is_dir(): dest /= 'index.html'
        if not dest.exists(): errors.append(f'{page.relative_to(root)}: missing {link}')
        elif url.fragment and dest in pages and unquote(url.fragment) not in pages[dest].ids:
            errors.append(f'{page.relative_to(root)}: missing fragment {link}')
assert not errors, '\n'.join(errors)
print(f'Checked internal links and anchors in {len(pages)} documentation pages.')
