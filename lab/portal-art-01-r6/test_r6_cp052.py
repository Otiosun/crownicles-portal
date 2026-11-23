"""QA ART01 R6: exact CP052 ESM modules with synthetic Responses (NOT real account)."""
from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path(__file__).parent
h=root/'demo-sintetico-r6.html'
if not h.exists():raise SystemExit('Run python build_preview.py first')
checks=0
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (320,390,430,768,1440):
  pg=browser.new_page(viewport={'width':width,'height':844});errors=[];requests=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.on('request',lambda e:requests.append(e.url))
  pg.set_content(h.read_text());pg.wait_for_function('window.__booted===true')
  assert pg.locator('#fixture-disclaimer').is_visible();checks+=1
  assert not pg.locator('#visual-stage').is_visible();checks+=1
  assert not pg.locator('.rail').is_visible();checks+=1
  assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth+1');checks+=1
  pg.locator('button[data-action="verify"]').click();pg.locator('#profile-heading').wait_for()
  assert pg.locator('#visual-stage').is_visible();checks+=1
  pg.locator('button[data-action="inventory"]').first.click();pg.locator('#inventory-heading').wait_for()
  assert pg.locator('button[data-action="select"]').count()==3;checks+=1
  pg.locator('button[data-category="weapon"][data-slot="2"][data-action="select"]').click()
  pg.wait_for_function('document.querySelector("#visual-number").textContent==="2"')
  assert pg.locator('.item.selected').count()==1;checks+=1
  pg.locator('button[data-action="inspect"]').click();pg.locator('#detail-heading').wait_for()
  assert pg.locator('#visual-number').inner_text()=='2';checks+=1
  pg.locator('button[data-action="back"]').click();pg.locator('#inventory-heading').wait_for()
  pg.wait_for_function('document.activeElement?.id === "item-weapon-2"')
  assert pg.locator('.item.selected').get_attribute('data-slot')=='2';checks+=1
  pg.locator('button[data-action="refresh"]').click();pg.locator('#inventory-heading').wait_for()
  pg.evaluate('window.__test.setInvalid(true)')
  pg.locator('button[data-action="refresh"]').click();pg.locator('#login-heading').wait_for()
  pg.wait_for_function('document.querySelector("#visual-stage").hidden')
  assert pg.locator('#visual-number').inner_text()=='◇';checks+=1
  assert pg.locator('#content').get_by_text('Espada de madeira').count()==0;checks+=1
  assert not errors and not requests,(errors,requests);checks+=1
  pg.close()
 for width in (320,390):
  pg=browser.new_page(viewport={'width':width,'height':844})
  pg.set_content(h.read_text());pg.wait_for_function('window.__booted===true')
  pg.add_style_tag(content='html{font-size:200%!important}')
  for phase in ('login','inventory','detail'):
   if phase=='inventory':
    pg.locator('button[data-action="verify"]').click();pg.locator('#profile-heading').wait_for()
    pg.locator('button[data-action="inventory"]').first.click();pg.locator('#inventory-heading').wait_for()
   if phase=='detail':
    pg.locator('button[data-action="select"][data-slot="1"][data-category="weapon"]').click()
    pg.locator('button[data-action="inspect"]').click();pg.locator('#detail-heading').wait_for()
   assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),(width,phase);checks+=1
  pg.close()
 browser.close()
print(f'CP052 original R6 integration: {checks}/{checks} PASS (synthetic transport, no real login)')
