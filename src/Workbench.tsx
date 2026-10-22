import React, {useEffect, useId, useRef, useState} from 'react';
import {api, uploadAttachment, downloadAttachment} from './api';
import {ProjectPlanning} from './ProjectPlanning';
import {Modal, DataTable, SearchInput, Loading, EmptyState, Badge} from './ui';
import {viewDescriptions} from './WorkspaceShell';
import {toast} from 'sonner';
import {Plus, RefreshCw, LayoutGrid, List, ArrowUpRight, FolderKanban, CalendarDays, Coins, Users, CheckCircle2} from 'lucide-react';

export const featureTitles = {projects:'Projects',issues:'Issues & backlog',sprints:'Sprints','leave-policies':'Leave policies','leave-accounts':'Leave balances',corrections:'Attendance corrections',calendar:'Attendance calendar',reports:'Reports',notifications:'Notifications',audit:'Audit history',settings:'Team settings',profiles:'Employee profiles'};
export type Feature = keyof typeof featureTitles;
type Row = Record<string, unknown> & {id:number};
type User = {id:number; role:string};
type Option = {value:string|number;label:string};
type Spec = {name:string;label:string;type?:string;options?:Option[];optional?:boolean;value?:string|number;min?:number;step?:string;onChange?:(value:string)=>void};
const label = (v:unknown):string => v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v).replaceAll('_',' ');
const options = (rows:Row[],key='name'):Option[] => rows.map(r => ({value:r.id,label:label(r[key])}));
const values = (items:string[]):Option[] => items.map(value=>({value,label:label(value)}));

function Fields({specs,disabled=false}:{specs:Spec[];disabled?:boolean}) {
  const prefix=useId();
  return <>{specs.map(f=><label key={f.name} htmlFor={`${prefix}-${f.name}`}><span id={`${prefix}-${f.name}-label`}>{f.label}</span>{f.options ? <select disabled={disabled} id={`${prefix}-${f.name}`} aria-labelledby={`${prefix}-${f.name}-label`} name={f.name} value={f.onChange?f.value:undefined} defaultValue={f.onChange?undefined:(f.value ?? '')} onChange={e=>f.onChange?.(e.target.value)} required={!f.optional}>{f.optional && <option value="">None</option>}{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type==='textarea' ? <textarea disabled={disabled} id={`${prefix}-${f.name}`} aria-labelledby={`${prefix}-${f.name}-label`} name={f.name} defaultValue={f.value ?? ''} required={!f.optional} maxLength={10000}/> : <input disabled={disabled} id={`${prefix}-${f.name}`} aria-labelledby={`${prefix}-${f.name}-label`} name={f.name} type={f.type || 'text'} defaultValue={f.value ?? ''} required={!f.optional} min={f.min} step={f.step}/>}</label>)}</>;
}
function data(form:HTMLFormElement):Record<string,unknown> {
  const result:Record<string,unknown>=Object.fromEntries(new FormData(form));
  for(const key of ['project_id','sprint_id','parent_id','assignee_id','estimate_minutes','story_points','location_id','user_id','policy_id','year','attendance_id','minutes','approval_steps','target_id','waiting_days','owner_id']) {
    if(key in result) result[key]=result[key]==='' ? null : Number(result[key]);
  }
  for(const key of ['prorate_joiners','allow_half_day']) if(key in result) result[key]=result[key]==='true';
  if('labels' in result) result.labels=String(result.labels).split(',').map(s=>s.trim()).filter(Boolean);
  return result;
}

export function Workbench({view,user}:{view:Feature;user:User}) {
  const [rows,setRows]=useState<Row[]>([]);
  const [projects,setProjects]=useState<Row[]>([]);
  const [people,setPeople]=useState<Row[]>([]);
  const [locations,setLocations]=useState<Row[]>([]);
  const [policies,setPolicies]=useState<Row[]>([]);
  const [sprints,setSprints]=useState<Row[]>([]);
  const [attendances,setAttendances]=useState<Row[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [creating,setCreating]=useState(false);
  const [projectDisplay,setProjectDisplay]=useState<'grid'|'list'>('grid');
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [newProjectId,setNewProjectId]=useState('');
  const [issueMembers,setIssueMembers]=useState<Row[]>([]);
  const [editMembers,setEditMembers]=useState<Row[]>([]);
  const [projectFilter,setProjectFilter]=useState('');
  const [backlog,setBacklog]=useState(false);
  const [selected,setSelected]=useState<Row|null>(null);
  const [details,setDetails]=useState<Row|null>(null);
  const [ledger,setLedger]=useState<Row[]|null>(null);
  const [report,setReport]=useState<Record<string,unknown>|null>(null);
  const [range,setRange]=useState({start:new Date().toISOString().slice(0,8)+'01',end:new Date().toISOString().slice(0,10),user_id:String(user.id)});
  const generation=useRef(0);
  const lead=user.role==='lead';

  async function load() {
    const version=++generation.current;
    setLoading(true);setError('');
    try {
      const reference=await Promise.all([api<Row[]>('/projects'),api<Row[]>('/employees'),api<Row[]>('/locations'),api<Row[]>('/leave-policies'),api<Row[]>('/sprints'),api<Row[]>('/attendance')]);
      if(version!==generation.current)return;
      setProjects(reference[0]);setPeople(reference[1]);setLocations(reference[2]);setPolicies(reference[3]);setSprints(reference[4]);setAttendances(reference[5]);
      let result:Row[]=[];
      if(view==='calendar')result=await api<Row[]>(`/calendar?${new URLSearchParams(range)}`);
      else if(view==='reports')setReport(await api(`/reports?start=${range.start}&end=${range.end}`));
      else if(view==='profiles')result=reference[1];
      else if(view==='settings')result=[await api<Row>('/settings')];
      else if(view==='issues')result=await api<Row[]>(`/issues?${new URLSearchParams({...(projectFilter?{project_id:projectFilter}:{}),backlog:String(backlog)})}`);
      else result=await api<Row[]>(`/${view}`);
      if(version===generation.current)setRows(result);
    } catch(e) {if(version===generation.current)setError((e as Error).message);} finally {if(version===generation.current)setLoading(false);}
  }
  useEffect(()=>{setCreating(false);setRows([]);setSelected(null);setDetails(null);setLedger(null);setReport(null);setSearch('');void load();return()=>{generation.current++;};},[view,projectFilter,backlog,range]);

  async function mutate(path:string,method:string,body?:unknown,after?:()=>void) {
    setBusy(true);setError('');
    try {await api(path,method,body);toast.success('Changes saved');after?.();await load();if(selected && view==='issues')setDetails(await api<Row>(`/issues/${selected.id}`));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const person=(id:unknown)=>label(people.find(p=>p.id===id)?.name || id);
  const projectOptions=options(projects);
  const memberOptions=options(people.filter(p=>p.role==='member' && p.active));
  const creationProject=projects.find(p=>p.id===Number(newProjectId))?.id || projects[0]?.id;
  useEffect(()=>{let current=true;setIssueMembers([]);if(view==='issues'&&creationProject)api<Row[]>(`/projects/${creationProject}/members`).then(m=>{if(current)setIssueMembers(m);}).catch(e=>{if(current)setError((e as Error).message);});return()=>{current=false;};},[view,creationProject,projects]);
  useEffect(()=>{let current=true;setEditMembers([]);if(view==='issues'&&details?.project_id)api<Row[]>(`/projects/${details.project_id}/members`).then(m=>{if(current)setEditMembers(m);}).catch(e=>{if(current)setError((e as Error).message);});return()=>{current=false;};},[view,details?.project_id]);
  const issueAssignees=memberOptions.filter(o=>issueMembers.some(m=>m.user_id===o.value&&m.active));
  const editAssignees=memberOptions.filter(o=>editMembers.some(m=>m.user_id===o.value&&m.active));
  const planningFields:Spec[]=[{name:'cost',label:'Planned cost',type:'number',min:0,step:'0.01',optional:true},{name:'currency',label:'Currency (3 uppercase letters)',value:'INR'},{name:'planned_date',label:'Planned date',type:'date',optional:true},{name:'release_date',label:'Release date',type:'date',optional:true}];
  const spec:Partial<Record<Feature,Spec[]>>={
    projects:[{name:'key',label:'Project key (2–12 uppercase letters/digits)'},{name:'name',label:'Project name'},{name:'description',label:'Description',type:'textarea',optional:true},{name:'owner_id',label:'Project owner',options:options(people.filter(p=>p.active)),optional:true},{name:'estimate_minutes',label:'Estimate (minutes)',type:'number',min:0,optional:true},...planningFields],
    sprints:[{name:'project_id',label:'Project',options:projectOptions},{name:'name',label:'Sprint name'},{name:'goal',label:'Goal',optional:true},{name:'start_date',label:'Start',type:'date'},{name:'end_date',label:'End',type:'date'}],
    issues:[{name:'project_id',label:'Project',options:projectOptions,value:creationProject||'',onChange:setNewProjectId},{name:'title',label:'Summary'},{name:'description',label:'Description',type:'textarea',optional:true},{name:'assignee_id',label:'Allocated assignee',options:issueAssignees},{name:'kind',label:'Issue type',options:values(['task','feature','story','bug','epic','subtask'])},{name:'parent_id',label:'Parent issue (required for subtask)',options:rows.filter(r=>r.kind!=='subtask').map(r=>({value:r.id,label:`${label(r.issue_key)} · ${label(r.title)}`})),optional:true},{name:'priority',label:'Priority',options:values(['medium','low','high','highest','lowest'])},{name:'estimate_minutes',label:'Estimate in minutes',type:'number',value:60,min:1},{name:'story_points',label:'Story points',type:'number',value:0,min:0},{name:'due_date',label:'Due date',type:'date',optional:true},{name:'labels',label:'Labels (comma separated)',optional:true},...planningFields],
    'leave-policies':[{name:'name',label:'Leave type / policy name'},{name:'annual_days',label:'Annual entitlement (days)',type:'number',min:0.01,step:'0.01'},{name:'accrual',label:'Credit schedule',options:values(['annual','monthly'])},{name:'approval_steps',label:'Required distinct lead approvals',type:'number',min:1,value:1},{name:'carry_forward_days',label:'Maximum days carried to next year',type:'number',min:0,value:0,step:'0.01'},{name:'waiting_days',label:'Eligibility days after joining',type:'number',min:0,value:0},{name:'prorate_joiners',label:'Prorate joining year entitlement',options:[{value:'false',label:'No'},{value:'true',label:'Yes'}]},{name:'allow_half_day',label:'Allow half-day requests',options:[{value:'true',label:'Yes'},{value:'false',label:'No'}]},{name:'location_id',label:'Office restriction',options:options(locations),optional:true}],
    'leave-accounts':[{name:'user_id',label:'Employee',options:memberOptions},{name:'policy_id',label:'Policy',options:options(policies)},{name:'year',label:'Year',type:'number',value:new Date().getFullYear(),min:2020}],
    corrections:[{name:'attendance_id',label:'Attendance',options:attendances.filter(a=>a.check_out_at).map(a=>({value:a.id,label:`#${a.id} · ${label(a.work_date)}`}))},{name:'check_in_at',label:'Correct check-in (your browser local time)',type:'datetime-local'},{name:'check_out_at',label:'Correct check-out (your browser local time)',type:'datetime-local'},{name:'reason',label:'Reason',type:'textarea'}]
  };
  const canCreate=(lead && ['projects','sprints','issues','leave-policies','leave-accounts'].includes(view)) || (!lead && view==='corrections');
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=event.currentTarget;const body=data(form);
    for(const key of ['due_date','planned_date','release_date','cost'])if(body[key]==='')body[key]=null;
    if(view==='corrections')for(const key of ['check_in_at','check_out_at'])body[key]=new Date(String(body[key])).toISOString();
    await mutate(`/${view}`,'POST',body,()=>{form.reset();setCreating(false);});
  }
  async function open(row:Row) {
    setError('');setSelected(row);setDetails(null);setLedger(null);
    try {
      if(view==='issues')setDetails(await api<Row>(`/issues/${row.id}`));
      if(view==='profiles')setDetails(await api<Row>(`/employees/${row.id}/profile`));
      if(view==='leave-accounts')setLedger(await api<Row[]>(`/leave-accounts/${row.id}/ledger`));
    }catch(e){setError((e as Error).message);}
  }
  const visible=rows.filter(row=>JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  const columns:Partial<Record<Feature,string[]>>={projects:['key','name','owner_id','cost','currency','estimate_minutes','planned_date','release_date','status'],issues:['issue_key','title','kind','priority','status','assignee_id','estimate_minutes','cost','currency','planned_date','release_date','story_points'],sprints:['name','project_id','start_date','end_date','status'], 'leave-policies':['name','annual_days','accrual','approval_steps','carry_forward_days','location_id'],'leave-accounts':['user_id','policy_name','year','available_days'],corrections:['id','user_id','attendance_id','check_in_at','check_out_at','reason','status'],calendar:['date','status'],notifications:['type','payload_json','created_at','read_at'],audit:['actor_id','action','target_type','target_id','created_at'],profiles:['name','username','active']};
  const cols=columns[view]||[];

  return <section className="content"><div className="heading"><div><p className="eyebrow">{['projects','issues','sprints'].includes(view)?'WORK MANAGEMENT':'WORKSPACE'}</p><h1>{featureTitles[view]}</h1><p className="muted">{viewDescriptions[view]}</p></div><div className="heading-actions"><button className="icon-button bordered" disabled={loading||busy} aria-label="Refresh records" onClick={()=>void load()}><RefreshCw size={16} className={loading?'spin':''}/></button>{canCreate&&<Modal open={creating} onOpenChange={setCreating} wide={view==='issues'} title={view==='leave-accounts'?'Enroll employee':view==='corrections'?'Request a time correction':`Create ${view==='projects'?'project':view==='sprints'?'sprint':view==='issues'?'issue':'leave policy'}`} description="A few thoughtful details to get things moving." footer={<><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button type="submit" form="workbench-create-form" disabled={busy}>{busy?'Saving…':view==='leave-accounts'?'Enroll employee':'Save changes'}</button></>} trigger={<button><Plus size={16}/>{view==='leave-accounts'?'Enroll employee':view==='corrections'?'Request correction':view==='projects'?'New project':view==='issues'?'Create issue':view==='sprints'?'Create sprint':'New policy'}</button>}>{error&&<p role="alert" className="error">{error}</p>}<form id="workbench-create-form" className="create-form" onSubmit={submit}><Fields specs={spec[view]||[]}/></form></Modal>}</div></div>{error&&!creating&&!selected&&<p role="alert" className="error">{error}</p>}
    {view==='issues' && lead && !issueAssignees.length && <p className="muted">Add members and allocations in Projects → Details before assigning issues to this project.</p>}
    {view==='leave-accounts' && lead && <div className="info-banner"><span><CheckCircle2 size={17}/>Balances include reservations for pending requests.</span><button className="secondary" disabled={busy} onClick={()=>void mutate('/leave-accruals/run','POST')}><RefreshCw size={14}/>Run due accruals</button></div>}
    {(view==='calendar'||view==='reports') && <form className="create-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setRange({start:String(f.get('start')),end:String(f.get('end')),user_id:String(f.get('user_id')||user.id)});}}><Fields specs={[{name:'start',label:'From',type:'date',value:range.start},{name:'end',label:'To',type:'date',value:range.end},...(view==='calendar'&&lead?[{name:'user_id',label:'Employee',options:memberOptions}]:[])]}/><button disabled={busy}>Apply dates</button></form>}
    {view==='issues' && <div className="toolbar"><label>Project<select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="">All projects</option>{projectOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label className="check"><input type="checkbox" checked={backlog} onChange={e=>setBacklog(e.target.checked)}/>Backlog only</label></div>}
    {view==='settings' && rows[0] && <form className="create-form" key={String(rows[0].timezone)} onSubmit={e=>{e.preventDefault();void mutate('/settings','PATCH',data(e.currentTarget));}}><Fields specs={[{name:'timezone',label:'IANA timezone',value:String(rows[0].timezone)},{name:'work_days',label:'Working weekdays (1=Mon, 7=Sun)',value:String(rows[0].work_days)},{name:'work_start',label:'Shift starts',type:'time',value:String(rows[0].work_start||'09:00').slice(0,5)},{name:'work_end',label:'Shift ends',type:'time',value:String(rows[0].work_end||'18:00').slice(0,5)}]}/><button disabled={busy}>Save settings</button></form>}
    {view==='reports' && report && <><div className="metrics">{Object.entries(report.tasks_by_status as Record<string,number>).map(([name,count])=><article key={name}><small>{label(name)}</small><strong>{count}</strong></article>)}<article><small>Overdue tasks</small><strong>{label(report.overdue_tasks)}</strong></article></div><h2>Attendance within selected dates</h2><DataTable rows={report.attendance as Row[]} columns={['user_id','work_date','minutes','corrected']} format={(key,value)=>key==='user_id'?person(value):label(value)}/></>}
    {cols.length>0 && <><div className="view-toolbar"><span className="record-count">{visible.length} {view==='projects'?'projects':'records'}</span><div className="toolbar-right"><SearchInput value={search} onChange={setSearch}/>{view==='projects'&&<div className="view-switch"><button aria-label="Grid view" aria-pressed={projectDisplay==='grid'} className={projectDisplay==='grid'?'active':''} onClick={()=>setProjectDisplay('grid')}><LayoutGrid size={16}/></button><button aria-label="List view" aria-pressed={projectDisplay==='list'} className={projectDisplay==='list'?'active':''} onClick={()=>setProjectDisplay('list')}><List size={17}/></button></div>}</div></div>{loading?<Loading/>:view==='projects'&&projectDisplay==='grid'?<div className="project-grid">{visible.map((row,index)=><article className="project-card" key={row.id}><div className="project-card-top"><span className={`project-icon project-color-${index%4}`}><FolderKanban size={23}/></span><Badge value={row.status}/></div><span className="project-key">{label(row.key)}</span><h2><button onClick={()=>void open(row)}>{label(row.name)}<ArrowUpRight size={16}/></button></h2><p>{row.description?label(row.description):'A space for your team’s next great idea.'}</p><div className="project-facts"><span><CalendarDays size={14}/>{row.release_date?new Date(String(row.release_date)+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'No release date'}</span><span><Coins size={14}/>{row.cost==null?'Budget not set':`${Number(row.cost).toLocaleString()} ${label(row.currency)}`}</span></div><div className="project-card-footer"><span><span className="tiny-avatar">{row.owner_id?person(row.owner_id).slice(0,2).toUpperCase():<Users size={12}/>}</span>{row.owner_id?person(row.owner_id):'No owner assigned'}</span><button className="icon-button" aria-label={`Open ${label(row.name)}`} onClick={()=>void open(row)}><ArrowUpRight size={17}/></button></div></article>)}{!visible.length&&<EmptyState title={search?'No matching projects':'Your next big thing starts here'} description={search?'Try a different search.':'Create a project to bring your team and plans together.'}/>}</div>:<DataTable rows={visible} columns={cols} format={(key,value)=>['user_id','assignee_id','actor_id','owner_id'].includes(key)?person(value):key==='project_id'?label(projects.find(p=>p.id===value)?.name||value):key==='location_id'?label(locations.find(p=>p.id===value)?.name||value):key==='sprint_id'?label(sprints.find(p=>p.id===value)?.name||value):label(value)} actions={row=><>
      {['projects','issues','leave-accounts'].includes(view) && <button className="table-detail-button" aria-label={`Open ${label(row.title||row.name||row.policy_name||'record')}`} onClick={()=>void open(row)}>View<ArrowUpRight size={13}/></button>}
      {view==='profiles' && (lead || row.id===user.id) && <button className="secondary" onClick={()=>void open(row)}>{lead?'Edit profile':'View profile'}</button>}
      {view==='sprints' && lead && row.status!=='completed' && <button disabled={busy} className="secondary" onClick={()=>void mutate(`/sprints/${row.id}/status`,'POST',{status:row.status==='planned'?'active':'completed'})}>{row.status==='planned'?'Start':'Complete'}</button>}
      {view==='sprints' && row.status==='completed' && <button className="secondary" onClick={()=>{setSelected(row);setDetails(row);}}>Review snapshot</button>}
      {view==='corrections' && lead && row.status==='pending' && ['approved','rejected'].map(status=><button disabled={busy} key={status} className="secondary" onClick={()=>void mutate(`/corrections/${row.id}/decision`,'POST',{status,note:''})}>{status==='approved'?'Approve':'Reject'}</button>)}
      {view==='notifications' && !row.read_at && <button disabled={busy} className="secondary" onClick={()=>void mutate(`/notifications/${row.id}/read`,'POST')}>Mark read</button>}
    </>}/>}</>}
    {selected && <Modal open onOpenChange={open=>{if(!open){setSelected(null);setDetails(null);setLedger(null);}}} title={label(selected.issue_key||selected.name||selected.policy_name||'Details')+(selected.title?` · ${label(selected.title)}`:'')} description={view==='projects'?'Project planning, people, and allocation.':view==='issues'?'Everything your team needs to move this issue forward.':undefined} wide>{error&&<p role="alert" className="error">{error}</p>}{['issues','profiles'].includes(view)&&!details&&!error&&<Loading/>}
      {view==='projects' && <ProjectPlanning projectId={selected.id} people={people} lead={lead} onUpdated={load}/>}
      {view==='leave-accounts' && ledger && <DataTable rows={ledger} columns={['created_at','kind','amount','leave_id']} format={(_,value)=>label(value)}/>}
      {view==='sprints' && details && <DataTable rows={(details.snapshot||[]) as Row[]} columns={['key','status','story_points']} format={(_,value)=>label(value)}/>}
      {view==='profiles' && details && <form className="create-form" key={selected.id} onSubmit={e=>{e.preventDefault();const body=data(e.currentTarget);body.active=body.active==='true';if(body.joined_on==='')body.joined_on=null;void mutate(`/employees/${selected.id}/profile`,'PATCH',body,()=>setSelected(null));}}><Fields disabled={!lead||selected.role!=='member'} specs={[{name:'name',label:'Name',value:String(details.name)},{name:'department',label:'Department',optional:true,value:String(details.department||'')},{name:'job_title',label:'Job title',optional:true,value:String(details.job_title||'')},{name:'joined_on',label:'Joined on',type:'date',optional:true,value:String(details.joined_on||'')},{name:'location_id',label:'Office',options:options(locations),optional:true,value:Number(details.location_id)||''},{name:'active',label:'Employment access',options:[{value:'true',label:'Active'},{value:'false',label:'Inactive (revokes sessions)'}],value:String(details.active)}]}/>{lead && selected.role==='member' && <button disabled={busy}>Save profile</button>}</form>}
      {view==='issues' && details && <><p>{label(details.description)}</p><p>Assignee: {person(details.assignee_id)} · {label(details.kind)} · {label(details.priority)} priority · {label(details.status)}</p><p>Estimate: {label(details.estimate_minutes)} minutes · Planned cost: {label(details.cost)} {label(details.currency)} · Planned: {label(details.planned_date)} · Release: {label(details.release_date)}</p>
      {lead && <details><summary>Edit issue / move into a sprint</summary><form className="create-form" key={selected.id} onSubmit={e=>{e.preventDefault();const body=data(e.currentTarget);for(const key of ['due_date','planned_date','release_date','cost'])if(body[key]==='')body[key]=null;void mutate(`/issues/${selected.id}`,'PATCH',body);}}><Fields specs={[{name:'title',label:'Summary',value:String(details.title)},{name:'description',label:'Description',type:'textarea',optional:true,value:String(details.description||'')},{name:'assignee_id',label:'Allocated assignee',options:editAssignees,value:Number(details.assignee_id)},{name:'due_date',label:'Due date',type:'date',optional:true,value:String(details.due_date||'')},{name:'sprint_id',label:'Sprint / backlog',options:options(sprints.filter(s=>s.project_id===details.project_id && s.status!=='completed')),optional:true,value:Number(details.sprint_id)||''},{name:'priority',label:'Priority',options:values(['lowest','low','medium','high','highest']),value:String(details.priority)},{name:'kind',label:'Issue type',options:values(['epic','feature','story','task','bug','subtask']),value:String(details.kind)},{name:'estimate_minutes',label:'Estimate (minutes)',type:'number',min:1,value:Number(details.estimate_minutes)},{name:'cost',label:'Planned cost',type:'number',min:0,step:'0.01',optional:true,value:String(details.cost??'')},{name:'currency',label:'Currency',value:String(details.currency||'INR')},{name:'planned_date',label:'Planned date',type:'date',optional:true,value:String(details.planned_date||'')},{name:'release_date',label:'Release date',type:'date',optional:true,value:String(details.release_date||'')},{name:'story_points',label:'Story points',type:'number',value:Number(details.story_points),min:0},{name:'labels',label:'Labels',optional:true,value:((details.labels||[]) as string[]).join(', ')}]}/><button disabled={busy}>Update issue</button></form></details>}
      {(lead || details.assignee_id===user.id) && <form className="create-form" key={`status-${String(details.status)}`} onSubmit={e=>{e.preventDefault();void mutate(`/tasks/${selected.id}/status`,'PATCH',data(e.currentTarget));}}><Fields specs={[{name:'status',label:'Next status',options:values(({assigned:['in_progress','blocked'],in_progress:['blocked','done'],blocked:['in_progress','assigned'],done:['assigned']} as Record<string,string[]>)[String(details.status)]||[])},{name:'note',label:'Transition note (required when blocked)',optional:true}]}/><button disabled={busy}>Change status</button></form>}
      <h3>Comments</h3><DataTable rows={details.comments as Row[]} columns={['author_id','body','created_at']} format={(key,value)=>key==='author_id'?person(value):label(value)}/><form className="create-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;void mutate(`/issues/${selected.id}/comments`,'POST',data(form),()=>form.reset());}}><Fields specs={[{name:'body',label:'Add a comment',type:'textarea'}]}/><button disabled={busy}>Comment</button></form>
      <h3>Work logs</h3><DataTable rows={details.work_logs as Row[]} columns={['user_id','work_date','minutes','note']} format={(key,value)=>key==='user_id'?person(value):label(value)}/><form className="create-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;void mutate(`/issues/${selected.id}/work-logs`,'POST',data(form),()=>form.reset());}}><Fields specs={[{name:'work_date',label:'Work date',type:'date'},{name:'minutes',label:'Minutes',type:'number',min:1},{name:'note',label:'Work description',optional:true}]}/><button disabled={busy}>Log work</button></form>
      <h3>Watchers & dependencies</h3><p>{((details.watchers||[]) as number[]).map(id=>person(id)).join(', ') || 'No watchers'}</p><button disabled={busy} className="secondary" onClick={()=>void mutate(`/issues/${selected.id}/watch`,'POST',{watching:!((details.watchers||[]) as number[]).includes(user.id)})}>{((details.watchers||[]) as number[]).includes(user.id)?'Stop watching':'Watch this issue'}</button><DataTable rows={(details.links||[]) as Row[]} columns={['source_id','kind','target_id']} format={(_,value)=>label(value)}/>{lead && <form className="create-form" onSubmit={e=>{e.preventDefault();void mutate(`/issues/${selected.id}/links`,'POST',data(e.currentTarget));}}><Fields specs={[{name:'target_id',label:'Target issue',options:rows.filter(r=>r.id!==selected.id && r.project_id===details.project_id).map(r=>({value:r.id,label:`${label(r.issue_key)} · ${label(r.title)}`}))},{name:'kind',label:'This issue…',options:[{value:'blocks',label:'blocks target'},{value:'relates',label:'relates to target'},{value:'duplicates',label:'duplicates target'}]}]}/><button disabled={busy}>Link issue</button></form>}
      <h3>Attachments</h3><DataTable rows={(details.attachments||[]) as Row[]} columns={['filename','size','created_at']} format={(_,value)=>label(value)} actions={file=><button className="secondary" disabled={busy} onClick={()=>{setBusy(true);void downloadAttachment(file.id,String(file.filename)).catch(e=>setError((e as Error).message)).finally(()=>setBusy(false));}}>Download</button>}/><form className="create-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const file=new FormData(form).get('file') as File;setBusy(true);setError('');void uploadAttachment(selected.id,file).then(async()=>{setDetails(await api<Row>(`/issues/${selected.id}`));form.reset();}).catch(e=>setError((e as Error).message)).finally(()=>setBusy(false));}}><label>Attach file (up to 5 MB)<input name="file" type="file" required/></label><button disabled={busy}>Upload</button></form>
      <h3>Status history</h3><DataTable rows={details.events as Row[]} columns={['actor_id','from_status','to_status','note','created_at']} format={(key,value)=>key==='actor_id'?person(value):label(value)}/></>}
    </Modal>}
  </section>;
}

