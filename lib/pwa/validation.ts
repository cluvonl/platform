import {z} from 'zod';

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(4000);
const short = z.string().trim().min(1).max(200);
const timestamp = z.union([z.string().datetime({offset: true}),z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)]);
const ids = z.array(uuid).min(1).max(100).refine((values) => new Set(values).size === values.length);
const empty = z.object({}).strict();
const attendance = z.object({result:z.enum(['present','partial','no_show']),awarded_minutes:z.number().int().min(0).max(100000),reason:z.string().trim().max(4000).default(''),no_show_ack:z.boolean().optional()}).strict().refine(value=>(value.result==='partial'?value.reason.length>0:value.reason.length===0)&&(value.result!=='no_show'||value.no_show_ack===true&&value.awarded_minutes===0));
const acknowledgement = {executor_person_id:uuid, obligation_id:uuid, instruction_version_id:uuid,
  instructions_ack:z.literal(true), cancellation_ack:z.literal(true), member_person_id:uuid.optional(),
  extra_voluntary_ack:z.boolean().optional(),buddy_booking_id:uuid.optional(),buddy_expected_version:z.number().int().positive().optional()};
const buddyPair=(value:{buddy_booking_id?:string;buddy_expected_version?:number})=>(value.buddy_booking_id===undefined)===(value.buddy_expected_version===undefined);
export const mobilePayloadSchemas: Record<string, z.ZodTypeAny> = {
  book_shift:z.object({...acknowledgement, shift_id:uuid}).strict().refine(buddyPair),
  accept_transfer:z.object(acknowledgement).strict().refine(buddyPair),
  set_team_goal:z.object({season_id:uuid, member_person_id:uuid.optional(), goal:z.number().int().min(0).max(100),reason:z.string().trim().max(4000).optional()}).strict(),
  reserve_cluster:z.object({season_id:uuid,title:short,mode:z.enum(['self','assign']),position_ids:ids,self_until:timestamp,assign_until:timestamp,counts_for_team:z.boolean()}).strict(),
  assign_member:z.object({member_person_id:uuid}).strict(),
  set_followup:z.object({self_until:timestamp,assign_until:timestamp}).strict(),
  request_reserve:z.object({person_ids:z.array(uuid).min(1).max(20).refine((values)=>new Set(values).size===values.length)}).strict(),
  prepare_handover:z.object({season_id:uuid,successor_person_id:uuid,note:text,checks:z.array(z.literal(true)).length(5)}).strict(),
  save_handover_draft:z.object({season_id:uuid,successor_person_id:uuid,note:text,checks:z.array(z.boolean()).length(5)}).strict(),
  accept_handover:empty,revoke_handover:empty,
  save_feedback:z.object({repeat:z.boolean(),instruction_clarity:z.boolean(),tip:z.string().trim().max(2000)}).strict(),
  prepare_booking:z.object({prepared:z.literal(true)}).strict(),
  ask_question:z.object({subject:short,body:text.max(2000),booking_id:uuid.optional()}).strict(),
  answer_question:z.object({answer:text}).strict(),take_question:empty,
  create_channel:z.object({scope:z.enum(['team','committee']),title:short}).strict(),
  send_message:z.object({body:text}).strict(),
  mark_inbox_read:empty,mark_all_inbox_read:empty,
  save_preferences:z.object({email:z.boolean(),reminders:z.boolean(),team:z.boolean(),news:z.boolean(),push:z.boolean(),inbox:z.boolean()}).strict(),
  dismiss_help:z.object({topic_id:z.string().regex(/^pwa\.[a-z-]{1,30}$/),topic_version:z.literal(1)}).strict(),
  reset_help:empty,enroll_course:empty,withdraw_course:empty,
  rsvp_event:z.object({rsvp:z.enum(['accepted','declined','tentative'])}).strict(),
  create_card:z.object({title:short,description:z.string().trim().max(4000),column_id:uuid,due_at:timestamp.nullable().optional(),assignee_person_ids:z.array(uuid).max(50).optional()}).strict(),
  update_card:z.object({column_id:uuid,status:z.enum(['open','completed','archived']),due_at:timestamp.nullable().optional(),assignee_person_ids:z.array(uuid).max(50).optional()}).strict(),
  check_card_item:z.object({completed:z.boolean()}).strict(),reply_card:z.object({body:text}).strict(),
  publish_instructions:z.object({body:text,propagate_to:z.array(z.object({shift_id:uuid,expected_version:z.number().int().positive()}).strict()).max(50).optional()}).strict(),
  open_transfer:z.object({expires_at:timestamp,reason:text}).strict(),report_obstruction:z.object({reason:text}).strict(),
  create_team_task:z.object({season_id:uuid,title:short,starts_at:timestamp,ends_at:timestamp,task_type_version_id:uuid,counts_for_team:z.boolean(),capacity:z.number().int().min(1).max(30),repeat_count:z.union([z.literal(1),z.literal(4),z.literal(8)]),instructions:text,requested_minutes:z.number().int().min(0).max(1440),match_id:uuid.nullable().optional(),referee_needed:z.boolean()}).strict(),
  create_club_task:z.object({season_id:uuid,title:short,starts_at:timestamp,ends_at:timestamp,task_type_version_id:uuid,capacity:z.number().int().min(1).max(30),repeat_count:z.union([z.literal(1),z.literal(4),z.literal(8)]),instructions:text,minimum_age:z.number().int().min(0).max(100).nullable(),qualification_type_id:uuid.nullable(),min_qualified_count:z.number().int().min(0).max(30),buddy_allowed:z.boolean(),distribution_mode:z.enum(['public','self','assign']).optional(),receiving_team_id:uuid.optional(),receiving_team_expected_version:z.number().int().positive().optional(),self_until:timestamp.optional(),assign_until:timestamp.optional(),counts_for_team:z.boolean().optional()}).strict().refine(value=>!value.distribution_mode||value.distribution_mode==='public'||!!(value.receiving_team_id&&value.receiving_team_expected_version&&value.self_until&&value.assign_until)),
  review_team_credit:z.object({review_kind:z.enum(['match','volunteer']),outcome:z.enum(['approved','rejected']),approved_minutes:z.number().int().min(0).max(1440).nullable(),reason:text}).strict(),
  publish_team_credit:empty,
  save_push_subscription:z.object({endpoint:z.string().url().max(2000).refine((value) => {
    const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!url.port
      && ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname);
  }),p256dh:z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),auth_secret:z.string().regex(/^[A-Za-z0-9_-]{20,30}$/)}).strict(),
  revoke_push_subscription:z.object({endpoint:z.string().url().max(2000)}).strict(),
  cancel_booking:z.object({reason_kind:z.enum(['regular','sickness','emergency']),description:text}).strict(),
  confirm_attendance:attendance,
  confirm_attendance_batch:z.object({entries:z.array(z.object({booking_id:uuid,expected_version:z.number().int().positive(),result:z.enum(['present','partial','no_show']),awarded_minutes:z.number().int().min(0).max(100000),reason:z.string().trim().max(4000).default(''),no_show_ack:z.boolean().optional()}).strict()).min(1).max(50).refine(values=>new Set(values.map(value=>value.booking_id)).size===values.length&&values.every(value=>attendance.safeParse({result:value.result,awarded_minutes:value.awarded_minutes,reason:value.reason,no_show_ack:value.no_show_ack}).success))}).strict(),
  join_waitlist:z.object({executor_person_id:uuid,obligation_id:uuid,buddy_booking_id:uuid.optional(),buddy_expected_version:z.number().int().positive().optional()}).strict().refine(buddyPair),
  express_interest:z.object({motivation:z.string().trim().max(4000)}).strict(),
  apply_distribution:z.object({assignments:z.array(z.object({allocation_id:uuid,expected_version:z.number().int().positive(),member_person_id:uuid}).strict()).min(1).max(100)}).strict(),
  open_policy:z.object({assignment_ids:z.array(uuid).min(1).max(50).refine((values)=>new Set(values).size===values.length),expected_versions:z.array(z.number().int().positive()).min(1).max(50)}).strict().refine((value)=>value.assignment_ids.length===value.expected_versions.length),
  accept_policy:z.object({assignment_ids:z.array(uuid).min(1).max(50).refine((values)=>new Set(values).size===values.length),expected_versions:z.array(z.number().int().positive()).min(1).max(50),capacity:z.enum(['self','guardian']),explicit_confirmation:z.literal(true)}).strict().refine((value)=>value.assignment_ids.length===value.expected_versions.length),
  start_profile:empty,
  save_club_contact:z.object({name:short,email:z.string().trim().email().max(254),phone:z.string().trim().max(40)}).strict(),
  save_profile:z.object({experience:z.string().max(2000),preferences:z.array(z.string().max(200)).max(60),talents:z.array(z.string().max(200)).max(60),availability:z.array(z.string().max(200)).max(60),monthly_minutes:z.number().int().min(0).max(44640),boundaries:z.string().max(2000),reserve:z.boolean(),buddy:z.boolean()}).strict(),
  invite_executor:z.object({given_name:z.string().trim().min(1).max(100),family_name:z.string().trim().min(1).max(150),email:z.string().trim().email().max(254),can_view_progress:z.boolean(),can_book_for:z.boolean()}).strict(),
};
export const mobileCommandSchema = z.object({club:z.string().min(1).max(80),command:z.string().min(1).max(60),
  resourceId:uuid.optional(), idempotencyKey:uuid,expectedVersion:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  payload:z.record(z.unknown()),
}).strict();
