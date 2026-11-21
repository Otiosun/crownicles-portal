/**
 * Offline, syntax-level import contract audit for the pinned Crownicles Core.
 * Manifest symbols and blob hashes were checked against immutable upstream
 * 64d08c05f11949029317341735f6f73024f19f9b. This is NOT a native typecheck.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const CANDIDATES = Object.freeze([
  'PortalCompanionsQuery.ts', 'PortalGardenQuery.ts',
  'PortalPropertyQuery.ts', 'PortalReadBundle.ts'
]);
export const UPSTREAM_COMMIT = '64d08c05f11949029317341735f6f73024f19f9b';
const ORIGIN = 'Core/src/commands/player';
const names = text => [...text.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)]
  .map(m => ({source: m[3], isType: !!m[1], symbols: m[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)}));
const defined = (source, symbol) => new RegExp(`\\bexport\\s+(?:(?:abstract|declare|default|async)\\s+)*(?:type|interface|class|const|enum|function)\\s+${symbol}\\b`).test(source);
const resolve = (origin, relative) => path.posix.normalize(path.posix.join(origin, relative) + '.ts');

export function inspectPinnedImports(sources, manifest) {
  const errors=[], seen=new Set();
  if(manifest?.commit!==UPSTREAM_COMMIT || !manifest?.modules || typeof manifest.modules!=='object') errors.push('MANIFEST_INVALID');
  const modules=manifest?.modules || {};
  let imports=0,upstreamImports=0;
  for(const file of CANDIDATES) {
    const source=sources[file];
    if(typeof source!=='string' || !source.length) { errors.push('SOURCE_MISSING:'+file);continue; }
    const parsed=names(source);
    // Refuse default imports, namespace imports and side effects, rather than silently
    // letting a changed candidate bypass the pinned manifest.
    const allFrom=[...source.matchAll(/\bimport\s+(?:[^;]*?)\s+from\s+["'][^"']+["']/g)];
    if(parsed.length!==allFrom.length || /\bimport\s*["']|\bimport\s*\(/.test(source))errors.push('UNSUPPORTED_IMPORT_SYNTAX:'+file);
    for(const imp of parsed) {
      if(imp.source==='sequelize') {
        if(!imp.isType || imp.symbols.length!==1 || imp.symbols[0]!=='Transaction')errors.push('SEQUELIZE_IMPORT_INVALID:'+file);
        continue;
      }
      imports++;
      if(!imp.source.startsWith('.')) {errors.push('EXTERNAL_NOT_ALLOWED:'+imp.source);continue;}
      const resolved=resolve(ORIGIN,imp.source);
      if(!resolved.startsWith('Core/src/') && !resolved.startsWith('Lib/src/')) {errors.push('PATH_ESCAPE:'+resolved);continue;}
      const local=resolved.startsWith(ORIGIN+'/') && CANDIDATES.includes(path.posix.basename(resolved));
      if(local) {
        const target=sources[path.posix.basename(resolved)];
        for(const symbol of imp.symbols) if(!defined(target||'',symbol)) errors.push('LOCAL_EXPORT_MISSING:'+resolved+':'+symbol);
      } else {
        upstreamImports++;
        const metadata=modules[resolved];
        if(!metadata) {errors.push('UNPINNED_IMPORT:'+resolved);continue;}
        seen.add(resolved);
        if(!/^[a-f0-9]{40}$/.test(metadata.sha||'')) errors.push('INVALID_BLOB_SHA:'+resolved);
        for(const symbol of imp.symbols) if(!Array.isArray(metadata.exports)||!metadata.exports.includes(symbol)) errors.push('UPSTREAM_EXPORT_MISSING:'+resolved+':'+symbol);
      }
    }
  }
  for(const modulePath of Object.keys(modules)) if(!seen.has(modulePath)) errors.push('UNUSED_PIN:'+modulePath);
  return {ok:errors.length===0,errors,imports,upstreamImports,modules:seen.size};
}

export function loadLocal(root) {
 const candidateDir=path.join(root,'integration','candidates');
 const sources=Object.fromEntries(CANDIDATES.map(f=>[f,fs.readFileSync(path.join(candidateDir,f),'utf8')]));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'integration','upstream-contracts.json'),'utf8'));
 return {sources,manifest};
}

const isMain=process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain) {
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 try {
  const {sources,manifest}=loadLocal(root);
  const result=inspectPinnedImports(sources,manifest);
  process.stdout.write(`PINNED_CORE=${UPSTREAM_COMMIT}\nIMPORT_PATHS=${result.imports}\nUPSTREAM_MODULES=${result.modules}\nIMPORT_AUDIT=${result.ok?'PASS':'FAIL'}\n`);
  if(!result.ok){for(const x of result.errors)process.stderr.write(x+'\n');process.exitCode=1;}
 }catch(error){process.stderr.write('IMPORT_AUDIT=ERROR; source or manifest missing\n');process.exitCode=1;}
}
