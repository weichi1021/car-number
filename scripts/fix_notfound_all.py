#!/usr/bin/env python3
import re
import json
from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'notfound' / 'notfound-all.json'
text = p.read_text()
nums = re.findall(r'CAT-(\d{1,4})', text)
nums_int = sorted({int(n) for n in nums})
lines = []
for i in range(0, len(nums_int), 10):
    chunk = nums_int[i:i+10]
    items = ', '.join(f'"CAT-{n:04d}"' for n in chunk)
    lines.append('  ' + items + ',')
if lines:
    # remove trailing comma on last line
    lines[-1] = lines[-1].rstrip(',')
out = '[\n' + '\n'.join(lines) + '\n]\n'
# write to tmp then replace
tmp = p.with_suffix('.json.tmp')
tmp.write_text(out)
# validate
json.loads(tmp.read_text())
# backup original
bak = p.with_suffix('.json.bak')
if not bak.exists():
    p.rename(bak)
# replace
tmp.rename(p)
print(f'Wrote fixed file: {p} (count={len(nums_int)})')
