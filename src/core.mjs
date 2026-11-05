export const routes=['map','monthly','topics','similarity'];
export const groupName=g=>g==='RUN_OTHER'?'별도 크루':g;
export const monthName=m=>`${m.slice(0,4)}년 ${Number(m.slice(5))}월`;
export const pct=v=>`${Number(v.toFixed(1))}%`;
export function parseRoute(hash){
 const [path='',search='']=hash.replace(/^#\/?/,'').split('?');
 return {page:routes.includes(path)?path:'home',query:new URLSearchParams(search)};
}
export function matchConditions(events,criteria,selection){
 const sets=criteria.groups.flatMap(g=>{
  const item=g.items.find(i=>i.id===selection[g.id]);return item?[new Set(item.eventIds)]:[];
 });
 return new Set(events.filter(e=>sets.every(s=>s.has(e.id))).map(e=>e.id));
}
export function chartDomain(records){
 return {min:Math.min(-.25,...records.flatMap(r=>r.histogram.filter(h=>h.percent>0).map(h=>h.left))),
  max:1,top:Math.ceil(Math.max(...records.flatMap(r=>r.histogram.map(h=>h.percent)))/5)*5};
}
export function histogramPath(bins,x,y){
 return bins.map((h,i)=>`${i?'L':'M'}${x((h.left+h.right)/2)},${y(h.percent)}`).join(' ');
}
export function nearestBin(bins,value){return bins.reduce((best,h)=>Math.abs((h.left+h.right)/2-value)<Math.abs((best.left+best.right)/2-value)?h:best,bins[0]);}
export function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
