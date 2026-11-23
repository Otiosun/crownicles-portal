"""Disposable TLS/cURL cookie-jar integration of original CP014 + CP046. No browser or trusted CA."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess,json,os,sys
ROOT=Path(__file__).resolve().parents[2]
checks=[]
def check(name,p):
 checks.append((name,bool(p)))
 if not p: print('FAIL',name)
with TemporaryDirectory(prefix='cp048-tls-') as d:
 d=Path(d);key=d/'key.pem';crt=d/'cert.pem';jar=d/'cookies.txt';jar.touch(mode=0o600)
 subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1','-keyout',str(key),'-out',str(crt),'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 env={**os.environ,'CP048_KEY':str(key),'CP048_CERT':str(crt)}
 node=subprocess.Popen(['node',str(ROOT/'lab/ux-p0-010/https-cookie-probe.cp048.mjs')],cwd=ROOT,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  info=json.loads(node.stdout.readline());port=info['port'];base=f'https://127.0.0.1:{port}'
  def call(path,method='GET',origin=False):
   argv=['curl','--noproxy','*','-ksS','--max-time','4','-b',str(jar),'-c',str(jar),'-X',method,'-H','Accept: application/json']
   if origin:argv+=['-H',f'Origin: {base}']
   argv+=['-w','\nSTATUS=%{http_code}',base+path]
   out=subprocess.check_output(argv,text=True);body,code=out.rsplit('\nSTATUS=',1)
   return int(code),json.loads(body)
  status,data=call('/v1/link/start','POST',origin=False)
  check('CSRF: start without matching Origin rejected',status==403)
  status,data=call('/v1/link/start','POST',origin=True)
  check('HTTPS start issued exactly one temporary code',status==201 and data.get('status')=='issued' and len(data.get('code',''))==14)
  code=data['code'];txt=jar.read_text()
  check('Real curl cookie jar has HttpOnly link cookie', '#HttpOnly_127.0.0.1' in txt and '__Host-crownicles_link' in txt)
  check('Link cookie is marked Secure on HTTPS',any('TRUE' in line.split('\t')[3:4] for line in txt.splitlines() if '__Host-crownicles_link' in line))
  status,data=call('/v1/link/status')
  check('Before private approval remains pending',status==200 and data.get('status')=='pending')
  check('Cannot read profile before private approval',call('/v1/me/profile')[0]==401)
  node.stdin.write('APPROVE '+code+'\n');node.stdin.flush()
  ack=json.loads(node.stdout.readline())
  check('Trusted synthetic private adapter approved',ack.get('approved') is True)
  status,data=call('/v1/link/status')
  check('Private approval acknowledged by session handler',status==200 and data.get('status')=='approved')
  status,data=call('/v1/link/redeem','POST',origin=True)
  check('Redeem issues a session',status==200 and data.get('status')=='redeemed')
  txt=jar.read_text()
  check('Session cookie really stored Secure/HttpOnly by curl', '__Host-crownicles_session' in txt and '#HttpOnly_127.0.0.1' in txt and any(line.split('\t')[3]=='TRUE' for line in txt.splitlines() if '__Host-crownicles_session' in line))
  status,data=call('/v1/me/profile')
  check('Actual TLS request carries session cookie and returns own profile',status==200 and data.get('data',{}).get('level')==12)
  status,data=call('/v1/link/redeem','POST',origin=True)
  check('Consumed challenge cannot be replayed',status==401)
  status,data=call('/v1/session/logout','POST',origin=True)
  check('Server confirms logout over TLS',status==200 and data.get('status')=='signed_out')
  check('Logout invalidates TLS session cookie',call('/v1/me/profile')[0]==401)
 finally:
  if node.poll() is None:
   node.stdin.write('SHUTDOWN\n');node.stdin.flush()
   try:node.wait(timeout=5)
   except subprocess.TimeoutExpired:node.kill();node.wait()
print('CP048 HTTPS + real curl cookie jar',sum(v for _,v in checks),'/',len(checks))
if not all(v for _,v in checks):sys.exit(1)
