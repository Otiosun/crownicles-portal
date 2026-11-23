from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json,sys
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'p0-shell.html').read_text(encoding='utf8')
MJS=(ROOT/'src'/'p0-visual.mjs').read_text(encoding='utf8')
HTML=re.sub(r'<script type="module">.*?</script>', '', HTML, flags=re.S)
assert 'controller.mjs' not in HTML
count=0;fail=[]
def check(cond,desc):
 global count
 count+=1
 if not cond:fail.append(desc)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h in [(320,700),(390,844),(430,930),(760,900),(1440,900)]:
  page=b.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
  errors=[];requests=[];page.on('pageerror',lambda x:errors.append(str(x)));page.on('request',lambda r:requests.append(r.url))
  page.set_content(HTML)
  page.add_script_tag(type='module',content=MJS+'\nwindow.__artMount=mountR5Visual(document);')
  page.wait_for_function('!!window.__artMount')
  check(page.locator('#visual-number').inner_text()=='◇',f'{w} neutral unauth')
  check(page.locator('#visual-stage').get_attribute('aria-hidden')=='true',f'{w} decoration not announced')
  check(page.locator('#visual-stage').get_attribute('data-mode')=='closed',f'{w} start closed')
  page.locator('#content').evaluate("(el)=>el.innerHTML='<h1 id=\"profile-heading\">Seu personagem</h1><div class=\"metric\">Nível 18</div>'")
  page.wait_for_function("document.querySelector('#visual-stage').dataset.mode==='profile'")
  check(page.locator('#visual-label').inner_text()=='Personagem',f'{w} profile')
  check(page.locator('#visual-number').inner_text()=='◇',f'{w} profile no private ID')
  page.locator('#content').evaluate("(el)=>el.innerHTML='<h1 id=\"inventory-heading\">Pertences</h1><div class=\"tabs\"><button data-action=\"category\" aria-pressed=\"true\">Armas</button></div><button class=\"item selected\" data-action=\"select\" data-slot=\"3\" aria-pressed=\"true\">ID 10</button>'")
  page.wait_for_function("document.querySelector('#visual-stage').dataset.mode==='inventory'")
  check(page.locator('#visual-number').inner_text()=='3',f'{w} slot projected from displayed DOM')
  check(page.locator('#visual-context').text_content()=='Posição selecionada',f'{w} context')
  page.locator('#content').evaluate("(el)=>el.innerHTML='<h1 id=\"detail-heading\">Inspecionar item</h1><dl><dt>ID do catálogo</dt><dd>10</dd></dl>'")
  page.wait_for_function("document.querySelector('#visual-stage').dataset.mode==='detail'")
  check(page.locator('#visual-number').inner_text()=='3',f'{w} remembered selection on detail')
  page.locator('#content').evaluate("(el)=>el.innerHTML='<h1 id=\"login-heading\">Seu personagem</h1><section id=\"link-heading\">Vincular</section>'")
  page.wait_for_function("document.querySelector('#visual-stage').dataset.mode==='closed'")
  check(page.locator('#visual-number').inner_text()=='◇',f'{w} logout clears previous slot')
  check(page.locator('#visual-label').inner_text()=='Sessão não confirmada',f'{w} fail closed')
  # Invalid payload from other renderer cannot inject an ID.
  page.locator('#content').evaluate("(el)=>el.innerHTML='<h1 id=\"inventory-heading\">Pertences</h1><button class=\"item selected\" data-action=\"select\" data-slot=\"9999999\">Item</button>'")
  page.wait_for_function("document.querySelector('#visual-stage').dataset.mode==='inventory'")
  check(page.locator('#visual-number').inner_text()=='—',f'{w} bad position rejected')
  page.locator('#content').evaluate("(el)=>el.innerHTML='<h1 id=\"detail-heading\">Inspecionar item</h1>'")
  page.wait_for_function("document.querySelector('#visual-stage').dataset.mode==='detail'")
  check(page.locator('#visual-number').inner_text()=='◇',f'{w} direct detail no made-up number')
  check(page.locator('#content').get_attribute('tabindex')=='-1',f'{w} P0 content semantics')
  check(page.locator('#navigation').count()==1 and page.locator('#status').count()==1,f'{w} P0 DOM contract')
  check(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'{w} horizontal overflow')
  page.evaluate("document.documentElement.style.fontSize='32px'")
  check(not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'{w} 200pct horizontal overflow')
  check(not errors,f'{w} errors {errors}')
  check(not requests,f'{w} network {requests}')
  page.evaluate('window.__artMount.destroy()')
  check(page.locator('#visual-number').inner_text()=='◇',f'{w} destroy cleanup')
  if w in [390,1440]:
   page.evaluate("document.documentElement.style.fontSize='16px'")
   page.locator('#content').evaluate("(el)=>el.innerHTML='<h1 id=\"inventory-heading\">Pertences</h1><div class=\"tabs\"><button data-action=\"category\" aria-pressed=\"true\">Armas</button></div><button class=\"item selected\" data-action=\"select\" data-slot=\"3\">ID 10</button>'")
   page.screenshot(path=str(ROOT/'qa'/f'R5-P0-shell-{w}.png'),full_page=True)
  page.close()
 b.close()
report={'passed':count-len(fail),'total':count,'failures':fail}
(ROOT/'qa'/'report_p0.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
sys.exit(bool(fail))
