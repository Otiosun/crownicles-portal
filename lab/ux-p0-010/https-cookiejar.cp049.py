"""CP049: real TLS and stdlib CookieJar exercise of CP014/CP046 test endpoints.

Not a browser: Python's CookieJar does not enforce JS HttpOnly visibility or SameSite.
The test INSPECTS those attributes while validating Secure+host-only transport.
Generates one-day self-signed cert in an auto-deleted temporary directory.
NO keys, tokens, cookies or account identifiers are saved to results/logs.
"""
from __future__ import annotations
from http.cookiejar import CookieJar
from urllib.request import build_opener, HTTPCookieProcessor, HTTPSHandler, Request
from urllib.error import HTTPError
from pathlib import Path
from tempfile import TemporaryDirectory
from subprocess import run, Popen, PIPE
import json, ssl, unittest, os

HERE=Path(__file__).resolve().parent
class CP049CookieJarTLS(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=TemporaryDirectory(prefix='cp049-cookiejar-'); root=Path(cls.temp.name)
  cls.cert=root/'server.crt'; key=root/'server.key'
  p=run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(cls.cert),'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],capture_output=True,text=True)
  if p.returncode:raise RuntimeError('OpenSSL fixture generation failed')
  cls.proc=Popen(['node',str(HERE/'https-cookie-fixture.cp049.mjs'),str(key),str(cls.cert)],stdin=PIPE,stdout=PIPE,stderr=PIPE,text=True,bufsize=1)
  first=cls.proc.stdout.readline()
  if not first:raise RuntimeError('TLS fixture failed before listen')
  info=json.loads(first)
  assert info['ready'] is True
  cls.origin=f"https://127.0.0.1:{info['port']}"
  cls.context=ssl.create_default_context(cafile=str(cls.cert))
  cls.context.check_hostname=True
 @classmethod
 def tearDownClass(cls):
  try:
   if cls.proc.poll() is None:
    cls.proc.stdin.write('{"command":"exit"}\n');cls.proc.stdin.flush()
    cls.proc.communicate(timeout=4)
  finally:cls.temp.cleanup()
 def client(self,user='a'):
  jar=CookieJar()
  opener=build_opener(HTTPCookieProcessor(jar),HTTPSHandler(context=self.context))
  def req(path,method='GET',origin=None):
   headers={'Accept':'application/json','X-Fixture-User':user}
   if method=='POST':headers['Origin']=self.origin if origin is None else origin
   r=Request(self.origin+path,method=method,headers=headers)
   try:
    with opener.open(r,timeout=3) as res:return res.status,json.loads(res.read().decode())
   except HTTPError as e:return e.code,json.loads(e.read().decode())
  return jar,req
 def control(self,command,user,code=None):
  msg={'command':command,'user':user}
  if code is not None:msg['code']=code
  self.proc.stdin.write(json.dumps(msg)+'\n');self.proc.stdin.flush()
  output=self.proc.stdout.readline();self.assertTrue(output,'Fixture process exited unexpectedly')
  self.assertEqual(json.loads(output),{'ok':True})
 def test_01_real_secure_cookie_persists_only_after_private_approval(self):
  jar,req=self.client()
  self.assertEqual(req('/v1/me/profile')[0],401)
  status,data=req('/v1/link/start','POST');self.assertEqual(status,201)
  self.assertEqual(req('/v1/me/profile')[0],401)
  cookies=list(jar);self.assertEqual(len(cookies),1)
  self.assertEqual(cookies[0].name,'__Host-crownicles_link')
  self.assertTrue(cookies[0].secure)
  self.assertFalse(cookies[0].domain_specified)
  self.assertTrue(cookies[0].has_nonstandard_attr('HttpOnly'))
  self.assertEqual(cookies[0].get_nonstandard_attr('SameSite'),'Strict')
  self.control('approve','a',data['code'])
  self.assertEqual(req('/v1/link/status')[1]['status'],'approved')
  status,data=req('/v1/link/redeem','POST');self.assertEqual(status,200)
  self.assertEqual(data['status'],'redeemed')
  self.assertEqual([x.name for x in jar],['__Host-crownicles_session'])
  self.assertTrue(list(jar)[0].secure)
  status,data=req('/v1/me/profile');self.assertEqual(status,200)
  self.assertEqual(data['data']['money'],111)
  self.assertNotIn('actorId',json.dumps(data))
  status,data=req('/v1/me/inventory');self.assertEqual(status,200)
  self.assertEqual(data['data']['categories'][0]['active']['id'],0)
  self.assertEqual(req('/v1/session/logout','POST')[1],{'status':'signed_out'})
  self.assertEqual(req('/v1/me/profile')[0],401)
 def test_02_two_real_cookie_jars_do_not_cross_players_and_rebind_revokes(self):
  a,aa=self.client('a');b,bb=self.client('b')
  ca=aa('/v1/link/start','POST')[1]['code']
  cb=bb('/v1/link/start','POST')[1]['code']
  self.control('approve','a',ca);self.control('approve','b',cb)
  self.assertEqual(aa('/v1/link/redeem','POST')[0],200)
  self.assertEqual(bb('/v1/link/redeem','POST')[0],200)
  self.assertNotEqual(list(a)[0].value,list(b)[0].value)
  self.assertEqual(aa('/v1/me/profile')[1]['data']['level'],12)
  self.assertEqual(bb('/v1/me/profile')[1]['data']['level'],77)
  self.control('unbind','a')
  self.assertEqual(aa('/v1/me/profile')[0],401)
  self.assertEqual(bb('/v1/me/profile')[1]['data']['level'],77)
 def test_04_secure_cookie_not_sent_over_plain_http_or_different_host(self):
  # CookieJar enforces Secure and host-only scope; it does NOT model SameSite.
  jar,req=self.client('b')
  challenge=req('/v1/link/start','POST')[1]['code']
  self.control('approve','b',challenge)
  self.assertEqual(req('/v1/link/redeem','POST')[0],200)
  self.assertEqual(len(jar),1)
  plain=Request('http://127.0.0.1:49221/no-network-needed')
  jar.add_cookie_header(plain)
  self.assertIsNone(plain.get_header('Cookie'))
  other=Request('https://localhost:49221/no-network-needed')
  jar.add_cookie_header(other)
  self.assertIsNone(other.get_header('Cookie'))
  secure=Request('https://127.0.0.1:49221/no-network-needed')
  jar.add_cookie_header(secure)
  self.assertIn('__Host-crownicles_session=',secure.get_header('Cookie',''))
 def test_03_cross_origin_post_rejected_before_cookie_issue(self):
  jar,req=self.client()
  status,_=req('/v1/link/start','POST','https://evil.example')
  self.assertEqual(status,403)
  self.assertEqual(len(jar),0)
  self.assertEqual(req('/v1/me/profile')[0],401)

if __name__=='__main__':unittest.main(verbosity=2)
