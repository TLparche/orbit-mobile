// Explicit, local-only import. Builds and CI use the checked-in public projection.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const [workArg,outputArg]=process.argv.slice(2);
if(!workArg||!outputArg)throw Error('Usage: node scripts/import-snapshot.mjs <existing-work-folder> <existing-web-output>');
const work=resolve(workArg),output=resolve(outputArg);
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const read=async(dir,name)=>JSON.parse(await readFile(join(dir,name),'utf8'));
const [graph,details,briefs,criteria,timeline,charts]=await Promise.all([
 read(output,'hologram_graph.json'),read(output,'hologram_details.json'),read(output,'hologram_briefs.json'),
 read(output,'hologram_participation.json'),read(output,'hologram_timeline.json'),read(work,'presentation/chart-data.json')]);
const {createLayout,tickLayout}=await import(pathToFileURL(join(work,'hologram_core.mjs')));
const positions=tickLayout(createLayout(graph),300);
assert.equal(graph.nodes.length,241);assert.equal(graph.edges.length,278);
const monthById=new Map(timeline.events.map(e=>[e.id,e.month]));
const events=graph.nodes.map(n=>{
 const d=details.events[n.id]||{},b=briefs.events[n.id]||{};
 return {id:n.id,title:n.title,cluster:n.cluster,month:monthById.get(n.id)||null,region:d.region||'',
  summary:b.summary||'',facts:b.facts||[],tags:b.presentationTags||[],
  image:d.image||null,preview:d.preview||null,url:d.url||null};
});
const publicGraph={nodes:graph.nodes.map((n,i)=>({id:n.id,cluster:n.cluster,position:positions[i]})),
 edges:graph.edges.map(e=>({source:e.source,target:e.target})),
 clusters:graph.clusters.map(c=>({label:c.label,color:c.color}))};
const publicCriteria={total:criteria.total,knownTotal:criteria.knownTotal,
 groups:criteria.groups.map(g=>({id:g.id,title:g.title||({interaction:'대화 구성',participation:'참여 안내',continuity:'반복 안내'}[g.id]),
 items:g.items.map(i=>({id:i.id,label:i.label,eventIds:i.eventIds}))}))};
const monthly=timeline.months.map(month=>({month,eventIds:events.filter(e=>e.month===month).map(e=>e.id)}));
assert.equal(monthly.reduce((n,m)=>n+m.eventIds.length,0),239);
const publicCharts={categories:charts.categories,records:charts.records.map(r=>({id:r.id,name:r.name,group:r.group,
 targets:r.targets.map(t=>({category:t.category,percent:t.count/r.answers*100})),
 histogram:r.histogram.map(h=>({left:h.left,right:h.right,percent:h.percent}))}))};
await mkdir('public/data',{recursive:true});await mkdir('public/fonts',{recursive:true});await mkdir('public/licenses',{recursive:true});
for(const [name,value] of Object.entries({events,graph:publicGraph,criteria:publicCriteria,monthly,charts:publicCharts}))
 await writeFile(`public/data/${name}.json`,JSON.stringify(value));
await copyFile(join(output,'hologram.woff2'),'public/fonts/study.woff2');
for(const name of ['FONT_LICENSE.txt','THREE_LICENSE.txt','HOLOGRAM_D3_LICENSE.txt'])
 await copyFile(join(output,name),join('public/licenses',basename(name)));
console.log('Imported public snapshot: 241 events, 278 edges, 239 dated events, 7 aggregate records.');
