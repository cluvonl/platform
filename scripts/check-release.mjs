import {readFileSync} from 'node:fs';
const r=JSON.parse(readFileSync(new URL('../release/readiness.json',import.meta.url),'utf8'));
if(r.v1_ready!==true||r.production_enabled!==true||!r.approved_by||!r.approved_at||!r.acceptance_report||!/^([0-9a-f]{40}|[0-9a-f]{64})$/.test(r.staging_commit||'')||!/^sha256:[0-9a-f]{64}$/.test(r.staging_image_digest||'')) {
  console.error('PRODUCTION GEBLOKKEERD: V1 is niet vrijgegeven. Werk uitsluitend op staging.');process.exit(1);
}
console.log('Papieren releasegate aanwezig; verifieer ook beschermde environmentgoedkeuring en stagingbewijs.');
