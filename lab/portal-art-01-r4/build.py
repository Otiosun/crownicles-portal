from pathlib import Path
import base64
p=Path(__file__).parent
art=base64.b64encode((p/'assets/fio-estudo.webp').read_bytes()).decode()
html=(p/'source.html').read_text().replace('__ART_DATA__','data:image/webp;base64,'+art)
(p/'Crownicles-Fio-Estudo-Interativo.html').write_text(html,encoding='utf-8')
print('html_bytes', (p/'Crownicles-Fio-Estudo-Interativo.html').stat().st_size, 'image_bytes',(p/'assets/fio-estudo.webp').stat().st_size)
