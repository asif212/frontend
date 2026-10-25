// Export only the public fields used by the SEO build; never copy the data directory.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve(process.argv[2]||'../backend/website_data');
const content=JSON.parse(await readFile(resolve(source,'content.json'),'utf8'));
const portfolio=JSON.parse(await readFile(resolve(source,'portfolio.json'),'utf8'));
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>key in value).map(key=>[key,value[key]]));
const publicContent=pick(content,['brand','hero_title','hero_text','whatsapp','services']);
publicContent.sections=content.sections.map(section=>pick(section,['id','title','text','visible']));
const publicPortfolio={sections:portfolio.sections.map(section=>pick(section,['id','title','description','parent_id','cover_id'])),photos:portfolio.photos.map(photo=>pick(photo,['id','section_id','name']))};
await mkdir('seo-data',{recursive:true});
for(const [name,data] of [['content',publicContent],['portfolio',publicPortfolio]])await writeFile(`seo-data/${name}.json`,JSON.stringify(data,null,2)+'\n');
console.log('Updated public SEO snapshots in seo-data/. No image files or private settings copied.');
