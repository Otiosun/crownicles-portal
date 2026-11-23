"""CP051 Chromium real module integration. No live account or HTTPS browser."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_preview import setup,click,ready,no_overflow
checks=[]
def ck(k,v):
 checks.append((k,bool(v)))
 if not v:print('FAIL',k,flush=True)
if __name__=='__main__':
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
  try:
   page=setup(browser,'normal',390)
   ck('No names before session','Punhal' not in page.locator('#content').inner_text())
   click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
   ck('ID0 source Punho','Punho' in page.locator('button[data-slot="0"]').inner_text())
   ck('Reserve 1 Punhal ID7','Punhal' in page.locator('button[data-slot="1"]').inner_text() and 'ID 7' in page.locator('button[data-slot="1"]').inner_text())
   ck('Duplicate ID in different slot remains separate','Punhal' in page.locator('button[data-slot="2"]').inner_text())
   page.locator('button[data-slot="2"]').click();click(page,'inspect')
   ck('Detail canonical name','Punhal' in page.locator('.facts').inner_text())
   click(page,'back')
   ck('Focus returns to same slot',page.locator('button[data-slot="2"]').get_attribute('aria-pressed')=='true')
   for category,label in [('armor','Sem escudo ou armadura'),('potion','Sem poção'),('object','Espaço livre')]:
    page.locator(f'button[data-category="{category}"]').click()
    ck('Category '+category+' labels',label in page.locator('button[data-action="select"]').first.inner_text())
   ck('390px reflow',no_overflow(page));page.close()
   page=setup(browser,'normal',320);click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
   ck('320px reflow',no_overflow(page) and 'Punho' in page.locator('button[data-slot="0"]').inner_text());page.close()
  finally:browser.close()
 print('CP051 BROWSER:',sum(ok for _,ok in checks),'/',len(checks))
 raise SystemExit(0 if all(ok for _,ok in checks) else 1)
