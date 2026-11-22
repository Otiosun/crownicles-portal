import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {inspectPinnedBlobs} from '../upstream-blob-audit.mjs';
import {UPSTREAM_COMMIT} from '../native-import-audit.mjs';

const FILE='Core/src/core/database/game/models/Player.ts';
function exec(root, args) {
 const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:3000,maxBuffer:32768});
 assert.equal(r.status,0,`Git failed: ${args[0]} ${r.stderr?.slice(0,60)}`);
 return r.stdout.trim();
}
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'crownicles-w06-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 exec(root,['init','-q']);
 exec(root,['config','user.name','QA Test']);
 exec(root,['config','user.email','qa@example.invalid']);
 const target=path.join(root,FILE);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,'export class Player {}\n');
 exec(root,['add','.']); exec(root,['commit','-qm','fixture']);
 const initial=exec(root,['rev-parse','HEAD']);
 const sha=exec(root,['rev-parse',`${initial}:${FILE}`]);
 return {root,initial,sha,target};
}
function inspect(f, hash=f.sha, commit=f.initial) {
 const manifest={commit:UPSTREAM_COMMIT,modules:{[FILE]:{sha:hash,exports:['Player']}}};
 // Translate only the immutable pin argument to this temporary fixture's
 // real Git object. The production implementation always uses UPSTREAM_COMMIT.
 const git=(cwd,args)=>exec(cwd,args.map(a=>a===UPSTREAM_COMMIT?commit:a));
 return inspectPinnedBlobs(manifest,f.root,{git});
}
test('real Git tree plumbing validates a pinned regular file',t=>{
 const f=fixture(t),r=inspect(f);
 assert.deepEqual(r,{ok:true,checked:1,errors:[]});
});
test('dirty working tree and advancing HEAD do not alter pinned object result',t=>{
 const f=fixture(t);
 fs.writeFileSync(f.target,'export class Changed {}\n');
 assert.equal(inspect(f).ok,true);
 exec(f.root,['add','.']); exec(f.root,['commit','-qm','new-head']);
 assert.equal(inspect(f).ok,true);
 const newer=exec(f.root,['rev-parse','HEAD']);
 assert.match(inspect(f,f.sha,newer).errors.join(','),/PIN_BLOB_MISMATCH/);
});
test('a real Git symlink cannot substitute a regular source file',t=>{
 if(process.platform==='win32') return t.skip('symlink Git mode test requires Unix');
 const f=fixture(t);
 fs.rmSync(f.target);
 fs.symlinkSync('destination.ts',f.target);
 exec(f.root,['add','.']);exec(f.root,['commit','-qm','replace-with-symlink']);
 const newer=exec(f.root,['rev-parse','HEAD']);
 const r=inspect(f,f.sha,newer);
 assert.match(r.errors.join(','),/PIN_NOT_REGULAR_FILE/);
});
