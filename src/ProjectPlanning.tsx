import {useEffect, useState, type FormEvent} from 'react';
import {api} from './api';
import {toast} from 'sonner';
import {Coins, Clock3, Users} from 'lucide-react';

type Row = Record<string,unknown> & {id:number};
type Project = Row & {members:Row[]};

export function ProjectPlanning({projectId,people,lead,onUpdated}:{projectId:number;people:Row[];lead:boolean;onUpdated:()=>Promise<void>}) {
  const [project,setProject]=useState<Project|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [tab,setTab]=useState<'planning'|'members'>('planning');
  async function load(){setProject(await api<Project>(`/projects/${projectId}`));}
  useEffect(()=>{let current=true;setProject(null);api<Project>(`/projects/${projectId}`).then(p=>{if(current)setProject(p);}).catch(e=>{if(current)setError((e as Error).message);});return()=>{current=false;};},[projectId]);
  async function submit(event:FormEvent<HTMLFormElement>,path:string,method:string){
    event.preventDefault();const body:Record<string,unknown>=Object.fromEntries(new FormData(event.currentTarget));
    for(const key of ['owner_id','user_id','estimate_minutes'])if(key in body)body[key]=body[key]===''?null:Number(body[key]);
    for(const key of ['planned_date','release_date','start_date','end_date','cost'])if(body[key]==='')body[key]=null;
    if('active' in body)body.active=body.active==='true';
    setBusy(true);setError('');
    try{await api(path,method,body);toast.success(method==='PATCH'?'Project updated':'Member allocation updated');await load();await onUpdated();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(!project)return <p role="status">{error || 'Loading project…'}</p>;
  const activePeople=people.filter(p=>p.active);
  return <div>{error&&<p className="error" role="alert">{error}</p>}<div className="project-summary-stats"><span><Coins size={16}/><small>Planned budget</small><strong>{project.cost==null?'Not set':`${Number(project.cost).toLocaleString()} ${String(project.currency)}`}</strong></span><span><Clock3 size={16}/><small>Time estimate</small><strong>{project.estimate_minutes==null?'Not set':`${Math.floor(Number(project.estimate_minutes)/60)}h ${Number(project.estimate_minutes)%60}m`}</strong></span><span><Users size={16}/><small>Active members</small><strong>{project.members.filter(m=>m.active).length}</strong></span></div><div className="view-tabs detail-tabs" aria-label="Project sections"><button className={tab==='planning'?'active':''} aria-pressed={tab==='planning'} onClick={()=>setTab('planning')}>Planning & details</button><button className={tab==='members'?'active':''} aria-pressed={tab==='members'} onClick={()=>setTab('members')}>Members & allocation <span className="label-chip">{project.members.length}</span></button></div>{tab==='planning'&&<><h3>Project planning</h3>
    {lead?<form className="create-form" key={`project-${project.id}`} onSubmit={e=>void submit(e,`/projects/${projectId}`,'PATCH')}>
      <label>Name<input name="name" required defaultValue={String(project.name)}/></label>
      <label>Description<textarea name="description" defaultValue={String(project.description||'')}/></label>
      <label>Project owner<select name="owner_id" defaultValue={String(project.owner_id||'')}><option value="">Unassigned</option>{activePeople.map(p=><option key={p.id} value={p.id}>{String(p.name)}</option>)}</select></label>
      <label>Planned cost<input type="number" name="cost" min="0" step="0.01" defaultValue={String(project.cost??'')}/></label>
      <label>Currency<input name="currency" pattern="[A-Z]{3}" maxLength={3} required defaultValue={String(project.currency||'INR')}/></label>
      <label>Estimate (minutes)<input type="number" name="estimate_minutes" min="0" defaultValue={String(project.estimate_minutes??'')}/></label>
      <label>Planned date<input type="date" name="planned_date" defaultValue={String(project.planned_date||'')}/></label>
      <label>Release date<input type="date" name="release_date" defaultValue={String(project.release_date||'')}/></label>
      <button disabled={busy}>Save project</button>
    </form>:<p>Owner: {String(people.find(p=>p.id===project.owner_id)?.name||'Unassigned')} · Planned cost: {String(project.cost??'—')} {String(project.currency)} · Estimate: {String(project.estimate_minutes??'—')} minutes · Planned: {String(project.planned_date||'—')} · Release: {String(project.release_date||'—')}</p>}
    </>}{tab==='members'&&<><h3>Project members & allocation</h3><p className="muted">Allocations cannot exceed 100% across overlapping projects. Finish or reassign open issues before removing a member.</p>
    {project.members.length===0&&<p className="empty">Add members before assigning project issues.</p>}
    {project.members.map(member=><details className="panel" key={member.id}><summary>{String(member.name)} · {String(member.allocation_percent)}% · {member.active?'Active':'Inactive'}</summary>{lead?<form className="create-form" onSubmit={e=>void submit(e,`/projects/${projectId}/members`,'POST')}>
      <input type="hidden" name="user_id" value={String(member.user_id)}/><AllocationFields member={member}/><button disabled={busy}>Update allocation</button>
    </form>:<p>From {String(member.start_date||'No start limit')} through {String(member.end_date||'No end limit')}</p>}</details>)}
    {lead&&<details className="panel"><summary>Add a member</summary><form className="create-form" onSubmit={e=>void submit(e,`/projects/${projectId}/members`,'POST')}>
      <label>Employee<select name="user_id" required>{activePeople.filter(p=>p.role==='member'&&!project.members.some(m=>m.user_id===p.id)).map(p=><option key={p.id} value={p.id}>{String(p.name)}</option>)}</select></label>
      <AllocationFields/><button disabled={busy}>Allocate member</button>
    </form></details>}</>}
  </div>;
}

function AllocationFields({member}:{member?:Row}){
  return <><label>Allocation (%)<input name="allocation_percent" type="number" min="0.01" max="100" step="0.01" required defaultValue={String(member?.allocation_percent??100)}/></label><label>Starts on<input name="start_date" type="date" defaultValue={String(member?.start_date||'')}/></label><label>Ends on<input name="end_date" type="date" defaultValue={String(member?.end_date||'')}/></label><label>Membership<select name="active" defaultValue={member?.active===false?'false':'true'}><option value="true">Active</option><option value="false">Inactive</option></select></label></>;
}
