import {useRef, useState, type ReactNode} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox, LoaderCircle, Search, X} from 'lucide-react';

export const humanize=(value:unknown)=>value==null?'—':String(value).replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export const fieldNames:Record<string,string>={issue_key:'Issue',user_id:'Employee',assignee_id:'Assignee',owner_id:'Owner',actor_id:'Changed by',author_id:'Author',project_id:'Project',sprint_id:'Sprint',location_id:'Office',estimate_minutes:'Estimate',story_points:'Points',planned_date:'Planned start',release_date:'Release date',available_days:'Available days',annual_days:'Days / year',work_date:'Work date',effective_check_in_at:'Check in',effective_check_out_at:'Check out',check_in_at:'Check in',check_out_at:'Check out',auto_closed:'Auto closed',approval_count:'Approvals',chargeable_days:'Days',payload_json:'Reference',target_type:'Record type',target_id:'Record',entry_key:'Reference',created_at:'Created',read_at:'Read',allocation_percent:'Allocation',start_date:'Start date',end_date:'End date',carry_forward_days:'Carry forward',approval_steps:'Approvals',team_id:'Team',minutes:'Time logged',key:'Key'};
const statuses:Record<string,string>={assigned:'To do',in_progress:'In progress',blocked:'Blocked',done:'Done',pending:'Pending',approved:'Approved',rejected:'Rejected',cancelled:'Cancelled',active:'Active',inactive:'Inactive',suspended:'Suspended',planned:'Planned',completed:'Completed',present:'Present',absent:'Absent',weekly_off:'Weekly off',holiday:'Holiday',leave:'On leave',scheduled:'Scheduled'};

export function Badge({value}:{value:unknown}){
  const key=String(value).toLowerCase();
  return <span className={`badge badge-${key.replace(/[^a-z_]/g,'')}`}><i/>{statuses[key]||humanize(value)}</span>;
}

export function Modal({open,onOpenChange,title,description,children,wide=false,trigger,drawer=false,footer}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description?:string;children:ReactNode;wide?:boolean;trigger?:ReactNode;drawer?:boolean;footer?:ReactNode}){
  const previousFocus=useRef<HTMLElement|null>(null);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>{trigger&&<Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}<Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className={`dialog-content ${wide?'dialog-wide':''} ${drawer?'dialog-drawer':''}`} {...(!description?{'aria-describedby':undefined}:{})} onOpenAutoFocus={()=>{previousFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;}} onCloseAutoFocus={event=>{if(!trigger){const target=previousFocus.current?.isConnected?previousFocus.current:document.getElementById('main-content');if(target){event.preventDefault();target.focus();}}}}><div className="dialog-header"><div><Dialog.Title>{title}</Dialog.Title>{description&&<Dialog.Description>{description}</Dialog.Description>}</div><Dialog.Close asChild><button type="button" className="icon-button" aria-label="Close dialog"><X size={18}/></button></Dialog.Close></div><div className="dialog-body">{children}</div>{footer&&<div className="dialog-footer">{footer}</div>}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function EmptyState({title='Nothing here yet',description='New records will appear here as your team gets started.'}:{title?:string;description?:string}){
  return <div className="empty-state"><span className="empty-icon"><Inbox size={25}/></span><h3>{title}</h3><p>{description}</p></div>;
}
export function Loading(){return <div className="loading-state" role="status"><LoaderCircle size={20} className="spin"/><span>Loading your workspace…</span></div>;}
export function SearchInput({value,onChange,placeholder='Search this view…'}:{value:string;onChange:(value:string)=>void;placeholder?:string}){return <div className="search-input"><Search size={16}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" className="icon-button" aria-label="Clear search" onClick={()=>onChange('')}><X size={14}/></button>}</div>;}

function cell(key:string,value:unknown,fallback:string){
  if(value==null||value==='')return <span className="cell-muted">—</span>;
  if(['status','priority','kind','role','accrual'].includes(key))return <Badge value={value}/>;
  if(typeof value==='boolean')return <span className={`boolean-value ${value?'positive':''}`}>{value?'Yes':'No'}</span>;
  if(/(_at|_date)$/.test(key)||key==='date'||key==='joined_on'){
    const raw=String(value);const onlyDate=/^\d{4}-\d{2}-\d{2}$/.test(raw);
    const date=new Date(onlyDate?raw+'T12:00:00':/Z$|[+-]\d\d:\d\d$/.test(raw)?raw:raw+'Z');
    if(!isNaN(date.getTime()))return <span className="date-cell">{date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}{!onlyDate&&<small>{date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</small>}</span>;
  }
  if(key==='cost')return <span className="numeric-cell">{Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>;
  if(key==='estimate_minutes'||key==='minutes')return <span className="numeric-cell">{Math.floor(Number(value)/60)>0?`${Math.floor(Number(value)/60)}h `:''}{Number(value)%60?`${Number(value)%60}m`:Number(value)===0?'0m':''}</span>;
  if(key==='issue_key')return <span className="issue-key">{String(value)}</span>;
  if(key==='payload_json'){try{return `Record #${JSON.parse(String(value)).id??'—'}`;}catch{return fallback;}}
  if(Array.isArray(value))return <span className="cell-labels">{value.map((v,i)=><span className="label-chip" key={i}>{String(v)}</span>)}</span>;
  return fallback;
}

export function DataTable<T extends Record<string,unknown>>({rows,columns,format,actions}:{rows:T[];columns:string[];format?:(key:string,value:unknown)=>string;actions?:(row:T)=>ReactNode}){
  const [sort,setSort]=useState<{key:string;direction:number}|null>(null);
  const [page,setPage]=useState(0);
  const [size,setSize]=useState(10);
  const sorted=sort?[...rows].sort((a,b)=>String(a[sort.key]??'').localeCompare(String(b[sort.key]??''),undefined,{numeric:true})*sort.direction):rows;
  const current=Math.min(page,Math.max(0,Math.ceil(sorted.length/size)-1));
  const visible=sorted.slice(current*size,current*size+size);
  return <div className="data-card"><div className="table-wrap"><table><thead><tr>{columns.map(key=><th key={key} aria-sort={sort?.key===key?(sort.direction===1?'ascending':'descending'):'none'}><button className="column-sort" onClick={()=>{setSort({key,direction:sort?.key===key?-sort.direction:1});setPage(0);}}>{fieldNames[key]||humanize(key)}{sort?.key===key?(sort.direction===1?<ArrowUp size={12}/>:<ArrowDown size={12}/>):null}</button></th>)}{actions&&<th className="action-heading">Actions</th>}</tr></thead><tbody>{visible.map((row,index)=><tr key={String(row.id??row.date??index)}>{columns.map(key=><td key={key}>{cell(key,row[key],format?format(key,row[key]):String(row[key]??'—'))}</td>)}{actions&&<td><div className="actions">{actions(row)}</div></td>}</tr>)}</tbody></table>{!rows.length&&<EmptyState/>}</div>{rows.length>0&&<div className="table-pagination"><span>{current*size+1}–{Math.min((current+1)*size,rows.length)} of {rows.length} records</span><div><label>Rows<select aria-label="Rows per page" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(0);}}>{[10,20,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label><button className="icon-button" aria-label="Previous page" disabled={current===0} onClick={()=>setPage(current-1)}><ChevronLeft size={16}/></button><button className="icon-button" aria-label="Next page" disabled={(current+1)*size>=rows.length} onClick={()=>setPage(current+1)}><ChevronRight size={16}/></button></div></div>}</div>;
}
