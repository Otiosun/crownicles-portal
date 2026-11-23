"""Rebuild synthetic standalone preview from exact pinned CP052 client modules.
No login, database, WhatsApp or network calls. Run from GitHub checkout or scratch ZIP.
"""
from pathlib import Path
import re,json,subprocess,base64
ROOT=Path(__file__).parent
MAN=json.loads((ROOT/'sourcepin_manifest.json').read_text())
SRC=ROOT/'sourcepin'
if not SRC.is_dir():SRC=ROOT.parent.parent  # lab/portal-art-01-r6 -> repository root
for rel,sha in MAN['files'].items():
  got=subprocess.check_output(['git','hash-object',str(SRC/rel)],text=True).strip()
  if got!=sha:raise RuntimeError('CP052_SOURCE_SHA_MISMATCH:'+rel)
cache={}
reg=re.compile(r'''(\bfrom\s*)(['"])([^'"\n]+)\2''')
def uri(path):
 path=path.resolve()
 if path in cache:return cache[path]
 s=path.read_text()
 s=reg.sub(lambda m:m.group(1)+m.group(2)+uri((path.parent/m.group(3)).resolve())+m.group(2),s)
 cache[path]='data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
 return cache[path]
controller=uri(SRC/'lab/ux-p0-010/controller.mjs')
visual='data:text/javascript;base64,'+base64.b64encode((ROOT/'visual-r6.mjs').read_bytes()).decode()
shell=(ROOT/'shell-r6.html').read_text()
shell=re.sub(r'<script type="module">.*?</script>', '', shell,flags=re.S)
notice='<aside role="note" id="fixture-disclaimer" style="background:#f6e7c5;color:#172027;padding:12px 18px;font:700 14px/1.35 system-ui">LABORATÓRIO • Respostas sintéticas para testar o controlador CP052 original. Nenhuma conta, WhatsApp ou servidor real está conectado.</aside>'
shell=shell.replace('<body>','<body>'+notice,1)
runner=(ROOT/'mock_runner.template.js').read_text().replace('__CP052_URI__',controller).replace('__R6_URI__',visual)
result=shell.replace('</body>',runner+'\n</body>')
(ROOT/'demo-sintetico-r6.html').write_text(result)
print('CP052 source modules pinned',len(cache),'demo bytes',len(result))
