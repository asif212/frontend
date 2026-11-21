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
// SEO_NOINDEX=true is used for preview/staging hosts: every page is noindex, robots.txt disallows crawling, no sitemap is published.
const noindexAll=env.SEO_NOINDEX==='true';
const number=String(content.whatsapp||'917909058028').replace(/\D/g,'');
const phoneIntl='+'+number,whatsappUrl='https://wa.me/'+number;
const phoneText=number.startsWith('91')&&number.length===12?`+91 ${number.slice(2,7)} ${number.slice(7)}`:phoneIntl;
const instagram='https://www.instagram.com/nayyer.ali1/',maps='https://maps.app.goo.gl/VLryJgg4qdqUcgQ79';
const contactSection=(content.sections||[]).find(x=>x.id==='contact');
const aboutTitle=`About ${brand} (Nial Tech) and Nayyer Ali | Graphic Design, Photo Editing & Motion Graphics`;
const aboutDescription=`${brand} (also written Nial Tech, nial.in) is the creative studio of Nayyer Ali: graphic design, photo editing, motion graphics, video editing and web development.`;
const alternateNames=['Nial Tech','Nial','nial.in'];
const person={'@type':'Person','@id':origin+'/#person',name:'Nayyer Ali',url:origin+'/about',sameAs:[instagram],worksFor:{'@id':origin+'/#organization'}};
const contactTitle=`Contact ${brand} | Graphic Design, Photo Editing & Motion Graphics`;
const contactDescription=`Contact ${brand} on WhatsApp or by phone for graphic design, photo editing, motion graphics, video editing and web development projects.`;
// Only details that exist are published; nothing is invented. Email/phone/location appear once entered in the website editor and the SEO snapshot is refreshed.
const contactList=`<ul><li>WhatsApp and phone: <a href="tel:${phoneIntl}">${escape(phoneText)}</a> (<a href="${whatsappUrl}">message on WhatsApp</a>)</li>${content.email?`<li>Email: <a href="mailto:${escape(content.email)}">${escape(content.email)}</a></li>`:''}${content.phone?`<li>Phone: <a href="tel:${escape(String(content.phone).replace(/[^+\d]/g,''))}">${escape(content.phone)}</a></li>`:''}${content.location?`<li>Location: ${escape(content.location)}</li>`:''}<li><a href="${instagram}">Follow ${escape(brand)} on Instagram</a></li><li><a href="${maps}">Find ${escape(brand)} on Google Maps</a></li></ul>`;
const organization={'@type':'Organization','@id':origin+'/#organization',name:brand,alternateName:alternateNames,url:origin+'/',founder:{'@id':origin+'/#person'},logo:origin+'/assets/website/nial-logo.png',telephone:phoneIntl,...(content.email?{email:content.email}:{}),contactPoint:[{'@type':'ContactPoint',telephone:phoneIntl,contactType:'customer support',url:whatsappUrl,...(content.email?{email:content.email}:{})}],hasMap:maps,sameAs:[instagram,maps]};
const urls=[];
// A relative VITE_API_URL (e.g. "/api/v1", same-origin proxy) is resolved against the site origin instead of crashing the build.
const apiOriginOf=new URL(env.VITE_API_URL||'/api/v1',origin).origin;
// Content-Security-Policy: inline scripts are allowed only by SHA-256 hash (the tiny theme bootstrap in index.html), never 'unsafe-inline'.
const inlineScripts=[...template.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
const connect=[...new Set(["'self'",apiOriginOf])].join(' ');
const csp=[`default-src 'self'`,`script-src 'self' ${inlineScripts.join(' ')}`.trim(),`style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,`font-src 'self' https://fonts.gstatic.com data:`,`img-src 'self' data: blob: ${apiOriginOf}`,`connect-src ${connect}`,`frame-ancestors 'none'`,`base-uri 'self'`,`form-action 'self'`,`object-src 'none'`,`upgrade-insecure-requests`].join('; ');
const host=new URL(origin).hostname;
// One canonical host: www.<domain> permanently redirects to <domain> (skipped if the site itself is on www.).
const canonicalHost=host.startsWith('www.')?'':`# One canonical host\nRewriteCond %{HTTP_HOST} ^www\\.${host.replace(/\./g,'\\.')}$ [NC]\nRewriteRule ^ https://${host}%{REQUEST_URI} [R=301,L]\n`;
const securityHeaders=`<IfModule mod_headers.c>\n${noindexAll?'Header always set X-Robots-Tag "noindex, nofollow"\n':''}Header always set Content-Security-Policy "${csp}"\nHeader always set X-Content-Type-Options "nosniff"\nHeader always set X-Frame-Options "DENY"\nHeader always set Referrer-Policy "strict-origin-when-cross-origin"\nHeader always set Permissions-Policy "geolocation=(self), camera=(), microphone=(), payment=(), usb=()"\nHeader always set Cross-Origin-Opener-Policy "same-origin"\nHeader always set Strict-Transport-Security "max-age=31536000"\n</IfModule>\n`;
async function page(path,title,description,body,schema=[],noindexPage=false){
 const noindex=noindexAll||noindexPage;
 const url=origin+path;
 const image=origin+'/assets/website/nial-logo.png';
 const head=`<title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${noindex?'noindex, nofollow':'index, follow, max-image-preview:large'}"><link rel="canonical" href="${escape(url)}">`+Object.entries({'og:title':title,'og:description':description,'og:type':'website','og:site_name':brand,'og:url':url,'og:image':image,'og:image:alt':title}).map(([key,value])=>`<meta property="${key}" content="${escape(value)}">`).join('')+`<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${image}">`+(schema.length?`<script id="site-structured-data" type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@graph':schema}).replace(/</g,'\\u003c')}</script>`:'');
 const html=template.replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta name="description"[^>]*\/>/,'').replace('</head>',head+'</head>').replace('<div id="root"></div>',`<div id="root"><div class="public-site"><header><a href="/">${escape(brand)}</a><nav><a href="/portfolio">Portfolio</a> <a href="/about">About</a> <a href="/contact">Contact</a> <a href="/app">Sign in</a></nav></header><main>${body}</main></div></div>`);
 const dir=resolve('dist','.'+path);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'index.html'),html);
 if(!noindex)urls.push(url);
}
const link=section=>`<a href="/portfolio/${encodeURIComponent(section.id)}">${escape(section.title)}</a>`;
const description=`${brand} (Nial Tech), the creative studio of Nayyer Ali, brings graphic design, photo editing, motion graphics, video editing and web development together. Explore our portfolio and get in touch.`;
await page('/',`${brand} | Graphic Design, Photo Editing & Motion Graphics`,description,`<h1>${escape(content.hero_title)}</h1><p>${escape(content.hero_text)}</p>${content.sections.filter(s=>s.visible).map(s=>`<section><h2>${escape(s.title)}</h2><p>${escape(s.text)}</p></section>`).join('')}<h2>Portfolio</h2>${portfolio.sections.filter(s=>!s.parent_id).map(link).join(' ')}<p>${escape(brand)} (also written Nial Tech, at nial.in) is the creative studio of Nayyer Ali. <a href="/about">About ${escape(brand)} and Nayyer Ali</a>.</p><h2>Services</h2><p>${escape(brand)} offers ${escape(content.services.slice(0,-1).join(', ').toLowerCase())} and ${escape(String(content.services.at(-1)).toLowerCase())}.</p><ul>${content.services.map(s=>`<li>${escape(s)}</li>`).join('')}</ul><section id="contact"><h2>${escape(String(contactSection?.title||`Contact ${brand}`).replace(/\s*\n\s*/g,' '))}</h2><p>${escape(contactSection?.text||'Have an idea, a brief, or just a question? Get in touch.')}</p>${contactList}<p><a href="/contact">Contact page</a></p></section>`,[organization,person,{'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:brand,alternateName:alternateNames,publisher:{'@id':origin+'/#organization'}}]);
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
const aboutText=(content.sections||[]).find(x=>x.id==='about');
await page('/about',aboutTitle,aboutDescription,`<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/about">About</a></nav><h1>About ${escape(brand)} and Nayyer Ali</h1><p>${escape(brand)} (also written Nial Tech, at nial.in) is the creative studio of Nayyer Ali. We bring graphic design, photo editing, motion graphics, video editing and web development together, with a creative perspective.</p>${aboutText?`<h2>${escape(String(aboutText.title).replace(/\s*\n\s*/g,' '))}</h2><p>${escape(aboutText.text)}</p>`:''}<h2>What we do</h2><ul>${content.services.map(s=>`<li>${escape(s)}</li>`).join('')}</ul><h2>Nayyer Ali</h2><p>Nayyer Ali leads ${escape(brand)}. Follow <a href="${instagram}">Nayyer Ali on Instagram</a>, see the <a href="/portfolio">portfolio</a> or <a href="/contact">get in touch</a>.</p>${contactList}`,[organization,person,{'@type':'AboutPage',url:origin+'/about',name:aboutTitle,about:{'@id':origin+'/#organization'}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin+'/'},{'@type':'ListItem',position:2,name:'About',item:origin+'/about'}]}]);
await page('/contact',contactTitle,contactDescription,`<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/contact">Contact</a></nav><h1>Contact ${escape(brand)}</h1><p>${escape(contactSection?.text||'Have an idea, a brief, or just a question? Get in touch.')}</p>${contactList}<h2>What we can help with</h2><ul>${content.services.map(s=>`<li>${escape(s)}</li>`).join('')}</ul><p><a href="/portfolio">See our portfolio</a></p>`,[organization,person,{'@type':'ContactPage',url:origin+'/contact',name:contactTitle,about:{'@id':origin+'/#organization'}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:origin+'/'},{'@type':'ListItem',position:2,name:'Contact',item:origin+'/contact'}]}]);
await page('/app',`MyTime · Sign in | ${brand}`,'Sign in to your private NialTech MyTime workspace.','<h1>Sign in to MyTime</h1>',[],true);
if(!noindexAll)await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt',noindexAll?`User-agent: *\nDisallow: /\n`:`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
await writeFile('dist/.htaccess',`${securityHeaders}DirectoryIndex index.html\nRewriteEngine On\n${canonicalHost}# Old MyTime path\nRewriteRule ^mytime(?:/.*)?$ /app [R=301,L]\n# Pages of the previous WordPress site that now live elsewhere (301 keeps their search value).\nRewriteRule ^home/?$ / [R=301,L]\nRewriteRule ^about-us/?$ /about [R=301,L]\nRewriteRule ^services/?$ /#services [NE,R=301,L]\nRewriteRule ^contact-us/?$ /contact [R=301,L]\nRewriteRule ^(?:work|our-work|portfolio-2|gallery)/?$ /portfolio [R=301,L]\n# Preserve previous WordPress portfolio entry URLs.\n${[['graphic-design','graphic-design'],['photo-editing','photo-editing'],['motion-graphics','motion-graphics'],['website-development','website-development'],['video-editing','video-editing']].map(([old,id])=>`RewriteRule ^${old}/?$ /portfolio/${id} [R=301,L]`).join('\n')}\n# Serve generated pages first; keep workspace routes working.\nRewriteCond %{REQUEST_FILENAME} -d\nRewriteRule ^ - [L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteRule ^app(?:/.*)?$ /app/index.html [L]\n# Let unknown public URLs return a genuine 404.\n`);
console.log(`SEO: generated ${urls.length} indexable pages, private login, sitemap, robots.txt and Hostinger redirects.`);
