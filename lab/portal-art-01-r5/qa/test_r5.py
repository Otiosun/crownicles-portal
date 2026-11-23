#!/usr/bin/env python3
"""Offline visual study tests. Not Crownicles P0 Auth/SQL/WA tests."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,hashlib,sys
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text(encoding='utf8')
assert 'http://' not in HTML and 'https://' not in HTML, 'Unexpected network reference in source'
checks=0
fail=[]
def check(condition,why):
 global checks
 checks+=1
 if not condition:fail.append(why)

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h in [(320,700),(390,844),(430,930),(768,860),(1024,768),(1440,900)]:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1,reduced_motion='reduce')
  errors=[];network=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('request',lambda r: network.append(r.url))
  page.set_content(HTML,wait_until='load')
  check(page.locator('h1').inner_text().startswith('Seu registro.'),f'{w} profile title')
  check(page.get_by_role('button',name='Abrir pertences').is_visible(),f'{w} open')
  check(page.locator('#obj-id').inner_text()=='◇',f'{w} no persona invented')
  page.get_by_role('button',name='Abrir pertences').click()
  check('pertences' in page.locator('h1').inner_text().lower(),f'{w} inventory screen')
  check(page.locator('#slot-weapon-0').get_attribute('aria-pressed')=='true',f'{w} initial selected')
  check(page.locator('#slot-weapon-1').inner_text().find('ID 0')!=-1,f'{w} item id zero')
  page.locator('#slot-weapon-3').click()
  check(page.locator('#slot-weapon-3').get_attribute('aria-pressed')=='true',f'{w} duplicate id distinct slot')
  check(page.locator('#obj-id').inner_text()=='10',f'{w} stage responds')
  page.get_by_role('button',name='Inspecionar posição').click()
  check(page.get_by_text('ID de catálogo',exact=True).is_visible(),f'{w} detail facts')
  check(page.locator('#readout-title').inner_text()=='Registro 03',f'{w} detail same slot')
  page.keyboard.press('Escape')
  page.wait_for_function("document.activeElement?.id==='slot-weapon-3'")
  check(page.locator('#slot-weapon-3').get_attribute('aria-pressed')=='true',f'{w} escape selection retained')
  check(page.evaluate("document.activeElement?.id")=='slot-weapon-3',f'{w} escape focus restored')
  page.locator('#slot-weapon-3').focus()
  page.keyboard.press('ArrowRight')
  page.wait_for_function("document.activeElement?.id==='slot-weapon-0'")
  check(page.locator('#slot-weapon-0').get_attribute('aria-pressed')=='true',f'{w} keyboard wraps')
  page.locator('#category-armor').click()
  check(page.locator('#slot-armor-2').count()==1,f'{w} category change items')
  check(page.locator('#category-armor').get_attribute('aria-pressed')=='true',f'{w} category focus state')
  page.locator('#category-object').click()
  check(page.get_by_text('Categoria vazia.',exact=False).is_visible(),f'{w} empty state')
  check(page.get_by_role('button',name='Inspecionar posição').is_disabled(),f'{w} empty disabled')
  page.locator('#category-weapon').click()
  page.locator('#slot-weapon-1').click()
  page.get_by_role('button',name='Inspecionar posição').click()
  check(page.locator('#readout .fact').filter(has_text='ID de catálogo').inner_text().endswith('0'),f'{w} id 0 inspect')
  page.get_by_role('button',name='Voltar ao mesmo item').click()
  page.wait_for_function("document.activeElement?.id==='slot-weapon-1'")
  check(page.locator('#slot-weapon-1').get_attribute('aria-pressed')=='true',f'{w} back same')
  check(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'{w} horizontal overflow')
  check(not errors,f'{w} errors {errors}')
  check(not network,f'{w} unexpected network {network}')
  check(page.evaluate("getComputedStyle(document.querySelector('.iris')).transitionDuration")=='0s',f'{w} reduced motion')
  # Header, category, stage, strips must stack in this order on phones.
  if w<=760:
   cat=page.locator('#categories').bounding_box();stage=page.locator('.stage').bounding_box();slots=page.locator('#slots').bounding_box();reader=page.locator('#readout').bounding_box()
   check(cat['y']+cat['height']<=stage['y']+6,f'{w} categories before stage')
   check(stage['y']+stage['height']<=slots['y']+15,f'{w} stage before slots')
   check(slots['y']+slots['height']<=reader['y']+15,f'{w} slots before detail')
  # Text zoom (simulate text-only enlargement without desktop zoom viewport mutation)
  page.evaluate("document.documentElement.style.fontSize='32px'")
  page.wait_for_timeout(60)
  check(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'{w} 200 pct text overflow')
  check(page.get_by_role('button',name='Personagem',exact=True).first.is_visible(),f'{w} nav still visible')
  check(page.locator('#status').inner_text().find('fixtures')!=-1,f'{w} disclose lab')
  if w in [320,390,1440]:
   page.evaluate("document.documentElement.style.fontSize='16px'")
   page.locator('#slot-weapon-1').click()
   page.screenshot(path=str(ROOT/'qa'/f'R5-final-{w}-inventory.png'),full_page=True)
   page.get_by_role('button',name='Inspecionar posição').click()
   page.screenshot(path=str(ROOT/'qa'/f'R5-final-{w}-detail.png'),full_page=True)
  page.close()
 browser.close()

report={'passed':checks-len(fail),'total':checks,'failures':fail,'sha256_html':hashlib.sha256(HTML.encode()).hexdigest()}
(ROOT/'qa'/'report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
sys.exit(bool(fail))
