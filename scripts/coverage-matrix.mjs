import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';

const handover = 'docs/handover/2026-10-06/registers';
const catalogue = JSON.parse(readFileSync(`${handover}/functies.json`, 'utf8'));
const relationships = JSON.parse(readFileSync(`${handover}/relaties.json`, 'utf8'));
const acceptance = JSON.parse(readFileSync('release/catalogue-acceptance.json', 'utf8'));
const baseSha = '47386491859b47fbebf85c3b209724dcc20407fc';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sqlObject = /\bcreate\s+(?:or\s+replace\s+)?(table|view|function)\s+(app|api)\.([a-z_0-9]+)/gi;
const migrations = readdirSync('supabase/migrations').filter((name) => /^\d+_.+\.sql$/.test(name)).sort().map((file) => {
  const source = readFileSync(`supabase/migrations/${file}`, 'utf8');
  return {file, sha256: hash(source), objects: [...source.matchAll(sqlObject)].map((match) => ({kind: match[1].toLowerCase(), name: `${match[2]}.${match[3]}`, line: source.slice(0, match.index).split('\n').length}))};
});
const baselineMigrations = migrations.filter(({file}) => file.startsWith('20261002'));
for (const {file, sha256} of baselineMigrations) {
  if (sha256 !== hash(execFileSync('git', ['show', `${baseSha}:supabase/migrations/${file}`]))) throw new Error(`IMMUTABLE_MIGRATION_CHANGED: ${file}`);
}
const counts = (entries) => ({
  migrations: entries.length,
  app_tables: new Set(entries.flatMap(({objects}) => objects.filter(({kind, name}) => kind === 'table' && name.startsWith('app.')).map(({name}) => name))).size,
  api_function_definitions: entries.flatMap(({objects}) => objects.filter(({kind, name}) => kind === 'function' && name.startsWith('api.'))).length,
  api_views: new Set(entries.flatMap(({objects}) => objects.filter(({kind, name}) => kind === 'view' && name.startsWith('api.')).map(({name}) => name))).size,
});

const routes = {
  P00: '/c/[club] (layout)', P01: '/c/[club]/overzicht', P02: '/c/[club]/taken',
  P03: '/c/[club]/mijn-taken', P04: '/c/[club]/gezin', P05: '/c/[club]/ruilmarkt',
  P06: '/c/[club]/agenda', P07: '/c/[club]/wedstrijden', P08: '/c/[club]/planbord',
  P09: '/c/[club]/huishoudens', P10: '/c/[club]/commissies', P11: '/c/[club]/kanban',
  P12: '/c/[club]/teams', P13: '/c/[club]/acties', P14: '/c/[club]/berichten',
  P15: '/c/[club]/beleid', P16: '/c/[club]/waardering', P17: '/c/[club]/opleidingen',
  P18: '/c/[club]/vrijwilligersfuncties', P19: '/c/[club]/rapportages', P20: '/c/[club]/financien',
  P21: '/c/[club]/communicatie', P22: '/c/[club]/instellingen', P23: '/c/[club]/intake',
};
const wiring = {
  'P00.F01': {read_models: ['api.my_workspaces', 'api.my_active_seasons'], components: ['components/app/secure-shell.tsx']},
  'P00.F02': {read_models: ['api.my_workspaces'], components: ['components/app/workspace-navigation.tsx'], limitation: 'Verleende scopes bepalen de werkruimte; overige paginaroutes nog te bouwen.'},
  'P00.F03': {components: ['components/app/workspace-navigation.tsx'], limitation: 'Alleen aangesloten paginaroutes; taakzoekprojectie ontbreekt.'},
  'P00.F05': {read_models: ['api.my_intake'], components: ['app/c/[club]/intake/page.tsx']},
  'P00.F06': {read_models: ['api.my_help_seen'], components: ['components/app/help-provider.tsx'], limitation: 'Aangesloten op overzicht, markt, intake en dossier; overige tabs/dialogen nog open.'},
  'P00.F07': {read_models: ['api.my_help_seen'], commands: ['api.mark_help_seen'], components: ['app/help/actions.ts', 'components/app/help-provider.tsx']},
  'P00.F08': {read_models: ['api.my_help_seen'], commands: ['api.mark_help_seen'], components: ['app/c/[club]/layout.tsx', 'components/app/help-provider.tsx']},
  'P00.F09': {components: ['components/ui/sidebar.tsx', 'components/app/workspace-navigation.tsx']},
  'P00.F13': {components: ['components/app/workspace-navigation.tsx'], limitation: 'URL-navigatie voor aangesloten routes; overige contextlinks nog open.'},
  'P00.F14': {commands: ['Supabase Auth.signOut'], components: ['app/auth/actions.ts']},
  'P01.F01': {read_models: ['api.my_households', 'api.my_active_seasons', 'api.my_household_season_progress'], components: ['app/c/[club]/overzicht/page.tsx'], limitation: 'Eigen dossier/seizoen en canonieke coverage/winterstand aangesloten; volledige bestuursaggregaten en teamprojecties nog open.'},
  'P02.F01': {read_models: ['api.list_shift_market'], components: ['app/c/[club]/diensten/page.tsx'], limitation: 'Teamreserveringen nog niet aangesloten.'},
  'P02.F06': {commands: ['api.book_shift'], components: ['app/c/[club]/diensten/actions.ts'], limitation: 'Buddy/instructie-erkenning en volledige uitvoerderkeuze nog open.'},
  'P09.F03': {route: '/c/[club]/huishouden', read_models: ['api.get_household_dossier_v2'], components: ['app/c/[club]/huishouden/page.tsx', 'components/app/household-dossier.tsx'], limitation: 'Eigen of expliciet toegestaan dossier met vier tabs en seizoensstand; volledige beheerderszoekroute en beoordelingsflows nog open.', functional_evidence: 'docs/release/evidence/local/20261006-w02-dossier/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02-dossier/compare.html'},
  'P09.F04': {route: '/c/[club]/huishouden', read_models: ['api.get_household_dossier_v2'], components: ['components/app/household-dossier.tsx'], limitation: 'Minimale namen en actuele identiteitkoppeling binnen rechten; geen verificatietoggle. Bronverificatie en beheer van persoonskoppelingen nog open.', functional_evidence: 'docs/release/evidence/local/20261006-w02-dossier/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02-dossier/compare.html'},
  'P09.F05': {route: '/c/[club]/huishouden', read_models: ['api.household_invitation_delivery_v2', 'api.household_invitation_context'], commands: ['api.create_household_invitation_v2', 'api.mark_household_invitation_delivery_v2', 'api.accept_household_invitation_v2', 'api.cancel_household_invitation', 'Supabase Auth.admin.inviteUserByEmail'], components: ['app/c/[club]/huishouden/actions.ts', 'components/app/invite-executor-form.tsx', 'components/app/cancel-invitation-form.tsx', 'app/invite/accept/actions.ts'], limitation: 'Versioned aanmaak, acceptatie en intrekking, huidige identiteit, minimale context, verloren-response retries en races met acceptatie/intrekking/bevoegdheidsverlies lokaal bewezen. Bootstrap-API contract, grantbeheer, providerconcurrency en stagingketen blijven open.', functional_evidence: 'docs/release/evidence/local/20261006-w02-invitation-cancellation/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02-dossier/compare.html'},
  'P09.F12': {route: '/c/[club]/huishouden', read_models: ['api.get_household_dossier_v2'], components: ['components/app/household-dossier.tsx'], limitation: 'Alleen eigen of expliciet beoordeelbare dossieracties, zonder auditpayload. Volledige besluit-, correctie- en werkhistorie nog open.', functional_evidence: 'docs/release/evidence/local/20261006-w02-dossier/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02-dossier/compare.html'},
  'P23.F01': {read_models: ['api.my_intake', 'api.list_intake_contexts'], components: ['app/c/[club]/intake/page.tsx'], limitation: 'Eigen en expliciet gemachtigde contexten aangesloten; aanmaken/intrekken van de machtiging via beheerflow nog open.', functional_evidence: 'docs/release/evidence/local/20261006-w02/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02/compare.html'},
  'P23.F02': {commands: ['api.save_intake_revision'], components: ['components/app/intake-form.tsx'], limitation: 'Ervaring en maatjesvraag versioned opgeslagen; aanbod en buddykeuze volgen in W03/W06.', functional_evidence: 'docs/release/evidence/local/20261006-w02/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02/compare.html'},
  'P23.F03': {read_models: ['api.intake_task_categories'], commands: ['api.save_intake_revision'], components: ['components/app/intake-form.tsx'], limitation: 'Talenten, taak- en functievoorkeuren opgeslagen; adviezen en wervingsworkflow nog open.', functional_evidence: 'docs/release/evidence/local/20261006-w02/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02/compare.html'},
  'P23.F04': {commands: ['api.save_intake_revision'], components: ['components/app/intake-form.tsx', 'lib/domain/intake.mjs'], limitation: 'Weekvoorkeur, maandminuten, grenzen, verhinderdatums, leerwens en reserve opgeslagen; datums blokkeren nieuwe bookings. Advies, workload en reserve-opvolging nog open.', functional_evidence: 'docs/release/evidence/local/20261006-w02/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02/compare.html'},
  'P23.F05': {commands: ['api.save_intake_revision'], components: ['app/c/[club]/intake/actions.ts', 'components/app/intake-form.tsx'], limitation: 'Vier stappen en expliciete opslag met actor/subject/reason/version/idempotency/audit aangesloten; staging-acceptatie ontbreekt.', functional_evidence: 'docs/release/evidence/local/20261006-w02/verification.md', visual_evidence: 'docs/release/evidence/local/20261006-w02/compare.html'},
};

const functionIds = new Set(catalogue.pages.flatMap(({functions}) => functions.map(({id}) => id)));
if (catalogue.pages.length !== 24 || functionIds.size !== 219) throw new Error('CATALOGUE_INCOMPLETE');
const flows = relationships.flows ?? relationships.relationships ?? [];
for (const flow of flows) for (const id of flow.steps ?? []) if (!functionIds.has(id)) throw new Error(`UNKNOWN_FLOW_FUNCTION: ${id}`);
const acceptanceIds = new Set(acceptance.acceptance.map(({id}) => id));
const rows = catalogue.pages.flatMap((page) => page.functions.map((feature) => {
  for (const id of feature.page_acceptance_ids) if (!acceptanceIds.has(id)) throw new Error(`UNKNOWN_ACCEPTANCE: ${id}`);
  const connected = wiring[feature.id] ?? {};
  const route = connected.route ?? routes[page.id];
  return {
    function_id: feature.id, page_id: page.id, title: feature.title, route,
    route_present: existsSync(page.id === 'P00' ? 'app/c/[club]/layout.tsx' : `app/c/[club]/${route.split('/').at(-1)}/page.tsx`),
    read_models: connected.read_models ?? [], commands: connected.commands ?? [], components: connected.components ?? [],
    mandate: page.audience, relationships: feature.flows, related_pages: feature.related_pages,
    page_acceptance_ids: feature.page_acceptance_ids,
    limitation: connected.limitation ?? (Object.keys(connected).length ? 'Staging- en volledige functieacceptatie ontbreken.' : 'Geen actuele UI→command/read-model-keten vastgesteld.'),
    status: Object.keys(connected).length ? 'IMPLEMENTED_PARTIAL_NOT_ACCEPTED' : 'TO_BUILD_OR_VERIFY',
    functional_evidence: connected.functional_evidence ?? (Object.keys(connected).length ? 'docs/release/evidence/local/20261006-w01/verification.md (deelbewijs; geen functieacceptatie)' : null),
    visual_evidence: connected.visual_evidence ?? (Object.keys(connected).length ? 'docs/release/evidence/local/20261006-w01/visual-comparison.md (deelbewijs)' : null), staging_evidence: null,
  };
}));
const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const report = {
  base_sha: baseSha, source_head: head, worktree_dirty: !!execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim(),
  prototype_sha: catalogue.source_sha, acceptance_ready: false,
  counts: {pages: 23, shared_shells: 1, functions: rows.length, acceptance_criteria: acceptanceIds.size, baseline: counts(baselineMigrations), current: counts(migrations)},
  migrations,
  route_compatibility: {'/c/[club]/diensten': 'Bestaande markt behouden als compatibiliteitsroute. Canonieke markt: /taken. Persoonlijke taken: /mijn-taken, nog te bouwen.'},
  functions: rows,
};
mkdirSync('docs/release/function-coverage', {recursive: true});
writeFileSync('docs/release/function-coverage/function-matrix.json', `${JSON.stringify(report, null, 2)}\n`);
const columns = Object.keys(rows[0]);
const escape = (value) => `"${String(Array.isArray(value) ? value.join('; ') : value ?? '').replaceAll('"', '""')}"`;
writeFileSync('docs/release/function-coverage/function-matrix.csv', `${columns.join(',')}\n${rows.map((row) => columns.map((key) => escape(row[key])).join(',')).join('\n')}\n`);
console.log(JSON.stringify(report.counts));
