import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';
import {loadIntakeReconfirmations} from '@/lib/data/intake-reconfirmation';
import {ReconfirmIntakeForm} from '@/components/app/reconfirm-intake-form';
import {Empty, Hint, PageTitle, Panel} from '@/components/cluvo/ui';
import {intakeHoursFromMinutes} from '@/lib/domain/intake.mjs';

const display = (value: unknown, fallback = 'Niet opgegeven') => Array.isArray(value) ? value.join(', ') || fallback : typeof value === 'string' ? value || fallback : fallback;
export default async function ReconfirmIntakePage({params, searchParams}: {
  params: Promise<{club:string}>; searchParams: Promise<{profile?:string; item?:string}>;
}) {
  const [{club}, query] = await Promise.all([params,searchParams]);
  const {client, workspace} = await requireWorkspace(club);
  const profileId = z.string().uuid().safeParse(query.profile), itemId = z.string().uuid().safeParse(query.item);
  const unavailable = <Empty title="Herbevestiging niet beschikbaar" text="Open een seizoensaanvraag bij je eigen of expliciet gemachtigde intake." />;
  if (!profileId.success || !itemId.success) return unavailable;
  const {data:items,error} = await loadIntakeReconfirmations(client,workspace.tenant_id,profileId.data);
  const item = items.find(({item_id})=>item_id===itemId.data);
  if (error || !item) return unavailable;
  const {data:contexts,error:contextError} = await client.schema('api').rpc('list_intake_contexts',{p_tenant_id:workspace.tenant_id});
  const subject = (contexts as Array<{profile_id:string;display_name:string}> | null)?.find(({profile_id})=>profile_id===item.profile_id);
  if (contextError || !subject) return unavailable;
  const {data:profile,error:profileError} = await client.schema('api').from('my_intake').select('answers,desired_minutes')
    .eq('tenant_id',workspace.tenant_id).eq('profile_id',item.profile_id).eq('version',item.profile_version).maybeSingle();
  if (profileError || !profile) return unavailable;
  const answers = (profile.answers ?? {}) as Record<string,unknown>;
  const fields = {'Praktische ervaring':display(answers.experience),'Voorkeuren':display(answers.preferences),'Talenten':display(answers.skills),
    'Vaste functie':display(answers.fixed_role_interest),'Beschikbaarheid':display(answers.availability),
    'Gewenste maandinzet':typeof answers.desired_monthly_minutes==='number'?`${intakeHoursFromMinutes(answers.desired_monthly_minutes)} uur`:'Niet opgegeven',
    'Eerder opgegeven seizoenswens':typeof profile.desired_minutes==='number'?`${intakeHoursFromMinutes(profile.desired_minutes)} uur`:'Niet opgegeven',
    'Praktische grenzen':display(answers.practical_limitations),'Verhinderde datums':display(answers.unavailability),
    'Leerwensen':display(answers.training_needs),'Maatje':answers.buddy_requested===true?'Graag':'Niet gevraagd',
    'Reservepool':answers.reserve_willing===true?'Ja, je mag mij benaderen':'Nee'};
  return <div className="page-enter stack">
    <PageTitle eyebrow="PERSOONLIJKE INTAKE" title="Past je intake nog bij je?" description={item.state==='confirmed'?`Je hebt de intake eerder bevestigd voor ${item.season_name}. Hieronder staan je huidige opgeslagen antwoorden.`:`Controleer de opgeslagen antwoorden voor ${item.season_name}.`} />
    <Panel><div className="stack">
      <Hint>{item.is_self?`Dit zijn jouw persoonlijke antwoorden, ${subject.display_name}.`:`Je helpt ${subject.display_name} met een expliciete machtiging; jouw account en de persoon namens wie je bevestigt worden vastgelegd.`} Herbevestiging geeft geen nieuwe rechten, vrijstelling of uren.</Hint>
      <div className="detail-meta">{Object.entries(fields).map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
      <ReconfirmIntakeForm key={item.item_id} club={club} item={item} idempotencyKey={randomUUID()} />
    </div></Panel>
  </div>;
}
