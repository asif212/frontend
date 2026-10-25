import {useCallback,useEffect,useRef,useState,type CSSProperties,type ReactNode,type RefObject} from 'react';
import {ArrowDown,ArrowUpRight,Images} from 'lucide-react';
import {websiteAsset} from './api';
import type {PortfolioData} from './Portfolio';
import './scroll-effects.css';

const clamp=(n:number,min=0,max=1)=>Math.min(max,Math.max(min,n));
type SceneFrame={progress:number;header:number;distance:number;reduced:boolean};
function useScrollScene(ref:RefObject<HTMLElement|null>,frame:(value:SceneFrame)=>void){
 useEffect(()=>{
  const scene=ref.current;if(!scene)return;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  let request=0,header=0,height=0,range=0,top=0,disposed=false,lastProgress=-1;
  const measure=()=>{header=document.querySelector('.site-header')?.getBoundingClientRect().height||0;height=window.innerHeight;scene.style.setProperty('--scene-header',`${header}px`);top=scene.getBoundingClientRect().top+window.scrollY;range=Math.max(1,scene.offsetHeight-(height-header));lastProgress=-1;};
  const update=()=>{request=0;const progress=media.matches?0:clamp((window.scrollY+header-top)/range);if(progress===lastProgress)return;lastProgress=progress;frame({progress,header,distance:range,reduced:media.matches});};
  const schedule=()=>{if(!request)request=requestAnimationFrame(update);};
  const resize=()=>{measure();schedule();};
  measure();update();
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',resize);media.addEventListener('change',resize);
  const observer=new ResizeObserver(resize);observer.observe(scene);const headerElement=document.querySelector('.site-header');if(headerElement)observer.observe(headerElement);
  // Font/image loading above the scene can change its document position.
  window.addEventListener('load',resize);document.fonts.ready.then(()=>{if(!disposed&&ref.current===scene)resize();});
  return()=>{disposed=true;cancelAnimationFrame(request);observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',resize);window.removeEventListener('load',resize);media.removeEventListener('change',resize);};
 },[ref,frame]);
}

export function HeroScene({children}:{children:ReactNode}){
 const ref=useRef<HTMLElement>(null);
 const frame=useCallback(({progress,reduced}:SceneFrame)=>{ref.current?.style.setProperty('--hero-progress',String(reduced?0:progress));},[]);
 useScrollScene(ref,frame);
 return <section ref={ref} className="hero-scroll-scene" aria-labelledby="hero-title"><div className="site-hero"><div className="hero-atmosphere" aria-hidden="true"/>{children}</div></section>;
}

export function ScrollPortfolio({data}:{data:PortfolioData}){
 const ref=useRef<HTMLElement>(null),track=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null),lastActive=useRef(0);
 const [active,setActive]=useState(0);
 const sections=data.sections.filter(s=>!s.parent_id);
 const getCover=(id:string,coverId:string|null)=>data.photos.find(p=>p.id===coverId)||data.photos.find(p=>p.section_id===id);
 const frame=useCallback(({progress,reduced}:SceneFrame)=>{
  const scene=ref.current,rail=track.current,view=viewport.current;if(!scene||!rail||!view)return;
  const travel=Math.max(0,rail.scrollWidth-view.clientWidth);
  scene.style.setProperty('--portfolio-progress',String(progress));rail.style.transform=reduced?'none':`translate3d(${-progress*travel}px,0,0)`;
  const cards=Array.from(rail.children) as HTMLElement[];
  let nearest=0,nearestDistance=Infinity;
  cards.forEach((card,index)=>{const offset=card.offsetLeft-progress*travel;const relative=(offset-view.clientWidth*.13)/Math.max(1,view.clientWidth);card.style.transform=reduced?'none':`translate3d(0,${Math.sin(relative*Math.PI)*18}px,0) rotate(${clamp(relative*3,-4,4)}deg)`;const centerDistance=Math.abs(offset+card.offsetWidth/2-view.clientWidth*.55);if(centerDistance<nearestDistance){nearestDistance=centerDistance;nearest=index;}});
  if(lastActive.current!==nearest){lastActive.current=nearest;setActive(nearest);}
 },[]);
 useScrollScene(ref,frame);
 function goTo(index:number,smooth=true){
  const scene=ref.current,rail=track.current,view=viewport.current;if(!scene||!rail||!view)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const card=rail.children[index] as HTMLElement|undefined;if(!card)return;
  if(reduced){card.scrollIntoView({block:'nearest',behavior:'auto'});return;}
  const travel=Math.max(1,rail.scrollWidth-view.clientWidth),header=document.querySelector('.site-header')?.getBoundingClientRect().height||0;
  const range=scene.offsetHeight-(window.innerHeight-header);
  window.scrollTo({top:scene.getBoundingClientRect().top+window.scrollY-header+clamp(card.offsetLeft/travel)*range,behavior:smooth?'smooth':'auto'});
 }
 if(!sections.length)return null;
 return <section ref={ref} className="scroll-portfolio" id="portfolio" aria-labelledby="scroll-portfolio-title" style={{'--collection-count':sections.length} as CSSProperties}>
 <div className="scroll-portfolio-stage"><div className="scroll-stage-halo" aria-hidden="true"/><div className="scroll-stage-word" aria-hidden="true">PERSPECTIVE</div>
 <div className="scroll-portfolio-intro"><p className="site-eyebrow"><span/>THE WORK / IN MOTION</p><h2 id="scroll-portfolio-title">Different worlds.<br/><em>One creative spirit.</em></h2><p className="scroll-portfolio-description">Stay a little. Scroll a little.<br/>See where a different perspective takes you.</p><a className="scroll-portfolio-all" href="/portfolio">Explore the full portfolio <ArrowUpRight size={17}/></a><div className="scroll-portfolio-current"><span>{String(active+1).padStart(2,'0')}</span><div><small>NOW EXPLORING</small><strong>{sections[active]?.title}</strong></div></div></div>
 <div ref={viewport} className="scroll-portfolio-viewport"><div ref={track} className="scroll-portfolio-track">{sections.map((section,index)=>{const image=getCover(section.id,section.cover_id);return <a key={section.id} href={`/portfolio/${section.id}`} className="scroll-portfolio-card" onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))goTo(index,false);}}><div className="scroll-card-topline"><span>COLLECTION / {String(index+1).padStart(2,'0')}</span><ArrowUpRight size={20}/></div><div className="scroll-card-image">{image?<img src={websiteAsset(image.url)} alt={section.title} loading="lazy"/>:<div className="scroll-card-empty"><Images size={45}/><span>A new perspective is on its way.</span></div>}</div><div className="scroll-card-caption"><h3>{section.title}</h3><span>Explore collection <ArrowUpRight size={15}/></span></div></a>;})}</div></div>
 <div className="scroll-portfolio-bottom"><span className="scroll-portfolio-hint"><ArrowDown size={15}/>KEEP SCROLLING TO EXPLORE</span><div className="scroll-portfolio-steps" aria-label="Jump to portfolio collection">{sections.map((section,index)=><button key={section.id} type="button" onClick={()=>goTo(index)} aria-label={`Show ${section.title}`} aria-current={active===index?'step':undefined}><span>{String(index+1).padStart(2,'0')}</span><i/></button>)}</div><span className="scroll-portfolio-total">{String(sections.length).padStart(2,'0')} CREATIVE DISCIPLINES</span></div>
 <div className="scroll-portfolio-progress" aria-hidden="true"><span/></div>
 </div></section>;
}
