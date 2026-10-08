// Public diagnostics contain only fixed catalog field names and bounded counts.
// Object identities and values are used privately and never returned.
import {isDeepStrictEqual as equal} from 'node:util';

const definitions={
 schemas:['name','owner acl'],relations:['schema name','kind persistence owner rls force_rls replica_identity options acl viewdef'],
 columns:['schema relation name','position type not_null identity generated storage compression default_expression acl'],
 policies:['schema relation name','command permissive roles using_expression check_expression'],
 functions:['schema name arguments kind','owner language security_definer leakproof volatility parallel strict config source binary definition acl'],
 constraints:['schema relation name','kind deferrable deferred validated definition'],indexes:['schema name','definition valid ready replica_identity'],
 triggers:['schema relation name','enabled definition'],event_triggers:['name','event owner function enabled tags'],
 extensions:['name','version schema owner relocatable config'],extension_members:['extension object',''],default_acls:['owner schema kind','acl'],
 roles:['name','superuser inherit create_role create_db login replication bypass_rls connection_limit valid_until config'],
 role_memberships:['role member grantor','admin inherit can_set'],role_database_settings:['database role','config'],parameter_acls:['name','acl'],
 security_labels:['object provider','label'],sequences:['schema name','type start increment max min cache cycle'],
 database:['name','owner encoding locale_provider collate ctype locale icu_rules collation_version connection_limit is_template allow_connections acl'],
 types:['schema name','kind owner not_null default_value acl enum_values'],inheritance:['child parent','sequence detach_pending'],
 partition_bounds:['schema name','bound key'],publications:['name','owner all_tables insert update delete truncate via_root'],
 publication_relations:['publication schema relation','attributes predicate'],publication_schemas:['publication schema',''],
 tablespaces:['name','owner options acl location'],ranges:['schema name','subtype collation opclass canonical subtype_diff multirange'],
 collations:['schema name','owner provider deterministic encoding collate ctype locale icu_rules version']
};
const fields=Object.fromEntries(Object.entries(definitions).map(([family,[identity,changed]])=>[family,{identity:identity.split(' '),changed:changed?changed.split(' '):[]}]));
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1_000_000;
export function publicCatalogDiagnostics(input){
 if(!Array.isArray(input))return Object.freeze([]);
 return Object.freeze(Object.keys(fields).flatMap(family=>{
  const row=input.find(value=>value?.family===family);
  if(!row||!['source_rows','restored_rows','missing_rows','extra_rows','changed_rows'].every(key=>count(row[key])))return [];
  return [Object.freeze({family,...Object.fromEntries(['source_rows','restored_rows','missing_rows','extra_rows','changed_rows'].map(key=>[key,row[key]])),
   changed_fields:Object.freeze(fields[family].changed.filter(key=>Array.isArray(row.changed_fields)&&row.changed_fields.includes(key))),
   ...(count(row.acl_missing_entries)&&count(row.acl_extra_entries)?{acl_missing_entries:row.acl_missing_entries,acl_extra_entries:row.acl_extra_entries}:{})})];
 }));
}
export function catalogMismatchDiagnostic(family,source,restored){
 if(!fields[family]||!Array.isArray(source)||!Array.isArray(restored))return null;
 const {identity,changed}=fields[family],groups=new Map();
 for(const row of restored){const key=JSON.stringify(identity.map(field=>row[field]));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 const diagnostic={family,source_rows:source.length,restored_rows:restored.length,missing_rows:0,extra_rows:0,changed_rows:0,changed_fields:[],acl_missing_entries:0,acl_extra_entries:0};
 for(const expected of source){
  const group=groups.get(JSON.stringify(identity.map(field=>expected[field])));
  if(!group?.length){diagnostic.missing_rows++;continue;}
  const exact=group.findIndex(row=>equal(row,expected));
  if(exact>=0){group.splice(exact,1);continue;}
  const actual=group.shift();diagnostic.changed_rows++;
  for(const field of changed)if(!equal(expected[field],actual[field])){
   diagnostic.changed_fields.push(field);
   if(field==='acl'&&Array.isArray(expected.acl)&&Array.isArray(actual.acl)){
    diagnostic.acl_missing_entries+=expected.acl.filter(grant=>!actual.acl.some(value=>equal(grant,value))).length;
    diagnostic.acl_extra_entries+=actual.acl.filter(grant=>!expected.acl.some(value=>equal(grant,value))).length;
   }
  }
 }
 diagnostic.extra_rows=[...groups.values()].reduce((total,rows)=>total+rows.length,0);
 return publicCatalogDiagnostics([diagnostic])[0]??null;
}
