import test from 'node:test';
import assert from 'node:assert/strict';
import {preflight,parseArgs} from '../gate-preflight.mjs';
const root='/fixtures/crownicles',gate='/fixtures/CP027';
const fake={uid:1000,platform:'linux',version:'24.2.1',pythonVersion:()=> '3.12',hasExecutable:()=>true,exists:()=>true,git:(cwd,args)=>args[0]==='rev-parse'?cwd:''};
const run=(options={source:root,gate},patch={})=>preflight(options,{...fake,...patch});
test('ready only for clean pinned unprivileged host with all dependencies',()=>{const r=run();assert.equal(r.ready,true);assert.ok(r.tests.every(x=>x.ok));});
test('Node 22 rejected',()=>{const r=run(undefined,{version:'22.16.0'});assert.equal(r.ready,false);assert.equal(r.tests.find(x=>x.name==='NODE_24').ok,false);});
test('root and Windows rejected',()=>{assert.equal(run(undefined,{uid:0}).ready,false);assert.equal(run(undefined,{platform:'win32'}).ready,false);});
test('missing server/client binary rejected independently',()=>{for(const command of ['mariadb','mariadbd','mariadb-install-db']){const r=run(undefined,{hasExecutable:x=>x!==command});assert.equal(r.ready,false);assert.equal(r.tests.find(x=>x.name==='BIN_'+command.toUpperCase().replaceAll('-','_')).ok,false);}});
test('reject missing pinned commit and non-root checkout',()=>{assert.equal(run(undefined,{git:(p,a)=>a[0]==='rev-parse'?p:null}).ready,false);assert.equal(run(undefined,{git:()=> 'otherdir'}).ready,false);});
test('reject missing source or runner artifacts without accessing files',()=>{assert.equal(run({gate}).ready,false);assert.equal(run({source:root}).ready,false);assert.equal(run(undefined,{exists:()=>false}).ready,false);});
test('strict command argument parser',()=>{assert.deepEqual(parseArgs(['--source',root,'--gate',gate]),{source:root,gate});for(const a of [['--key','x'],['--source'],['--source','--gate','x'],['--source','a','--source','b']])assert.throws(()=>parseArgs(a),/USAGE/);});
test('never emits actor, cookie, db password or raw absolute path in results',()=>{const o=run(),text=JSON.stringify(o);assert.ok(!text.includes(root));assert.ok(!text.includes(gate));assert.ok(!/cookie|password|token|secret/i.test(text));});

test('Python 3.8 rejected even if binary present',()=>{const r=run(undefined,{pythonVersion:()=> '3.8'});assert.equal(r.ready,false);assert.equal(r.tests.find(x=>x.name==='PYTHON_3_9').ok,false);});
test('source inspection invokes only read-only git operations',()=>{const actions=[];run(undefined,{git:(cwd,args)=>{actions.push(args.join(' '));return args[0]==='rev-parse'?cwd:'';}});assert.deepEqual(actions,['rev-parse --show-toplevel','cat-file -e 64d08c05f11949029317341735f6f73024f19f9b^{commit}']);});

test('reject dependency roots as external symlinks',()=>{const r=run(undefined,{isSymlink:p=>p.endsWith('Core/node_modules')});assert.equal(r.ready,false);assert.equal(r.tests.find(x=>x.name==='DEPENDENCY_ROOTS_NOT_SYMLINKS').ok,false);});
test('HEAD may advance while pinned source object remains available',()=>{const r=run(undefined,{git:(cwd,args)=>args[0]==='rev-parse'?cwd:''});assert.equal(r.ready,true);});
