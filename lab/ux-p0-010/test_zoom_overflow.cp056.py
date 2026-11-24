"""CP056: 100%/200% text reflow across the *real* P0 controller ESM.

Chromium exercises CP046/CP052/CP054/CP055 source modules with the existing
synthetic, owner-scoped test transport. No browser TLS, player or production data.
This test is intentionally independent of package.json integration.
Run: python lab/ux-p0-010/test_zoom_overflow.cp056.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_preview import setup, click, ready, no_overflow

checks = []

def ck(label, condition):
    ok = bool(condition)
    checks.append((label, ok))
    if not ok:
        print('FAIL', label, flush=True)

def reflows(page, label):
    # Includes descendants: an overflowing child can break focus, even if a
    # parent/viewport hides its own scrollbars.
    ck(label + ' no horizontal or nested overflow', no_overflow(page))

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,
        headless=True, args=['--no-sandbox'])
    try:
        for width in (320, 390, 430, 768, 1440):
            for scale in (100, 200):
                page = setup(browser, 'normal', width)
                prefix = f'{width}px/{scale}%'
                page.evaluate('(scale) => document.documentElement.style.fontSize = scale + "%"', scale)
                reflows(page, prefix + '/unverified')
                click(page, 'verify')
                ready(page, 'profile')
                reflows(page, prefix + '/profile')
                click(page, 'inventory')
                ready(page, 'inventory')
                reflows(page, prefix + '/inventory')
                page.locator('button[data-action="select"]').first.click()
                reflows(page, prefix + '/selected')
                click(page, 'inspect')
                ck(prefix + '/detail is present', page.locator('#detail-heading').count() == 1)
                reflows(page, prefix + '/detail')
                click(page, 'back')
                reflows(page, prefix + '/back')
                for category in ('armor', 'potion', 'object', 'weapon'):
                    page.locator(f'#category-{category}').click()
                    reflows(page, prefix + '/' + category)
                click(page, 'forget')
                page.wait_for_function('!window.__ui.reader.getState().authorized', timeout=3000)
                reflows(page, prefix + '/logout')
                ck(prefix + '/logout has no item detail', page.locator('.facts').count() == 0)
                page.close()
    finally:
        browser.close()

passed = sum(ok for _, ok in checks)
print(f'CP056 ZOOM BROWSER: {passed} / {len(checks)}')
raise SystemExit(0 if passed == len(checks) else 1)
