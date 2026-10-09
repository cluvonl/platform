#!/usr/bin/env python3
"""Two real PostgreSQL connections; fixed disposable local DB, synthetic identities.

No production/staging URL, copied accounts, mocked RPC or removed DB guard.
Native OTP sessions are independently verified by browser-admin-native.mjs.
"""
import json
import queue
import subprocess
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = 'cluvo_admin_race_20261009'
SOURCE = 'cluvo_admin_owned_20261009'
CONTAINER = 'supabase_db_cluvo-local'
TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
A = '33333333-3333-4333-8333-333333333333'
M = '11111111-1111-4111-8111-111111111111'
N = '22222222-2222-4222-8222-222222222222'
POSITION = 'aa210000-0000-4000-8000-000000000004'
SHIFT = 'aa200000-0000-4000-8000-000000000003'
TEAM = 'af700000-0000-4000-8000-000000000001'
GRANT = 'af700000-0000-4000-8000-000000000003'
LOCATION = 'af700000-0000-4000-8000-000000000004'


def raw(args, data=None):
    r = subprocess.run(['docker', 'exec', '-i', CONTAINER, *args], input=data, capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr.decode()[-2000:])
    return r.stdout


def sql(statement, database=DB):
    return raw(['psql', '-U', 'supabase_admin', '-d', database, '-XAtq', '-v', 'ON_ERROR_STOP=1'], statement.encode()).decode().strip()


schema = raw(['pg_dump', '-U', 'supabase_admin', '-d', SOURCE, '--schema-only', '--no-publications', '--no-subscriptions'])
catalogs = raw(['pg_dump', '-U', 'supabase_admin', '-d', SOURCE, '--data-only', '--table=app.permissions', '--table=app.help_topics'])
core = (ROOT / 'supabase/fixtures/core-v1.sql').read_text()


def seed():
    assert DB == 'cluvo_admin_race_20261009' and DB not in ('postgres', SOURCE)
    sql(f'DROP DATABASE IF EXISTS {DB} WITH(FORCE);CREATE DATABASE {DB};', 'postgres')
    sql(schema.decode())
    sql(catalogs.decode())
    sql(core + f"""
    update auth.users set email_confirmed_at=statement_timestamp();
    insert into auth.sessions(id,user_id)select id,id from auth.users;
    insert into app.permission_roles(id,tenant_id,role_key,name,system_role)values('{TEAM}','{TENANT}','race_admin','Explicit synthetic race authority',false),('{GRANT}','{TENANT}','race_limited','Only organization identity',false);
    insert into app.role_permissions(tenant_id,role_id,permission_key)select '{TENANT}','{TEAM}',permission_key from app.permissions;
    insert into app.role_permissions(tenant_id,role_id,permission_key)values('{TENANT}','{GRANT}','organization.manage');
    insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)values('{TENANT}','{A}','{TEAM}','tenant','{A}');
    insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)values('{GRANT}','{TENANT}','{M}','{GRANT}','tenant','{A}');
    insert into app.teams(id,tenant_id,name)values('{TEAM}','{TENANT}','Native race team');
    insert into app.team_person_memberships(tenant_id,team_id,person_id,membership_kind)values('{TENANT}','{TEAM}','a1000000-0000-4000-8000-000000000003','team_parent');
    insert into app.platform_access_grants(auth_user_id,display_name,permission_key,ends_at,granted_by_auth_user_id)values('{A}','Explicit race lifecycle operator','platform.tenant.manage',statement_timestamp()+interval '1 day','{A}');
    """)


def context(actor):
    return "begin;set local statement_timeout='15s';set local role authenticated;select set_config('request.jwt.claims'," + "'" + json.dumps({'sub': actor, 'session_id': actor}) + "',true);\n"


class Connection:
    def __init__(self, actor, command, name, hold=False):
        self.messages = queue.Queue()
        self.lines = []
        self.process = subprocess.Popen(['docker', 'exec', '-i', CONTAINER, 'psql', '-U', 'supabase_admin', '-d', DB, '-XAtq', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        def reader():
            for line in self.process.stdout:
                self.lines.append(line)
                self.messages.put(line.strip())
            self.messages.put(None)
        threading.Thread(target=reader, daemon=True).start()
        self.send(f"set application_name='cluvo-admin-race:{name}';" + context(actor) + command + '\n\\echo APPLIED\n' + ('' if hold else 'commit;\n\\echo COMMITTED\n'))
        if not hold:
            self.process.stdin.close()

    def send(self, value):
        self.process.stdin.write(value)
        self.process.stdin.flush()

    def wait_marker(self, marker):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            item = self.messages.get(timeout=max(.1, deadline-time.monotonic()))
            if item == marker:
                return
            if item is None:
                raise RuntimeError('Native race connection ended before '+marker+': '+''.join(self.lines)[-1500:])
        raise TimeoutError('Native race marker missing')

    def release(self):
        self.send('commit;\n\\echo COMMITTED\n')
        self.process.stdin.close()
        self.wait_marker('COMMITTED')
        assert self.process.wait(timeout=5) == 0

    def finish(self):
        self.process.wait(timeout=20)
        return ''.join(self.lines)

    def close(self):
        if self.process.poll() is None:
            if not self.process.stdin.closed:
                self.process.stdin.close()
            self.process.terminate()
            self.process.wait(timeout=5)


def booking(person, key):
    return f"select ok from api.book_shift('{TENANT}','{SHIFT}','{POSITION}','{person}','a6000000-0000-4000-8000-000000000001',1,'{key}');"


cluster = f"select ok from api.pwa_command('{TENANT}','reserve_cluster','{TEAM}',1,jsonb_build_object('season_id','a5000000-0000-4000-8000-000000000001','title','Actual last-place race','mode','assign','position_ids',jsonb_build_array('{POSITION}'),'self_until',statement_timestamp()+interval '1 day','assign_until',statement_timestamp()+interval '2 days','counts_for_team',true),'af600000-0000-4000-8000-000000000001');"
book_a = booking('a1000000-0000-4000-8000-000000000001', 'af600000-0000-4000-8000-000000000002')
book_b = booking('a1000000-0000-4000-8000-000000000002', 'af600000-0000-4000-8000-000000000003')
location = f"select api.club_admin_command('{TENANT}','save_location','{LOCATION}',0,'{{\"name\":\"Actual concurrency proof\",\"active\":true,\"reason\":\"Synthetic native conflict and retry\"}}','af600000-0000-4000-8000-000000000004')->>'ok';"
revoke = f"select api.club_admin_command('{TENANT}','revoke_access','{GRANT}',1,'{{\"reason\":\"End limited identity mandate\"}}','af600000-0000-4000-8000-000000000005')->>'ok';"
pause = f"select api.platform_command('set_tenant_status','{TENANT}',1,jsonb_build_object('status','suspended','impact_hash',api.platform_tenant_impact('{TENANT}','suspended')->>'impact_hash','reason','Checked pause under concurrent command'),'af600000-0000-4000-8000-000000000006')->>'ok';"
proof = []
for name, actor_a, first, actor_b, second, failure in [
 ('booking-before-cluster', M, book_a, A, cluster, 'CAPACITY_FULL'),
 ('cluster-before-booking', A, cluster, M, book_a, 'TEAM_POSITION_RESERVED'),
 ('two-last-place-bookings', M, book_a, N, book_b, 'CAPACITY_FULL'),
 ('revocation-before-command', A, revoke, M, location, 'FORBIDDEN'),
 ('pause-before-command', A, pause, M, location, 'FORBIDDEN'),
 ('same-command-on-two-connections', A, location, A, location, None),
]:
    seed()
    first_connection = second_connection = None
    try:
        first_connection = Connection(actor_a, first, 'first', hold=True)
        first_connection.wait_marker('APPLIED')
        second_connection = Connection(actor_b, second, 'second')
        wait = None
        for _ in range(40):
            observed = sql("select coalesce(wait_event_type,'')||':'||coalesce(wait_event,'')from pg_stat_activity where datname=current_database()and application_name='cluvo-admin-race:second';")
            if observed == 'Lock:advisory':
                wait = observed
                break
            if second_connection.process.poll() is not None:
                break
            time.sleep(.05)
        assert wait == 'Lock:advisory', 'Second native RPC must actually wait on the authority fence'
        first_connection.release()
        result = second_connection.finish()
        if failure:
            assert second_connection.process.returncode != 0 and failure in result, 'Actual losing native result must be '+failure
        else:
            assert second_connection.process.returncode == 0 and 'COMMITTED' in result
        bookings = int(sql(f"select count(*)from app.bookings where position_id='{POSITION}'and state not in('cancelled','transferred');"))
        allocations = int(sql(f"select count(*)from app.pwa_allocations where position_id='{POSITION}'and state<>'released';"))
        assert not(bookings and allocations), 'Public booking and team reservation cannot coexist'
        if name.startswith('booking') or name=='two-last-place-bookings':
            assert bookings == 1 and allocations == 0
        if name.startswith('cluster'):
            assert bookings == 0 and allocations == 1
        if name in('revocation-before-command','pause-before-command'):
            assert sql(f"select count(*)from app.locations where id='{LOCATION}';") == '0'
        if failure is None:
            assert sql(f"select count(*)from app.locations where id='{LOCATION}';") == '1'
            assert sql(f"select count(*)from app.audit_events where resource_id='{LOCATION}'and action='admin.save_location';") == '1'
        proof.append({'case': name, 'status': 'PASS', 'native_connections': 2, 'observed_wait': wait, 'losing_result': failure or 'same confirmed receipt', 'bookings': bookings, 'reservations': allocations})
        print(json.dumps(proof[-1]), flush=True)
    finally:
        if first_connection:
            first_connection.close()
        if second_connection:
            second_connection.close()
output = ROOT / 'docs/release/evidence/local/20261009-admin-native/concurrency.json'
output.write_text(json.dumps({'status':'PASS','database':DB,'synthetic_accounts_only':True,'sql_native_sessions':True,'otp_provider_proof':False,'source_accounts_copied':False,'cases':proof},indent=2)+'\n')
