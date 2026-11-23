"""CP050 Chromium integration: local ID lookup, no new request or actor crossing.

Runs against the source-real CP049 controller ESM under the CP047 page.set_content
harness. This is not a real HTTPS browser-cookie proof.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import test_preview as lab

checks = []
def ck(name, ok):
    checks.append((name, bool(ok)))
    if not ok:
        print('FAIL', name, flush=True)

def visible(page):
    return page.locator('button[data-action="select"]:visible')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None, headless=True, args=['--no-sandbox'])
    try:
        page = lab.setup(browser, 'normal', 390)
        ck('Search absent without authenticated inventory', page.locator('#inventory-query').count() == 0)
        lab.click(page, 'verify'); lab.ready(page, 'profile')
        lab.click(page, 'inventory'); lab.ready(page, 'inventory')
        search = page.locator('#inventory-query')
        ck('Inventory has labeled search input', search.count() == 1 and page.locator('label[for="inventory-query"]').count() == 1)
        ck('All original rows present', visible(page).count() == 3)
        initial_calls = page.evaluate('window.__calls.length')
        search.fill('7')
        ck('Exactly two matching ID7 positions visible', visible(page).count() == 2 and [x.get_attribute('data-slot') for x in visible(page).all()] == ['1','2'])
        ck('Input retains focus while filtering', page.evaluate("document.activeElement?.id==='inventory-query'"))
        ck('Search makes no network request', page.evaluate('window.__calls.length') == initial_calls)
        ck('Result announcement names the right count', '2 de 3' in page.locator('#inventory-filter-status').inner_text())
        page.locator('button[data-slot="2"]').click()
        ck('Filtering keeps distinct selected slot', page.locator('button[data-slot="2"]').get_attribute('aria-pressed') == 'true')
        lab.click(page, 'inspect')
        ck('Inspect opens selected slot 2, no item modification', 'Reserva 2' in page.locator('.facts').inner_text())
        lab.click(page, 'back')
        ck('Returning to inventory keeps search and selection', page.locator('#inventory-query').input_value() == '7' and page.locator('button[data-slot="2"]').get_attribute('aria-pressed') == 'true')
        page.locator('#inventory-query').fill('0')
        ck('Item ID zero remains findable', visible(page).count() == 1 and visible(page).first.get_attribute('data-item-id') == '0')
        ck('Nonmatching selection not actionable while filtered', page.locator('.selection:visible').count() == 0)
        page.locator('#inventory-query').fill('abc')
        ck('Nonnumeric query rejected without coercing to ID zero', visible(page).count() == 0 and 'somente números' in page.locator('#inventory-filter-status').inner_text())
        page.locator('#inventory-query').fill('70')
        ck('Unmatched numeric query reports empty category', visible(page).count() == 0 and page.locator('#inventory-filter-empty:visible').count() == 1)
        lab.click(page, 'category')
        ck('Category switch retains explicit query', page.locator('#inventory-query').input_value() == '70')
        page.locator('#inventory-query').fill('')
        ck('Clearing search restores current category', visible(page).count() >= 1 and page.locator('#inventory-filter-empty:visible').count() == 0)
        lab.click(page, 'forget')
        page.wait_for_function('!window.__ui.reader.getState().authorized', timeout=2500)
        ck('Logout removes private search interface', page.locator('#inventory-query').count() == 0)
        lab.click(page, 'verify');lab.ready(page,'profile')
        lab.click(page, 'inventory');lab.ready(page, 'inventory')
        ck('New session never inherits prior ID query', page.locator('#inventory-query').input_value() == '')
        ck('390px no overflow', lab.no_overflow(page))
        page.close()
        tiny = lab.setup(browser, 'normal', 320)
        lab.click(tiny, 'verify');lab.ready(tiny,'profile')
        lab.click(tiny, 'inventory');lab.ready(tiny,'inventory')
        tiny.locator('#inventory-query').fill('7')
        ck('320px no overflow with filter active', lab.no_overflow(tiny))
        tiny.close()
    finally:
        browser.close()
passed = sum(ok for _,ok in checks)
print(f'CP050 Chromium inventory search {passed}/{len(checks)}')
if passed != len(checks): raise SystemExit(1)
