import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile('dist/'+path,'utf8');
const home=await read('index.html'),portfolio=await read('portfolio/index.html'),login=await read('app/index.html'),sitemap=await read('sitemap.xml');
for(const html of [home,portfolio,login]){
 assert.equal((html.match(/<title>/g)||[]).length,1);
 assert.equal((html.match(/name="description"/g)||[]).length,1);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert.match(html,/<h1>/);
 assert.match(html,/property="og:title"/);
 assert.doesNotMatch(html,/refresh_token|GOOGLE_CLIENT_SECRET|source_wordpress_id/);
}
assert.match(home,/Graphic Design/);assert.match(portfolio,/BreadcrumbList/);
assert.match(login,/noindex, nofollow/);assert.doesNotMatch(sitemap,/\/app|api\/|localhost/);
for(const match of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)){
 const url=new URL(match[1]);const html=await read(url.pathname.slice(1)+(url.pathname==='/'?'':'/')+'index.html');
 assert.ok(html.includes(`href="${url.href}"`));assert.doesNotMatch(html,/noindex/);
}
assert.match(await read('robots.txt'),/Sitemap:/);
assert.match(await read('.htaccess'),/R=301/);
console.log('SEO checks passed: unique metadata, canonical URLs, crawlable HTML, sitemap pages, private login and redirects.');
