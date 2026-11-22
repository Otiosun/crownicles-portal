import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPinnedBlobs,parseArgs} from '../upstream-blob-audit.mjs';
import {UPSTREAM_COMMIT} from '../native-import-audit.mjs';

const dir='/laboratorio/Crownicles';
const a='Core/src/core/database/game/models/Player.ts';
const b='Lib/src/constants/PetConstants.ts';
const shaA='a'.repeat(40),shaB='b'.repeat(40);
const manifest=()=>({commit:UPSTREAM_COMMIT,modules:{[a]:{sha:shaA,exports:['Player']},[b]:{sha:shaB,exports:['PetConstants']}}});
const fake=(overrides={})=>({git:(cwd,args)=>{
  const op=args[0];
  if(op==='rev-parse') return overrides.root??cwd;
  if(op==='cat-file') return Object.hasOwn(overrides,'commitType')?overrides.commitType:'commit';
  if(op==='ls-tree') {
    const p=args[3];
    if(overrides.entries && p in overrides.entries) return overrides.entries[p];
    const sha=p===a?shaA:shaB;
    return `100644 blob ${sha}\t${p}`;
  }
  throw Error('Unexpected Git operation: '+op);
}});
const check=(m=manifest(),opts={})=>inspectPinnedBlobs(m,dir,fake(opts));

test('accept exact pinned regular-file blobs from the immutable commit',()=>{
 const r=check();assert.deepEqual(r,{ok:true,checked:2,errors:[]});
});
test('read-only Git verbs and same checkout root only',()=>{
 const calls=[];const r=inspectPinnedBlobs(manifest(),dir,{git:(cwd,args)=>{
  calls.push(args);
  return fake().git(cwd,args);
 }});
 assert.equal(r.ok,true);
 assert.deepEqual(calls.map(x=>x[0]),['rev-parse','cat-file','ls-tree','ls-tree']);
 assert.deepEqual(calls.slice(2).map(x=>x[2]),['--','--']);
});
test('reject wrong Git checkout root and missing or non-commit pin',()=>{
 assert.match(check(manifest(),{root:'/other'}).errors.join(','),/SOURCE_GIT_ROOT_INVALID/);
 assert.match(check(manifest(),{commitType:null}).errors.join(','),/PIN_COMMIT_MISSING/);
 assert.match(check(manifest(),{commitType:'tree'}).errors.join(','),/PIN_COMMIT_MISSING/);
});
test('reject modified hashes even when SHA format remains valid',()=>{
 const m=manifest();m.modules[a].sha='c'.repeat(40);
 assert.match(check(m).errors.join(','),/PIN_BLOB_MISMATCH/);
});
test('reject missing files and symlink/submodule substitutions',()=>{
 assert.match(check(manifest(),{entries:{[a]:''}}).errors.join(','),/PIN_FILE_MISSING/);
 assert.match(check(manifest(),{entries:{[a]:`120000 blob ${shaA}\t${a}`}}).errors.join(','),/PIN_NOT_REGULAR_FILE/);
 assert.match(check(manifest(),{entries:{[a]:`160000 commit ${shaA}\t${a}`}}).errors.join(','),/PIN_NOT_REGULAR_FILE/);
});
test('reject path traversal, pathspec-like entries and malformed blob IDs',()=>{
 for(const evil of ['Core/src/../../secrets.ts','Core/src/file[name].ts','Lib/src//file.ts']){
  const m=manifest();m.modules[evil]={sha:shaA};
  assert.match(check(m).errors.join(','),/PIN_PATH_INVALID/);
 }
 const m=manifest();m.modules[a].sha='nope';
 assert.match(check(m).errors.join(','),/PIN_SHA_INVALID/);
});
test('validate manifest and arguments, never echo raw local paths or secrets',()=>{
 assert.match(check({...manifest(),commit:'f'.repeat(40)}).errors.join(','),/MANIFEST_INVALID/);
 assert.match(inspectPinnedBlobs({commit:UPSTREAM_COMMIT,modules:{}},dir).errors.join(','),/MANIFEST_INVALID/);
 assert.match(inspectPinnedBlobs(manifest(),'').errors.join(','),/SOURCE_MISSING/);
 assert.deepEqual(parseArgs(['--source',dir]),{source:dir});
 for(const v of [[],['--source'],['--source','--bad'],['--bad',dir],['--source',dir,'extra']])assert.throws(()=>parseArgs(v),/USAGE/);
 const output=JSON.stringify(check(manifest(),{root:'/private/secret/location'}));
 assert.ok(!output.includes(dir)&&!output.includes('/private/secret/location'));
});
test('a valid tree cannot substitute another module path or object type',()=>{
 assert.match(check(manifest(),{entries:{[a]:`100644 blob ${shaA}\t${b}`}}).errors.join(','),/PIN_FILE_MISSING/);
 assert.match(check(manifest(),{entries:{[a]:`100644 tree ${shaA}\t${a}`}}).errors.join(','),/PIN_FILE_MISSING/);
});
