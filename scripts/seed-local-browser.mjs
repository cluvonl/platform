import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

// Deliberately fixed to this disposable local CLI stack. No URL, remote DB or
// service credential is accepted by this fixture helper.
const container = 'supabase_db_cluvo-local';
const query = (sql) => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], {input: sql, encoding: 'utf8'});
if (query('select count(*) from auth.users;').trim() !== '0') {
  throw new Error('Local browser seed requires a fresh disposable database; existing identities are preserved.');
}
const fixture = readFileSync('supabase/fixtures/core-v1.sql', 'utf8');
query(`begin;\n${fixture}\n
update auth.users set email_confirmed_at=statement_timestamp(), instance_id='00000000-0000-0000-0000-000000000000',
  raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb,
  confirmation_token='', recovery_token='', email_change_token_new='', email_change='',
  reauthentication_token='', email_change_token_current='', phone_change_token=''
where email like '%@example.test';
insert into auth.identities(id,user_id,identity_data,provider,provider_id,created_at,updated_at)
select id,id,jsonb_build_object('sub',id,'email',email,'email_verified',true),'email',id::text,statement_timestamp(),statement_timestamp()
from auth.users where email like '%@example.test';
commit;`);
console.log(JSON.stringify({fixture: 'core-v1', identities: 4, environment: 'local', real_member_data: false}));
