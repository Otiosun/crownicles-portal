"""Crownicles UX-P0-010 DOM+transport test in Chromium, no HTTP navigation.

The sandbox blocks page.goto even for data/file/loopback; page.set_content and
ESM data URL imports retain the actual source modules, with only import paths
substituted by their byte-encoded contents. Fixtures injected ONLY in test.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64, json, re, sys
ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/'lab/ux-p0-010'
B64=lambda s:'data:text/javascript;base64,'+base64.b64encode(s.encode('utf-8')).decode('ascii')

def module_url(path,replacements=()):
 src=(ROOT/path).read_text(encoding='utf-8')
 for old,new in replacements:
  assert src.count(old)==1,(path,old,src.count(old))
  src=src.replace(old,new)
 return B64(src)
MACHINE=module_url('lab/ux-p0-003/machine.mjs')
GUARD=module_url('integration/p0/projection-guard.mjs')
BRIDGE=module_url('integration/p0/response-bridge.mjs',[("'../../lab/ux-p0-003/machine.mjs'",f"'{MACHINE}'"),("'./projection-guard.mjs'",f"'{GUARD}'")])
READER=module_url('integration/p0/browser-reader.cp046.mjs',[("'../../lab/ux-p0-003/machine.mjs'",f"'{MACHINE}'"),("'./response-bridge.mjs'",f"'{BRIDGE}'")])
CONTROLLER=module_url('lab/ux-p0-010/controller.mjs',[("'../../integration/p0/browser-reader.cp046.mjs'",f"'{READER}'"),("'../ux-p0-003/machine.mjs'",f"'{MACHINE}'")])
HTML=(APP/'preview.html').read_text()
HTML=re.sub(r'<script type="module">.*?</script>', '', HTML, flags=re.S)

STUB=r'''async controllerUrl => {
 const profile=(money=42)=>({level:12,health:{value:8,max:12},experience:{value:3,max:10},money,badges:[],missions:{gems:0,campaignProgression:0},rank:{rank:-1,unranked:true,numberOfPlayers:0,score:0},effect:{healed:false,timeLeft:-1,effect:'none',hasTimeDisplay:false},kingChallengeTier:0});
 const item=(id,category)=>category<2?{id,rarity:1,itemCategory:category,itemLevel:0,attack:{baseValue:1,upgradeValue:0,maximum:{kind:'value',value:1}},defense:{baseValue:0,upgradeValue:0,maximum:{kind:'value',value:1}},speed:{baseValue:0,upgradeValue:0,maximum:{kind:'value',value:1}}}:{id,rarity:1,itemCategory:category,nature:1,power:0,maximumPower:{kind:'value',value:1}};
 const inventory=()=>({categories:['weapon','armor','potion','object'].map((category,i)=>({category,capacity:i===0?3:1,active:item(0,i),reserves:i===0?[{slot:1,display:item(7,0)},{slot:2,display:item(7,0)}]:[]})),materials:[],talismans:{kind:'not_reported'},plants:{kind:'not_reported'}});
 window.__fixture={profile,inventory};
 window.__mode='normal';window.__calls=[];
 const fetcher=async(url,opts)=>{
  window.__calls.push({url,method:opts.method,credentials:opts.credentials,cache:opts.cache,headers:opts.headers,signal:opts.signal});
  if(url==='/v1/session/logout'){
   if(window.__mode==='logoutFail') throw Error('network loss');
   if(window.__mode==='logoutHung')return new Promise(()=>{});
   if(window.__mode==='logoutHtml')return new Response('<html>maintenance</html>',{status:200,headers:{'content-type':'text/html'}});
   if(window.__mode==='logoutOversize')return new Response('X'.repeat(2048),{status:200,headers:{'content-type':'application/json'}});
   return new Response(JSON.stringify({status:'signed_out'}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(window.__mode==='unauthorized')return new Response('',{status:401});
  if(window.__mode==='down')return new Response('',{status:503});
  if(window.__mode==='hung')return new Promise(resolve=>{window.__resolveHung=resolve;});
  if(window.__mode==='bad') return new Response(JSON.stringify({state:'ready',asOf:'2026-11-23T04:00:00.000Z',data:{keycloakId:'secret'}}),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({state:'ready',asOf:'2026-11-23T04:00:00.000Z',data:url.endsWith('profile')?profile():inventory()}),{status:200,headers:{'content-type':'application/json'}});
 };
 const mod=await import(controllerUrl);
 window.__ui=mod.mountP0Portal(document,{fetcher,focus:true,logoutTimeoutMs:100,readTimeoutMs:100});
 return !!window.__ui;
}'''

checks=[]
def ck(label,condition):
 checks.append((label,bool(condition)))
 if not condition: print('FAIL',label,flush=True)

def setup(browser, mode='normal',width=390):
 page=browser.new_page(viewport={'width':width,'height':800},device_scale_factor=1)
 page.set_content(HTML)
 page.evaluate(STUB,CONTROLLER)
 page.evaluate('m=>window.__mode=m',mode)
 return page

def click(page,action):
 page.locator(f'button[data-action="{action}"]').first.click()

def ready(page,section):
 page.wait_for_function('(section)=>window.__ui.reader.getState().sections[section].state==="ready"',arg=section,timeout=3000)

def no_overflow(page):
 return page.evaluate("document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('body *')].filter(e=>{const x=getComputedStyle(e);return x.display!=='inline'&&x.display!=='contents'&&e.getClientRects().length}).every(e=>e.scrollWidth<=e.clientWidth+1)")

if __name__ == "__main__":
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
  try:
   page=setup(browser,'normal',390)
   ck('No synthetic profile before verification',page.locator('.metric').count()==0)
   ck('No item buttons before verification',page.locator('button[data-action="select"]').count()==0)
   ck('No cookie, token or actor ID authored into HTML',all(word not in HTML for word in ['TOK_A','PRIVATE_ACTOR','localStorage','document.cookie','token=']))
   click(page,'verify');ready(page,'profile')
   ck('Profile level from HTTP data appears',page.locator('.metric').filter(has_text='Nível').inner_text().endswith('12'))
   ck('Profile money from HTTP data appears','42' in page.locator('.metric').filter(has_text='Dinheiro').inner_text())
   ck('Correct same-origin/no-store, no raw Cookie or Authorization',page.evaluate("window.__calls[0].credentials==='same-origin'&&window.__calls[0].cache==='no-store'&&Object.keys(window.__calls[0].headers).every(k=>!['cookie','authorization'].includes(k.toLowerCase()))"))
   ck('Viewport 390 no internal overflow',no_overflow(page))
   click(page,'inventory');ready(page,'inventory')
   ck('Inventory category buttons 4',page.locator('button[data-action="category"]').count()==4)
   ck('Category 0 active id preserved',page.locator('button[data-action="select"]').first.get_attribute('data-slot')=='0')
   ck('Duplicate ID rows distinct slots',page.locator('button[data-slot="1"]').count()==1 and page.locator('button[data-slot="2"]').count()==1)
   page.locator('button[data-slot="2"]').click();click(page,'inspect')
   ck('Detail for slot 2 visible',page.locator('#detail-heading').count()==1 and 'Reserva 2' in page.locator('.facts').inner_text())
   click(page,'back')
   ck('Back retains slot 2 selected',page.locator('button[data-slot="2"]').get_attribute('aria-pressed')=='true')
   page.wait_for_function("document.activeElement?.id==='item-weapon-2'",timeout=2000)
   ck('Detail focus restored to slot 2',page.evaluate("document.activeElement?.id==='item-weapon-2'"))
   click(page,'refresh');ready(page,'inventory')
   ck('Refresh preserves selected item identity',page.locator('button[data-slot="2"]').get_attribute('aria-pressed')=='true')
   click(page,'forget')
   page.wait_for_function('!window.__ui.reader.getState().authorized',timeout=3000)
   ck('Logout clears profile data',page.evaluate("window.__ui.reader.getState().sections.profile.data===null"))
   ck('Logout clears inventory data',page.evaluate("window.__ui.reader.getState().sections.inventory.data===null"))
   ck('Logout sends POST same-origin and no payload',page.evaluate("window.__calls.at(-1).url==='/v1/session/logout'&&window.__calls.at(-1).method==='POST'&&window.__calls.at(-1).credentials==='same-origin'"))
   ck('Logout status reports confirmed only after 200', 'Sessão encerrada pelo servidor' in page.locator('#status').inner_text())
   page.close()
   # Revoked session: no data visible.
   page=setup(browser,'unauthorized');click(page,'verify')
   page.wait_for_function('!window.__ui.reader.getState().authorized')
   ck('401 rejects speculative auth',page.locator('#login-heading').count()==1 and page.locator('.metric').count()==0)
   page.close()
   # 503 cannot prove an authenticated session; never open navigation.
   page=setup(browser,'down');click(page,'verify')
   page.wait_for_function("!window.__ui.reader.getState().authorized && document.getElementById('status').textContent.includes('Não foi possível confirmar')")
   ck('503 cannot claim an authenticated session',page.locator('button[data-action="inventory"]').count()==0 and page.locator('#login-heading').count()==1)
   page.evaluate("window.__mode='normal'");click(page,'verify');ready(page,'profile')
   ck('Retry after temporary 503 can restore verified session',page.locator('.metric').count()==4)
   page.close()
   # A 200 HTML logout page is not proof that the session was revoked.
   page=setup(browser,'normal');click(page,'verify');ready(page,'profile')
   page.evaluate("window.__mode='logoutHtml'");click(page,'forget')
   page.wait_for_function("document.getElementById('status').textContent.includes('não confirmou')")
   ck('Logout HTTP 200 without signed_out cannot claim revocation', 'Sessão encerrada pelo servidor' not in page.locator('#status').inner_text())
   page.close()
   # Logout must reject oversized JSON even with HTTP 200 and JSON MIME.
   page=setup(browser,'normal');click(page,'verify');ready(page,'profile')
   page.evaluate("window.__mode='logoutOversize'");click(page,'forget')
   page.wait_for_function("document.getElementById('status').textContent.includes('não confirmou')")
   ck('Oversized logout confirmation is rejected',page.locator('.metric').count()==0 and 'Sessão encerrada pelo servidor' not in page.locator('#status').inner_text())
   page.close()
   # Bad DTO: still authorized, but never shows secret.
   page=setup(browser,'bad');click(page,'verify')
   page.wait_for_function("!window.__ui.reader.getState().authorized && document.getElementById('status').textContent.includes('Não foi possível confirmar')")
   ck('Bad DTO returns to unverified state',page.locator('button[data-action="verify"]').count()==1)
   ck('Malicious private field never visible','secret' not in page.locator('body').inner_text())
   page.close()
   # logout failure does not claim to have revoked server session.
   page=setup(browser,'normal');click(page,'verify');ready(page,'profile')
   page.evaluate("window.__mode='logoutFail'");click(page,'forget')
   page.wait_for_function("document.getElementById('status').textContent.includes('Não foi possível')")
   ck('Unconfirmed server logout shown clearly', 'Não foi possível confirmar' in page.locator('#status').inner_text())
   ck('Unconfirmed logout still clears local data',page.evaluate("window.__ui.reader.getState().sections.profile.data===null"))
   page.close()
   # A stalled cookie verification must not leave a speculative user logged in.
   page=setup(browser,'hung');click(page,'verify')
   page.wait_for_function("!window.__ui.reader.getState().authorized && document.getElementById('status').textContent.includes('excedeu')",timeout=3000)
   ck('Hung verification times out and returns to login',page.locator('button[data-action="verify"]').count()==1)
   ck('Hung verification leaves no private data',page.evaluate("window.__ui.reader.getState().sections.profile.data===null"))
   page.evaluate('''() => window.__resolveHung(new Response(JSON.stringify({state:'ready',asOf:'2026-11-23T04:00:00.000Z',data:window.__fixture.profile(999)}),{status:200,headers:{'content-type':'application/json'}}))''')
   page.wait_for_timeout(150)
   ck('Late response after timeout cannot restore stale actor data',page.evaluate("!window.__ui.reader.getState().authorized && window.__ui.reader.getState().sections.profile.data===null") and page.locator('.metric').count()==0)
   page.close()
   # Timeout during Inventory refresh must clear previously loaded Profile AND Inventory.
   page=setup(browser,'normal');click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
   page.evaluate("window.__mode='hung'");click(page,'refresh')
   page.wait_for_function("!window.__ui.reader.getState().authorized && document.getElementById('status').textContent.includes('excedeu')",timeout=3000)
   ck('Hung inventory refresh purges both private sections',page.evaluate("window.__ui.reader.getState().sections.inventory.data===null&&window.__ui.reader.getState().sections.profile.data===null"))
   page.close()
   # Transient 503 after a valid account must not preserve previous actor data.
   page=setup(browser,'normal');click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
   page.evaluate("window.__mode='down'");click(page,'refresh')
   page.wait_for_function("!window.__ui.reader.getState().authorized")
   ck('Unavailable refresh purges all stale actor data',page.evaluate("window.__ui.reader.getState().sections.inventory.data===null&&window.__ui.reader.getState().sections.profile.data===null"))
   page.close()
   # If the server never responds to logout, UI cannot remain stuck forever.
   page=setup(browser,'normal');click(page,'verify');ready(page,'profile')
   page.evaluate("window.__mode='logoutHung'");click(page,'forget')
   page.wait_for_function("document.getElementById('status').textContent.includes('Não foi possível')",timeout=3000)
   ck('Hung logout reports unconfirmed revocation',page.locator('button[data-action="verify"]').count()==1)
   ck('Hung logout clears actor data',page.evaluate("window.__ui.reader.getState().sections.profile.data===null"))
   page.close()
   # responsive and semantics in several viewports
   for w in [320,390,430,768,1440]:
    page=setup(browser,'normal',w);click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
    ck(f'No overflow inventory width {w}',no_overflow(page))
    ck(f'Content main landmark width {w}',page.locator('main#content').count()==1)
    page.close()
  finally:
   browser.close()
 passed=sum(ok for _,ok in checks)
 print('UX-P0-010 Chromium checks',passed,'/',len(checks))
 if passed!=len(checks):sys.exit(1)
