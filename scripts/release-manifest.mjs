import {createHash} from 'node:crypto';import {readdirSync,readFileSync,existsSync} from 'node:fs';
const sha=process.env.SOURCE_SHA, image=process.env.CLUVO_IMAGE, run=process.env.RUN_ID,mode=process.env.RELEASE_MODE||'prototype';
if(!/^[a-f0-9]{40}$/.test(sha||'')||!/^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(image||'')||!/^\d+$/.test(run||'')||!['prototype','app'].includes(mode))throw new Error('Invalid release inputs');
const path='supabase/migrations';
const migrations=existsSync(path)?readdirSync(path).filter(f=>f.endsWith('.sql')).sort().map(f=>({file:f,sha256:createHash('sha256').update(readFileSync(`${path}/${f}`)).digest('hex')})):[];
const migrationHash=createHash('sha256').update(JSON.stringify(migrations)).digest('hex');
console.log(JSON.stringify({source_sha:sha,image,image_digest:image.split('@')[1],workflow_run_id:run,built_at:new Date().toISOString(),config_schema_version:1,migration_manifest_sha256:migrationHash,migrations,mode,runtime_activation_verified:false,v1_ready:false,staging_verified_at:null},null,2));
