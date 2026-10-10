import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {books,KNOWLEDGE_VERSION} from '../lib/knowledge/catalog.mjs';
import {acceptanceArticles,proposalArticles,mobileScreenArticles,clubSectionArticles,platformSectionArticles,referencePageArticles,commandArticles} from '../lib/knowledge/coverage.mjs';
const read=async file=>readFile(new URL('../'+file,import.meta.url),'utf8');
export async function registryKeys(file,name) {
 const source=ts.createSourceFile(file,await read(file),ts.ScriptTarget.Latest,true);
 let result;
 function walk(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name&&node.initializer&&ts.isObjectLiteralExpression(node.initializer))result=node.initializer.properties.map(p=>p.name.getText(source).replace(/^['"]|['"]$/g,''));ts.forEachChild(node,walk);}walk(source);
 if(!result)throw Error('KNOWLEDGE_REGISTRY_MISSING:'+name);return result.sort();
}
export async function knowledgeInventory() {
 const sourceFiles=['docs/canon/RELEASECANON-V1.txt','docs/release/function-coverage/function-matrix.json','docs/pwa/mobile-function-integration.json','lib/admin/contracts.ts','lib/pwa/validation.ts','lib/admin/server.ts','lib/pwa/server.ts','components/mobile/types.ts','components/admin/native-workspace.tsx'];
 const sources={};for(const file of sourceFiles)sources[file]=createHash('sha256').update(await read(file)).digest('hex');
 const reference=JSON.parse(await read(sourceFiles[1])),mobile=JSON.parse(await read(sourceFiles[2]));
 const referenceFunctions=Object.fromEntries(reference.functions.map(f=>[f.function_id,{title:f.title,articles:referencePageArticles[f.page_id]??[],interpretation:['P00.F10','P00.F15','P22.F11'].includes(f.function_id)?'REFERENCE_DEMO_ONLY_NOT_RUNTIME':'DOCUMENTED_WITH_CURRENT_UI_LIMITS'}]));
 const mobileFunctions=Object.fromEntries(mobile.functions.map(f=>[f.id,{title:f.name,articles:f.route?mobileScreenArticles[f.route.split('/').at(-1)]??[]:({F140:['starten'],F141:['starten'],F142:['meldingen'],F143:['profiel'],F144:['privacy'],F145:['taak-boeken'],F146:['online-status'],F147:['online-status']})[f.id]??[],interpretation:['F116','F118'].includes(f.id)?'REFERENCE_DEMO_ONLY_NOT_RUNTIME':f.id==='F038'?'SOURCE_END_TIME_UNCONFIRMED':'DOCUMENTED_WITH_CURRENT_UI_LIMITS'}]));
 return {version:KNOWLEDGE_VERSION,scope:'ROLE_BASED_KNOWLEDGE_DOCUMENTATION',production_enabled:false,article_count:books.reduce((n,b)=>n+b.articles.length,0),word_count:books.flatMap(b=>b.articles).reduce((n,a)=>n+a.sections.flatMap(s=>s.blocks).map(b=>b.text).join(' ').split(/\s+/).length,0),books:books.map(b=>({id:b.id,title:b.title,environment:b.environment,articles:b.articles.map(a=>a.id)})),canonical_acceptance:acceptanceArticles,canonical_proposals:proposalArticles,screens:mobileScreenArticles,club_sections:clubSectionArticles,platform_sections:platformSectionArticles,commands:commandArticles,reference_functions:referenceFunctions,mobile_functions:mobileFunctions,source_sha256:sources,limitations:['Documentation coverage does not imply full functional or physical-device acceptance.','The historical inventories predate the deployed administration and remain provenance, not current acceptance status.','Source match duration is unconfirmed; no match end time is invented.','Demo identity/reset controls are intentionally absent.','Hosted positive platform access requires a separately authorized personal mandate; local native synthetic platform proof is separate.']};
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){await mkdir('docs/knowledge',{recursive:true});const inventory=await knowledgeInventory();await writeFile('docs/knowledge/coverage.json',JSON.stringify(inventory,null,2)+'\n');console.log(JSON.stringify({scope:inventory.scope,articles:inventory.article_count,words:inventory.word_count,reference_functions:Object.keys(inventory.reference_functions).length,mobile_functions:Object.keys(inventory.mobile_functions).length}));}
