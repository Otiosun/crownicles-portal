/**
 * CP049: TLS-only, loopback-only, temporary laboratory composition for CP014 + CP046.
 * Uses the original CP014 SQLite ledger/route handler, not a new login protocol.
 * It deliberately supplies NO production configuration, OIDC, MariaDB, WA adapter
 * or public reverse proxy; it cannot become the production HTTPS server.
 */
import https from 'node:https';
import {createSessionHandler} from '../cp014/session-gateway.mjs';
import {createP0NativeHttpHandler,createCP014Resolver} from '../../integration/p0/secure-native-read.cp046.mjs';

const LOOPBACK_HOST='127.0.0.1';
const HOST_TOKEN=/^127\.0\.0\.1:\d{1,5}$/;
const BODY=JSON.stringify({error:'invalid_host'});
const HEADERS=Object.freeze({'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
function goodTLS(tls){
 return !!tls&&typeof tls==='object'&&!Array.isArray(tls)&&
  ['key','cert'].every(k=>(typeof tls[k]==='string'&&tls[k].length>0)||
     (Buffer.isBuffer(tls[k])&&tls[k].length>0));
}
/** Only fixture authority and disposable identities may be passed. */
export function createCP049HttpsLab({tls,ledger,authority,rateScopeFor,readNativeOwn,clock=Date.now}={}){
 if(!goodTLS(tls))throw TypeError('CP049_TLS_PRIVATE_KEY_AND_CERT_REQUIRED');
 if(typeof ledger?.inspectSession!=='function'||typeof ledger?.issueChallenge!=='function'||
    typeof authority?.readBinding!=='function'||typeof rateScopeFor!=='function'||
    typeof readNativeOwn!=='function')throw TypeError('CP049_LAB_ADAPTERS_REQUIRED');
 let expectedHost=null,sessionHandler=null;
 const readHandler=createP0NativeHttpHandler({resolveFreshSession:createCP014Resolver({ledger,authority}),readNativeOwn,clock});
 const server=https.createServer({key:tls.key,cert:tls.cert,minVersion:'TLSv1.2'},(req,res)=>{
  // Both the route and cookies must be bound to exactly one origin. Host
  // confusion cannot redirect same-origin challenge/cookie work.
  if(!req.socket.encrypted||!expectedHost||!HOST_TOKEN.test(req.headers.host??'')||req.headers.host!==expectedHost){
   res.writeHead(421,HEADERS);res.end(BODY);return;
  }
  if(req.url==='/v1/me/profile'||req.url==='/v1/me/inventory'){
   void readHandler(req,res);return;
  }
  void sessionHandler(req,res);
 });
 const originalListen=server.listen.bind(server);
 server.listen=(...args)=>{
  if(expectedHost!==null||server.listening)throw Error('CP049_LISTEN_ALREADY_BOUND');
  let port,host;
  if(args[0]&&typeof args[0]==='object'&&!Array.isArray(args[0])){
   if(Object.hasOwn(args[0],'path')||Object.hasOwn(args[0],'fd'))throw Error('CP049_LOOPBACK_ONLY');
   port=args[0].port;host=args[0].host;
  }else{port=args[0];host=args[1];}
  if(host!==LOOPBACK_HOST||!Number.isSafeInteger(port)||port<0||port>65535){
   throw Error('CP049_LOOPBACK_ONLY');
  }
  const result=originalListen(...args);
  server.once('listening',()=>{
   const bound=server.address();
   expectedHost=`${LOOPBACK_HOST}:${bound.port}`;
   sessionHandler=createSessionHandler({ledger,authority,repo:{},rateScopeFor,
     origin:`https://${expectedHost}`,clock});
  });
  return result;
 };
 return server;
}
