"""CP047 keyboard and Chromium accessibility tree smoke.

Runs with real source modules via the pinned test_preview harness, not a public
website or real authentication. Does NOT replace NVDA/TalkBack/VoiceOver review.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import test_preview as p0

checks = []

def check(label, passed):
    checks.append((label, bool(passed)))
    if not passed:
        print('FAIL', label, flush=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,
        args=['--no-sandbox'],
    )
    page = p0.setup(browser, 'normal', 390)
    try:
        cdp = page.context.new_cdp_session(page)

        def accessible():
            return [
                {'role': entry.get('role', {}).get('value'), 'name': entry.get('name', {}).get('value')}
                for entry in cdp.send('Accessibility.getFullAXTree')['nodes']
                if not entry.get('ignored', True)
            ]

        initial = accessible()
        check('Main landmark exists', any(x['role'] == 'main' for x in initial))
        check('Verification button has accessible name', any(x['role'] == 'button' and x['name'] == 'Verificar sessão existente' for x in initial))
        page.locator('button[data-action="verify"]').focus()
        page.keyboard.press('Enter')
        p0.ready(page, 'profile')
        check('Keyboard verification opens profile', page.locator('#profile-heading').count() == 1)
        check('Profile heading is accessible', any(x['role'] == 'heading' and x['name'] == 'Seu personagem' for x in accessible()))
        page.locator('button[data-action="inventory"]').first.focus()
        page.keyboard.press('Enter')
        p0.ready(page, 'inventory')
        check('Keyboard Enter opens inventory', page.locator('#inventory-heading').count() == 1)
        tree = accessible()
        check('Weapon category named', any(x['role'] == 'button' and x['name'] == 'Armas' for x in tree))
        check('Active item ID0 named', any(x['role'] == 'button' and 'ID 0' in (x['name'] or '') for x in tree))
        check('Two reserves named separately',
              any(x['role'] == 'button' and 'Reserva 1' in (x['name'] or '') for x in tree) and
              any(x['role'] == 'button' and 'Reserva 2' in (x['name'] or '') for x in tree))
        page.locator('button[data-slot="2"]').focus()
        page.keyboard.press('Enter')
        page.wait_for_function("document.activeElement?.id==='item-weapon-2' && window.__ui.reader.getState().selected?.slot===2", timeout=3000)
        page.locator('button[data-action="inspect"]').focus()
        page.keyboard.press('Enter')
        page.wait_for_function("document.getElementById('detail-heading')!==null", timeout=3000)
        page.wait_for_function("document.activeElement?.id==='detail-heading'", timeout=3000)
        check('Keyboard selection opens correct inspection', page.locator('#detail-heading').count() == 1)
        page.locator('button[data-action="back"]').focus()
        page.keyboard.press('Enter')
        page.wait_for_function("document.activeElement?.id==='item-weapon-2'", timeout=3000)
        check('Keyboard Back restores original slot focus', page.evaluate("document.activeElement?.id==='item-weapon-2'"))
    finally:
        page.close()
        browser.close()

print('CP047 keyboard/accessibility-tree smoke:', sum(ok for _, ok in checks), '/', len(checks))
if not all(ok for _, ok in checks):
    raise SystemExit(1)
