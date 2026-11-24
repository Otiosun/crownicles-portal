"""CP062: Chromium regression for actual P0 ESM navigation, not_initialized→ready.

Synthetic responses only; no external HTTP, cookies or real player data.
Requires Chromium and Python Playwright. Run: python lab/ux-p0-010/test_recovery.cp062.py
"""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright
import test_preview as t

ANCHOR="  if(window.__mode==='down')return new Response('',{status:503});"
INJECT="""  if(window.__mode==='not_initialized'||window.__mode==='restricted')
   return new Response(JSON.stringify({state:window.__mode,asOf:'2026-11-23T04:00:00.000Z'}),{status:200,headers:{'content-type':'application/json'}});
"""
assert t.STUB.count(ANCHOR)==1
FIXTURE=t.STUB.replace(ANCHOR,INJECT+ANCHOR)
checks=[]
def ck(label,result):
 ok=bool(result);checks.append(ok)
 print(('PASS ' if ok else 'FAIL ')+label,flush=True)

def setup(browser,mode,width):
 page=browser.new_page(viewport={'width':width,'height':860})
 page.set_default_timeout(3000)
 page.set_content(t.HTML)
 assert page.evaluate(FIXTURE,t.CONTROLLER)
 page.evaluate('x=>window.__mode=x',mode)
 return page

def ready(page,section,phase):
 page.wait_for_function('([s,p])=>window.__ui.reader.getState().sections[s].state===p',arg=[section,phase])

def retry(page):
 page.locator('button[data-action="retry"]').first.click()

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 try:
  one=setup(browser,'not_initialized',320)
  t.click(one,'verify');ready(one,'profile','not_initialized')
  ck('Profile not_initialized displayed without private data','Ainda não preparado' in one.locator('.message').inner_text() and one.locator('.metric').count()==0)
  ck('Profile retry button is keyboard accessible',one.locator('button[data-action="retry"]').count()==1)
  ck('320px no horizontal overflow',t.no_overflow(one))
  one.evaluate("window.__mode='normal'")
  one.locator('button[data-action="retry"]').focus()
  one.keyboard.press('Enter');ready(one,'profile','ready')
  ck('Keyboard retry restores verified profile',one.locator('.metric').filter(has_text='Nível').inner_text().endswith('12'))
  ck('Safe GET profile is repeated',one.evaluate("window.__calls.filter(x=>x.url==='/v1/me/profile'&&x.credentials==='same-origin'&&x.cache==='no-store'&&x.method==='GET').length===2"))
  one.close()

  two=setup(browser,'normal',390);t.click(two,'verify');ready(two,'profile','ready')
  two.evaluate("window.__mode='not_initialized'");t.click(two,'inventory');ready(two,'inventory','not_initialized')
  ck('Inventory is uninitialized without fabricated items','Ainda não preparado' in two.locator('.message').inner_text() and two.locator('button[data-action="select"]').count()==0)
  ck('Inventory offers retry AND profile navigation',two.locator('button[data-action="retry"]').count()==1 and two.locator('button[data-action="profile"]').count()>=1)
  two.evaluate("window.__mode='normal'");retry(two);ready(two,'inventory','ready')
  ck('Inventory retry restores canonical category slots',two.locator('button[data-action="category"]').count()==4 and two.locator('button[data-slot="2"]').get_attribute('data-item-id')=='7')
  two.locator('button[data-slot="2"]').click();t.click(two,'inspect');t.click(two,'back')
  ck('Item detail returns to exact slot',two.locator('button[data-slot="2"]').get_attribute('aria-pressed')=='true')
  two.close()

  for width,status in [(430,'unauthorized'),(768,'down')]:
   page=setup(browser,'normal',width);t.click(page,'verify');ready(page,'profile','ready')
   page.evaluate("window.__mode='not_initialized'");t.click(page,'inventory');ready(page,'inventory','not_initialized')
   page.evaluate('m=>window.__mode=m',status);retry(page)
   page.wait_for_function('!window.__ui.reader.getState().authorized')
   ck(f'{status} while retrying clears both cached private sections',page.evaluate("window.__ui.reader.getState().sections.profile.data===null && window.__ui.reader.getState().sections.inventory.data===null") and page.locator('.metric').count()==0)
   page.close()

  page=setup(browser,'restricted',1440);t.click(page,'verify');ready(page,'profile','restricted')
  ck('Restricted state is still distinct','Acesso restrito' in page.locator('.message').inner_text() and page.locator('button[data-action="retry"]').count()==0)
  page.close()
 finally:browser.close()
print(f'CP062 Chromium recovery: {sum(checks)}/{len(checks)}',flush=True)
sys.exit(0 if all(checks) else 1)
