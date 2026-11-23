"""CP052: Actual CP050+CP051 integration in one Chromium journey.

Source modules come from the PR21 tree (no mocks for controller/catalog/reader).
The transport fixture is local, not an HTTPS browser or real player session.
This does not imply release/auth/DB approval.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_preview import setup,click,ready,no_overflow

checks=[]
def ck(name, condition):
    checks.append((name, bool(condition)))
    if not condition: print('FAIL:',name,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,
                              headless=True,args=['--no-sandbox'])
    try:
        page=setup(browser,'normal',390)
        ck('no catalog leaked before login', 'Punhal' not in page.locator('main').inner_text())
        click(page,'verify');ready(page,'profile')
        click(page,'inventory');ready(page,'inventory')
        ck('native ID0 label rendered', 'Punho' in page.locator('button[data-slot="0"]').inner_text())
        ck('two distinct reserves have native label', all('Punhal' in e.inner_text() for e in page.locator('button[data-slot="1"],button[data-slot="2"]').all()))
        calls_before=page.evaluate('window.__calls.length')
        page.locator('#inventory-query').fill('7')
        ck('ID filter returns exactly both duplicate named items',
           page.locator('.item:visible').count()==2 and
           all('Punhal' in e.inner_text() and 'ID 7' in e.inner_text() for e in page.locator('.item:visible').all()))
        ck('filter itself makes zero additional HTTP requests',page.evaluate('window.__calls.length')==calls_before)
        page.locator('#item-weapon-2').click();click(page,'inspect')
        ck('detail displays named duplicate from slot 2',
           'Punhal' in page.locator('.facts').inner_text() and 'Reserva 2' in page.locator('.facts').inner_text())
        click(page,'back')
        ck('back preserves ID query and exact selected slot',
           page.locator('#inventory-query').input_value()=='7' and
           page.locator('#item-weapon-2').get_attribute('aria-pressed')=='true')
        page.wait_for_function("document.activeElement?.id==='item-weapon-2'", timeout=1500)
        ck('back re-focuses the selected slot',page.evaluate("document.activeElement?.id==='item-weapon-2'"))
        page.locator('#inventory-query').fill('punhal')
        ck('native name search finds both duplicate ID7 reserves',
           page.locator('.item:visible').count()==2 and
           all('Punhal' in el.inner_text() for el in page.locator('.item:visible').all()))
        page.locator('#inventory-query').fill('PUNHAL')
        ck('name search is case insensitive',page.locator('.item:visible').count()==2)
        page.locator('#inventory-query').fill('relampago')
        ck('accent insensitive name search can find title ID1 only when present',
           page.locator('.item:visible').count()==0)
        ck('search by title does not request server again',page.evaluate('window.__calls.length')==calls_before)
        page.locator('#inventory-query').fill('0')
        ck('ID0 search finds named active item only',
           page.locator('.item:visible').count()==1 and
           'Punho' in page.locator('.item:visible').inner_text())
        ck('previous selection cannot be inspected when filtered out',page.locator('.selection:visible').count()==0)
        page.locator('#inventory-query').fill('7x')
        ck('malformed search cannot coerce into native ID',page.locator('.item:visible').count()==0 and
           'ID inteiro' in page.locator('#inventory-filter-status').inner_text())
        page.locator('#inventory-query').fill('7')
        page.locator('#category-armor').click()
        ck('category-specific ID preserves query but does not invent item',
           page.locator('#inventory-query').input_value()=='7' and page.locator('.item:visible').count()==0 and
           page.locator('#inventory-filter-empty:visible').count()==1)
        page.locator('#inventory-query').fill('0')
        ck('same ID0 resolves official armor name, not weapon name',
           'Sem escudo ou armadura' in page.locator('.item:visible').inner_text() and
           'Punho' not in page.locator('.item:visible').inner_text())
        page.locator('#category-potion').click()
        ck('potion category does not reuse armor title',
           'Sem poção' in page.locator('.item:visible').inner_text())
        page.locator('#category-object').click()
        ck('object category does not reuse potion title',
           'Espaço livre' in page.locator('.item:visible').inner_text())
        page.locator('#inventory-query').fill('')
        ck('clearing query restores available local items',page.locator('.item:visible').count()==1)
        ck('no horizontal overflow on 390px with translated names',no_overflow(page))
        click(page,'forget');page.wait_for_function('!window.__ui.reader.getState().authorized')
        ck('logout removes catalog/search DOM entirely',page.locator('#inventory-query').count()==0 and page.locator('.item').count()==0)
        click(page,'verify');ready(page,'profile');click(page,'inventory');ready(page,'inventory')
        ck('new verified session starts with cleared query',page.locator('#inventory-query').input_value()=='')
        page.close()
    finally:
        browser.close()
print('CP052 PR21 real-controller/catalog Chromium journey:',sum(check for _,check in checks),'/',len(checks))
raise SystemExit(0 if all(check for _,check in checks) else 1)
