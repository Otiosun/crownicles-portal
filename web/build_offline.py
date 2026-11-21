from pathlib import Path
from bs4 import BeautifulSoup
import base64,re,hashlib
R=Path(__file__).resolve().parent
s=BeautifulSoup((R/'index.html').read_text(),'html.parser')
css=(R/'style.css').read_text();adapter=(R/'contract-adapter.js').read_text();js=(R/'app.js').read_text()
assets={}
for p in sorted((R/'assets').glob('*.webp')):
 url='data:image/webp;base64,'+base64.b64encode(p.read_bytes()).decode('ascii')
 assets['./assets/'+p.name]=url
 # Stylesheet is local to the file; URLs are replaced with self-contained data URIs.
 css=css.replace("url('./assets/"+p.name+"')",f'url("{url}")')
js=js.replace('els.sceneArt.src=src;','els.sceneArt.src=inlineAsset(src);')
assert 'els.sceneArt.src=inlineAsset(src)' in js
# Dynamic set under private helper, not a JS module or external network.
import json
js=js.replace("'use strict';", "'use strict';\nconst OFFLINE_ASSETS="+json.dumps(assets,separators=(',',':'))+";\nconst inlineAsset=s=>OFFLINE_ASSETS[s]||s;",1)
for x in s.select('link[rel=stylesheet]'):x.decompose()
style=s.new_tag('style');style.string=css;s.head.append(style)
for x in s.select('script[src]'):x.decompose()
script0=s.new_tag('script');script0.string=adapter;s.body.append(script0)
script=s.new_tag('script');script.string=js;s.body.append(script)
for img in s.select('img[src]'):
 if img['src'] in assets:img['src']=assets[img['src']]
output=R/'preview-offline.html';output.write_text('<!doctype html>\n'+str(s))
assert not re.search(r'<script[^>]+src=',str(s))
assert not re.search(r'<link[^>]+stylesheet',str(s))
assert all(v in output.read_text() for v in ['id="garden-section"','id="property-section"','id="companion-section"','id="chest-inspection"','normalizeBundle','data:image/webp;base64'])
print('Offline bytes',output.stat().st_size,'sha256',hashlib.sha256(output.read_bytes()).hexdigest())
print('All assets included:',sorted(assets),'CSS references residual:',re.findall(r'url\([^)]*assets/',css))
