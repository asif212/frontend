const origin=(import.meta as unknown as {env:Record<string,string>}).env.VITE_SITE_URL||'https://nial.in';
export const siteUrl=new URL(origin).origin;
export function setSeo({title,description,path='/',image='/assets/website/nial-logo.png',noindex=false,schema=[]}:{title:string;description:string;path?:string;image?:string;noindex?:boolean;schema?:unknown[]}){
 document.title=title;
 function meta(key:string,value:string,property=false){const attr=property?'property':'name';let node=document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);if(!node){node=document.createElement('meta');node.setAttribute(attr,key);document.head.append(node);}node.content=value;}
 const url=new URL(path,siteUrl).href;
 meta('description',description);meta('robots',noindex?'noindex, nofollow':'index, follow, max-image-preview:large');
 for(const [key,value] of Object.entries({'og:title':title,'og:description':description,'og:url':url,'og:type':'website','og:site_name':'NialTech','og:image':new URL(image,siteUrl).href,'og:image:alt':title}))meta(key,value,true);
 meta('twitter:card','summary');meta('twitter:title',title);meta('twitter:description',description);meta('twitter:image',new URL(image,siteUrl).href);
 let canonical=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=url;
 document.getElementById('site-structured-data')?.remove();
 if(schema.length){const script=document.createElement('script');script.id='site-structured-data';script.type='application/ld+json';script.textContent=JSON.stringify({'@context':'https://schema.org','@graph':schema});document.head.append(script);}
}
export const organization={ '@type':'Organization','@id':`${siteUrl}/#organization`,name:'NialTech',url:siteUrl+'/',logo:siteUrl+'/assets/website/nial-logo.png',telephone:'+917909058028',sameAs:['https://www.instagram.com/nayyer.ali1/']};
