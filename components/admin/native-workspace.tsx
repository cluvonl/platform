'use client';
import {useState} from 'react';
import {ManagePage,MessagesPage,CommitteesPage} from '@/components/mobile/club';
import {TeamsPage} from '@/components/mobile/teams';
import {AttendanceBatchForm} from '@/components/mobile/attendance-form';
import {InstructionsForm} from '@/components/mobile/instructions-form';
import {CommandForm} from '@/components/mobile/command-form';
import {TaskDetail} from '@/components/mobile/task-detail';
import {ContextSelection} from '@/components/mobile/context-selection';
import {Panel} from '@/components/cluvo/ui';
import type {MobileSnapshot} from '@/components/mobile/types';
export function NativeAdminWorkspace({section,snapshot,resourceId}:{section:string;snapshot:MobileSnapshot;resourceId?:string}){
 const [tab,setTab]=useState(resourceId&&snapshot.teamCreditRequests?.some(r=>r.id===resourceId)?'team':'overview');
 return <div className="cluvo-mobile admin-native"><ContextSelection snapshot={snapshot}/>{section==='planning'&&<ManagePage snapshot={snapshot}/>} {section==='teams'&&<TeamsPage snapshot={snapshot} initialTeamId={resourceId}/>} {section==='execution'&&<AttendanceBatchForm snapshot={snapshot} bookings={snapshot.bookings.filter(b=>b.canConfirm&&(!resourceId||b.taskId===resourceId))}/>} {section==='committees'&&<CommitteesPage snapshot={snapshot} initialCommitteeId={resourceId}/>} {section==='communication'&&<MessagesPage snapshot={snapshot}/>} {section==='policies'&&<Panel title="Instructies en feedback op bestaande taken">{snapshot.feedback.filter(f=>f.canImprove).map(f=>{const task=snapshot.tasks.find(t=>t.id===f.taskId);return <article key={f.id}><h3>{f.taskTitle}</h3><p>{f.text}</p>{task&&<InstructionsForm snapshot={snapshot} task={task}/>}</article>;})}</Panel>}
 {section==='requests'&&<><nav className="admin-tabs" aria-label="Aanvragen"><button type="button" aria-pressed={tab==='overview'} onClick={()=>setTab('overview')}>Huishoudvragen</button><button type="button" aria-pressed={tab==='team'} onClick={()=>setTab('team')}>Teamtaakminuten</button></nav>{tab==='team'?<ManagePage snapshot={snapshot} initialTab="requests"/>:<Panel title="Vragen en opvolging">{snapshot.questions.filter(q=>q.canReview&&(!resourceId||q.id===resourceId)).map(q=><article className="admin-details" key={q.id}><h3>{q.subject}</h3><p>{q.text}</p>{q.state==='open'&&<CommandForm snapshot={snapshot} command="take_question" resourceId={q.id} version={q.version} fields={[]} submit="Ik pak deze vraag op"/>}{q.state==='in_progress'&&<CommandForm snapshot={snapshot} command="answer_question" resourceId={q.id} version={q.version} fields={[{name:'answer',label:'Terugkoppeling',type:'textarea',required:true}]} submit="Vraag beantwoorden"/>}{q.answer&&<p>{q.answer}</p>}</article>)}</Panel>}</>}
 <TaskDetail snapshot={snapshot}/></div>;
}
