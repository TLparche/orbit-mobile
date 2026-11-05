import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const [workArg,outputArg]=process.argv.slice(2),work=resolve(workArg),output=resolve(outputArg);
const read=async(dir,name)=>JSON.parse(await readFile(join(dir,name),'utf8'));
const [original,graph,criteria,timeline,charts]=await Promise.all([read(work,'presentation/chart-data.json'),read(output,'hologram_graph.json'),read(output,'hologram_participation.json'),read(output,'hologram_timeline.json'),read('public/data','charts.json')]);
for(const record of original.records){const target=charts.records.find(r=>r.id===record.id);assert.equal(target.name,record.name);assert.equal(target.group,record.group);record.targets.forEach((t,i)=>assert.equal(target.targets[i].percent,t.count/record.answers*100));record.histogram.forEach((h,i)=>{for(const k of ['left','right','percent'])assert.equal(target.histogram[i][k],h[k]);});}
const publicGraph=await read('public/data','graph.json'),publicCriteria=await read('public/data','criteria.json'),monthly=await read('public/data','monthly.json');
const {createLayout,tickLayout}=await import(pathToFileURL(join(work,'hologram_core.mjs')));
assert.deepEqual(publicGraph.nodes.map(n=>n.position),tickLayout(createLayout(graph),300));assert.deepEqual(publicGraph.edges,graph.edges.map(e=>({source:e.source,target:e.target})));
criteria.groups.forEach((g,i)=>g.items.forEach((v,j)=>assert.deepEqual(publicCriteria.groups[i].items[j].eventIds,v.eventIds)));
for(const m of monthly)assert.deepEqual([...m.eventIds].sort(),timeline.events.filter(e=>e.month===m.month).map(e=>e.id).sort());
const {pointShaders,edgeShaders}=await import('../src/legacy-shaders.mjs');
const source=await readFile(join(work,'hologram.js'),'utf8');
for(const [name,pair]of [['pointMaterial',pointShaders],['lineMaterial',edgeShaders]]){
 const block=source.slice(source.indexOf(`${name}=new THREE.ShaderMaterial`));
 const match=block.match(/vertexShader:`([^`]+)`,\s*fragmentShader:`([^`]+)`/);
 assert.equal(pair.vertex,match[1]);assert.equal(pair.fragment,match[2]);
}
console.log('PASS: original graph positions/edges, condition memberships, monthly events, chart values and all four original shaders are identical.');
