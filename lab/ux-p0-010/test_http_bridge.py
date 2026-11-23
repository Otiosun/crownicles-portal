"""Browser DOM -> Python test bridge -> REAL loopback HTTP -> CP014/CP046.

The sandbox blocks Chromium network navigation, so only the browser transport
function is substituted with an explicit Python HTTP relay; production UI code
and P0 state modules are loaded unmodified aside from ESM import URL rewrites.
The test relay adds a synthetic session cookie outside the browser. It is NOT
proof of browser Secure-cookie behavior or HTTPS/Keycloak/MariaDB.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess,urllib.request,urllib.error,base64,json,sys
import test_preview as p0

NODE=Path(__file__).with_name('test-http-server.mjs')
proc=subprocess.Popen(['node','--disable-warning=ExperimentalWarning',str(NODE)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,stdin=subprocess.PIPE,text=True,bufsize=1)
checks=[]
def check(name,truth):
 checks.append((name,bool(truth)))
 if not truth:print('FAIL',name,flush=True)
try:
 info=json.loads(proc.stdout.readline())
 base=f'http://127.0.0.1:{info["port"]}'
 tokens=info['tokens']
 def http_request(owner,args):
  opts=args.get('options',{})
  method=opts.get('method','GET')
  headers={'Cookie':f'__Host-crownicles_session={tokens[owner]}','Accept':'application/json'}
  if method=='POST':headers['Origin']='https://portal.example.test'
  req=urllib.request.Request(base+args['url'],headers=headers,method=method)
  try:reply=urllib.request.urlopen(req,timeout=4)
  except urllib.error.HTTPError as exc:reply=exc
  with reply:
   raw=reply.read();return {'status':reply.status,'headers':{'content-type':reply.headers.get('content-type',''),'content-length':str(len(raw))},'b64':base64.b64encode(raw).decode('ascii')}
 def setup(browser,owner):
  page=browser.new_page(viewport={'width':390,'height':820})
  page.set_content(p0.HTML)
  page.expose_function('__p0Relay',lambda args:http_request(owner,args))
  page.evaluate('''async controllerUrl=>{
   window.__calls=[];
   const fetcher=async(url,options)=>{
    window.__calls.push({url,method:options.method,credentials:options.credentials,headers:options.headers,cache:options.cache});
    const r=await window.__p0Relay({url,options:{method:options.method}});
    const bytes=Uint8Array.from(atob(r.b64),c=>c.charCodeAt(0));
    return new Response(bytes,{status:r.status,headers:r.headers});
   };
   const mod=await import(controllerUrl);
   window.__ui=mod.mountP0Portal(document,{fetcher,focus:true});
  }''',p0.CONTROLLER)
  return page
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
  try:
   A=setup(browser,'A');B=setup(browser,'B')
   p0.click(A,'verify');p0.ready(A,'profile')
   p0.click(B,'verify');p0.ready(B,'profile')
   check('A source native packet projected through real HTTP as level 12','12' in A.locator('.metric').filter(has_text='Nível').inner_text())
   check('B source native packet projected through real HTTP as level 15','15' in B.locator('.metric').filter(has_text='Nível').inner_text())
   check('A and B account values remain isolated','12' in A.locator('.metric').filter(has_text='Dinheiro').inner_text() and '77' in B.locator('.metric').filter(has_text='Dinheiro').inner_text())
   p0.click(A,'inventory');p0.ready(A,'inventory')
   p0.click(B,'inventory');p0.ready(B,'inventory')
   check('A inventory item 7',A.locator('button[data-slot="1"]').inner_text().find('ID 7')>=0)
   check('B inventory item 9',B.locator('button[data-slot="1"]').inner_text().find('ID 9')>=0)
   check('A slot 0 active valid',A.locator('button[data-slot="0"]').count()==1)
   check('No identity or private key leaked into DOM',all('DO_NOT_LEAK' not in x.locator('body').inner_text() for x in [A,B]))
   check('No Cookie header constructed by browser JS',all('Cookie' not in r['headers'] for r in A.evaluate('window.__calls')+B.evaluate('window.__calls')))
   # Revocation in exact CP014 SQLite ledger, while A has loaded BOTH sections.
   proc.stdin.write('REVOKE_A\n');proc.stdin.flush()
   p0.click(A,'refresh')
   A.wait_for_function('!window.__ui.reader.getState().authorized',timeout=3000)
   check('A revocation strips both cached sections',A.evaluate('window.__ui.reader.getState().sections.profile.data===null&&window.__ui.reader.getState().sections.inventory.data===null'))
   check('A after revocation sees verification prompt',A.locator('button[data-action="verify"]').count()==1)
   # B must remain unaffected and retain item identity.
   p0.click(B,'refresh');p0.ready(B,'inventory')
   check('B not affected by A revocation',B.evaluate('window.__ui.reader.getState().authorized') and 'ID 9' in B.locator('button[data-slot="1"]').inner_text())
   p0.click(B,'forget')
   B.wait_for_function("document.getElementById('status').textContent.includes('Sessão encerrada pelo servidor')",timeout=3000)
   check('B logout is confirmed by original CP014 server',B.locator('button[data-action="verify"]').count()==1)
   p0.click(B,'verify')
   B.wait_for_function('!window.__ui.reader.getState().authorized')
   check('B old session cannot be reused after logout',B.locator('button[data-action="verify"]').count()==1 and B.locator('.metric').count()==0)
   check('No sensitive identity logged in UI',all('bindingRef' not in x.locator('body').inner_text() for x in [A,B]))
   A.close();B.close()
  finally:browser.close()
finally:
 try:proc.stdin.write('SHUTDOWN\n');proc.stdin.flush();proc.wait(timeout=5)
 except Exception:proc.kill();proc.wait()
print('CP047 cross-engine HTTP+DOM',sum(v for _,v in checks),'/',len(checks),flush=True)
if not all(v for _,v in checks):sys.exit(1)
