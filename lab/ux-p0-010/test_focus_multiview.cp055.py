from pathlib import Path
from playwright.sync_api import sync_playwright
from test_preview import setup,click,ready,no_overflow
checks=[]
def ck(name,cond):
    checks.append(bool(cond))
    if not cond: print('FAIL',name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
 try:
  for w in [320,390,430,768,1440]:
   for reduced in [False,True]:
    page=setup(browser,'normal',w)
    if reduced:page.emulate_media(reduced_motion='reduce')
    click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
    page.locator('#inventory-query').fill('70')
    page.evaluate('''() => {window.__callbacks=[];window.requestAnimationFrame = cb=>{window.__callbacks.push(cb);return window.__callbacks.length}}''')
    page.locator('#category-armor').click()
    page.locator('#inventory-query').focus()
    page.evaluate('''() => {for (const cb of window.__callbacks.splice(0))cb(performance.now())}''')
    ck(f'{w},reduced={reduced} search maintains focus',page.evaluate("document.activeElement?.id==='inventory-query'"))
    page.keyboard.press('ControlOrMeta+A');page.keyboard.press('Backspace')
    ck(f'{w},reduced={reduced} clear search',page.locator('#inventory-query').input_value()=='')
    ck(f'{w},reduced={reduced} shows own category rows',page.locator('button.item:visible').count()>0)
    ck(f'{w},reduced={reduced} no horizontal overflow',no_overflow(page))
    page.close()
 finally:browser.close()
print('CP055 MULTIVIEW COMPOSITE',sum(checks),'/',len(checks))
raise SystemExit(0 if all(checks) else 1)
