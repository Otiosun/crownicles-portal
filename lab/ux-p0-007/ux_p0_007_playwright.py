"""Crownicles UX-P0-007 - browser-exposed accessibility, internal reflow and privacy.
This is only an offline lab; no game data, production session, or deployed HTTP app.
Run: python ux_p0_007_playwright.py [--root PATH]
"""
from __future__ import annotations
from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.request import urlopen
from urllib.parse import urljoin
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import base64, json, sys, argparse, traceback

parser=argparse.ArgumentParser()
parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parent/'lab')
parser.add_argument('--result',type=Path,default=None)
args=parser.parse_args()
root=args.root.resolve()
htmlfile=root/'ux-p0-005'/'preview.html'
module=root/'ux-p0-003'/'machine.mjs'
html=htmlfile.read_text(encoding='utf-8')
machine=module.read_text(encoding='utf-8')
source="import {initialState,transition,itemAt,canInspect,P0_CATEGORIES} from '../ux-p0-003/machine.mjs';"
assert html.count(source)==1, 'The lab no longer imports the pinned UX-P0-003 machine exactly once'
assert machine.count('export function transition')==1
url='data:text/javascript;base64,'+base64.b64encode(machine.encode()).decode()
offline=html.replace(source, source.replace("'../ux-p0-003/machine.mjs'",f"'{url}'"))
checks=[]
def ck(name,passed,context=''):
    ok=bool(passed)
    checks.append({'name':name,'pass':ok,'context':str(context)[:240]})
    if not ok: print('FAIL',name,context,flush=True)
def focus(page,ident):
    page.wait_for_function('(id) => document.activeElement && document.activeElement.id===id',arg=ident,timeout=1800)
def internal_overflow(page):
    return page.evaluate('''() => [...document.querySelectorAll('body *')].filter(e=>{
      const cs=getComputedStyle(e);if(cs.display==='inline'||cs.display==='contents'||!e.getClientRects().length)return false;
      return e.scrollWidth > e.clientWidth + 1;
    }).map(e=>({tag:e.tagName,id:e.id,klass:String(e.className||'').slice(0,35),sw:e.scrollWidth,cw:e.clientWidth}))''')
def check_reflow(page,label):
    over=internal_overflow(page)
    ck(label+' root no horizontal scroll', page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    ck(label+' no internal clipped blocks',not over,over)
def apply_state(page,status):
    details=page.locator('#scenarioTools')
    if not details.evaluate('el=>el.open'): details.locator('summary').click()
    page.locator('#scenario').select_option(status)
    page.locator('#applyScenario').click()
def axe_tree(page):
    cdp=page.context.new_cdp_session(page)
    return [ {'role':n.get('role',{}).get('value',''), 'name':n.get('name',{}).get('value','')}
       for n in cdp.send('Accessibility.getFullAXTree')['nodes'] if not n.get('ignored',True)]

class Quiet(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(root),**kw)
    def log_message(self,*args): pass

server=ThreadingHTTPServer(('127.0.0.1',0),Quiet)
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/ux-p0-005/preview.html'
try:
    for path,expected in [(base,'text/html'),(urljoin(base,'../ux-p0-003/machine.mjs'),'text/javascript')]:
        with urlopen(path,timeout=4) as r:
            body=r.read();mime=r.headers.get_content_type()
            ck('HTTP bytes '+expected,r.status==200 and len(body)>4000 and mime==expected,f'{r.status} {mime} {len(body)}')
    ck('relative ESM URL points to machine',urljoin(base,'../ux-p0-003/machine.mjs').endswith('/ux-p0-003/machine.mjs'))
finally:server.shutdown()

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for width,height in [(320,800),(390,844),(768,1024),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        try:
            page.set_content(offline,wait_until='load')
            ck(f'{width} starts unauthenticated',page.get_by_role('button',name='Iniciar sessão fictícia').is_visible())
            page.get_by_role('button',name='Iniciar sessão fictícia').click();focus(page,'profile-heading')
            ck(f'{width} profile shows factual fixture',page.get_by_text('10 / 12').is_visible())
            page.get_by_role('button',name='Ver pertences').click();focus(page,'inventory-heading')
            ck(f'{width} focus visible',page.locator('#inventory-heading').evaluate('e=>getComputedStyle(e).outlineWidth')=='3px')
            ax=axe_tree(page)
            ck(f'{width} AX main/nav/heading',all(any(x['role']==role and (not name or x['name']==name) for x in ax) for role,name in [('main',''),('navigation','Navegação principal'),('heading','Pertences')]))
            ck(f'{width} AX groups',all(any(x['role']=='group' and x['name']==name for x in ax) for name in ['Categorias dos pertences','Posições do acervo']))
            ck(f'{width} slot 0 has neutral label',page.locator('#item-weapon-0').inner_text().startswith('Posição ativa'))
            page.locator('#item-weapon-0').click();focus(page,'item-weapon-0')
            ck(f'{width} ID=0 selected',page.locator('#item-weapon-0').get_attribute('aria-pressed')=='true')
            for slot in [1,2]:
                page.locator(f'#item-weapon-{slot}').click();focus(page,f'item-weapon-{slot}')
                page.get_by_role('button',name='Inspecionar item').click();focus(page,'detail-heading')
                ck(f'{width} slot {slot} details',page.get_by_text('ID de catálogo').is_visible() and page.locator('dl.facts').get_by_text('7').count()>0)
                page.get_by_role('button',name='Voltar ao mesmo item').click();focus(page,f'item-weapon-{slot}')
                ck(f'{width} slot {slot} restored',page.locator(f'#item-weapon-{slot}').get_attribute('aria-pressed')=='true')
            for size in ['100%','200%']:
                style=page.add_style_tag(content=f'html{{font-size:{size}!important}}')
                check_reflow(page,f'{width} inventory {size}')
                if width==320 and size=='200%':page.screenshot(path=str(root.parent/'inventory-320-200pct.png'),full_page=True)
                if width==1440 and size=='200%':page.screenshot(path=str(root.parent/'inventory-1440-200pct.png'),full_page=True)
                style.evaluate('el=>el.remove()')
            page.get_by_role('button',name='Objetos').click();focus(page,'category-object')
            ck(f'{width} change category resets selected',page.locator('.selection').count()==0 and page.locator('#category-object').get_attribute('aria-pressed')=='true')
            page.get_by_role('button',name='Armas').click();focus(page,'category-weapon')
            apply_state(page,'restricted');focus(page,'inventory-heading')
            ck(f'{width} restricted purges records',page.get_by_text('Esta informação não está disponível para consulta agora.').is_visible() and page.locator('.item').count()==0)
            apply_state(page,'not_initialized');focus(page,'inventory-heading')
            ck(f'{width} not initialized distinct',page.get_by_text('Esta parte da conta ainda não está preparada para consulta.').is_visible())
            apply_state(page,'unavailable');focus(page,'inventory-heading')
            ck(f'{width} unavailable offers retry',page.get_by_role('button',name='Tentar novamente').is_visible())
            page.get_by_role('button',name='Tentar novamente').click();focus(page,'inventory-heading')
            apply_state(page,'loading');focus(page,'inventory-heading')
            ck(f'{width} loading purges old records',page.get_by_text('Consultando pertences…').is_visible() and page.locator('.item').count()==0)
            apply_state(page,'ready');focus(page,'inventory-heading')
            page.locator('#item-weapon-1').click();page.get_by_role('button',name='Inspecionar item').click();focus(page,'detail-heading')
            apply_state(page,'unauthorized');focus(page,'login-heading')
            ck(f'{width} 401 clears all data',page.locator('.item').count()==0 and page.get_by_text('ID de catálogo').count()==0 and page.get_by_text('10 / 12').count()==0 and page.get_by_role('button',name='Iniciar sessão fictícia').is_visible())
            ck(f'{width} no JS errors',not errors,errors)
        except Exception as err:
            ck(f'{width} fatal',False,str(err).splitlines()[0])
        finally: page.close()
    page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    page.set_content(offline)
    page.keyboard.press('Tab')
    ck('keyboard skip link first',page.evaluate("document.activeElement?.textContent.trim()==='Ir ao conteúdo'"))
    page.keyboard.press('Enter')
    ck('skip link moves actual DOM focus',page.evaluate("document.activeElement?.id==='content'"))
    page.keyboard.press('Tab');ck('tab reaches start',page.evaluate("document.activeElement?.dataset.action==='start'"))
    page.keyboard.press('Enter');focus(page,'profile-heading')
    page.keyboard.press('Tab');ck('tab reaches inventory action',page.evaluate("document.activeElement?.dataset.action==='inventory'"))
    page.keyboard.press('Enter');focus(page,'inventory-heading')
    target_bad=[]
    for b in page.locator('button:visible').all():
        rect=b.bounding_box()
        if rect and min(rect['width'],rect['height'])<44:target_bad.append([b.inner_text(),rect])
    ck('390 touch targets at least 44px',not target_bad,target_bad)
    page.close()
    browser.close()

n=len(checks);failed=[c for c in checks if not c['pass']]
summary={'id':'UX-P0-007','date':'2026-11-22','checks':n,'passed':n-len(failed),'failed':len(failed),'mode':'Chromium + data: ESM; local HTTP bytes via Python urllib, browser HTTP navigation blocked','limitations':['No real screen reader or human testing','No browser HTTP navigation, server auth, Core, DB, CI runner, merge, or deploy']}
output={'summary':summary,'checks':checks}
outfile=args.result or root.parent/'test-results.json'
outfile.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2));print('saved',outfile)
sys.exit(0 if not failed else 1)
