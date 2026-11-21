import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPinnedImports,loadLocal,UPSTREAM_COMMIT,CANDIDATES} from '../native-import-audit.mjs';
const root=new URL('../../',import.meta.url).pathname;
const base=()=>loadLocal(root);
const check=(s,m)=>inspectPinnedImports(s,m);
test('pinned 6.2.0.b has all candidate imports/symbols',()=>{
 const {sources,manifest}=base(),r=check(sources,manifest);
 assert.deepEqual(r.errors,[]);assert.equal(r.ok,true);assert.equal(r.imports,39);assert.equal(r.modules,28);
});
test('reject extra unknown upstream imports',()=>{
 const {sources,manifest}=base();sources['PortalGardenQuery.ts']+='\nimport { Secret } from "../../core/database/game/models/Secret";';
 assert.match(check(sources,manifest).errors.join(','),/UNPINNED_IMPORT/);
});
test('reject wrong native export names',()=>{
 const {sources,manifest}=base();sources['PortalPropertyQuery.ts']=sources['PortalPropertyQuery.ts'].replace('{ Apartment }','{ WrongApartment }');
 assert.match(check(sources,manifest).errors.join(','),/UPSTREAM_EXPORT_MISSING/);
});
test('reject removed pin and stale pins',()=>{
 const {sources,manifest}=base();delete manifest.modules['Core/src/core/database/game/models/Player.ts'];
 assert.match(check(sources,manifest).errors.join(','),/UNPINNED_IMPORT/);
 const a=base();a.manifest.modules['Core/src/core/database/game/models/unused.ts']={sha:'a'.repeat(40),exports:['Unused']};
 assert.match(check(a.sources,a.manifest).errors.join(','),/UNUSED_PIN/);
});
test('reject broken blob sha and wrong upstream commit',()=>{
 const a=base();a.manifest.modules['Core/src/core/database/game/models/Player.ts'].sha='bad';
 assert.match(check(a.sources,a.manifest).errors.join(','),/INVALID_BLOB_SHA/);
 const b=base();b.manifest.commit='0'.repeat(40);
 assert.match(check(b.sources,b.manifest).errors.join(','),/MANIFEST_INVALID/);
});
test('reject missing local symbol',()=>{
 const {sources,manifest}=base();sources['PortalReadBundle.ts']=sources['PortalReadBundle.ts'].replace('readChestForPortal','readFakeChestForPortal');
 assert.match(check(sources,manifest).errors.join(','),/LOCAL_EXPORT_MISSING/);
});
test('reject external unpinned module and directory escape',()=>{
 const a=base();a.sources['PortalGardenQuery.ts']+='\nimport { y } from "unverified-package";';
 assert.match(check(a.sources,a.manifest).errors.join(','),/EXTERNAL_NOT_ALLOWED/);
 const b=base();b.sources['PortalGardenQuery.ts']+='\nimport { secret } from "../../../../../private";';
 assert.match(check(b.sources,b.manifest).errors.join(','),/PATH_ESCAPE/);
});
test('manifest represents pinned commit and four local candidates',()=>{
 assert.equal(UPSTREAM_COMMIT.length,40);assert.equal(CANDIDATES.length,4);
});

test('reject default and side-effect imports that bypass named-symbol scanner',()=>{
 const a=base();a.sources['PortalGardenQuery.ts']+='\nimport Secret from "unverified-package";';
 assert.match(check(a.sources,a.manifest).errors.join(','),/UNSUPPORTED_IMPORT_SYNTAX/);
 const b=base();b.sources['PortalGardenQuery.ts']+='\nimport "unverified-package";';
 assert.match(check(b.sources,b.manifest).errors.join(','),/UNSUPPORTED_IMPORT_SYNTAX/);
});
test('Sequelize import must remain type-only Transaction',()=>{
 const a=base();a.sources['PortalPropertyQuery.ts']=a.sources['PortalPropertyQuery.ts'].replace('import type { Transaction }','import { Sequelize }');
 assert.match(check(a.sources,a.manifest).errors.join(','),/SEQUELIZE_IMPORT_INVALID/);
});
