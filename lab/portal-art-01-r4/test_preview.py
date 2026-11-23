from pathlib import Path
from playwright.sync_api import sync_playwright
import json, hashlib
root=Path(__file__).parent
html=(root/'Crownicles-Fio-Estudo-Interativo.html').read_text()
checks=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width,height in [(320,740),(390,844),(430,930),(768,1024),(1440,900)]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda req: requests.append(req.url) if not req.url.startswith('data:') else None)
  page.set_content(html,wait_until='load')
  page.locator('.relic').wait_for(state='visible')
  checks.append((width,'img-load',page.locator('.relic').evaluate('(e)=>e.complete && e.naturalWidth>0')))
  checks.append((width,'profile-title','personagem' in page.locator('#title').inner_text().lower()))
  checks.append((width,'profile-level','18' in page.locator('#panel').inner_text()))
  page.get_by_role('button',name='Pertences',exact=True).click()
  checks.append((width,'inventory-title','pertences' in page.locator('#title').inner_text().lower()))
  checks.append((width,'first-item',page.locator('.item-row').count()>=1))
  page.get_by_role('button',name='Poções').click()
  checks.append((width,'potion-choice',page.locator('.item-row').count()==1))
  page.get_by_role('button',name='Armas').click()
  page.locator('#item-3').click()
  checks.append((width,'selected-3',page.locator('#item-3').get_attribute('aria-pressed')=='true'))
  page.get_by_role('button',name='Inspecionar',exact=False).click()
  checks.append((width,'detail-title','em foco' in page.locator('#title').inner_text().lower()))
  page.keyboard.press('Escape')
  checks.append((width,'esc-back','pertences' in page.locator('#title').inner_text().lower()))
  try:
   page.wait_for_function("document.activeElement.id === 'item-3'",timeout=1000)
   restored=True
  except Exception:restored=False
  checks.append((width,'focus-restored',restored))
  page.locator('#item-3').click()
  page.get_by_role('button',name='Inspecionar',exact=False).click()
  page.get_by_role('button',name='Voltar ao mesmo item').click()
  checks.append((width,'button-back',page.locator('#item-3').get_attribute('aria-pressed')=='true'))
  checks.append((width,'no-overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')))
  checks.append((width,'no-js-errors',not errors))
  checks.append((width,'no-network',not requests))
  if width in (390,1440):
   page.get_by_role('button',name='Personagem').click()
   page.screenshot(path=str(root/f'qa/Crownicles-R4-{width}-perfil.png'),full_page=True)
   page.get_by_role('button',name='Pertences',exact=True).click()
   page.screenshot(path=str(root/f'qa/Crownicles-R4-{width}-pertences.png'),full_page=True)
   page.get_by_role('button',name='Inspecionar',exact=False).click()
   page.screenshot(path=str(root/f'qa/Crownicles-R4-{width}-inspecao.png'),full_page=True)
  page.close()
 browser.close()
passes=sum(1 for _,_,yes in checks if yes)
result={'passes':passes,'total':len(checks),'failures':[{'width':w,'name':k} for w,k,ok in checks if not ok],'html_sha256':hashlib.sha256(html.encode()).hexdigest(),'checks':checks}
(root/'qa/qa.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
print(json.dumps({k:v for k,v in result.items() if k!='checks'},indent=2,ensure_ascii=False))
if passes<len(checks):raise SystemExit(1)
