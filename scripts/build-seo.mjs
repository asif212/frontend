// Generate crawlable HTML from public content only. Never copy private website_data files.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadEnv} from 'vite';
const env={...loadEnv('production',process.cwd(),''),...process.env};
const origin=new URL(env.VITE_SITE_URL||'https://nial.in').origin;
const dataDir=resolve(env.SEO_DATA_DIR||'./seo-data');
const read=async name=>JSON.parse(await readFile(resolve(dataDir,name),'utf8'));
let content,portfolio;
try{[content,portfolio]=await Promise.all([read('content.json'),read('portfolio.json')]);}catch{throw Error('SEO build requires public content.json and portfolio.json. Restore the committed seo-data snapshots or set SEO_DATA_DIR to a public snapshot directory.');}
const template=await readFile('dist/index.html','utf8');
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brand=content.brand||'NialTech';
const organization={'@type':'Organization','@id':origin+'/#organization',name:brand,url:origin+'/',logo:origin+'/assets/website/nial-logo.png',telephone:'+'+(content.whatsapp||'917909058028'),sameAs:['https://www.instagram.com/nayyer.ali1/']};
const urls=[];
// A relative VITE_API_URL (e.g. "/api/v1", same-origin proxy) is resolved against the site origin instead of crashing the build.
const apiOriginOf=new URL(env.VITE_API_URL||'/api/v1',origin).origin;
// Content-Security-Policy: inline scripts are allowed only by SHA-256 hash (the tiny theme bootstrap in index.html), never 'unsafe-inline'.
const inlineScripts=[...template.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
const connect=[...new Set(["'self'",apiOriginOf])].join(' ');
const csp=[`default-src 'self'`,`script-src 'self' ${inlineScripts.join(' ')}`.trim(),`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,`font-src 'self' https://fonts.gstatic.com data:`,`img-src 'self' data: blob: ${apiOriginOf}`,`connect-src ${connect}`,`frame-ancestors 'none'`,`base-uri 'self'`,`form-action 'self'`,`object-src 'none'`,`upgrade-insecure-requests`].join('; ');
const securityHeaders=`<IfModule mod_headers.c>\nHeader always set Content-Security-Policy "${csp}"\nHeader always set X-Content-Type-Options "nosniff"\nHeader always set X-Frame-Options "DENY"\nHeader always set Referrer-Policy "strict-origin-when-cross-origin"\nHeader always set Permissions-Policy "geolocation=(self), camera=(), microphone=(), payment=(), usb=()"\nHeader always set Cross-Origin-Opener-Policy "same-origin"\nHeader always set Strict-Transport-Security "max-age=31536000"\n</IfModule>\n`;
async function page(path,title,description,body,schema=[],noindex=false){
 const url=origin+path;
 const image=origin+'/assets/website/nial-logo.png';
 const head=`<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${noindex?'noindex, nofollow':'index, follow, max-image-preview:large'}"><link rel="canonical" href="${escape(url)}">`+Object.entries({'og:title':title,'og:description':description,'og:type':'website','og:site_name':brand,'og:url':url,'og:image':image,'og:image:alt':title}).map(([key,value])=>`<meta property="${key}" content="${escape(value)}">`).join('')+`<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${image}">`+(schema.length?`<script id="site-structured-data" type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':schema}).replace(/</g,'\\u003c')}</script>`:'');
 const html=template.replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta name="description"[^>]*\/>/,'').replace('</head>',head+'</head>').replace('<div id="root"></div>',`<div id="root"><div class="public-site"><header><a href="/">${escape(brand)}</a><nav><a href="/portfolio">Portfolio</a> <a href="/app">Sign in</a></nav></header><main>${body}</main></div></div>`);
 const dir=resolve('dist','.'+path);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'index.html'),html);
 if(!noindex)urls.push(url);
}
const link=section=>`<a href="/portfolio/${encodeURIComponent(section.id)}">${escape(section.title)}</a>`;
const description=`${brand} brings graphic design, photo editing, motion graphics, video editing and web development together. Explore our portfolio and get in touch.`;
await page('/',`${brand} | Graphic Design, Photo Editing & Motion Graphics`,description,`<h1>${escape(content.hero_title)}</h1><p>${escape(content.hero_text)}</p>${content.sections.filter(s=>s.visible).map(s=>`<section><h2>${escape(s.title)}</h2><p>${escape(s.text)}</p></section>`).join('')}<h2>Portfolio</h2>${portfolio.sections.filter(s=>!s.parent_id).map(link).join(' ')}<h2>Services</h2><ul>${content.services.map(s=>`<li>${escape(s)}</li>`).join('')}</ul><a href="https://wa.me/${escape(content.whatsapp||'917909058028')}">Get in touch on WhatsApp</a>`,[organization,{'@type':'WebSite',url:origin+'/',name:brand,publisher:{'@id':origin+'/#organization'}}]);
for(const current of [null,...portfolio.sections]){
 if(current&&!/^[a-zA-Z0-9-]+$/.test(current.id))throw Error('Invalid public portfolio id');
 const path=current?`/portfolio/${current.id}`:'/portfolio';
 const title=current?`${current.title} Portfolio | ${brand}`:`Creative Portfolio | ${brand}`;
 const description=current?(current.description||`Explore ${current.title.toLowerCase()} by ${brand}. Discover our creative work and get in touch about your next project.`):`Explore the ${brand} portfolio: graphic design, photo editing, motion graphics, web development and video editing.`;
 const crumbs=[{name:'Home',path:'/'},{name:'Portfolio',path:'/portfolio'}];
 let ancestors=[],node=current;const seen=new Set();while(node&&!seen.has(node.id)){seen.add(node.id);ancestors.unshift(node);node=portfolio.sections.find(s=>s.id===node.parent_id);}crumbs.push(...ancestors.map(s=>({name:s.title,path:`/portfolio/${s.id}`})));
 const children=portfolio.sections.filter(s=>s.parent_id===(current?.id||null));
 const photos=current?portfolio.photos.filter(p=>p.section_id===current.id):[];
 const apiOrigin=apiOriginOf;
 await page(path,title,description,`<nav aria-label="Breadcrumb">${crumbs.map(c=>`<a href="${escape(c.path)}">${escape(c.name)}</a>`).join(' / ')}</nav><h1>${escape(current?.title||'A little different. By design.')}</h1><p>${escape(description)}</p>${children.map(link).join(' ')}${photos.map(p=>`<figure><img src="${apiOrigin}/api/v1/website/portfolio/photos/${encodeURIComponent(p.id)}" alt="${escape(p.name)}" loading="lazy"><figcaption>${escape(p.name)}</figcaption></figure>`).join('')}`,[{'@type':'CollectionPage',name:current?.title||'Creative Portfolio',description,url:origin+path},{'@type':'BreadcrumbList',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,name:c.name,item:origin+c.path}))}]);
}
await page('/app',`MyTime · Sign in | ${brand}`,'Sign in to your private NialTech MyTime workspace.','<h1>Sign in to MyTime</h1>',[],true);
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt',`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile('dist/.htaccess',`${securityHeaders}DirectoryIndex index.html\nRewriteEngine On\n# Preserve previous WordPress portfolio entry URLs.\n${[['graphic-design','graphic-design'],['photo-editing','photo-editing'],['motion-graphics','motion-graphics'],['website-development','website-development'],['video-editing','video-editing']].map(([old,id])=>`RewriteRule ^${old}/?$ /portfolio/${id} [R=301,L]`).join('\n')}\n# Serve generated pages first; keep workspace routes working.\nRewriteCond %{REQUEST_FILENAME} -d\nRewriteRule ^ - [L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteRule ^app(?:/.*)?$ /app/index.html [L]\n# Let unknown public URLs return a genuine 404.\n`);
console.log(`SEO: generated ${urls.length} indexable pages, private login, sitemap, robots.txt and Hostinger redirects.`);
