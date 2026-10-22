import {test,expect} from '@playwright/test';
import {workspace} from './helpers/workspace';

test('sign in, task creation, and blocking stay inside the workspace',async({page})=>{
  const {writes}=await workspace(page);
  await page.screenshot({path:test.info().outputPath('board.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Create task',exact:true}).click();
  const form=page.getByRole('dialog');
  await expect(form).toBeVisible();
  await form.getByLabel('Title',{exact:true}).fill('Prepare the release notes');
  await form.getByLabel('Estimate (minutes)').fill('60');
  await form.getByLabel('Due date').fill('2026-11-22');
  await form.getByRole('button',{name:'Save',exact:true}).click();
  await expect(form).not.toBeVisible();
  await expect(page.getByRole('heading',{name:'Prepare the release notes'})).toBeVisible();
  const card=page.locator('.task').filter({hasText:'Prepare the release notes'});
  await card.getByRole('combobox').selectOption('blocked');
  await expect(form.getByRole('heading',{name:'What’s blocking this task?'})).toBeVisible();
  await form.getByLabel('Blocking reason').fill('Waiting for review');
  await form.getByRole('button',{name:'Mark as blocked'}).click();
  await expect(form).not.toBeVisible();
  await expect(page.locator('.column-blocked').getByRole('heading',{name:'Prepare the release notes'})).toBeVisible();
  expect(writes.some(w=>w.body.note==='Waiting for review')).toBeTruthy();
});

test('project dialogs preserve planning and member allocation inputs',async({page})=>{
  const {writes}=await workspace(page);
  await page.getByRole('button',{name:'Projects',exact:true}).click();
  await expect(page.getByRole('button',{name:'Workspace design',exact:true})).toBeVisible();
  await page.screenshot({path:test.info().outputPath('projects.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Workspace design',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:'Project planning'})).toBeVisible();
  await dialog.getByLabel('Planned cost',{exact:true}).fill('321.25');
  await dialog.getByRole('button',{name:'Save project'}).click();
  await dialog.getByRole('button',{name:/Members & allocation/}).click();
  await dialog.getByText('Add a member',{exact:true}).click();
  await dialog.getByLabel('Allocation (%)',{exact:true}).fill('50');
  await dialog.getByRole('button',{name:'Allocate member'}).click();
  await expect(dialog.getByText('Taylor Kim · 50% · Active')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(writes.find(w=>w.path==='/projects/1'&&w.body.cost==='321.25')).toBeTruthy();
  expect(writes.find(w=>w.path==='/projects/1/members'&&w.body.allocation_percent==='50')).toBeTruthy();
});

test('issue creation preserves feature metadata and returns focus after closing',async({page})=>{
  const {members,writes}=await workspace(page);
  members.push({id:1,user_id:2,name:'Taylor Kim',active:true,allocation_percent:'100'});
  await page.getByRole('button',{name:'Issues & backlog',exact:true}).click();
  await page.getByRole('button',{name:'Create issue',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Summary',{exact:true}).fill('A thoughtful new feature');
  await expect(dialog.getByLabel('Allocated assignee')).toContainText('Taylor Kim');
  await dialog.getByLabel('Issue type',{exact:true}).selectOption('feature');
  await dialog.getByLabel('Planned cost',{exact:true}).fill('1234.50');
  await dialog.getByLabel('Planned date',{exact:true}).fill('2026-11-01');
  await dialog.getByLabel('Release date',{exact:true}).fill('2026-11-30');
  await expect(dialog).toHaveCSS('opacity','1');
  await expect(dialog).toHaveCSS('background-color','rgb(255, 255, 255)');
  await page.screenshot({path:test.info().outputPath('issue-dialog.png'),fullPage:true,animations:'disabled'});
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Create issue',exact:true})).toBeFocused();
  expect(writes.find(w=>w.path==='/issues')?.body).toMatchObject({kind:'feature',cost:'1234.50',planned_date:'2026-11-01',release_date:'2026-11-30'});
});

test('table sorting and pagination operate on loaded records',async({page})=>{
  await workspace(page,{taskCount:25});
  await page.getByRole('button',{name:'List view',exact:true}).click();
  await expect(page.getByText('1–10 of 25 records')).toBeVisible();
  await page.getByRole('button',{name:'Next page'}).click();
  await expect(page.getByText('11–20 of 25 records')).toBeVisible();
  await page.getByRole('button',{name:'Title',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:'Title'})).toHaveAttribute('aria-sort','ascending');
  await expect(page.getByText('1–10 of 25 records')).toBeVisible();
});

test('mobile navigation and keyboard page search work without page overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await workspace(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.screenshot({path:test.info().outputPath('mobile.png'),fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Open navigation'}).click();
  const navigation=page.getByRole('dialog',{name:'Workspace navigation'});
  await navigation.getByRole('button',{name:'Projects',exact:true}).click();
  await expect(navigation).not.toBeVisible();
  await expect(page.getByRole('heading',{name:'Projects',exact:true})).toBeVisible();
  await page.keyboard.press('Control+k');
  const quick=page.getByRole('dialog',{name:'Jump to a view'});
  await quick.getByRole('textbox',{name:'Search pages…'}).fill('report');
  await quick.getByRole('button',{name:'Reports',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Reports',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});

test('validation errors stay readable and keep unsaved form input',async({page})=>{
  await workspace(page);
  await page.route('**/api/v1/tasks',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({detail:[{loc:['body','due_date'],msg:'Choose a working day'}]})});
  });
  await page.getByRole('button',{name:'Create task',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Title',{exact:true}).fill('Keep my draft');
  await dialog.getByLabel('Estimate (minutes)').fill('45');
  await dialog.getByLabel('Due date').fill('2026-11-20');
  await dialog.getByRole('button',{name:'Save',exact:true}).click();
  await expect(dialog.getByRole('alert')).toHaveText('Due date: Choose a working day');
  await expect(dialog.getByLabel('Title',{exact:true})).toHaveValue('Keep my draft');
});

test('an expired session returns to sign-in with an explanation',async({page})=>{
  await workspace(page);
  await page.route('**/api/v1/tasks',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({detail:'Session expired'})}));
  await page.getByRole('button',{name:'Refresh records',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(/session.*expired/i);
});

test('sign-in offers password visibility and adapts to a narrow screen',async({page})=>{
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.goto('/');
  await page.screenshot({path:test.info().outputPath('sign-in.png'),fullPage:true,animations:'disabled'});
  await page.getByLabel('Password',{exact:true}).fill('example-password');
  await page.getByRole('button',{name:'Show password'}).click();
  await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Hide password'}).click();
  await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('type','password');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await expect(page.getByRole('button',{name:'Sign in to your workspace'})).toBeVisible();
});
