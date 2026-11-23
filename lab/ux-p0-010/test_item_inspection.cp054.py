"""CP054 Chromium native item inspection: no real session or HTTPS navigation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_preview import setup,click,ready,no_overflow
checks=[]
def ck(label,ok):
 checks.append((label,bool(ok)))
 if not ok: print('FAIL',label,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 try:
  for width in [320,390,430,1440]:
   page=setup(browser,'normal',width)
   ck(f'No private/item facts before auth {width}',page.locator('.facts').count()==0)
   click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
   for cat,expected in [('weapon','Nível do item'),('armor','Nível do item'),('potion','Natureza (código nativo)'),('object','Natureza (código nativo)')]:
    page.locator(f'button[data-action="category"][data-category="{cat}"]').click()
    page.locator('button[data-action="select"]').first.click();click(page,'inspect')
    facts=page.locator('.facts').inner_text()
    ck(f'{width} {cat} native rarity', 'Raridade (índice nativo)' in facts)
    ck(f'{width} {cat} correct schema', expected in facts)
    ck(f'{width} {cat} no cross-schema', ('Natureza (código nativo)' not in facts) if cat in ['weapon','armor'] else ('Ataque · limite' not in facts))
    ck(f'{width} {cat} zero-valued fields visible', '0' in facts)
    ck(f'{width} {cat} no overflow',no_overflow(page))
    click(page,'back')
    ck(f'{width} {cat} returns same item slot',page.locator('button[data-slot="0"]').get_attribute('aria-pressed')=='true')
   click(page,'forget');page.wait_for_function('!window.__ui.reader.getState().authorized')
   ck(f'{width} no detail after logout',page.locator('.facts').count()==0)
   page.close()
 finally: browser.close()
print('CP054 BROWSER',sum(ok for _,ok in checks),'/',len(checks))
raise SystemExit(0 if all(ok for _,ok in checks) else 1)
