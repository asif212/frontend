import {expect,type Page} from '@playwright/test';

export async function workspace(page:Page,{role='lead',taskCount=4,populated=false}:{role?:string;taskCount?:number;populated?:boolean}={}){
  const user={id:role==='lead'?1:2,name:'Alex Morgan',username:'alex',role,must_change_password:false,active:true};
  const people=[{id:1,name:'Alex Morgan',role:'lead',active:true},{id:2,name:'Taylor Kim',role:'member',active:true}];
  const tasks=Array.from({length:taskCount},(_,i)=>({id:i+1,title:['Design the onboarding flow','Build the project overview','Review access permissions','Ship the new dashboard'][i%4]+(i>=4?` ${i+1}`:''),description:'A thoughtful update to make the workspace easier to use.',team_id:1,assignee_id:2,estimate_minutes:120,status:['assigned','in_progress','blocked','done'][i%4],due_date:'2026-11-20',issue_key:`TIME-${i+1}`}));
  const projects:Record<string,unknown>[]=[{id:1,key:'DES',name:'Workspace design',description:'A calmer, clearer experience for every working day.',cost:'25000.00',currency:'INR',estimate_minutes:2400,owner_id:1,planned_date:'2026-11-01',release_date:'2026-11-30',status:'active'}];
  const members:Record<string,unknown>[]=[];
  const issues:Record<string,unknown>[]=populated?[{...tasks[0],project_id:1,kind:'feature',priority:'high',story_points:5,cost:'1200.50',currency:'INR',planned_date:'2026-11-01',release_date:'2026-11-30'}]:[];
  const writes:{path:string;body:Record<string,unknown>}[]=[];
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('**/api/v1/**',async route=>{
    const request=route.request();const path=new URL(request.url()).pathname.replace('/api/v1','');
    let body:Record<string,unknown>={};if(request.method()!=='GET'){body=request.postDataJSON()||{};writes.push({path,body});}
    let response:unknown=[];
    if(path==='/auth/login')response={access_token:'test-token',user};
    else if(path==='/employees')response=people;
    else if(path==='/locations')response=[{id:1,name:'Bengaluru office'}];
    else if(path==='/tasks'&&request.method()==='POST'){const row={...body,id:tasks.length+1,status:'assigned',issue_key:null};tasks.push(row as typeof tasks[number]);response=row;}
    else if(path==='/tasks')response=tasks;
    else if(/^\/tasks\/\d+\/status$/.test(path)){const row=tasks.find(t=>t.id===Number(path.split('/')[2]));Object.assign(row!,body);response=row;}
    else if(path==='/projects'&&request.method()==='POST'){const row={...body,id:projects.length+1,status:'active'};projects.push(row);response=row;}
    else if(path==='/projects')response=projects;
    else if(/^\/projects\/\d+\/members$/.test(path)){if(request.method()==='POST'){members.push({...body,id:1,name:'Taylor Kim',active:true});response=members[0];}else response=members;}
    else if(/^\/projects\/\d+$/.test(path)){const row=projects.find(p=>p.id===Number(path.split('/')[2]));if(request.method()==='PATCH')Object.assign(row!,body);response={...row,members};}
    else if(path==='/issues'&&request.method()==='POST'){response={...body,id:1,issue_key:'DES-1',status:'assigned'};issues.push(response as Record<string,unknown>);}
    else if(path==='/issues')response=issues;
    else if(path==='/teams')response=[{id:1,name:'Engineering',timezone:'Asia/Kolkata',status:'active'}];
    else if(path==='/settings')response={id:1,timezone:'Asia/Kolkata',work_days:'1,2,3,4,5',work_start:'09:00:00',work_end:'18:00:00'};
    else if(populated&&path==='/attendance')response=[{id:1,user_id:2,work_date:'2026-10-22',check_in_at:'2026-10-22T03:30:00',check_out_at:'2026-10-22T12:30:00',effective_check_in_at:'2026-10-22T03:30:00',effective_check_out_at:'2026-10-22T12:30:00',corrected:false,auto_closed:false}];
    else if(populated&&path==='/leave')response=[{id:1,user_id:2,start_date:'2026-11-02',end_date:'2026-11-03',reason:'Personal leave with a detailed explanation for the approver',status:'pending',chargeable_days:'2',approval_count:0}];
    else if(populated&&path==='/holidays')response=[{id:1,name:'Office holiday',date:'2026-11-01',location_id:1}];
    else if(populated&&path==='/sprints')response=[{id:1,project_id:1,name:'Planning sprint',status:'planned',start_date:'2026-11-01',end_date:'2026-11-14'}];
    else if(populated&&path==='/leave-policies')response=[{id:1,name:'Annual leave',annual_days:'24',accrual:'monthly',approval_steps:2,carry_forward_days:'5',location_id:1}];
    else if(populated&&path==='/leave-accounts')response=[{id:1,user_id:2,policy_name:'Annual leave',year:2026,available_days:'18.5'}];
    else if(populated&&path==='/corrections')response=[{id:1,user_id:2,attendance_id:1,check_in_at:'2026-10-22T03:30:00',check_out_at:'2026-10-22T12:30:00',reason:'Checkout correction',status:'pending'}];
    else if(populated&&path==='/calendar')response=[{date:'2026-10-22',status:'present'}];
    else if(populated&&path==='/notifications')response=[{id:1,type:'task_assigned',payload_json:'{"id":1}',created_at:'2026-10-22T03:00:00',read_at:null}];
    else if(populated&&path==='/audit')response=[{id:1,actor_id:1,action:'employee_profile_updated',target_type:'users',target_id:2,created_at:'2026-10-22T03:00:00'}];
    else if(/^\/employees\/\d+\/profile$/.test(path))response={user_id:2,name:'Taylor Kim',active:true,department:'Engineering',job_title:'Software engineer',location_id:1,joined_on:'2026-01-01'};
    else if(/^\/issues\/\d+$/.test(path))response={...issues[0],events:[],comments:[],work_logs:[],watchers:[],links:[],attachments:[]};
    else if(/^\/leave-accounts\/\d+\/ledger$/.test(path))response=[{id:1,kind:'accrual',amount:'2.00',created_at:'2026-10-01T00:00:00',leave_id:null}];
    else if(path==='/reports')response={tasks_by_status:{assigned:1,in_progress:1,blocked:1,done:1},overdue_tasks:0,attendance:[]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto('/');
  await page.getByLabel('Username',{exact:true}).fill('alex');
  await page.getByLabel('Password',{exact:true}).fill('example-password');
  await page.getByRole('button',{name:'Sign in to your workspace'}).click();
  await expect(page.getByRole('heading',{name:role==='super_admin'?'Teams':'Team board',exact:true})).toBeVisible();
  return {writes,members};
}

