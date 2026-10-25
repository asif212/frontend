import {test,expect} from '@playwright/test';
import content from './fixtures/website';

test.beforeEach(async({page})=>{
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.route('**/api/v1/website',r=>r.fulfill({json:content}));
 await page.route('**/api/v1/website/portfolio',r=>r.fulfill({json:{sections:[],photos:[]}}));
});

test('public website, project details, and MyTime sign-in',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1})).toContainText('Good stories deserve');
 await expect(page.getByRole('heading',{name:'Made to be remembered.'})).toBeVisible();
 await page.getByRole('button',{name:/A study in light/}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('dialog')).toContainText('Portfolio preview');
 await page.keyboard.press('Escape');
 await page.getByRole('link',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/app$/);
 await expect(page.getByLabel('Username',{exact:true})).toBeVisible();
});

test('phone navigation and layout',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Mobile website navigation'}).getByRole('link',{name:'Services'}).click();
 await expect(page).toHaveURL(/#services$/);
 await expect(page.getByRole('button',{name:'Open navigation'})).toHaveAttribute('aria-expanded','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('administrator can edit content and replace a fixed image',async({page})=>{
 let current=structuredClone(content),published=false,replaced=false;
 await page.route('**/api/v1/**',async r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/website/portfolio'))return r.fulfill({json:{sections:[],photos:[]}});
  if(path.endsWith('/auth/login'))return r.fulfill({json:{access_token:'test',user:{id:1,name:'Administrator',role:'super_admin',must_change_password:false}}});
  if(path.endsWith('/website/assets/about')){replaced=true;return r.fulfill({json:current});}
  if(path.endsWith('/website')){if(r.request().method()==='PATCH'){current={...r.request().postDataJSON(),images:{},limits:content.limits};published=true;}return r.fulfill({json:current});}
  return r.fulfill({json:[]});
 });
 await page.goto('/app');
 await page.getByLabel('Username',{exact:true}).fill('admin');
 await page.getByLabel('Password',{exact:true}).fill('test-password-123');
 await page.getByRole('button',{name:'Sign in to your workspace',exact:true}).click();
 await page.getByRole('button',{name:'Website content',exact:true}).click();
 await page.getByLabel('Main headline').fill('A new perspective.');
 await page.getByRole('button',{name:'Save & publish content'}).click();
 await expect(page.getByRole('status')).toContainText('Published.');
 expect(published).toBe(true);
 expect(current.hero_title).toBe('A new perspective.');
 await page.locator('.website-image-grid input[type=file]').first().setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP8z4AdMOEQH6QSAM1BAQ/oQeJvAAAAAElFTkSuQmCC','base64')});
 await expect(page.getByRole('status')).toContainText('Image replaced');
 expect(replaced).toBe(true);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

const initialPortfolio={sections:[{id:'graphic-design',title:'Graphic Design',description:'Design work',parent_id:null as string|null,cover_id:'photo-one' as string|null},{id:'brand-design',title:'Brand Design',description:'Visual identities',parent_id:'graphic-design' as string|null,cover_id:'photo-one' as string|null}],photos:[{id:'photo-one',section_id:'brand-design',name:'Brand study',url:'/assets/website/work-2.webp'}]};

test('original logo and Get in touch link to WhatsApp',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.site-header .site-original-logo')).toHaveAttribute('src','/assets/website/nial-logo.png');
 await expect(page.getByRole('navigation',{name:'Website navigation'}).getByRole('link',{name:'Get in touch',exact:true})).toHaveAttribute('href','https://wa.me/917909058028');
 await expect(page.getByRole('link',{name:'Get in touch on WhatsApp'})).toHaveAttribute('href','https://wa.me/917909058028');
 await expect(page.getByRole('navigation',{name:'Website navigation'}).getByRole('link',{name:'Portfolio',exact:true})).toHaveAttribute('href','/portfolio');
});

test('public nested portfolio, gallery and mobile layout',async({page})=>{
 await page.route('**/api/v1/website/portfolio',r=>r.fulfill({json:initialPortfolio}));
 await page.goto('/portfolio');
 await page.getByRole('link',{name:/Graphic Design.*sections/}).click();
 await expect(page.getByRole('heading',{level:1,name:'Graphic Design'})).toBeVisible();
 await page.getByRole('link',{name:/Brand Design.*photos/}).click();
 await expect(page.getByRole('heading',{level:1,name:'Brand Design'})).toBeVisible();
 await page.getByRole('button',{name:'View Brand study'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await expect(page.locator('.portfolio-page-heading img')).toHaveAttribute('src','/assets/website/work-2.webp');
});

test('admin creates parents and children, uploads multiple photos and chooses a shared cover',async({page})=>{
 let portfolio=structuredClone(initialPortfolio),sequence=0;
 await page.route('**/api/v1/**',async r=>{
  const path=new URL(r.request().url()).pathname,method=r.request().method();
  if(path.endsWith('/auth/login'))return r.fulfill({json:{access_token:'test',user:{id:1,name:'Administrator',role:'super_admin',must_change_password:false}}});
  if(path.includes('/website/portfolio')){
   if(path.endsWith('/sections')&&method==='POST')portfolio.sections.push({id:`section-${++sequence}`,source_wordpress_id:1399,...r.request().postDataJSON()} as typeof portfolio.sections[number]);
   else if(path.endsWith('/photos')&&method==='POST'){
    const sectionId=path.split('/').at(-2)!;
    const id=`uploaded-${++sequence}`;
    const name=sequence===3?'cover-one.png':'cover-two.png';
    portfolio.photos.push({id,section_id:sectionId,name,url:'/assets/website/work-1.webp'});
    const section=portfolio.sections.find(s=>s.id===sectionId)!;section.cover_id ||= id;
   }else if(method==='PATCH'){const payload=r.request().postDataJSON();expect(Object.keys(payload).sort()).toEqual(['cover_id','description','parent_id','title']);Object.assign(portfolio.sections.find(s=>s.id===path.split('/').at(-1)),payload);}
   return r.fulfill({json:portfolio});
  }
  if(path.endsWith('/website'))return r.fulfill({json:content});
  return r.fulfill({json:[]});
 });
 await page.goto('/app');
 await page.getByLabel('Username',{exact:true}).fill('admin');
 await page.getByLabel('Password',{exact:true}).fill('test-password-123');
 await page.getByRole('button',{name:'Sign in to your workspace',exact:true}).click();
 await page.getByRole('button',{name:'Website content',exact:true}).click();
 await page.getByRole('button',{name:'New parent section'}).click();
 await page.getByLabel('Section title',{exact:true}).fill('Brand stories');
 await page.getByRole('button',{name:'Create section',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Edit Brand stories',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Add child section'}).click();
 await page.getByLabel('Section title',{exact:true}).fill('A day in colour');
 await expect(page.getByLabel('Parent section',{exact:true})).toHaveValue('section-1');
 await page.getByRole('button',{name:'Create section',exact:true}).click();
 await page.locator('.portfolio-upload input').setInputFiles([{name:'cover-one.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP8z4AdMOEQH6QSAM1BAQ/oQeJvAAAAAElFTkSuQmCC','base64')},{name:'cover-two.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP8z4AdMOEQH6QSAM1BAQ/oQeJvAAAAAElFTkSuQmCC','base64')}]);
 await expect(page.locator('.portfolio-manager').getByRole('status')).toHaveText('2 photos uploaded and published.');
 expect(portfolio.photos).toHaveLength(3);
 await page.getByRole('navigation',{name:'Portfolio sections'}).getByRole('button',{name:'Brand stories',exact:true}).click();
 await page.getByRole('button',{name:'Choose cover from uploads'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'cover-two.png',exact:true}).click();
 await page.getByRole('button',{name:'Save section',exact:true}).click();
 await expect(page.locator('.portfolio-manager').getByRole('status')).toHaveText('Section published.');
 expect(portfolio.sections.find(s=>s.id==='section-1')?.cover_id).toBe('uploaded-4');
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('shared header highlights portfolio and exposes Instagram and Maps on mobile',async({page})=>{
 await page.goto('/portfolio');
 const nav=page.getByRole('navigation',{name:'Website navigation'});
 await expect(nav.getByRole('link',{name:'Portfolio',exact:true})).toHaveAttribute('aria-current','page');
 const utility=page.locator('.site-header-inline-socials');
 await expect(utility.getByRole('link',{name:'Instagram',exact:true})).toHaveAttribute('href','https://www.instagram.com/nayyer.ali1/');
 await expect(utility.getByRole('link',{name:'Google Maps',exact:true})).toHaveAttribute('href','https://maps.app.goo.gl/VLryJgg4qdqUcgQ79');
 await expect(utility.getByRole('link',{name:'Instagram',exact:true})).toHaveAttribute('target','_blank');
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  await page.getByRole('button',{name:'Open navigation'}).click();
  await expect(page.getByRole('navigation',{name:'Mobile website navigation'}).getByRole('link',{name:'Home',exact:true})).toBeVisible();
  await expect(page.locator('.site-mobile-socials').getByRole('link',{name:'Instagram',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Open navigation'})).toHaveAttribute('aria-expanded','false');
 }
});

test('website defaults to dark and remembers the selected theme across public pages',async({page})=>{
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-site-theme','dark');
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-site-theme','light');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-site-theme','light');
 await page.getByRole('navigation',{name:'Website navigation'}).getByRole('link',{name:'Portfolio',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-site-theme','light');
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-site-theme','dark');
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  await expect(page.getByRole('button',{name:'Switch to light mode',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.goto('/app');
 await expect(page.locator('html')).not.toHaveAttribute('data-site-theme');
 await expect(page.getByLabel('Username',{exact:true})).toBeVisible();
});

const scrollPortfolio={sections:Array.from({length:5},(_,i)=>({id:`creative-${i}`,title:`Creative collection ${i+1}`,description:'',parent_id:null,cover_id:'scroll-photo'})),photos:[{id:'scroll-photo',section_id:'creative-0',name:'Creative work',url:'/assets/website/work-2.webp'}]};

test('homepage scroll pins the portfolio while the artwork moves and hero drifts',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.route('**/api/v1/website/portfolio',r=>r.fulfill({json:scrollPortfolio}));
 await page.goto('/');await expect(page.locator('.scroll-portfolio-track')).toBeVisible();
 const heroBefore=await page.locator('.hero-atmosphere').evaluate(el=>getComputedStyle(el).transform);
 await page.evaluate(()=>window.scrollTo(0,250));
 await expect.poll(()=>page.locator('.hero-atmosphere').evaluate(el=>getComputedStyle(el).transform)).not.toBe(heroBefore);
 const geometry=await page.locator('.scroll-portfolio').evaluate(el=>{const header=document.querySelector('.site-header')!.getBoundingClientRect().height;return {top:el.getBoundingClientRect().top+scrollY-header,range:el.clientHeight-(innerHeight-header),header};});
 await page.evaluate(g=>window.scrollTo(0,g.top+g.range*.1),geometry);
 await expect.poll(()=>page.locator('.scroll-portfolio').evaluate(el=>Number(getComputedStyle(el).getPropertyValue('--portfolio-progress')))).toBeGreaterThan(.08);
 const before=await page.locator('.scroll-portfolio-track').evaluate(el=>el.style.transform);
 const topBefore=(await page.locator('.scroll-portfolio-stage').boundingBox())!.y;
 await page.evaluate(g=>window.scrollTo(0,g.top+g.range*.7),geometry);
 await expect.poll(()=>page.locator('.scroll-portfolio-track').evaluate(el=>el.style.transform)).not.toBe(before);
 expect(Math.abs((await page.locator('.scroll-portfolio-stage').boundingBox())!.y-topBefore)).toBeLessThan(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
 await page.locator('.scroll-portfolio-card').nth(3).click();
 await expect(page).toHaveURL(/\/portfolio\/creative-3$/);
});

test('homepage scroll experience has a static reduced-motion fallback and fits phones',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/v1/website/portfolio',r=>r.fulfill({json:scrollPortfolio}));
 await page.goto('/');await expect(page.locator('.scroll-portfolio-card')).toHaveCount(5);
 await expect(page.locator('.scroll-portfolio-stage')).toHaveCSS('position','relative');
 await expect(page.locator('.scroll-portfolio-track')).toHaveCSS('transform','none');
 await expect(page.locator('.hero-scroll-scene>.site-hero')).toHaveCSS('position','relative');
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.emulateMedia({reducedMotion:'no-preference'});
 const geometry=await page.locator('.scroll-portfolio').evaluate(el=>{const header=document.querySelector('.site-header')!.getBoundingClientRect().height;return {top:el.getBoundingClientRect().top+scrollY-header,range:el.clientHeight-(innerHeight-header)};});
 await page.evaluate(g=>window.scrollTo(0,g.top+g.range*.5),geometry);
 await expect(page.locator('.scroll-portfolio-stage')).toHaveCSS('position','sticky');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
