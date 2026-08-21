#!/usr/bin/env python3
"""Replace `fa-solid fa-spinner fa-spin` inline icons with the unified
`comet-loader-inline` element across src/*.js, preserving adjacent text
(button labels like "Running...", "Loading Permission Sets...", etc.)."""
import re, glob, sys

SPINNER_RE = re.compile(
    r'<i\s+class=["\']fa-solid\s+fa-spinner\s+fa-spin(?:[^"\']*)["\'](?:[^>]*)></i>'
)

def repl(m):
    return '<span class="comet-loader-inline"></span>'

changed = []
for path in sorted(glob.glob('src/*.js')):
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    new, n = SPINNER_RE.subn(repl, src)
    if n:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        changed.append((path, n))

for p, n in changed:
    print(f'{p}: {n} replaced')
print('TOTAL', sum(n for _, n in changed))
