/**
 * CP027 pre-gate: verify that the pinned upstream-contract manifest references
 * the exact regular-file blobs in the immutable Crownicles Core Git commit.
 * READ ONLY: never runs git checkout, fetch, clean, hooks, or database commands.
 * This is neither a Core typecheck nor a MariaDB integration test.
 */
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {UPSTREAM_COMMIT, inspectPinnedImports, loadLocal} from './native-import-audit.mjs';

const SHA = /^[0-9a-f]{40}$/;
const SAFE_PATH = /^(?:Core|Lib)\/src\/[a-zA-Z0-9_./-]+\.ts$/;

function readOnlyGit(source, args) {
  const r=spawnSync('git',['-C',source,...args],{
    encoding:'utf8',timeout:5000,maxBuffer:32768,
    env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},
  });
  return r.error||r.status!==0?null:r.stdout.trim();
}

/** A bounded, local, metadata-only check. `probe.git` is for deterministic tests. */
export function inspectPinnedBlobs(manifest, source, probe={}) {
  const errors=[];
  const fail=(code)=>errors.push(code);
  const entries=manifest?.modules && typeof manifest.modules==='object' && !Array.isArray(manifest.modules)
    ? Object.entries(manifest.modules) : [];
  if(manifest?.commit!==UPSTREAM_COMMIT || entries.length===0) fail('MANIFEST_INVALID');
  if(typeof source!=='string'||!source.trim()) fail('SOURCE_MISSING');
  if(errors.length) return {ok:false,checked:0,errors};
  const cwd=path.resolve(source);
  const git=probe.git??readOnlyGit;
  const root=git(cwd,['rev-parse','--show-toplevel']);
  if(root===null || path.resolve(root)!==cwd) {
    fail('SOURCE_GIT_ROOT_INVALID');
    return {ok:false,checked:0,errors};
  }
  if(git(cwd,['cat-file','-t',UPSTREAM_COMMIT])!=='commit') {
    fail('PIN_COMMIT_MISSING');
    return {ok:false,checked:0,errors};
  }
  let checked=0;
  for(const [file,metadata] of entries) {
    // Do not permit a manifest entry to introduce pathspec syntax, traversal,
    // non-native files, or malformed object IDs into a Git command.
    if(!SAFE_PATH.test(file)||file.split('/').some(part=>part==='.'||part==='..')||file.includes('//')) {
      fail('PIN_PATH_INVALID'); continue;
    }
    if(!SHA.test(metadata?.sha||'')) {fail('PIN_SHA_INVALID:'+file);continue;}
    const line=git(cwd,['ls-tree',UPSTREAM_COMMIT,'--',file]);
    if(line===null) {fail('PIN_GIT_READ_FAILED:'+file);continue;}
    const match=/^(100644|100755|120000|160000) (blob|commit) ([0-9a-f]{40})\t(.+)$/.exec(line);
    if(!match||match[4]!==file) {fail('PIN_FILE_MISSING:'+file);continue;}
    if(!['100644','100755'].includes(match[1])||match[2]!=='blob') {
      fail('PIN_NOT_REGULAR_FILE:'+file);continue;
    }
    if(match[3]!==metadata.sha) {fail('PIN_BLOB_MISMATCH:'+file);continue;}
    checked++;
  }
  return {ok:errors.length===0,checked,errors};
}

export function parseArgs(argv) {
  if(argv.length!==2||argv[0]!=='--source'||!argv[1]||argv[1].startsWith('--')) throw Error('USAGE');
  return {source:argv[1]};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain) {
  try {
    const {source}=parseArgs(process.argv.slice(2));
    const {sources,manifest}=loadLocal(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
    const imports=inspectPinnedImports(sources,manifest);
    const blobs=inspectPinnedBlobs(manifest,source);
    process.stdout.write(`IMPORT_AUDIT=${imports.ok?'PASS':'FAIL'}\n`);
    process.stdout.write(`PINNED_BLOBS=${blobs.checked}/${Object.keys(manifest.modules).length}\n`);
    process.stdout.write(`UPSTREAM_BLOB_AUDIT=${imports.ok&&blobs.ok?'PASS':'FAIL'}\n`);
    if(!imports.ok||!blobs.ok) {
      for(const code of [...imports.errors,...blobs.errors]) process.stderr.write(code+'\n');
      process.exitCode=2;
    }
  } catch {
    process.stderr.write('Uso: npm run audit:upstream -- --source /checkout/Crownicles\n');
    process.exitCode=2;
  }
}
