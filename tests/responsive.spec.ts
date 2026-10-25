import {test,expect,type Page} from '@playwright/test';
import {workspace} from './helpers/workspace';

const pages=[
  ['Team board','Create task'],['Projects','New project'],['Issues & backlog','Create issue'],['Sprints','Create sprint'],
  ['People','Add employee'],['Employee profiles',null],['Attendance',null],['Attendance corrections',null],
  ['Attendance calendar',null],['Leave & approvals',null],['Leave balances','Enroll employee'],['Holiday calendar','Add holiday'],
  ['Notifications',null],['Reports',null],['Work locations','Add location'],['Leave policies','New policy'],
  ['Audit history',null],['Team settings',null],
] as const;

async function navigate(page:Page,name:string){
  await page.keyboard.press('Control+k');
  const dialog=page.getByRole('dialog',{name:'Jump to a view'});
  await dialog.getByRole('button',{name,exact:true}).click();
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.locator('.loading-state')).toHaveCount(0);
}

async function fits(page:Page,label:string){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${label} must not overflow the page`).toBeTruthy();
}

async function dialogFits(page:Page,label:string){
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity','1');
  const rect=await dialog.boundingBox();const viewport=page.viewportSize()!;
  expect(rect!.x,`${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(rect!.y,`${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(rect!.x+rect!.width,`${label} right edge`).toBeLessThanOrEqual(viewport.width+1);
  expect(rect!.y+rect!.height,`${label} bottom edge`).toBeLessThanOrEqual(viewport.height+1);
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1),`${label} dialog horizontal overflow`).toBeTruthy();
  const body=dialog.locator('.dialog-body');
  expect(await body.evaluate(element=>element.scrollWidth<=element.clientWidth+1),`${label} form horizontal overflow`).toBeTruthy();
  for(const control of await dialog.locator('input:not([type=hidden]),select,textarea').all()){
    const box=await control.boundingBox();
    if(box)expect(box.x+box.width,`${label} field fits width`).toBeLessThanOrEqual(viewport.width+1);
  }
  await fits(page,label);
}

for(const width of [320,390,768,1024]){
  test(`all lead pages and creation dialogs fit at ${width}px`,async({page})=>{
    test.setTimeout(90000);
    await page.setViewportSize({width,height:820});
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await workspace(page,{populated:true});
    for(const [name,create] of pages){
      await test.step(name,async()=>{
        await navigate(page,name);await fits(page,name);
        if(width===390&&['Reports','Team settings','Issues & backlog'].includes(name))await page.screenshot({path:test.info().outputPath(name.replaceAll(' ','-')+'.png'),fullPage:true,animations:'disabled'});
        if(create){await page.getByRole('button',{name:create,exact:true}).click();await dialogFits(page,`${name} creation`);await page.keyboard.press('Escape');}
        if(name==='Projects'){
          await page.getByRole('button',{name:'Workspace design',exact:true}).click();await dialogFits(page,'Project planning');
          await page.getByRole('button',{name:/Members & allocation/}).click();await page.getByText('Add a member',{exact:true}).click();await dialogFits(page,'Project allocation');await page.keyboard.press('Escape');
        }
        if(name==='Issues & backlog'||name==='Leave balances'){
          await page.locator('.data-card').getByRole('button',{name:/^Open /}).first().click();await dialogFits(page,name+' details');await page.keyboard.press('Escape');
        }
        if(name==='Employee profiles'){
          await page.getByRole('button',{name:'Edit profile'}).last().click();await expect(page.getByRole('button',{name:'Save profile'})).toBeVisible();await dialogFits(page,'Employee profile');await page.keyboard.press('Escape');
        }
      });
    }
    expect(errors).toEqual([]);
  });
}

test('member leave and attendance correction forms fit a narrow phone',async({page})=>{
  await page.setViewportSize({width:320,height:640});await workspace(page,{role:'member',populated:true});
  for(const [name,button] of [['Leave & approvals','Request leave'],['Attendance corrections','Request correction']]){
    await navigate(page,name);await page.getByRole('button',{name:button,exact:true}).click();await dialogFits(page,button);await page.keyboard.press('Escape');
  }
});

test('administrator team management fits a narrow phone',async({page})=>{
  await page.setViewportSize({width:320,height:640});await workspace(page,{role:'super_admin',populated:true});
  await fits(page,'Teams');await page.getByRole('button',{name:'Create team',exact:true}).click();await dialogFits(page,'Create team');await page.keyboard.press('Escape');
  await page.getByText('Create a team lead',{exact:true}).click();await fits(page,'Create team lead');
  const fields=page.locator('.panel input,.panel select');
  for(const field of await fields.all()){const box=await field.boundingBox();if(box)expect(box.x+box.width).toBeLessThanOrEqual(321);}
});

test('issue creation fits a short landscape viewport',async({page})=>{
  await page.setViewportSize({width:740,height:360});await workspace(page,{populated:true});await navigate(page,'Issues & backlog');
  await page.getByRole('button',{name:'Create issue',exact:true}).click();await dialogFits(page,'Landscape issue');
  const save=page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true});await expect(save).toBeInViewport();
});

test('mandatory password change fits a narrow phone',async({page})=>{
  await page.setViewportSize({width:320,height:640});
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('**/api/v1/auth/login',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'test',user:{id:2,name:'Taylor Kim',role:'member',must_change_password:true}})}));
  await page.goto('/app');await page.getByLabel('Username',{exact:true}).fill('taylor');await page.getByLabel('Password',{exact:true}).fill('temporary-password');
  await page.getByRole('button',{name:'Sign in to your workspace'}).click();
  await expect(page.getByRole('heading',{name:'Make it your own'})).toBeVisible();await fits(page,'Password change');
  await expect(page.getByLabel('New password',{exact:true})).toBeVisible();
});

test.describe('touch phone',()=>{
  test.use({isMobile:true,hasTouch:true});
  test('every lead page fits with touch controls',async({page})=>{
    test.setTimeout(60000);await page.setViewportSize({width:390,height:844});await workspace(page,{populated:true});
    for(const [name] of pages){await navigate(page,name);await fits(page,'Touch '+name);}
    await navigate(page,'Issues & backlog');await page.getByRole('button',{name:'Create issue',exact:true}).click();await dialogFits(page,'Touch issue form');
    await expect(page.getByRole('dialog').getByRole('button',{name:'Save changes'})).toBeInViewport();
  });
});
