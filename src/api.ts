import {compressImage} from './compressImage';
// Keep the bearer token in memory. Reloading requires signing in again.
let token = '';
const base = (import.meta as unknown as {env: Record<string, string>}).env.VITE_API_URL || 'http://localhost:8000/api/v1';
export function setToken(value: string) { token = value; }
async function checkResponse(response:Response):Promise<void> {
  if(response.ok)return;
  if(response.status===401&&token){token='';window.dispatchEvent(new Event('session-expired'));}
  const result=await response.json().catch(()=>({}));
  if(typeof result.detail==='string')throw new Error(result.detail);
  if(Array.isArray(result.detail)){
    throw new Error(result.detail.map((item:{loc?:string[];msg?:string})=>{
      const field=item.loc?.filter(value=>value!=='body').pop()?.replaceAll('_',' ');
      return `${field?field.charAt(0).toUpperCase()+field.slice(1)+': ':''}${(item.msg||'Please check this field').replace(/^Value error, /,'')}`;
    }).join('. '));
  }
  throw new Error('We couldn’t complete that action. Please try again.');
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(base + path, {
    method, headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    ...(body === undefined ? {} : {body: JSON.stringify(body)})
  }).catch(()=>{throw new Error('Couldn’t reach your workspace. Check your connection and try again.');});
  await checkResponse(response);
  return response.status === 204 ? undefined as T : response.json();
}

export async function uploadAttachment(taskId:number,file:File):Promise<void> {
  const body=new FormData();body.append('file',file);
  const response=await fetch(`${base}/issues/${taskId}/attachments`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});
  await checkResponse(response);
}

export async function downloadAttachment(id:number,filename:string):Promise<void> {
  const response=await fetch(`${base}/attachments/${id}/download`,{headers:{Authorization:`Bearer ${token}`}});
  await checkResponse(response);
  const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function websiteAsset(path:string):string {
  if (!path.startsWith('/api/')) return path;
  return new URL(base, window.location.origin).origin + path;
}
export async function replaceWebsiteImage<T>(slot:string,file:File):Promise<T> {
  const body=new FormData();body.append('file',await compressImage(file));
  const response=await fetch(`${base}/website/assets/${slot}`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});
  await checkResponse(response);
  return response.json();
}

export async function uploadPortfolioPhoto<T>(sectionId:string,file:File):Promise<T> {
  const body=new FormData();body.append('file',await compressImage(file));
  const response=await fetch(`${base}/website/portfolio/sections/${sectionId}/photos`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});
  await checkResponse(response);
  return response.json();
}
