/**
 * AST-based, fail-closed import syntax policy for the four candidate readers.
 * This supplements the pinned import manifest scanner rather than typechecking
 * the Crownicles Core. Run after npm install (TypeScript 5.8.3).
 */
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {CANDIDATES,loadLocal,inspectPinnedImports} from './native-import-audit.mjs';
const require=createRequire(import.meta.url);
const ts=require('typescript');

export function inspectCandidateSyntax(sources) {
 const errors=[],imports=[];
 for(const file of CANDIDATES) {
  const src=sources[file];
  if(typeof src!=='string'||!src.trim()){errors.push('SOURCE_MISSING:'+file);continue;}
  const ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  if(ast.parseDiagnostics.length) errors.push('TYPESCRIPT_PARSE_INVALID:'+file);
  for(const stmt of ast.statements) {
   if(ts.isImportEqualsDeclaration(stmt)) errors.push('IMPORT_EQUALS_FORBIDDEN:'+file);
   if(ts.isExportDeclaration(stmt) && stmt.moduleSpecifier) errors.push('REEXPORT_FORBIDDEN:'+file);
   if(!ts.isImportDeclaration(stmt)) continue;
   const clause=stmt.importClause,mod=stmt.moduleSpecifier;
   if(!ts.isStringLiteral(mod)||!clause||clause.name||!clause.namedBindings||!ts.isNamedImports(clause.namedBindings)
      ||clause.namedBindings.elements.length===0
      ||clause.namedBindings.elements.some(x=>x.isTypeOnly||!ts.isIdentifier(x.name)|| (x.propertyName&&!ts.isIdentifier(x.propertyName)))) {
    errors.push('IMPORT_SHAPE_FORBIDDEN:'+file);continue;
   }
   const moduleName=mod.text;
   const names=clause.namedBindings.elements.map(x=>x.propertyName?.text??x.name.text);
   if(moduleName==='sequelize') {
    if(!clause.isTypeOnly||names.length!==1||names[0]!=='Transaction') errors.push('SEQUELIZE_IMPORT_FORBIDDEN:'+file);
   } else if(!moduleName.startsWith('.')) errors.push('EXTERNAL_IMPORT_FORBIDDEN:'+file);
   imports.push({file,moduleName,names,isTypeOnly:clause.isTypeOnly});
  }
  const walk=(node)=>{
   if(ts.isCallExpression(node)) {
    if(node.expression.kind===ts.SyntaxKind.ImportKeyword) errors.push('DYNAMIC_IMPORT_FORBIDDEN:'+file);
    else if(ts.isIdentifier(node.expression)&&node.expression.text==='require') errors.push('REQUIRE_FORBIDDEN:'+file);
    else if(ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='require') errors.push('REQUIRE_FORBIDDEN:'+file);
   }
   ts.forEachChild(node,walk);
  };
  walk(ast);
 }
 return {ok:errors.length===0,errors,imports,upstreamCount:imports.filter(x=>x.moduleName!=='sequelize').length};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain) {
 try {
  const {sources,manifest}=loadLocal(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
  const ast=inspectCandidateSyntax(sources);
  const pin=inspectPinnedImports(sources,manifest);
  const agree=ast.upstreamCount===pin.imports && pin.ok;
  process.stdout.write(`AST_IMPORTS=${ast.imports.length}\n`);
  process.stdout.write(`AST_UPSTREAM_IMPORTS=${ast.upstreamCount}\n`);
  process.stdout.write(`NATIVE_SYNTAX_AUDIT=${ast.ok&&agree?'PASS':'FAIL'}\n`);
  if(!ast.ok||!agree){for(const code of [...ast.errors,...(!agree?['PIN_AST_DISAGREEMENT']:[])])process.stderr.write(code+'\n');process.exitCode=2;}
 }catch{process.stderr.write('NATIVE_SYNTAX_AUDIT=ERROR\n');process.exitCode=2;}
}
