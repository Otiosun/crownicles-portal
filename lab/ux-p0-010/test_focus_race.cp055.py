"""CP055 Chromium: deterministic stale requestAnimationFrame focus competition.

Controller and catalog are real ESM modules, transport is the existing local P0
fixture, not a real HTTPS browser or owner session. This reproduces the focus
race that caused CP050 clear search to intermittently keep its previous value.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_preview import setup, click, ready

checks=[]
def ck(label,ok):
    ok=bool(ok)
    checks.append((label,ok))
    if not ok: print('FAIL',label,flush=True)

# Capture user-script rAF callbacks so we can schedule user focus before
# navigation's pending focus callback. Avoid arbitrary sleep or flake odds.
def install_raf_queue(page):
    page.evaluate('''() => {window.__focusQueue=[];
        window.requestAnimationFrame = cb => {window.__focusQueue.push(cb); return window.__focusQueue.length};
    }''')

def flush(page):
    return page.evaluate('''() => {let jobs=window.__focusQueue.splice(0);for(const job of jobs)job(performance.now());return jobs.length}''')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,
                              headless=True,args=['--no-sandbox'])
    try:
        page=setup(browser,'normal',390)
        click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
        page.locator('#inventory-query').fill('70')
        ck('numeric search first hides all nonmatching items',page.locator('.item:visible').count()==0)
        install_raf_queue(page)
        page.locator('#category-armor').click()
        ck('category click scheduled focus restoration',page.evaluate('window.__focusQueue.length')>=1)
        ck('category rerender preserves query',page.locator('#inventory-query').input_value()=='70')
        page.locator('#inventory-query').focus()
        ck('user took input focus before pending navigation focus',page.evaluate("document.activeElement?.id==='inventory-query'"))
        flush(page)
        ck('pending category rAF must not steal focus from search',page.evaluate("document.activeElement?.id==='inventory-query'"))
        page.keyboard.press('ControlOrMeta+A');page.keyboard.press('Backspace')
        ck('keyboard clears search after competing focus callbacks',page.locator('#inventory-query').input_value()=='')
        ck('cleared search restores category rows',page.locator('.item:visible').count()>=1)
        ck('cleared search hides empty-results indicator',page.locator('#inventory-filter-empty:visible').count()==0)
        # Conversely, when user does NOT take focus, navigation must restore it.
        page.locator('#category-weapon').click()
        ck('new category has pending restoration',page.evaluate('window.__focusQueue.length')>=1)
        flush(page)
        ck('navigation restores category focus when uncontested',page.evaluate("document.activeElement?.id==='category-weapon'"))
        ck('normal category switch still selects the right category',page.locator('#category-weapon').get_attribute('aria-pressed')=='true')
        # Two overlapping navigation callbacks may target different categories.
        # Latest request wins, even when both were scheduled before one frame.
        page.locator('#category-armor').click()
        page.locator('#category-potion').click()
        ck('two category changes schedule independent focus callbacks',page.evaluate('window.__focusQueue.length')>=2)
        flush(page)
        ck('latest navigation wins over older pending category focus',page.evaluate("document.activeElement?.id==='category-potion'"))
        ck('latest category is selected',page.locator('#category-potion').get_attribute('aria-pressed')=='true')
        page.close()
    finally:browser.close()
print('CP055 deterministic Chromium focus-race:',sum(ok for _,ok in checks),'/',len(checks))
raise SystemExit(0 if all(ok for _,ok in checks) else 1)
