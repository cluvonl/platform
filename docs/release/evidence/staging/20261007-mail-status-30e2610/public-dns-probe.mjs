import dns from 'node:dns/promises';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const queries = [['root_txt','cluvo.nl','resolveTxt'],['dmarc','_dmarc.cluvo.nl','resolveTxt'],
  ['dkim_s1','s1._domainkey.cluvo.nl','resolveCname'],['dkim_s2','s2._domainkey.cluvo.nl','resolveCname'],
  ['nameservers','cluvo.nl','resolveNs']];
const findings = await Promise.all(queries.map(async ([scope,name,method]) => {
  try {
    const records = await dns[method](name);
    const values = method === 'resolveTxt' ? records.map((record) => record.join('')) : records;
    return {scope,status:'ANSWER',...(scope === 'root_txt' ? {
      spf_records:values.filter((value) => /^v=spf1(?: |$)/.test(value)).length,
      spf_sendgrid_include_present:values.some((value) => /^v=spf1(?: |$)/.test(value) && value.includes('include:sendgrid.net')),
    } : scope === 'dmarc' ? {
      dmarc_records:values.filter((value) => /^v=DMARC1;/i.test(value)).length,
      policy_reject:values.some((value) => /\bp=reject(?:;|\s|$)/.test(value)),
      policy_quarantine:values.some((value) => /\bp=quarantine(?:;|\s|$)/.test(value)),
    } : scope.startsWith('dkim') ? {
      sendgrid_target:values.some((value) => /\.sendgrid\.net\.?$/.test(value)),
    } : {nameservers:values})};
  } catch (error) {
    return {scope,status:['ENODATA','ENOTFOUND'].includes(error.code) ? 'NO_RECORD' : 'QUERY_UNAVAILABLE'};
  }
}));
const report = {observed_at:new Date().toISOString(),domain:'cluvo.nl',read_only:true,
  parent_source_sha:'30e26105bba6e65f318349b7af2a94b28cc77ce9',
  probe_source_sha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  all_custom_dkim_selectors_checked:false,all_return_path_spf_checked:false,
  provider_domain_authentication_verified:false,actual_delivery_verified:false,findings};
await writeFile(new URL('./public-dns-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({domain:report.domain,read_only:true,queries:findings.length}));
