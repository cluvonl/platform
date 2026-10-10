import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {books} from '../lib/knowledge/catalog.mjs';
import {readableBooks,searchKnowledge} from '../lib/knowledge/model.mjs';
import {knowledgeInventory,registryKeys} from '../scripts/knowledge-inventory.mjs';
import {commandArticles,mobileScreenArticles,clubSectionArticles,platformSectionArticles} from '../lib/knowledge/coverage.mjs';
const entries=books.flatMap(b=>b.articles),ids=new Set(entries.map(a=>a.id));
const context=(environment,keys=[],global=false)=>({environment,member:environment==='personal',permissions:keys.map(key=>({key,global}))});
test('authored knowledge covers eight workspaces with substantive steps and valid internal references',()=>{
 assert.equal(books.length,8);assert.equal(ids.size,entries.length);
 for(const b of books){assert.match(b.id,/^[a-z][a-z0-9-]+$/);assert.ok(b.description.length>50);for(const a of b.articles){assert.ok(a.sections.length>=3,a.id);assert.ok(a.sections.some(s=>s.blocks.filter(b=>b.kind==='step').length>=4),a.id);assert.ok(a.sections.flatMap(s=>s.blocks).map(b=>b.text).join(' ').split(/\s+/).length>=120,a.id);for(const id of a.related)assert.ok(ids.has(id),`${a.id}->${id}`);if(b.environment!=='personal')assert.ok(a.permissions.length>0,a.id);}}
});
test('member search and direct lookup have no club or platform article content',()=>{
 const c=context('personal');assert.deepEqual(readableBooks(books,c).map(b=>b.id),['leden']);
 for(const q of ['definitief verwerken','globale standaardinstellingen','onboard_administrator'])assert.equal(searchKnowledge(books,c,q).length,0);
 assert.equal(readableBooks(books,{...c,member:false}).length,0);
});
test('club knowledge follows actual action permissions rather than board or role labels',()=>{
 assert.equal(readableBooks(books,context('club',['board'])).length,0);
 const c=context('club',['team_task.manage']);assert.deepEqual(readableBooks(books,c).map(b=>b.id),['teamouders']);
 assert.equal(searchKnowledge(books,c,'financieel voorstel').length,0);assert.equal(searchKnowledge(books,c,'teamouderoverdracht')[0].entry.id,'teamoverdracht');
 const attendance=readableBooks(books,context('club',['attendance.confirm'])).flatMap(b=>b.articles.map(a=>a.id));assert.deepEqual(attendance,['uitvoering','uitvoering-correctie']);
 const prepared=readableBooks(books,context('club',['finance.assessment.prepare'])).flatMap(b=>b.articles.map(a=>a.id));assert.ok(prepared.includes('financiele-voorbereiding'));assert.ok(!prepared.includes('financiele-goedkeuring'));assert.ok(!prepared.includes('financiele-verwerking'));
});
test('platform support does not imply club knowledge and scoped platform keys cannot open global instructions',()=>{
 assert.equal(readableBooks(books,context('club',['platform.support'])).length,0);
 assert.equal(searchKnowledge(books,context('platform',['platform.config.manage']),'globale standaardinstellingen').length,0);
 assert.equal(searchKnowledge(books,context('platform',['platform.config.manage'],true),'globale standaardinstellingen')[0].entry.id,'platformstandaarden');
 assert.equal(readableBooks(books,context('platform',['organization.manage'])).length,0);
});
test('search accepts accents, literal punctuation, all terms and filtered books without widening rights',()=>{
 const c=context('personal');assert.ok(searchKnowledge(books,c,'WINTERDOEL').some(r=>r.entry.id==='urenstand'));assert.ok(searchKnowledge(books,c,'privácy').some(r=>r.entry.id==='privacy'));
 assert.equal(searchKnowledge(books,c,'winterdoel onbestaandtoken').length,0);assert.equal(searchKnowledge(books,c,'','financien').length,0);assert.equal(searchKnowledge(books,c,'<script>alert(1)</script>').length,0);assert.ok(searchKnowledge(books,c,'(').length>0);
});
test('all canonical proposals and acceptance cases bind to existing articles; saved audit equals source analysis',async()=>{
 const generated=await knowledgeInventory();const saved=JSON.parse(await readFile(new URL('../docs/knowledge/coverage.json',import.meta.url),'utf8'));assert.deepEqual(saved,generated);
 assert.equal(Object.keys(saved.canonical_acceptance).length,30);assert.equal(Object.keys(saved.canonical_proposals).length,28);assert.equal(Object.keys(saved.reference_functions).length,219);assert.equal(Object.keys(saved.mobile_functions).length,147);
 for(const mapping of [saved.canonical_acceptance,saved.canonical_proposals,saved.screens,saved.club_sections,saved.platform_sections,...Object.values(saved.commands)])for(const values of Object.values(mapping)){assert.ok(values.length>0);for(const id of values)assert.ok(ids.has(id),id);}
 for(const mapping of [saved.reference_functions,saved.mobile_functions])for(const value of Object.values(mapping)){assert.ok(value.articles.length>0,value.title);for(const id of value.articles)assert.ok(ids.has(id),id);}
});
test('every native command and current screen needs an explicit documentation binding',async()=>{
 for(const [surface,file,name]of [['mobile','lib/pwa/validation.ts','mobilePayloadSchemas'],['club','lib/admin/contracts.ts','clubAdminSchemas'],['platform','lib/admin/contracts.ts','platformSchemas']])assert.deepEqual(Object.keys(commandArticles[surface]).sort(),await registryKeys(file,name),surface);
 const mobile=await readFile(new URL('../components/mobile/types.ts',import.meta.url),'utf8');const screens=mobile.match(/MOBILE_SCREENS = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(s=>s.slice(1,-1));assert.deepEqual(Object.keys(mobileScreenArticles).sort(),screens.sort());
 const source=await readFile(new URL('../lib/admin/contracts.ts',import.meta.url),'utf8');for(const [name,mapping]of [['clubSections',clubSectionArticles],['platformSections',platformSectionArticles]]){const section=source.slice(source.indexOf('export const '+name));const until=section.indexOf('] as const');const keys=[...section.slice(0,until).matchAll(/\['([^']+)'\s*,/g)].map(m=>m[1]);assert.deepEqual(Object.keys(mapping).sort(),keys.sort());}
});
