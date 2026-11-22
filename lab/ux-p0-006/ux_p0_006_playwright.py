"""UX-P0-006 offline ESM and DOM/a11y regression lab: no server integration.

Uses a data: ESM import instead of the relative module URL because Chromium in this
executor blocks all top-level navigation to localhost. Unlike UX-P0-005's inline
machine injection, the HTML still executes <script type=module> and native `import`.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
import base64, re, sys
here=Path(__file__).resolve().parent
root=here.parent if (here.parent/'ux-p0-005'/'preview.html').exists() else here
html=(root/'ux-p0-005'/'preview.html').read_text()
machine=(root/'ux-p0-003'/'machine.mjs').read_text()
assert len(machine)>4000 and 'export function transition' in machine
old="import {initialState,transition,itemAt,canInspect,P0_CATEGORIES} from '../ux-p0-003/machine.mjs';"
assert html.count(old)==1
url='data:text/javascript;base64,'+base64.b64encode(machine.encode()).decode()
html=html.replace(old,old.replace("'../ux-p0-003/machine.mjs'",f"'{url}'"))
results=[]
def assert_true(cond):
 if not cond:raise AssertionError("assert_true failed")
def test(name,work):
 try:
  work()
  results.append((name,'PASS'))
 except Exception as e:
  results.append((name,'FAIL '+str(e).splitlines()[0][:190]))

def is_focus(page,el): return page.evaluate("id => document.activeElement?.id === id",el)

def scenario(page,state):
 tool=page.locator('#scenarioTools')
 if not tool.evaluate('(e) => e.open'):tool.locator('summary').click()
 page.locator('#scenario').select_option(state)
 page.locator('#applyScenario').click()

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h in [(320,800),(390,844),(768,1024),(1440,900)]:
  page=b.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
  errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(html)
  try:
   page.get_by_role('button',name='Iniciar sessão fictícia').click()
   page.get_by_text('10 / 12').wait_for(timeout=4000)
   page.wait_for_function("document.activeElement?.id==='profile-heading'")
   test(f'{w} ESM + focus after login',lambda: (not errors and is_focus(page,'profile-heading')) or (_ for _ in ()).throw(AssertionError(errors)))
   page.get_by_role('button',name='Ver pertences').click()
   page.wait_for_function("document.activeElement?.id==='inventory-heading'")
   test(f'{w} inventory main focus',lambda:assert_true(is_focus(page,'inventory-heading')))
   test(f'{w} focus visible on h1',lambda:assert_true(page.locator('#inventory-heading').evaluate('e=>getComputedStyle(e).outlineWidth')=='3px'))
   test(f'{w} category/list group landmarks',lambda:assert_true(page.get_by_role('group',name='Categorias dos pertences').count()==1 and page.get_by_role('group',name='Posições do acervo').count()==1))
   page.locator('#item-weapon-0').click()
   test(f'{w} id 0 accepted',lambda:assert_true(page.get_by_text('Selecionado:').is_visible()))
   for slot in [1,2]:
    page.locator(f'#item-weapon-{slot}').click()
    page.get_by_role('button',name='Inspecionar item').click()
    page.wait_for_function("document.activeElement?.id==='detail-heading'")
    page.get_by_role('button',name='Voltar ao mesmo item').click()
    page.wait_for_function(f"document.activeElement?.id==='item-weapon-{slot}'")
    test(f'{w} duplicate slot {slot} restore',lambda slot=slot:assert_true(page.locator(f'#item-weapon-{slot}').get_attribute('aria-pressed')=='true'))
   scenario(page,'restricted')
   test(f'{w} restricted hidden data',lambda:assert_true(page.get_by_text('Esta informação não está disponível para consulta agora.').is_visible() and page.get_by_text('ID 7 · sem ilustração atribuída').count()==0))
   scenario(page,'not_initialized')
   test(f'{w} not_initialized distinct',lambda:assert_true(page.get_by_text('Esta parte da conta ainda não está preparada para consulta.').is_visible()))
   scenario(page,'unavailable')
   test(f'{w} unavailable retry',lambda:assert_true(page.get_by_role('button',name='Tentar novamente').is_visible()))
   page.get_by_role('button',name='Tentar novamente').click()
   scenario(page,'loading')
   test(f'{w} loading stale-free',lambda:assert_true(page.get_by_text('Consultando pertences…').is_visible() and page.get_by_text('ID 7 · sem ilustração atribuída').count()==0))
   scenario(page,'ready')
   page.locator('#item-weapon-1').click()
   page.get_by_role('button',name='Inspecionar item').click()
   scenario(page,'unauthorized')
   test(f'{w} 401 purge',lambda:assert_true(page.get_by_role('button',name='Iniciar sessão fictícia').is_visible() and page.get_by_text('10 / 12').count()==0 and page.get_by_text('ID de catálogo').count()==0))
   test(f'{w} no horizontal overflow',lambda:assert_true(page.evaluate('document.documentElement.scrollWidth <= innerWidth')))
   page.get_by_role('button',name='Iniciar sessão fictícia').click()
   page.get_by_role('button',name='Ver pertences').click()
   page.add_style_tag(content='html{font-size:200%!important}')
   test(f'{w} 200% text no overflow',lambda:assert_true(page.evaluate('document.documentElement.scrollWidth <= innerWidth')))
   page.get_by_role('button',name='Objetos').click()
   test(f'{w} 200% text category no overflow',lambda:assert_true(page.evaluate('document.documentElement.scrollWidth <= innerWidth')))
   test(f'{w} no console errors',lambda:assert_true(not errors))
  except Exception as e:
   results.append((f'{w} fatal','FAIL '+str(e).splitlines()[0][:150]))
  finally:page.close()
 # more explicit keyboard and touch hit tests
 page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
 page.set_content(html)
 page.keyboard.press('Tab')
 test('keyboard skip link',lambda:assert_true(page.evaluate("document.activeElement?.textContent.trim()==='Ir ao conteúdo'")))
 page.keyboard.press('Enter')
 test('skip navigation focuses main',lambda:assert_true(page.evaluate("document.activeElement?.id==='content'")))
 page.keyboard.press('Tab')
 test('keyboard start reachable',lambda:assert_true(page.evaluate("document.activeElement?.dataset.action==='start'")))
 page.keyboard.press('Enter')
 page.wait_for_function("document.activeElement?.id==='profile-heading'")
 test('keyboard enter works',lambda:assert_true(page.get_by_text('10 / 12').is_visible()))
 # tab should reach character nav button; we inspect for keyboard ordering
 page.keyboard.press('Tab')
 test('tab after heading reaches intended action',lambda:assert_true(page.evaluate("document.activeElement?.dataset.action==='inventory'")))
 page.get_by_role('button',name='Ver pertences').click()
 def touches():
  buttons=page.locator('button:visible')
  short=[]
  for i in range(buttons.count()):
   el=buttons.nth(i)
   box=el.bounding_box()
   if box and min(box['width'],box['height'])<44:short.append((el.inner_text(),round(box['width']),round(box['height'])))
  assert not short,short
 test('390 hit target >=44x44',touches)
 # screenshots
 page.screenshot(path=str(root/'p0-006-inventory.png'),full_page=True)
 b.close()

failed=[x for x in results if x[1].startswith('FAIL')]
print('TOTAL',len(results),'FAILED',len(failed))
for name,out in results:print(name,'=>',out)
sys.exit(1 if failed else 0)
