import {setSeo} from './seo';
import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {api, setToken} from './api';
import './style.css';
import {Toaster, toast} from 'sonner';
import {Plus, RefreshCw, Columns3, List, CircleCheck, Clock3, CircleAlert, Layers3, ArrowRight, CalendarDays, CheckSquare2} from 'lucide-react';
import {WorkspaceShell, viewDescriptions} from './WorkspaceShell';
import {Website, WebsiteEditor} from './Website';
import {AuthScreen} from './AuthScreen';
import {Modal, DataTable, SearchInput, Loading, EmptyState, Badge} from './ui';
import {Workbench, featureTitles, type Feature} from './Workbench';

type Row = {id: number; [key: string]: unknown};
type User = Row & {name: string; role: string; must_change_password: boolean};
type View = 'tasks' | 'attendance' | 'leave' | 'employees' | 'holidays' | 'locations' | 'teams' | 'website' | Feature;
const titles: Record<View, string> = {website:'Website content',tasks:'Team board', attendance:'Attendance', leave:'Leave & approvals', employees:'People', holidays:'Holiday calendar', locations:'Work locations', teams:'Teams',...featureTitles};
const statuses = ['assigned', 'in_progress', 'blocked', 'done'];
const transitions: Record<string, string[]> = {assigned:['in_progress','blocked'], in_progress:['blocked','done'], blocked:['in_progress','assigned'], done:['assigned']};
const text = (value: unknown) => value == null ? '—' : String(value).replaceAll('_',' ');

function App() {
  useEffect(()=>{setSeo({title:'MyTime · Sign in | NialTech',description:'Sign in to your private NialTech MyTime workspace.',path:'/app',noindex:true});},[]);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>('tasks');
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const lead = user?.role === 'lead';
  const admin = user?.role === 'super_admin';
  const advanced = view in featureTitles;
  const [policies, setPolicies] = useState<Row[]>([]);
  const [boardMode,setBoardMode]=useState<'board'|'list'>('board');
  const [statusFilter,setStatusFilter]=useState('all');
  const [blockTask,setBlockTask]=useState<Row|null>(null);

  async function load() {
    if (advanced || view === 'website') return;
    setLoading(true); setError('');
    try {
      const result = await api<Row[]>(`/${view}`);
      setRows(result);
      if (!admin) {
        const [p, l] = await Promise.all([api<Row[]>('/employees'), api<Row[]>('/locations')]);
        setPeople(p); setLocations(l); setPolicies(await api<Row[]>('/leave-policies'));
      }
    } catch(e) {setError((e as Error).message);} finally {setLoading(false);}
  }
  useEffect(()=>{const expired=()=>{setUser(null);setCreating(false);setBlockTask(null);setError('Your session has expired. Please sign in again.');};window.addEventListener('session-expired',expired);return()=>window.removeEventListener('session-expired',expired);},[]);
  useEffect(() => {if(user && !user.must_change_password) {setRows([]); void load();}}, [view, user]);

  async function action(operation: () => Promise<unknown>) {
    setBusy(true); setError('');
    try {await operation(); toast.success('Changes saved'); await load();return true;} catch(e) {setError((e as Error).message);return false;} finally {setBusy(false);}
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{access_token:string; user:User}>('/auth/login','POST',data);
      setToken(result.access_token); setView(result.user.role === 'super_admin' ? 'teams' : 'tasks'); setUser(result.user);
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }

  async function logout() {
    setBusy(true);setError('');
    try {await api('/auth/logout','POST');}
    catch(e){setError((e as Error).message);}
    finally{setToken('');setUser(null);setBusy(false);}
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {await api('/auth/password','POST',Object.fromEntries(new FormData(event.currentTarget))); setToken(''); setUser(null);}
    catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }

  if (!user || user.must_change_password) return <AuthScreen changePassword={Boolean(user)} busy={busy} error={error} onSubmit={user?changePassword:login}/>;

  const allowed: View[] = admin ? ['teams','website'] : ['tasks','projects','issues','sprints','attendance','corrections','calendar','leave','leave-accounts','employees','profiles','holidays','notifications',...(lead ? ['locations','leave-policies','reports','audit','settings'] as View[] : [])];
  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()) && (view!=='tasks'||statusFilter==='all'||r.status===statusFilter));
  const person = (id: unknown) => text(people.find(p => p.id === id)?.name || id);
  const canCreate = view === 'teams' || (lead && ['tasks','employees','holidays','locations'].includes(view)) || (!lead && view === 'leave');

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data: Record<string,unknown> = Object.fromEntries(new FormData(event.currentTarget));
    for (const key of ['assignee_id','estimate_minutes','location_id','lat','lng','accuracy','policy_id']) if (key in data) data[key] = Number(data[key]);
    if (view === 'employees') data.role = 'member';
    if (data.policy_id === 0) delete data.policy_id;
    setBusy(true); setError('');
    try {await api(`/${view}`, 'POST', data); setCreating(false);toast.success(view==='leave'?'Leave request submitted':'Created successfully'); await load();}
    catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }

  async function clock(kind: string) {
    setBusy(true); setError('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve,reject) => navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
      await api(`/attendance/${kind}`,'POST',{lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy});toast.success(kind==='check-in'?'You’re checked in. Have a good day!':'Checked out. See you next time!'); await load();
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }

  const createForm = <form id="main-create-form" className="create-form" onSubmit={create}>
      {view === 'tasks' && <><Field name="title" label="Title"/><Field name="description" label="Description" required={false}/><label>Assignee<select name="assignee_id" required>{people.filter(p => p.role === 'member' && p.active).map(p => <option key={p.id} value={p.id}>{text(p.name)}</option>)}</select></label><Field name="estimate_minutes" label="Estimate (minutes)" type="number" min={1}/><Field name="due_date" label="Due date" type="date"/></>}
      {view === 'employees' && <><Field name="name" label="Full name"/><Field name="username" label="Username"/><Field name="password" label="Temporary password" type="password" minLength={12}/><Field name="department" label="Department" required={false}/><Field name="job_title" label="Job title" required={false}/><label>Office<select name="location_id" required>{locations.map(l => <option key={l.id} value={l.id}>{text(l.name)}</option>)}</select></label></>}
      {view === 'locations' && <><Field name="name" label="Office name"/><Field name="lat" label="Latitude" type="number" step="any" min={-90} max={90}/><Field name="lng" label="Longitude" type="number" step="any" min={-180} max={180}/><input type="hidden" name="accuracy" value="0"/></>}
      {view === 'holidays' && <><Field name="name" label="Holiday name"/><Field name="date" label="Date" type="date"/><label>Office<select required name="location_id">{locations.map(l => <option key={l.id} value={l.id}>{text(l.name)}</option>)}</select></label></>}
      {view === 'leave' && <>{policies.length > 0 && <label>Leave policy<select required name="policy_id">{policies.map(p=><option key={p.id} value={p.id}>{text(p.name)}</option>)}</select></label>}<label>Duration<select name="duration"><option value="full">Full working days</option><option value="half">Half day (single date)</option></select></label><Field name="start_date" label="From" type="date"/><Field name="end_date" label="Until" type="date"/><Field name="reason" label="Reason"/></>}
      {view === 'teams' && <><Field name="name" label="Team name"/><Field name="timezone" label="IANA timezone" defaultValue="Asia/Kolkata"/></>}

    </form>;
  return <WorkspaceShell user={user} view={view} allowed={allowed} titles={titles} onNavigate={next=>{setView(next as View);setCreating(false);setSearch('');setStatusFilter('all');}} onLogout={()=>void logout()}>{view==='website' ? <WebsiteEditor/> : advanced ? <Workbench view={view as Feature} user={user}/> : <section className="content"><div className="heading"><div><p className="eyebrow">{view==='tasks'?'WORK MANAGEMENT':view==='teams'?'ADMINISTRATION':'PEOPLE & TIME'}</p><h1>{titles[view]}</h1><p className="muted">{viewDescriptions[view]}</p></div>{canCreate && <Modal open={creating} onOpenChange={setCreating} title={view==='leave'?'Request time off':`Create ${view==='tasks'?'task':view==='employees'?'employee':view==='holidays'?'holiday':view==='locations'?'work location':'team'}`} description="Add the details below. You can review everything before saving." footer={<><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button type="submit" form="main-create-form" disabled={busy}>{busy?'Saving…':'Save'}</button></>} trigger={<button><Plus size={16}/>{view==='leave'?'Request leave':view==='tasks'?'Create task':view==='employees'?'Add employee':view==='holidays'?'Add holiday':view==='locations'?'Add location':'Create team'}</button>}>{error&&<p role="alert" className="error">{error}</p>}{createForm}</Modal>}</div>{error && !creating && <p className="error" role="alert">{error}</p>}

    {view === 'teams' && <details className="panel"><summary>Create a team lead</summary><form className="create-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget;const body=Object.fromEntries(new FormData(form));const teamId=body.team_id;delete body.team_id;void action(async()=>{await api(`/teams/${teamId}/leads`,'POST',{...body,role:'lead'});form.reset();});}}><label>Team<select name="team_id" required>{rows.map(r=><option key={r.id} value={r.id}>{text(r.name)}</option>)}</select></label><Field name="name" label="Lead name"/><Field name="username" label="Username"/><Field name="password" label="Temporary password" type="password" minLength={12}/><button disabled={busy}>Create lead</button></form><div className="actions">{rows.map(row=><button key={row.id} className="secondary" disabled={busy} onClick={()=>void action(()=>api(`/teams/${row.id}/status`,'POST',{status:row.status==='active'?'suspended':'active'}))}>{row.status==='active'?'Suspend':'Reactivate'} {text(row.name)}</button>)}</div></details>}
    {view==='tasks' && <div className="overview-stats">{[{label:'Total tasks',count:rows.length,Icon:Layers3,color:'blue'}, {label:'In progress',count:rows.filter(r=>r.status==='in_progress').length,Icon:Clock3,color:'purple'}, {label:'Needs attention',count:rows.filter(r=>r.status==='blocked').length,Icon:CircleAlert,color:'amber'}, {label:'Completed',count:rows.filter(r=>r.status==='done').length,Icon:CircleCheck,color:'teal'}].map(stat=><article key={stat.label}><span className={`stat-icon ${stat.color}`}><stat.Icon size={19}/></span><div><small>{stat.label}</small><strong>{loading?'—':stat.count}</strong></div></article>)}</div>}
    <div className="view-toolbar"><div className="toolbar-left">{view==='tasks'&&<div className="view-tabs" aria-label="Filter tasks">{[{value:'all',label:'All tasks'},{value:'in_progress',label:'In progress'},{value:'blocked',label:'Blocked'}].map(tab=><button key={tab.value} className={statusFilter===tab.value?'active':''} aria-pressed={statusFilter===tab.value} onClick={()=>setStatusFilter(tab.value)}>{tab.label}</button>)}</div>}</div><div className="toolbar-right"><SearchInput value={search} onChange={setSearch}/><button className="icon-button bordered" disabled={loading||busy} aria-label="Refresh records" onClick={()=>void load()}><RefreshCw size={16} className={loading?'spin':''}/></button>{view==='tasks'&&<div className="view-switch"><button aria-label="Board view" aria-pressed={boardMode==='board'} className={boardMode==='board'?'active':''} onClick={()=>setBoardMode('board')}><Columns3 size={16}/></button><button aria-label="List view" aria-pressed={boardMode==='list'} className={boardMode==='list'?'active':''} onClick={()=>setBoardMode('list')}><List size={17}/></button></div>}{view==='attendance'&&!lead&&<><button disabled={busy} onClick={()=>void clock('check-in')}><Clock3 size={16}/>Check in</button><button className="secondary" disabled={busy} onClick={()=>void clock('check-out')}>Check out<ArrowRight size={15}/></button></>}</div></div>
    {loading?<Loading/>:view==='tasks'&&boardMode==='board'?<div className="board">{statuses.map(status=><section className={`column column-${status}`} key={status}><h2><span className={`dot ${status}`}/>{status==='assigned'?'To do':text(status)}<span className="count">{filtered.filter(r=>r.status===status).length}</span></h2>{filtered.filter(r=>r.status===status).map(row=><article className="task" key={row.id}><div className="task-top"><span className="issue-key"><CheckSquare2 size={13}/>{text(row.issue_key||`TIME-${row.id}`)}</span><span className="task-estimate"><Clock3 size={11}/>{text(row.estimate_minutes)}m</span></div><h3>{text(row.title)}</h3>{row.description?<p>{text(row.description)}</p>:null}{row.due_date?<span className="task-due"><CalendarDays size={12}/>{new Date(String(row.due_date)+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>:null}<div className="task-meta"><span className="task-assignee"><span className="tiny-avatar">{person(row.assignee_id).split(' ').map(s=>s[0]).slice(0,2).join('')}</span>{person(row.assignee_id)}</span></div><label className="task-move">Move to<select aria-label={`Change status for ${text(row.title)}`} value={status} disabled={busy} onChange={e=>{const next=e.target.value;if(next==='blocked'){setBlockTask(row);return;}void action(()=>api(`/tasks/${row.id}/status`,'PATCH',{status:next,note:''}));}}><option value={status}>{status==='assigned'?'To do':text(status)}</option>{transitions[status].map(next=><option key={next} value={next}>{next==='assigned'?'To do':text(next)}</option>)}</select></label></article>)}{!filtered.some(r=>r.status===status)&&<div className="column-empty"><span>+</span><p>{status==='done'?'Good work will land here.':'A little space for what’s next.'}</p></div>}</section>)}</div>:<DataTable rows={filtered} columns={view==='tasks'?['issue_key','title','assignee_id','estimate_minutes','due_date','status']:columns(view)} format={(key,value)=>key==='user_id'||key==='assignee_id'?person(value):key==='issue_key'&&!value?'—':text(value)} actions={view==='leave'?row=><>{lead&&row.status==='pending'?['approved','rejected'].map(status=><button disabled={busy} key={status} className={status==='approved'?'button-approve':'secondary'} onClick={()=>void action(()=>api(`/leave/${row.id}/decision`,'POST',{status,note:''}))}>{status==='approved'?'Approve':'Reject'}</button>):['pending','approved'].includes(String(row.status))?<button className="secondary" disabled={busy} onClick={()=>void action(()=>api(`/leave/${row.id}/cancel`,'POST'))}>Cancel request</button>:<Badge value={row.status}/>}</>:undefined}/>}

    <p className="footnote">Showing up to 200 records. {view === 'attendance' && 'Check-in uses your current location and the office geofence.'}</p></section>}<Modal open={Boolean(blockTask)} onOpenChange={open=>{if(!open)setBlockTask(null);}} title="What’s blocking this task?" description="Give your team the context they need to help.">{error&&<p role="alert" className="error">{error}</p>}<form className="create-form" onSubmit={async event=>{event.preventDefault();const note=String(new FormData(event.currentTarget).get('note'));if(await action(()=>api(`/tasks/${blockTask?.id}/status`,'PATCH',{status:'blocked',note})))setBlockTask(null);}}><label>Blocking reason<textarea name="note" required placeholder="What needs to happen before this can move forward?"/></label><button disabled={busy}>Mark as blocked</button></form></Modal></WorkspaceShell>;
}

function columns(view: View): string[] {
  return ({tasks:[], attendance:['user_id','work_date','effective_check_in_at','effective_check_out_at','corrected','auto_closed'],leave:['user_id','start_date','end_date','reason','chargeable_days','approval_count','status'],employees:['name','username','role','active'],holidays:['name','date','location_id'],locations:['name','lat','lng'],teams:['id','name','timezone','status']} as Partial<Record<View,string[]>>)[view] || [];
}
function Field({label,...props}: React.InputHTMLAttributes<HTMLInputElement> & {label:string}) {return <label>{label}<input required {...props}/></label>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode>{window.location.pathname==='/app'||window.location.pathname.startsWith('/app/')?<App/>:<Website/>}<Toaster position="bottom-right" richColors closeButton/></React.StrictMode>);
