import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCandidateSyntax} from '../native-syntax-audit.mjs';
import {CANDIDATES} from '../native-import-audit.mjs';
const good=()=>Object.fromEntries(CANDIDATES.map(f=>[f,'import type { Transaction } from "sequelize";\nimport { Player as P } from "../../core/database/game/models/Player";\nexport const go=()=>P;']));
const mutate=(text,file=CANDIDATES[0])=>{const s=good();s[file]+='\n'+text;return inspectCandidateSyntax(s);};

test('parses named and type imports with exact canonical symbols',()=>{
 const r=inspectCandidateSyntax(good());
 assert.equal(r.ok,true);assert.equal(r.imports.length,8);assert.equal(r.upstreamCount,4);
 assert.equal(r.imports[1].names[0],'Player');
});
test('ignores commented fake imports rather than treating them as dependencies',()=>{
 const r=mutate('// import { Ghost } from "unverified-package";');
 assert.equal(r.ok,true);assert.equal(r.upstreamCount,4);
});
test('rejects side-effect, default, namespace and import-equals forms',()=>{
 for(const s of ['import "hidden";','import Stuff from "hidden";','import * as NS from "hidden";','import h = require("hidden");']){
  assert.equal(mutate(s).ok,false,s);
 }
});
test('rejects dynamic import, require calls and reexports',()=>{
 for(const s of ['async function load(){return import("fs")}', 'const x=require("fs")',
  'const x=module.require("fs")', 'export { secret } from "hidden";']){
  assert.equal(mutate(s).ok,false,s);
 }
});
test('rejects non-type sequelize and arbitrary external imports',()=>{
 assert.match(mutate('import { Model } from "sequelize";').errors.join(','),/SEQUELIZE_IMPORT_FORBIDDEN/);
 assert.match(mutate('import { parse } from "external";').errors.join(','),/EXTERNAL_IMPORT_FORBIDDEN/);
});
test('rejects inline type specifiers mixed with runtime imports',()=>{
 assert.match(mutate('import {type U, run} from "./other";').errors.join(','),/IMPORT_SHAPE_FORBIDDEN/);
});
test('rejects invalid TypeScript and missing candidates',()=>{
 assert.match(mutate('const broken = ;').errors.join(','),/TYPESCRIPT_PARSE_INVALID/);
 const s=good();delete s[CANDIDATES[0]];
 assert.match(inspectCandidateSyntax(s).errors.join(','),/SOURCE_MISSING/);
});
test('unsupported syntax hidden in other candidate is not missed',()=>{
 assert.match(mutate('import "secret";',CANDIDATES[3]).errors.join(','),/IMPORT_SHAPE_FORBIDDEN/);
});
