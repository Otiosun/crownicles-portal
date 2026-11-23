"""Recover the standalone study illustration from its self-contained HTML (offline)."""
from pathlib import Path
import base64, re
root = Path(__file__).parent
html = (root/'Crownicles-Fio-Estudo-Interativo.html').read_text(encoding='utf-8')
m = re.search(r'data:image/webp;base64,([A-Za-z0-9+/=]+)', html)
if m is None:
    raise SystemExit('NO_ART_DATA')
raw=base64.b64decode(m.group(1), validate=True)
output=root/'assets'/'fio-estudo.webp'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_bytes(raw)
print(f'{output.relative_to(root)}: {len(raw)} bytes')
