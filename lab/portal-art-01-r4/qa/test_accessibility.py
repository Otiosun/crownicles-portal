from pathlib import Path
from playwright.sync_api import sync_playwright
import json
html=Path(__file__).resolve().parent.parent.joinpath('Crownicles-Fio-Estudo-Interativo.html').read_text()
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in (320,390,1440):
  page=b.new_page(viewport={'width':width,'height':844},reduced_motion='reduce')
  page.set_content(html)
  results.append((width,'reduced_motion',page.locator('.relic').evaluate('(e)=>getComputedStyle(e).transitionDuration')=='0s'))
  results.append((width,'skip_link',page.locator('a.skip[href="#main"]').count()==1))
  results.append((width,'main_h1',page.locator('main h1').count()==1))
  page.evaluate('document.documentElement.style.fontSize="32px"')
  results.append((width,'text_200_profile_no_xscroll',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')))
  page.locator('button[data-nav="inventory"]').click()
  results.append((width,'text_200_inventory_no_xscroll',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')))
  page.locator('button[data-action="inspect"]').click()
  results.append((width,'text_200_detail_no_xscroll',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')))
  page.close()
 b.close()
print(json.dumps({'n':len(results),'passed':sum(ok for _,_,ok in results),'failed':[(w,k) for w,k,ok in results if not ok]},indent=2))
if any(not ok for _,_,ok in results):raise SystemExit(1)
