/**
 * READ ONLY CP027 host preflight. Does not install, start daemons or run
 * the native gate. No credentials, raw paths or subprocess stderr printed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {UPSTREAM_COMMIT} from './native-import-audit.mjs';
const commands=['bash','git','python3','timeout','mariadb','mariadbd','mariadb-install-db','openssl'];
const files=['run.sh','verify.py','prepare.py','cp015-original.zip','cp017-original.zip'];
const pythonVersion=()=>{
 const p=spawnSync('python3',['-c','import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")'],{timeout:5000,encoding:'utf8',maxBuffer:256});
 return p.error||p.status!==0?null:p.stdout.trim();
};
const executable=(command) => (process.env.PATH||'').split(path.delimiter).some(folder=>{
  if(!folder)return false;
  try {const p=path.join(folder,command);return fs.statSync(p).isFile() && (fs.accessSync(p,fs.constants.X_OK),true);}catch{return false;}
});
function readGit(source,words){
 const p=spawnSync('git',['-C',source,...words],{timeout:5000,encoding:'utf8',maxBuffer:8192});
 return p.error||p.status!==0?null:p.stdout.trim();
}

export function preflight({source,gate},probe={}) {
 const uid=probe.uid??(typeof process.getuid==='function'?process.getuid():null);
 const platform=probe.platform??os.platform();
 const version=probe.version??process.versions.node;
 const hasExecutable=probe.hasExecutable??executable;
 const exists=probe.exists??(p=>fs.existsSync(p));
 const git=probe.git??readGit;
 const isSymlink=probe.isSymlink??(p=>{try{return fs.lstatSync(p).isSymbolicLink();}catch{return false;}});
 const python=probe.pythonVersion??pythonVersion;
 const tests=[];
 const add=(name,pass)=>tests.push({name,ok:!!pass});
 add('NODE_24',Number(version.split('.')[0])>=24);
 add('NON_ROOT',uid!==null&&uid!==0);
 add('UNIX_SHELL',platform==='linux'||platform==='darwin');
 for(const cmd of commands)add('BIN_'+cmd.toUpperCase().replaceAll('-','_'),hasExecutable(cmd));
 const py=python();const [pyMajor,pyMinor]=(py||'').split('.').map(Number);
 add('PYTHON_3_9',Number.isInteger(pyMajor) && (pyMajor>3||(pyMajor===3&&pyMinor>=9)));
 add('SOURCE_SUPPLIED',typeof source==='string' && source.length>0);
 add('GATE_SUPPLIED',typeof gate==='string' && gate.length>0);
 if(source) {
  const p=path.resolve(source);
  add('SOURCE_LAYOUT',exists(path.join(p,'Core','package.json')) && exists(path.join(p,'Lib','package.json')));
  add('SOURCE_GIT_ROOT',git(p,['rev-parse','--show-toplevel'])===p);
  // CP015 fetches the pinned object from the local repository; HEAD need not equal the pin.
  add('SOURCE_PIN_OBJECT',git(p,['cat-file','-e',UPSTREAM_COMMIT+'^{commit}'])!==null);
  const coreDep=path.join(p,'Core','node_modules'),libDep=path.join(p,'Lib','node_modules');
  add('CORE_DEPENDENCIES',exists(coreDep));
  add('LIB_DEPENDENCIES',exists(libDep));
  add('DEPENDENCY_ROOTS_NOT_SYMLINKS',!isSymlink(coreDep)&&!isSymlink(libDep));
 }
 if(gate){const p=path.resolve(gate);add('GATE_FILES',files.every(f=>exists(path.join(p,f))));}
 return {ready:tests.every(x=>x.ok),tests};
}

export function parseArgs(argv){
 const args={};
 for(let i=0;i<argv.length;i++){
   const arg=argv[i],key=arg.startsWith('--')?arg.slice(2):'';
   if(!['source','gate'].includes(key)||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('USAGE');
   if(args[key])throw Error('USAGE');
   args[key]=argv[++i];
 }
 return args;
}
const isMain=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
 try{
  const report=preflight(parseArgs(process.argv.slice(2)));
  for(const t of report.tests)process.stdout.write(t.name+'='+(t.ok?'PASS':'BLOCKED')+'\n');
  process.stdout.write('CP027_PREFLIGHT='+(report.ready?'READY':'BLOCKED')+'\n');
  process.exitCode=report.ready?0:2;
 }catch{process.stderr.write('Uso: npm run gate:preflight -- --source /checkout/Crownicles --gate /pasta/CP027\n');process.exitCode=2;}
}
