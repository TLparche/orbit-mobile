import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchConditions,chartDomain,parseRoute,nearestBin} from '../src/core.mjs';
const read=async n=>JSON.parse(await readFile(`public/data/${n}.json`,'utf8'));
const [events,graph,criteria,monthly,charts]=await Promise.all(['events','graph','criteria','monthly','charts'].map(read));
test('frozen public snapshot has complete unique graph and event references',()=>{
 assert.equal(events.length,241);assert.equal(new Set(events.map(e=>e.id)).size,241);assert.equal(graph.nodes.length,241);assert.equal(graph.edges.length,278);
 const ids=new Set(events.map(e=>e.id)),pairs=new Set();
 for(const n of graph.nodes){assert(ids.has(n.id));assert(n.position.every(Number.isFinite));assert(graph.clusters[n.cluster]);}
 for(const e of graph.edges){assert(ids.has(e.source)&&ids.has(e.target));assert.notEqual(e.source,e.target);pairs.add([e.source,e.target].sort().join('|'));}
 assert.equal(pairs.size,278);
});
test('monthly totals preserve all twelve months and exclude exactly two undated events',()=>{
 assert.deepEqual(monthly.map(m=>m.eventIds.length),[4,38,19,22,26,29,23,25,26,18,8,1]);
 const ids=monthly.flatMap(m=>m.eventIds);assert.equal(ids.length,239);assert.equal(new Set(ids).size,239);
 for(const m of monthly)for(const id of m.eventIds)assert.equal(events.find(e=>e.id===id).month,m.month);
 assert.equal(events.filter(e=>!e.month).length,2);
});
test('all condition combinations intersect across groups without dropping unfiltered unknown event',()=>{
 assert.equal(matchConditions(events,criteria,{}).size,241);assert.equal(criteria.knownTotal,240);
 const choices=criteria.groups.map(g=>[null,...g.items]);
 for(const a of choices[0])for(const b of choices[1])for(const c of choices[2]){
  const picked=[a,b,c],s=Object.fromEntries(criteria.groups.map((g,i)=>[g.id,picked[i]?.id]));
  const expected=events.filter(e=>picked.every(i=>!i||i.eventIds.includes(e.id))).map(e=>e.id);
  assert.deepEqual([...matchConditions(events,criteria,s)],expected);
 }
});
test('public chart projection has seven aggregate records and exact percentage totals',()=>{
 assert.equal(charts.records.length,7);assert.equal(charts.categories.length,6);
 assert.deepEqual(charts.records.reduce((n,r)=>(n[r.group]=(n[r.group]||0)+1,n),{}),{SMCC:4,BTR:2,RUN_OTHER:1});
 for(const r of charts.records){assert(Math.abs(r.targets.reduce((n,t)=>n+t.percent,0)-100)<1e-9);assert.equal(r.histogram.length,40);assert(Math.abs(r.histogram.reduce((n,h)=>n+h.percent,0)-100)<1e-9);}
 const d=chartDomain(charts.records);for(const r of charts.records)for(const h of r.histogram){assert(h.percent<=d.top);if(h.percent>0)assert(h.left>=d.min);}
});
test('public JSON contains no original answers, answer IDs or local paths',()=>{
 const s=JSON.stringify({events,graph,criteria,monthly,charts});
 assert(!/answerIds|A-D\d\d-|sourcePath|[A-Z]:[\\/]|"quotes"|"body"|"transcript"/.test(s));
 for(const e of events){assert(!e.url||new URL(e.url).protocol==='https:');assert(!e.preview||/^image-previews\/[a-f0-9]+\.jpg$/.test(e.preview));}
});
test('routes accept deep links and retain panel parameters',()=>{
 assert.equal(parseRoute('#/map?event=event-100').query.get('event'),'event-100');assert.equal(parseRoute('#/similarity').page,'similarity');assert.equal(parseRoute('#/unknown').page,'home');
 const bins=charts.records[0].histogram;assert.equal(nearestBin(bins,100),bins.at(-1));assert.equal(nearestBin(bins,-100),bins[0]);
});
