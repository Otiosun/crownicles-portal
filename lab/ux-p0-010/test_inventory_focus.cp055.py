"""CP055: deterministic Chromium regression for deferred-focus search race.

Uses the actual CP050+CP051+CP052+CP054 controller, not a fake controller.
It holds only requestAnimationFrame callbacks scheduled by the DOM click to
model a user typing before the next paint. No game/network/real user session.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_preview import setup, click, ready

checks=[]
def ck(label,valid):
 checks.append((label,bool(valid)))
 if not valid:print('FAIL',label,flush=True)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,
                           headless=True,args=['--no-sandbox'])
 try:
  for width in [320,390,1440]:
   page=setup(browser,'normal',width)
   click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
   ck(f'{width} mounted search',page.locator('#inventory-query').count()==1)
   page.locator('#inventory-query').fill('70')
   ck(f'{width} unmatched search empty',page.locator('button[data-action="select"]:visible').count()==0)
   page.evaluate("""() => {
    const orig=requestAnimationFrame;window.__heldFocus=[];
    window.requestAnimationFrame=cb=>{window.__heldFocus.push(cb);return 1};
    document.getElementById('category-armor').click();
    window.requestAnimationFrame=orig;
   }""")
   ck(f'{width} switched category, query retained',page.locator('#inventory-query').input_value()=='70')
   page.locator('#inventory-query').fill('')
   ck(f'{width} user clear restored rows',page.locator('button[data-action="select"]:visible').count()==1)
   ck(f'{width} focused search before delayed callback',page.evaluate("document.activeElement?.id==='inventory-query'"))
   page.evaluate('() => {for(const cb of window.__heldFocus)cb(performance.now());window.__heldFocus=[]}')
   ck(f'{width} delayed focus cannot steal typing',page.evaluate("document.activeElement?.id==='inventory-query'"))
   ck(f'{width} input stayed empty',page.locator('#inventory-query').input_value()=='')
   ck(f'{width} live count reflects cleared query','1 itens nesta categoria.' in page.locator('#inventory-filter-status').inner_text())
   page.close()
 finally:browser.close()

print(f'CP055 Chromium focus regression {sum(v for _,v in checks)}/{len(checks)}')
raise SystemExit(0 if all(v for _,v in checks) else 1)
