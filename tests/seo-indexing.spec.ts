// Indexability: what a crawler receives for the public pages, the redirect map, preview-site noindex mode,
// and that /contact keeps its own SEO tags after the React app renders it.
import {test,expect} from '@playwright/test';
import {execSync} from 'node:child_process';
import {createServer,type Server} from 'node:http';
import {readFileSync,existsSync,statSync,mkdtempSync,cpSync,writeFileSync} from 'node:fs';
import {resolve,extname,join} from 'node:path';
import {tmpdir} from 'node:os';
import content from './fixtures/website';

const dist=resolve('dist'),API='https://api.nial.in';
const read=(p:string)=>readFileSync(join(dist,p),'utf8');
const build=(extra:Record<string,string>={})=>execSync('npm run build',{env:{...process.env,VITE_API_URL:`${API}/api/v1`,VITE_SITE_URL:'https://nial.in',...extra},stdio:'ignore'});
const jsonLd=(html:string)=>JSON.parse(html.match(/<script id="site-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/)![1])['@graph'] as Record<string,unknown>[];
const meta=(html:string,name:string)=>html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))?.[1];
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain','.xml':'application/xml'};

test.describe.configure({mode:'serial'});
test.afterAll(()=>{build();}); // always leave dist as a normal production build

test.describe('production build',()=>{
  test.beforeAll(()=>{build();});

  test('homepage HTML (no JavaScript) carries the contact details and Organization/ContactPoint data',()=>{
    const html=read('index.html');
    expect(html).toContain('href="tel:+917909058028"');expect(html).toContain('+91 79090 58028');
    expect(html).toContain('href="https://wa.me/917909058028"');expect(html).toContain('instagram.com/nayyer.ali1');expect(html).toContain('maps.app.goo.gl');
    expect(html).toContain('<a href="/contact">');
    expect(html).not.toContain('mailto:');           // nothing invented while no email has been entered
    expect(html).not.toContain('Location:');
    expect(meta(html,'robots')).toBe('index, follow, max-image-preview:large');
    const org=jsonLd(html).find(n=>n['@type']==='Organization') as Record<string,any>;
    expect(org.telephone).toBe('+917909058028');
    expect(org.contactPoint[0]).toMatchObject({'@type':'ContactPoint',telephone:'+917909058028',contactType:'customer support'});
    expect(org.sameAs).toContain('https://www.instagram.com/nayyer.ali1/');
    expect(org.email).toBeUndefined();
  });

  test('/contact is a real indexable page, canonical to itself, listed in the sitemap',()=>{
    const html=read('contact/index.html');
    expect(html).toMatch(/<title>Contact NialTech \|/);expect(html).toContain('<h1>Contact NialTech</h1>');
    expect(html).toContain('<link rel="canonical" href="https://nial.in/contact">');
    expect(meta(html,'robots')).toBe('index, follow, max-image-preview:large');
    expect(html).toContain('href="tel:+917909058028"');
    const graph=jsonLd(html);expect(graph.map(n=>n['@type'])).toEqual(expect.arrayContaining(['Organization','ContactPage','BreadcrumbList']));
    const sitemap=read('sitemap.xml');expect(sitemap).toContain('<loc>https://nial.in/contact</loc>');
    expect(sitemap.match(/<loc>/g)!.length).toBe(14);expect(sitemap).toContain('<loc>https://nial.in/about</loc>');
    for(const u of ['https://nial.in/','https://nial.in/portfolio','https://nial.in/portfolio/graphic-design'])expect(sitemap).toContain(`<loc>${u}</loc>`);
    expect(sitemap).not.toContain('/app');
    expect(read('app/index.html')).toContain('noindex, nofollow');
    expect(read('robots.txt')).toBe('User-agent: *\nAllow: /\n\nSitemap: https://nial.in/sitemap.xml\n');
  });

  test('.htaccess: one canonical host, old WordPress URLs redirect, no noindex header',()=>{
    const h=read('.htaccess');
    expect(h).toContain('RewriteCond %{HTTP_HOST} ^www\\.nial\\.in$ [NC]');expect(h).toContain('RewriteRule ^ https://nial.in%{REQUEST_URI} [R=301,L]');
    for(const rule of ['^mytime(?:/.*)?$ /app','^home/?$ / [R=301,L]','^about-us/?$ /about [R=301,L]','^services/?$ /#services [NE,R=301,L]','^contact-us/?$ /contact','^(?:work|our-work|portfolio-2|gallery)/?$ /portfolio','^graphic-design/?$ /portfolio/graphic-design'])expect(h,rule).toContain(rule);
    expect(h).not.toContain('X-Robots-Tag');
    // redirect targets must exist in the build
    for(const target of ['about/index.html','contact/index.html','portfolio/index.html','portfolio/graphic-design/index.html','app/index.html'])expect(existsSync(join(dist,target)),target).toBe(true);
  });
});

test.describe('brand and name signals',()=>{
  test.beforeAll(()=>{build();});
  test('Organization/WebSite declare Nial Tech, Nial and nial.in as alternate names; Nayyer Ali is a linked Person',()=>{
    for(const page of ['index.html','about/index.html','contact/index.html']){
      const graph=jsonLd(read(page));
      const org=graph.find(n=>n['@type']==='Organization') as Record<string,any>;
      expect(org.name).toBe('NialTech');expect(org.alternateName).toEqual(['Nial Tech','Nial','nial.in']);
      expect(org.founder).toEqual({'@id':'https://nial.in/#person'});
      const person=graph.find(n=>n['@type']==='Person') as Record<string,any>;
      expect(person).toMatchObject({name:'Nayyer Ali',url:'https://nial.in/about'});expect(person.sameAs).toContain('https://www.instagram.com/nayyer.ali1/');
    }
    const site=jsonLd(read('index.html')).find(n=>n['@type']==='WebSite') as Record<string,any>;
    expect(site).toMatchObject({name:'NialTech',alternateName:['Nial Tech','Nial','nial.in'],url:'https://nial.in/'});
  });
  test('/about is an indexable page about NialTech and Nayyer Ali, linked from the homepage and nav',()=>{
    const html=read('about/index.html');
    expect(html).toMatch(/<title>About NialTech \(Nial Tech\) and Nayyer Ali \|/);
    expect(html).toContain('<h1>About NialTech and Nayyer Ali</h1>');
    expect(html).toContain('<link rel="canonical" href="https://nial.in/about">');
    expect(meta(html,'robots')).toBe('index, follow, max-image-preview:large');
    for(const name of ['Nial Tech','nial.in','Nayyer Ali'])expect(html,name).toContain(name);
    expect(jsonLd(html).map(n=>n['@type'])).toEqual(expect.arrayContaining(['AboutPage','BreadcrumbList','Person']));
    const home=read('index.html');expect(home).toContain('href="/about"');expect(home).toContain('Nayyer Ali');expect(home).toContain('Nial Tech');
  });
  test('every name variant appears in visible text a crawler can read on the homepage',()=>{
    const text=read('index.html').replace(/<script[\s\S]*?<\/script>/g,' ').replace(/<[^>]+>/g,' ');
    for(const name of ['NialTech','Nial Tech','nial.in','Nayyer Ali'])expect(text,name).toContain(name);
  });
});

test('contact details entered in the website editor are published in the HTML and structured data',()=>{
  const dir=mkdtempSync(join(tmpdir(),'seo-'));cpSync(resolve('seo-data'),dir,{recursive:true});
  const c=JSON.parse(readFileSync(join(dir,'content.json'),'utf8'));Object.assign(c,{email:'hello@nial.in',phone:'+91 98765 43210',location:'Noida, India'});writeFileSync(join(dir,'content.json'),JSON.stringify(c));
  build({SEO_DATA_DIR:dir});
  for(const page of ['index.html','contact/index.html']){
    const html=read(page);
    expect(html,page).toContain('href="mailto:hello@nial.in"');expect(html,page).toContain('href="tel:+919876543210"');expect(html,page).toContain('Location: Noida, India');
    const org=jsonLd(html).find(n=>n['@type']==='Organization') as Record<string,any>;
    expect(org.email).toBe('hello@nial.in');expect(org.contactPoint[0].email).toBe('hello@nial.in');
  }
});

test('SEO_NOINDEX preview mode: noindex everywhere, robots disallow, no sitemap, X-Robots-Tag header',()=>{
  build({SEO_NOINDEX:'true'});
  for(const page of ['index.html','contact/index.html','portfolio/index.html','portfolio/graphic-design/index.html','app/index.html'])expect(meta(read(page),'robots'),page).toBe('noindex, nofollow');
  expect(read('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
  expect(existsSync(join(dist,'sitemap.xml'))).toBe(false);
  expect(read('.htaccess')).toContain('Header always set X-Robots-Tag "noindex, nofollow"');
});

test.describe('in the browser',()=>{
  let server:Server,origin='';
  test.beforeAll(async()=>{
    build();
    server=createServer((req,res)=>{const path=decodeURIComponent((req.url||'/').split('?')[0]);let f=join(dist,path);if(existsSync(f)&&statSync(f).isDirectory())f=join(f,'index.html');if(!existsSync(f))f=join(dist,'index.html');res.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream'});res.end(readFileSync(f));});
    await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  });
  test.afterAll(()=>server.close());
  async function open(page:import('@playwright/test').Page,path:string){
    await page.route('https://fonts.googleapis.com/**',r=>r.abort());
    await page.route(`${API}/api/v1/website`,r=>r.fulfill({json:content}));
    await page.route(`${API}/api/v1/website/portfolio`,r=>r.fulfill({json:{sections:[],photos:[]}}));
    await page.route(`${API}/api/v1/website/reviews`,r=>r.fulfill({json:{rating:null,reviews:[]}}));
    await page.route(`${API}/api/v1/website/assets/**`,r=>r.abort());
    await page.goto(origin+path);await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();
    await page.waitForFunction(()=>document.querySelector('#site-structured-data')&&document.querySelector('.site-contact'));
  }
  test('/contact keeps its own title, canonical and ContactPage data once the app has rendered',async({page})=>{
    await open(page,'/contact/');
    expect(await page.title()).toMatch(/^Contact NialTech \|/);
    expect(await page.locator('link[rel=canonical]').getAttribute('href')).toBe('https://nial.in/contact');
    expect(await page.locator('meta[name=robots]').getAttribute('content')).toBe('index, follow, max-image-preview:large');
    const graph=JSON.parse(await page.locator('#site-structured-data').innerText())['@graph'] as {'@type':string}[];
    expect(graph.map(n=>n['@type'])).toEqual(expect.arrayContaining(['Organization','ContactPage']));
    await expect(page.locator('#contact')).toBeVisible();
    await expect(page.locator('a[href="tel:+917909058028"]').first()).toBeVisible();
  });
  test('/about keeps its own title, canonical and AboutPage data once the app has rendered',async({page})=>{
    await open(page,'/about/');
    expect(await page.title()).toMatch(/^About NialTech \(Nial Tech\) and Nayyer Ali \|/);
    expect(await page.locator('link[rel=canonical]').getAttribute('href')).toBe('https://nial.in/about');
    const graph=JSON.parse(await page.locator('#site-structured-data').innerText())['@graph'] as Record<string,any>[];
    expect(graph.map(n=>n['@type'])).toEqual(expect.arrayContaining(['Organization','Person','AboutPage']));
    expect(graph.find(n=>n['@type']==='Organization')!.alternateName).toContain('Nial Tech');
    await expect(page.locator('.site-footer-identity')).toContainText('Nayyer Ali');
  });
  test('the homepage still canonicalises to / after rendering',async({page})=>{
    await open(page,'/');
    expect(await page.locator('link[rel=canonical]').getAttribute('href')).toBe('https://nial.in/');
    expect(await page.title()).toMatch(/^NialTech \| Graphic Design/);
    const org=(JSON.parse(await page.locator('#site-structured-data').innerText())['@graph'] as Record<string,any>[]).find(n=>n['@type']==='Organization')!;
    expect(org.contactPoint[0].telephone).toBe('+917909058028');
  });
});
