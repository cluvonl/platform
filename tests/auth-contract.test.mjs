import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('OTP-login maakt geen ongecontroleerde Auth-gebruiker aan', async () => {
  const actions = await read('app/auth/actions.ts');
  assert.match(actions, /signInWithOtp/);
  assert.match(actions, /shouldCreateUser:\s*false/);
  assert.match(actions, /verifyOtp/);
  assert.match(actions, /type:\s*'email'/);
  assert.match(actions, /httpOnly:\s*true/);
  assert.match(actions, /sameSite:\s*'strict'/);
  assert.match(actions, /delete\(\{name:\s*otpEmailCookie,\s*path:\s*'\/auth\/verify'\}\)/);
  assert.doesNotMatch(actions, /auth\/verify\?email=/);
  assert.match(actions, /schema\('api'\)[\s\S]*from\('my_workspaces'\)/);
  assert.match(actions, /signOut\(\{scope:\s*'local'\}\)/);
});

test('beveiligde werkruimte verifieert claims en tenantlidmaatschap op de server', async () => {
  const [workspace, proxy] = await Promise.all([
    read('lib/auth/workspace.ts'),
    read('proxy.ts'),
  ]);
  assert.match(workspace, /auth\.getClaims\(\)/);
  assert.match(workspace, /schema\('api'\)[\s\S]*from\('my_workspaces'\)/);
  assert.match(workspace, /\.eq\('tenant_slug',\s*tenantSlug\)/);
  assert.match(proxy, /'\/c\/:path\*'/);
  assert.match(proxy, /'\/workspaces'/);
});

test('intakecommand vertrouwt geen client-actor en gebruikt optimistic concurrency', async () => {
  const action = await read('app/c/[club]/intake/actions.ts');
  assert.match(action, /requireWorkspace\(parsed\.data\.club\)/);
  assert.match(action, /p_tenant_id:\s*workspace\.tenant_id/);
  assert.match(action, /p_expected_version/);
  assert.match(action, /p_idempotency_key/);
  assert.match(action, /p_represented_person_id:\s*null/);
  assert.match(action, /p_assistance_reason:\s*null/);
  assert.match(action, /schema\('api'\)\.rpc\('save_intake_revision'/);
  assert.doesNotMatch(action, /actor_auth_id|service_role|SUPABASE_SECRET/i);
});

test('uitnodigingsgeheimen blijven server-side, retrybaar en verdwijnen uit de browser-URL', async () => {
  const [inviteAction, confirmRoute, acceptAction, acceptForm, adminClient, config, authConfig, magicTemplate, onboarding] = await Promise.all([
    read('app/c/[club]/huishouden/actions.ts'),
    read('app/auth/confirm/route.ts'),
    read('app/invite/accept/actions.ts'),
    read('components/auth/accept-invitation-form.tsx'),
    read('lib/supabase/admin.ts'),
    read('lib/supabase/config.ts'),
    read('supabase/config.toml'),
    read('supabase/templates/magic_link.html'),
    read('supabase/migrations/20261002170949_wp1_onboarding_storage.sql'),
  ]);
  assert.match(inviteAction, /createSupabaseAdminClient\(\)/);
  assert.match(inviteAction, /auth\.admin\.inviteUserByEmail/);
  assert.match(inviteAction, /createHash\('sha256'\)/);
  assert.match(inviteAction, /createHmac\('sha256',\s*invitationTokenSecret\(\)\)/);
  assert.match(inviteAction, /inviteError\.code === 'email_exists'/);
  assert.match(inviteAction, /signInWithOtp/);
  assert.match(inviteAction, /shouldCreateUser:\s*false/);
  assert.match(confirmRoute, /httpOnly:\s*true/);
  assert.match(confirmRoute, /sameSite:\s*'strict'/);
  assert.match(confirmRoute, /next = '\/invite\/accept'/);
  assert.match(acceptAction, /cookies\(\)/);
  assert.match(acceptAction, /cluvo_household_invitation/);
  assert.match(acceptAction, /delete\(\{name:\s*invitationCookie,\s*path:\s*'\/invite\/accept'\}\)/);
  assert.doesNotMatch(acceptForm, /name=["']token["']/);
  assert.match(adminClient, /supabaseAdminConfig\(\)/);
  assert.doesNotMatch(adminClient, /NEXT_PUBLIC|publishableKey/);
  assert.match(config, /INVITATION_TOKEN_SECRET/);
  assert.match(authConfig, /otp_expiry\s*=\s*3600/);
  assert.match(magicTemplate, /TokenHash/);
  assert.match(onboarding, /interval '1 hour'/);
  assert.match(onboarding, /expires_in_seconds',\s*3600/);
});

test('boeking en presentie gebruiken uitsluitend tenantgebonden databasecommands', async () => {
  const [booking, attendance, marketPage, attendancePage] = await Promise.all([
    read('app/c/[club]/diensten/actions.ts'),
    read('app/c/[club]/beheer/presentie/actions.ts'),
    read('app/c/[club]/diensten/page.tsx'),
    read('app/c/[club]/beheer/presentie/page.tsx'),
  ]);
  assert.match(booking, /requireWorkspace\(parsed\.data\.club\)/);
  assert.match(booking, /p_tenant_id:\s*workspace\.tenant_id/);
  assert.match(booking, /p_executor_person_id:\s*workspace\.person_id/);
  assert.match(booking, /p_expected_shift_version/);
  assert.match(booking, /p_idempotency_key/);
  assert.match(booking, /schema\('api'\)\.rpc\('book_shift'/);
  assert.doesNotMatch(booking, /actor_auth|service_role|SUPABASE_SECRET/i);

  assert.match(attendance, /requireWorkspace\(parsed\.data\.club\)/);
  assert.match(attendance, /p_tenant_id:\s*workspace\.tenant_id/);
  assert.match(attendance, /p_expected_booking_version/);
  assert.match(attendance, /p_idempotency_key/);
  assert.match(attendance, /schema\('api'\)\.rpc\('confirm_attendance'/);
  assert.doesNotMatch(attendance, /actor_auth|service_role|SUPABASE_SECRET/i);

  assert.match(marketPage, /schema\('api'\)\.rpc\('list_shift_market'/);
  assert.match(marketPage, /schema\('api'\)\.rpc\('list_bookable_obligations'/);
  assert.doesNotMatch(marketPage, /from\('household_progress'\)/);
  assert.match(attendancePage, /schema\('api'\)\.rpc\('list_attendance_queue'/);
  assert.doesNotMatch(`${marketPage}\n${attendancePage}`, /schema\('app'\)/);
});

test('mobiele werkruimte houdt een zichtbare server-side uitlogactie', async () => {
  const [shell, styles] = await Promise.all([
    read('components/app/secure-shell.tsx'),
    read('app/globals.css'),
  ]);
  assert.match(shell, /<form action=\{signOutAction\}>/);
  assert.doesNotMatch(styles, /\.secure-profile form\{display:none\}/);
  assert.match(styles, /@media\(max-width:850px\)[\s\S]*\.secure-profile button\{margin-top:0;white-space:nowrap\}/);
});
