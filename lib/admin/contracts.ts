import {z} from 'zod';

const uuid=z.string().uuid();
const short=z.string().trim().min(1).max(150);
const reason=z.string().trim().min(3).max(1000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time=z.string().datetime({offset:true});
const nullableTime=time.nullable();
const nullableId=uuid.nullable();
const named={name:short,active:z.boolean(),reason};
export const clubAdminSchemas:Record<string,z.ZodTypeAny>={
 take_hour_dispute:z.object({reason}).strict(),resolve_hour_dispute:z.object({outcome:z.enum(['unchanged','corrected','rejected']),decision_id:nullableId,explicit_confirmation:z.literal(true),reason}).strict(),
 save_volunteer_role:z.object(named).strict(),revise_volunteer_role:z.object({household_exempt:z.boolean(),effective_from:date,effective_until:date.nullable(),conditions:z.string().trim().min(3).max(4000),explicit_confirmation:z.literal(true),reason}).strict().refine(v=>v.effective_until===null||v.effective_until>=v.effective_from),
 save_vacancy:z.object({title:short,description:z.string().trim().min(3).max(4000),role_version_id:uuid,committee_id:nullableId,team_id:nullableId,expected_minutes:z.number().int().min(0).max(100000),guidance:z.string().max(4000),contact_person_id:uuid,opens_at:nullableTime,closes_at:nullableTime,reason}).strict().refine(v=>!(v.committee_id&&v.team_id)&&(!v.closes_at||!!v.opens_at&&Date.parse(v.closes_at)>Date.parse(v.opens_at))),set_vacancy_state:z.object({state:z.enum(['published','closed']),explicit_confirmation:z.literal(true),reason}).strict(),
 follow_vacancy_interest:z.object({state:z.enum(['contacted','meeting','rejected']),reason}).strict(),
 recognize_vacancy_appointment:z.object({obligation_id:uuid,expected_obligation_version:z.number().int().min(1),starts_on:date,ends_on:date.nullable(),explicit_confirmation:z.literal(true),reason}).strict(),
 confirm_attendance:z.object({result:z.enum(['present','partial','no_show','club_cancelled']),awarded_minutes:z.number().int().min(0).max(1440),explicit_confirmation:z.literal(true),reason}).strict(),correct_attendance_award:z.object({result:z.enum(['present','partial','no_show','club_cancelled']),awarded_minutes:z.number().int().min(0).max(1440),explicit_confirmation:z.literal(true),reason}).strict(),
 save_template_draft:z.object({template_key:z.string().regex(/^[a-z][a-z0-9_.-]*$/).max(100),name:short,committee_id:nullableId,subject:z.string().trim().min(1).max(200),preheader:z.string().max(300),sender_name:short,reply_to:z.union([z.string().email(),z.literal('')]),text_body:z.string().min(1).max(10000),button_label:z.string().max(100),image_path:z.union([z.string().regex(/^\/brand\/[a-zA-Z0-9/_-]+\.(png|svg|webp)$/),z.literal('')]),reason}).strict(),
 preview_template:z.object({revision_id:uuid,scenario:z.enum(['standard','missing_name','long_title','two_children','no_hours','represented']),reason}).strict(),
 queue_template_test:z.object({revision_id:uuid,scenario:z.enum(['standard','missing_name','long_title','two_children','no_hours','represented']),explicit_confirmation:z.literal(true),reason}).strict(),
 approve_template:z.object({revision_id:uuid,explicit_confirmation:z.literal(true),reason}).strict(),publish_template:z.object({revision_id:uuid,explicit_confirmation:z.literal(true),reason}).strict(),
 prepare_assessment:z.object({route:z.enum(['shortage','buyout']),exception_decision_id:nullableId,supply_assessment_id:nullableId,reason}).strict(),
 approve_assessment:z.object({reason}).strict(),finalize_assessment:z.object({processing_kind:z.enum(['invoice','controlled_export']),reason}).strict(),
 review_exception:z.object({outcome:z.enum(['approve','reject','escalate']),has_conflict:z.boolean(),reason}).strict(),
 finalize_exception:z.object({outcome:z.enum(['approved','rejected','escalated']),financial_route:z.enum(['none','buyout','shortage']),reason}).strict(),
 close_season:z.object({explicit_confirmation:z.literal(true),reason}).strict(),
 rollover_season:z.object({source_season_id:uuid,selected_template_keys:z.array(z.string().regex(/^[a-z][a-z0-9_-]*$/).max(100)).max(50),explicit_confirmation:z.literal(true),reason}).strict(),
 post_fund_entry:z.object({entry_kind:z.enum(['receipt','reserve','release','spend_reserved','spend_direct','correction']),amount_cents:z.number().int().min(1).max(100000000),reservation_key:nullableId,processing_record_id:nullableId,reverses_entry_id:nullableId,purpose:z.string().trim().min(3).max(1000),owner_person_id:nullableId,reason}).strict(),
 save_organization:z.object({name:short,contact_name:short,contact_email:z.string().email().max(254),contact_phone:z.string().trim().max(40),logo_path:z.string().max(33000).refine(v=>/^\/brand\/[a-zA-Z0-9/_-]+\.(png|svg|webp)$/.test(v)||/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(v)),primary_color:z.string().regex(/^#[0-9a-fA-F]{6}$/),reason}).strict(),
 save_committee_contact:z.object({contact_name:z.string().trim().max(150),contact_email:z.union([z.string().email().max(254),z.literal('')]),contact_phone:z.string().trim().max(40),reason}).strict(),
 add_committee_member:z.object({committee_id:uuid,person_id:uuid,duty:short,reason}).strict(),end_committee_member:z.object({reason}).strict(),
 save_location:z.object(named).strict(),save_committee:z.object({...named,slug:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80)}).strict(),save_team:z.object(named).strict(),
 save_person:z.object({given_name:short,family_name:short,status:z.enum(['active','inactive','archived']),membership_started_on:date.nullable(),reason}).strict(),
 save_household:z.object({label:short,separated_parents:z.boolean(),reason}).strict(),
 link_household_person:z.object({household_id:uuid,person_id:uuid,kind:z.enum(['member','parent','guardian','executor']),reason}).strict(),
 add_team_member:z.object({team_id:uuid,person_id:uuid,membership_kind:z.enum(['player','coach','staff']),reason}).strict(),end_team_member:z.object({reason}).strict(),
 invite_access:z.object({auth_user_id:uuid,role_id:uuid,scope_kind:z.enum(['tenant','committee','household']),scope_id:nullableId,ends_at:time,expires_at:time,reason}).strict(),cancel_access_invitation:z.object({reason}).strict(),
 grant_access:z.object({auth_user_id:uuid,role_id:uuid,scope_kind:z.enum(['tenant','committee','team','household']),scope_id:nullableId,ends_at:time,reason}).strict(),revoke_access:z.object({reason}).strict(),
 consent_support:z.object({approved:z.boolean(),reason}).strict(),end_support:z.object({reason}).strict(),
 save_category:z.object({committee_id:uuid,name:short,minimum_positions:z.number().int().min(1).max(30),reason}).strict(),
 save_task_type:z.object({category_id:uuid,name:short,active:z.boolean(),reason}).strict(),revise_task_type:z.object({credit_minutes:z.number().int().min(0).max(1440),cancellation_minutes_override:z.number().int().min(0).max(44640).nullable(),reason}).strict(),
 save_course:z.object({title:short,description:z.string().max(4000),active:z.boolean(),reason}).strict(),save_qualification_type:z.object(named).strict(),
 save_course_session:z.object({course_id:uuid,starts_at:time,ends_at:time,capacity:z.number().int().min(1).max(1000),qualification_type_id:nullableId,qualification_valid_until:nullableTime,reason}).strict().refine(v=>Date.parse(v.ends_at)>Date.parse(v.starts_at)),
 register_qualification:z.object({person_id:uuid,qualification_type_id:uuid,achieved_at:time,expires_at:nullableTime,explicit_confirmation:z.literal(true),reason}).strict(),revoke_qualification:z.object({explicit_confirmation:z.literal(true),reason}).strict(),
 certify_enrollment:z.object({achieved_at:time,expires_at:nullableTime,reason}).strict(),
 save_policy_draft:z.object({document_key:z.string().regex(/^[a-z][a-z0-9_-]*$/).max(100),title:short,owner_committee_id:nullableId,exact_body:z.string().min(1).max(32000),effective_at:nullableTime,response_due_at:nullableTime,reacceptance_required:z.boolean(),reason}).strict(),
 publish_policy:z.object({revision_id:uuid,person_ids:z.array(uuid).min(1).max(200),explicit_confirmation:z.literal(true),reason}).strict(),
 save_season:z.object({name:short,starts_on:date,ends_on:date,winter_cutoff_at:time,target_minutes:z.number().int().min(0).max(100000),winter_target_minutes:z.number().int().min(0).max(100000),status:z.enum(['preparing','active']),reason}).strict().refine(v=>v.ends_on>v.starts_on&&v.winter_target_minutes<=v.target_minutes),
 save_settings:z.object({effective_from:time,cancellation_minutes:z.number().int().min(0).max(44640),confirmation_days:z.number().int().min(1).max(365),dispute_days:z.number().int().min(1).max(365),reason}).strict(),
};
export const platformPermissions=['platform.overview','platform.tenant.read','platform.tenant.manage','platform.access.manage','platform.config.manage','platform.integration.manage','platform.support','platform.audit.read'] as const;
export const platformSchemas:Record<string,z.ZodTypeAny>={
 retry_delivery:z.object({explicit_confirmation:z.literal(true),reason}).strict(),
 invite_administrator:z.object({tenant_id:uuid,auth_user_id:uuid,given_name:short,family_name:short,permission_keys:z.array(z.string().min(1).max(100)).min(2).max(60),ends_at:time,expires_at:time,explicit_confirmation:z.literal(true),reason}).strict(),cancel_administrator_invitation:z.object({tenant_id:uuid,reason}).strict(),
 onboard_administrator:z.object({tenant_id:uuid,auth_user_id:uuid,given_name:short,family_name:short,permission_keys:z.array(z.string().min(1).max(100)).min(2).max(60),ends_at:time,explicit_confirmation:z.literal(true),reason}).strict(),
 onboard_season:z.object({tenant_id:uuid,name:short,starts_on:date,ends_on:date,winter_cutoff_at:time,target_minutes:z.number().int().min(0).max(100000),winter_target_minutes:z.number().int().min(0).max(100000),reason}).strict().refine(v=>v.ends_on>v.starts_on&&v.winter_target_minutes<=v.target_minutes),
 create_tenant:z.object({slug:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80),name:short,contact_name:z.string().trim().max(150),contact_email:z.union([z.string().email().max(254),z.literal('')]),reason}).strict(),
 update_tenant:z.object({name:short,contact_name:z.string().trim().max(150),contact_email:z.union([z.string().email().max(254),z.literal('')]),reason}).strict(),
 set_tenant_status:z.object({status:z.enum(['preparing','active','suspended','archived']),impact_hash:z.string().regex(/^[a-f0-9]{64}$/),reason}).strict(),
 grant_staff:z.object({auth_user_id:uuid,display_name:short,permission_key:z.enum(platformPermissions),tenant_scope_id:nullableId,ends_at:time,reason}).strict(),revoke_staff:z.object({reason}).strict(),
 set_module:z.object({tenant_id:uuid,module_key:z.enum(['planning','teams','courses','policies','communication','sportlink','reporting']),enabled:z.boolean(),reason}).strict(),
 save_default:z.object({setting_key:z.enum(['organization','planning','communication','template']),value:z.record(z.unknown()),reason}).strict(),
 request_support:z.object({tenant_id:uuid,permission_keys:z.array(z.enum(['organization.manage','shift.view','shift.manage','attendance.confirm','committee.workspace.view','committee.workspace.manage','match.import'])).min(1).max(7),scope_kind:z.enum(['tenant','committee']),scope_id:nullableId,ends_at:time,purpose:z.string().trim().min(10).max(1000),reason}).strict(),revoke_support:z.object({reason}).strict(),
};
export type AdminRow=Record<string,unknown>;
export type AdminPermission={key:string;kind:string;scope_id:string|null};
export type ClubAdminAccess={authorized:true;tenant_id:string;slug:string;name:string;timezone:string;status:string;version:number;permissions:AdminPermission[];seasons:AdminRow[];support:AdminRow[];branding?:Record<string,unknown>;modules?:Record<string,boolean>};
export type AdminRead={section:string;tenant_id:string|null;season_id?:string|null;observed_at:string;source:string;rows:AdminRow[]|AdminRow;extras?:AdminRow;access?:unknown};
export type AdminCommand={surface:'club'|'platform';club?:string;action:string;resourceId:string;version:number;key:string;payload:Record<string,unknown>};
export type AdminResult={status:'confirmed'|'rejected'|'unknown';message:string;key:string};
export const rows=(value:unknown):AdminRow[]=>Array.isArray(value)?value.filter((v):v is AdminRow=>v!==null&&typeof v==='object'&&!Array.isArray(v)):[];
export const str=(v:unknown)=>typeof v==='string'?v:'';
export const num=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)?v:0;
export const clubSections=[
 ['cockpit','Overzicht','OVERZICHT'],['organization','Vereniging','ORGANISATIE'],['people','Personen en huishoudens','ORGANISATIE'],['access','Rollen en toegang','ORGANISATIE'],['committees','Commissies','ORGANISATIE'],['teams','Teams','ORGANISATIE'],
 ['planning','Planning en verdeling','VRIJWILLIGERSWERKING'],['execution','Uitvoering','VRIJWILLIGERSWERKING'],['requests','Aanvragen','VRIJWILLIGERSWERKING'],['policies','Beleid en instructies','VRIJWILLIGERSWERKING'],['courses','Opleidingen','VRIJWILLIGERSWERKING'],['communication','Communicatie','VRIJWILLIGERSWERKING'],
 ['reports','Rapportages','INZICHT'],['finance','Financiële besluiten','INZICHT'],['seasons','Seizoenen','INZICHT'],['support','Ondersteuning en audit','INZICHT'],
] as const;
const sectionPermissions:Record<string,string[]>={organization:['organization.manage'],people:['organization.manage','household.review'],access:['organization.access.manage'],committees:['organization.manage','committee.workspace.manage','shift.manage'],teams:['organization.manage','team_task.manage'],planning:['shift.manage','team_task.manage','club_cluster.manage'],execution:['attendance.confirm'],requests:['household.review','exception.review','exception.finalize','team_task.manage','team_task.market.approve','team_task.market.publish','match.review','hour_dispute.review','vacancy.manage','volunteer_role.manage'],policies:['policy.manage'],courses:['development.manage'],communication:['communication.manage'],reports:['report.season.view'],finance:['finance.assessment.view','finance.assessment.prepare','finance.assessment.approve','finance.assessment.finalize','finance.fund.manage'],seasons:['organization.manage','season.close','season.rollover'],support:['organization.access.manage']};
export function clubSectionAllowed(access:ClubAdminAccess,section:string){return (section!=='reports'||access.modules?.reporting!==false)&&(section==='cockpit'||access.permissions.some(p=>sectionPermissions[section]?.includes(p.key)));}
export const platformSections=[['overview','Platformoverzicht','PLATFORM'],['tenants','Verenigingen','PLATFORM'],['staff','Medewerkers en toegang','BEHEER'],['defaults','Standaardinstellingen','BEHEER'],['integrations','Integraties en verzending','BEHEER'],['support','Ondersteuning','BEHEER'],['audit','Platformaudit','BEHEER']] as const;
export const platformSectionPermission:Record<string,string>={overview:'platform.overview',tenants:'platform.tenant.read',staff:'platform.access.manage',defaults:'platform.config.manage',integrations:'platform.integration.manage',support:'platform.support',audit:'platform.audit.read'};

const adminPermissionLabels:Record<string,string>={
 'organization.manage':'Verenigingsgegevens beheren','organization.access.manage':'Benoemde rollen en toegang beheren',
 'shift.view':'Verenigingstaken bekijken','shift.book':'Verenigingstaken boeken','shift.manage':'Verenigingstaken plannen',
 'attendance.confirm':'Uitvoering bevestigen en corrigeren','club_cluster.manage':'Vrije plaatsen voor teams clusteren',
 'committee.workspace.view':'Benoemde commissiewerkruimte bekijken','committee.workspace.manage':'Benoemde commissiewerkruimte beheren',
 'team_task.view':'Benoemde teamtaken bekijken','team_task.manage':'Benoemde teamtaken beheren','team_task.market.approve':'Aanvragen voor teamtaakminuten beoordelen','team_task.market.publish':'Goedgekeurde teamtaken publiceren',
 'household.view':'Geautoriseerde huishoudgegevens bekijken','household.progress.view':'Geautoriseerde huishoudvoortgang bekijken','household.invite_executor':'Benoemde uitvoerders uitnodigen',
 'household.review':'Geautoriseerde huishoudvragen beoordelen','obligation.review':'Verplichtingsafspraken beoordelen',
 'exception.review':'Uitzonderingsaanvragen beoordelen','exception.finalize':'Bevoegde uitzonderingsbesluiten afronden',
 'policy.manage':'Beleid en instructies beheren','policy.follow_up':'Beleidsacties opvolgen','development.manage':'Opleidingen en kwalificaties beheren',
 'communication.manage':'Geautoriseerde communicatie beheren','report.season.view':'Geautoriseerde seizoensrapporten bekijken',
 'season.close':'Seizoenssluiting uitvoeren','season.rollover':'Seizoensovergang uitvoeren',
 'match.view':'Wedstrijden bekijken','match.import':'Sportlink-koppeling en wedstrijdimport beheren','match.review':'Wedstrijdzaken beoordelen',
 'finance.assessment.view':'Financiële beoordelingen bekijken','finance.assessment.prepare':'Financiële voorstellen voorbereiden',
 'finance.assessment.approve':'Financiële voorstellen bevoegd goedkeuren','finance.assessment.finalize':'Goedgekeurde financiële besluiten verwerken','finance.fund.manage':'Vrijwilligerspot beheren',
 'vacancy.manage':'Vacatures en benoemde belangstelling opvolgen','volunteer_role.manage':'Vrijwilligersfuncties beheren','hour_dispute.review':'Uurvragen beoordelen',
};
export const adminPermissionLabel=(key:string)=>adminPermissionLabels[key]??key;
