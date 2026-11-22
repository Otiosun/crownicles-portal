"""Crownicles UX-P0-005 — DOM smoke tests using same machine and preview code.

Requires Python Playwright and Chromium. Executes as a bundle in about:blank because
network/file navigation may be disabled in restricted lab environments. Does NOT
verify ESM loading through a static server.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
html=(root/'ux-p0-005'/'preview.html').read_text(encoding='utf-8')
machine=(root/'ux-p0-003'/'machine.mjs').read_text(encoding='utf-8').replace('export ','')
import_line="import {initialState,transition,itemAt,canInspect,P0_CATEGORIES} from '../ux-p0-003/machine.mjs';"
assert import_line in html
html=html.replace('<script type="module">','<script>').replace(import_line,machine)

with sync_playwright() as playwright:
    browser_args={'headless':True,'args':['--no-sandbox']}
    if os.getenv('CHROMIUM_PATH'):
        browser_args['executable_path']=os.environ['CHROMIUM_PATH']
    browser=playwright.chromium.launch(**browser_args)
    for width,height in [(320,800),(390,844),(768,1024),(1440,900)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(html)
        assert page.get_by_role('heading',name='Experiência de consulta').is_visible()
        page.get_by_role('button',name='Iniciar sessão fictícia').click()
        assert page.get_by_text('10 / 12').is_visible()
        page.get_by_role('button',name='Ver pertences').click()
        assert page.get_by_text('ID 0 · sem ilustração atribuída').is_visible()
        for slot in (1,2):
            page.locator(f'#item-weapon-{slot}').click()
            page.get_by_role('button',name='Inspecionar item').click()
            assert page.get_by_role('heading',name='Inspecionar item').is_visible()
            assert page.get_by_text('ID de catálogo').is_visible()
            page.get_by_role('button',name='Voltar ao mesmo item').click()
            assert page.locator(f'#item-weapon-{slot}').get_attribute('aria-pressed')=='true'
            page.wait_for_function(f"document.activeElement.id === 'item-weapon-{slot}'")
        page.locator('#scenarioTools summary').click()
        page.locator('#scenario').select_option('restricted')
        page.get_by_role('button',name='Aplicar estado').click()
        assert page.get_by_text('Esta informação não está disponível para consulta agora.').is_visible()
        assert page.get_by_text('ID 7 · sem ilustração atribuída').count()==0
        page.locator('#scenario').select_option('ready')
        page.get_by_role('button',name='Aplicar estado').click()
        page.locator('#item-weapon-1').click()
        page.get_by_role('button',name='Inspecionar item').click()
        page.locator('#scenario').select_option('unauthorized')
        page.get_by_role('button',name='Aplicar estado').click()
        assert page.get_by_role('button',name='Iniciar sessão fictícia').is_visible()
        assert page.get_by_text('ID de catálogo').count()==0
        assert page.get_by_text('10 / 12').count()==0
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
        assert not errors,errors
        print(f'{width}x{height}: PASS')
        page.close()
    browser.close()
