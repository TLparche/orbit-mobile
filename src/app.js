import './style.css';
import './legacy-theme.css';
import {routes,parseRoute,groupName,monthName,pct,matchConditions,chartDomain,histogramPath,nearestBin,escapeHTML as esc} from './core.mjs';

const main=document.querySelector('main'),nav=document.querySelector('nav'),sheet=document.querySelector('#sheet'),sheetContent=document.querySelector('#sheet-content');
document.querySelector('.skip').onclick=e=>{e.preventDefault();main.focus();};
const names={map:'3D 모임 지도',monthly:'월별 행사 수',topics:'대화 주제 비중',similarity:'답변 표현의 유사성'};
const shortNames={map:'지도',monthly:'월별',topics:'대화',similarity:'유사도'};
const icons={map:'<circle cx="12" cy="12" r="4"/><ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)"/>',monthly:'<path d="M4 4v16h17M8 15V9m5 6V4m5 11v-7"/>',topics:'<path d="M3 4h18v12H9l-5 4v-4H3zM7 8h10M7 12h6"/>',similarity:'<path d="M3 3v18h19M5 17c4 0 3-11 7-11s2 11 9 11M5 15c3 0 3-6 8-6s4 6 8 6"/>'};
const icon=(key,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg>`;
const shades=['#E2E8F0','#AEBBCB','#8295AD','#59718E','#354B66','#142D49'];
const lineColors=['#59CBE8','#F1BD77','#BCA7F5'];
const dataCache=new Map(),views=new Map(),pendingViews=new Map(),scrolls=new Map();
const state={page:'',query:new URLSearchParams(),selection:{},topicsFocus:false,similarityFocus:false,monthly:null,recordSelection:{},binSelection:{}};
let routeVersion=0,mapView=null,filterData=null,eventData=null,opener=null;

async function json(name){
 if(!dataCache.has(name))dataCache.set(name,fetch(new URL(`data/${name}.json`,document.baseURI)).then(r=>{if(!r.ok)throw Error('자료 연결 실패');return r.json();}).catch(e=>{dataCache.delete(name);throw e;}));
 return dataCache.get(name);
}
function element(html){const t=document.createElement('template');t.innerHTML=html.trim();return t.content.firstElementChild;}
function heading(page,sub=''){return `<div class="page-heading"><h1>${names[page]}</h1>${sub?`<p class="lede">${sub}</p>`:''}</div>`;}
function explain(html){return `<details class="explanation"><summary>자료 설명</summary>${html}</details>`;}
function errorNode(retry){const e=element('<div class="error" role="alert">자료를 불러오지 못했어요.<br>인터넷 연결을 확인한 뒤 다시 눌러 주세요.<br><button type="button">다시 불러오기</button></div>');e.querySelector('button').onclick=retry;return e;}
function pushPanel(values){
 opener=document.activeElement;
 const q=new URLSearchParams(state.query);for(const [k,v]of Object.entries(values))v==null?q.delete(k):q.set(k,v);
 history.pushState({orbitPanel:true},'',`#/${state.page}?${q}`);void renderRoute();
}
function closePanel(){
 if(history.state?.orbitPanel){history.back();return;}
 history.replaceState(null,'',`#/${state.page}`);void renderRoute();
}
document.querySelector('.close-sheet').onclick=closePanel;
sheet.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)closePanel();}});

function home(){
 return element(`<section class="home"><div class="intro"><p class="eyebrow">CERAGEM × ORBIT</p><h1>모임을 연결하는<br>이야기.</h1><p>궁금한 그래프를 눌러 둘러보세요.</p></div><div class="home-grid">${routes.map((key,i)=>`<a class="home-link" href="#/${key}">${icon(key,'home-art')}<div><span class="number">0${i+1}</span><strong>${names[key]}</strong></div><span class="arrow" aria-hidden="true">↗</span></a>`).join('')}</div><p class="home-foot">함께 움직이는 일상을 연구합니다.</p></section>`);
}

async function createMap(){
 const [graph,events,criteria,{createMapView}]=await Promise.all([json('graph'),json('events'),json('criteria'),import('./map.js')]);
 eventData=events;filterData=criteria;
 const root=element(`<section>${heading('map')}<div class="map-stage"><div class="map-stats" aria-live="polite">행사 241 · 연결 278</div><div class="map-zoom"><button type="button" aria-label="지도 확대">＋</button><button type="button" aria-label="지도 축소">－</button></div><div class="map-fallback" hidden>3D 화면을 열지 못했어요.<br>아래 행사 목록에서 같은 자료를 볼 수 있어요.<button type="button">3D 다시 열기</button></div></div><p class="map-hint">밀어서 회전 · 두 손가락으로 확대</p><ul class="map-legend">${graph.clusters.map(c=>`<li><i style="--cluster:${c.color}"></i>${esc(c.label)}</li>`).join('')}</ul><div class="map-tools"><button type="button" data-action="filters">조건 선택</button><button type="button" data-action="list">행사 목록</button></div><div class="toolbar"><span class="small-note" data-map-count>전체 241개 행사</span><button type="button" class="quiet map-reset">처음 보기 ↺</button></div><div class="condition-badges"></div>${explain('<p>점은 행사, 선은 모집 문구와 이미지가 비슷한 행사의 연결입니다. 실제 교류나 인기도를 뜻하지 않습니다.</p><p>SMCC 공개 모집 자료 · 2026.10.26 기준. 색은 기존 분석의 분위기 분류입니다.</p>')}</section>`);
 const stage=root.querySelector('.map-stage');
 mapView=createMapView(stage,graph,id=>pushPanel({panel:null,event:id}));
 const zoom=root.querySelectorAll('.map-zoom button');zoom[0].onclick=()=>mapView.zoom(.8);zoom[1].onclick=()=>mapView.zoom(1.25);
 root.querySelector('.map-reset').onclick=()=>{state.selection={};mapView.reset();updateFilters();};
 root.querySelector('[data-action=filters]').onclick=()=>pushPanel({panel:'filters',event:null});
 root.querySelector('[data-action=list]').onclick=()=>pushPanel({panel:'list',event:null});
 root.querySelector('.map-fallback button').onclick=()=>mapView.retry();
 root.update=()=>{mapView.setActive(state.page==='map'&&!sheet.open);updateFilters();};
 return root;
}
function updateFilters(){
 if(!eventData||!filterData||!mapView)return;
 const ids=matchConditions(eventData,filterData,state.selection),v=views.get('map');
 mapView.setFilter(ids);
 if(!v)return;
 const chosen=filterData.groups.flatMap(g=>g.items.filter(i=>state.selection[g.id]===i.id));
 v.querySelector('[data-map-count]').textContent=chosen.length?`조건에 맞는 행사 ${ids.size}개`:'전체 241개 행사';
 v.querySelector('.condition-badges').innerHTML=chosen.map(i=>`<span class="pill">${esc(i.label)}</span>`).join('');
 v.querySelector('[data-action=filters]').textContent=chosen.length?`조건 선택 · ${chosen.length}`:'조건 선택';
 const count=sheetContent.querySelector('.filter-count');if(count)count.textContent=`${ids.size}개 행사`;
}

async function monthly(){
 const months=await json('monthly'),max=Math.max(...months.map(m=>m.eventIds.length));
 const root=element(`<section class="chart-page">${heading('monthly')}<div class="panel"><div class="toolbar" style="margin-top:0"><span class="pill">총 239개 행사</span></div>${months.map((m,i)=>`${i===0||m.month.slice(0,4)!==months[i-1].month.slice(0,4)?`<div class="year-label">${m.month.slice(0,4)}</div>`:''}<button type="button" class="month-row" data-month="${m.month}" aria-label="${monthName(m.month)} ${m.eventIds.length}개 행사 보기"><span>${Number(m.month.slice(5))}월</span><span class="track"><span class="fill" style="width:${m.eventIds.length/max*100}%"></span></span><strong>${m.eventIds.length}</strong></button>`).join('')}</div>${explain('<p>월이 확인된 239개 행사입니다. 날짜가 확인되지 않은 2개는 제외했습니다.</p><p>2026.10.26에 저장한 모집 자료이며, 당시 예정된 11월 행사 1개를 포함합니다.</p>')}</section>`);
 root.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{state.monthly=b.dataset.month;root.update();pushPanel({month:b.dataset.month,event:null});});
 root.update=()=>root.querySelectorAll('[data-month]').forEach(b=>{b.classList.toggle('selected',b.dataset.month===state.monthly);b.setAttribute('aria-pressed',String(b.dataset.month===state.monthly));});
 return root;
}
async function topics(){
 const data=await json('charts');
 const root=element(`<section class="chart-page">${heading('topics')}<div class="toolbar"><button type="button" class="emphasis-toggle" aria-pressed="false">SMCC 강조</button></div><p class="conclusion" hidden>SMCC는 모임 외 대화 주제가 풍부함</p><div class="panel"><div class="legend">${data.categories.map((c,i)=>`<span class="legend-item"><span class="swatch category-${i}" style="background-color:${shades[i]}"></span>${esc(c)}</span>`).join('')}</div>${data.records.map(r=>`<button type="button" class="record-row ${r.group==='SMCC'?'smcc':''}" data-record="${r.id}" aria-label="${esc(r.name)} 항목별 비율 보기"><span class="record-title"><span>${esc(r.name)}</span><span class="more" aria-hidden="true">상세 ↗</span></span><span class="stack">${r.targets.map((t,i)=>`<span class="stack-segment category-${i}" data-category="${esc(t.category)}" style="width:${t.percent}%;background-color:${shades[i]}"></span>`).join('')}${r.group==='SMCC'?`<span class="focus-outline" style="left:${r.targets[0].percent}%;right:0"></span>`:''}</span></button>`).join('')}<div class="axis-labels" style="margin-left:0"><span>0%</span><span>50%</span><span>100%</span></div></div>${explain('<p>각 대화 기록에서 어떤 대상을 이야기했는지 분류한 비율입니다. 막대를 누르면 항목별 비율을 볼 수 있습니다.</p>')}</section>`);
 root.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>pushPanel({record:b.dataset.record}));
 root.querySelector('.emphasis-toggle').onclick=()=>{state.topicsFocus=!state.topicsFocus;root.update();};
 root.update=()=>{root.classList.toggle('focus-mode',state.topicsFocus);root.querySelector('.emphasis-toggle').setAttribute('aria-pressed',String(state.topicsFocus));root.querySelector('.conclusion').hidden=!state.topicsFocus;};
 return root;
}

async function similarity(){
 const data=await json('charts'),domain=chartDomain(data.records),groups=['SMCC','BTR','RUN_OTHER'];
 const root=element(`<section class="chart-page">${heading('similarity','같은 대화 기록 안에서 답변 표현이 얼마나 닮았는지 비교합니다.')}<div class="toolbar"><button type="button" class="emphasis-toggle" aria-pressed="false">SMCC 강조</button></div><p class="conclusion" hidden>내 일상의 스펙트럼을 넓혀주는 일상의 도구</p><div class="histograms"></div>${explain('<p>인터뷰 답변을 문장 임베딩으로 변환하고, 같은 기록 안 답변끼리 코사인 유사도를 계산했습니다. 그래프는 유사도 구간별 답변쌍의 비율입니다.</p><p>오른쪽일수록 표현이 비슷합니다. 세 그래프의 가로·세로 범위는 같습니다. 기록마다 자료의 양과 수집 방식이 다릅니다.</p>')}</section>`);
 const ns='http://www.w3.org/2000/svg';
 groups.forEach((group,gi)=>{
  const rs=data.records.filter(r=>r.group===group),color=lineColors[gi],dashes=['','10 5','2 5','10 4 2 4'];
  const card=element(`<article class="panel hist-card" data-group="${group}"><div class="hist-header"><h2>${groupName(group)}</h2></div><div class="record-switches">${rs.map((r,i)=>`<button type="button" data-line="${r.id}" aria-pressed="false"><svg viewBox="0 0 26 12" aria-hidden="true"><path d="M0 6H26" stroke="${color}" stroke-width="3" stroke-dasharray="${dashes[i]}"/></svg>${esc(r.name.replace(/^(SMCC |BTR |별도 크루 )/,''))}</button>`).join('')}</div><p class="chart-axis-caption left">답변쌍 비율 (%)</p><svg class="hist-plot" role="img" aria-label="${groupName(group)} 답변 표현 유사도 분포"></svg><p class="chart-axis-caption">← 다른 표현 · 비슷한 표현 →</p><label class="range-label" for="range-${group}"><span>유사도 구간 선택</span><strong class="bin-label"></strong></label><input id="range-${group}" class="bin-range" type="range" min="0" max="39" step="1" value="25"><div class="value-readout" aria-live="polite"></div></article>`);
  const svg=card.querySelector('svg.hist-plot');let xScale=null;
  const draw=()=>{
   const fontSize=parseFloat(getComputedStyle(document.documentElement).fontSize)*.89;
   const width=svg.getBoundingClientRect().width||300,height=Math.max(230,fontSize*12),left=Math.max(46,fontSize*2.5),right=Math.max(14,fontSize*.7),top=fontSize,bottom=fontSize*2.25,w=width-left-right,h=height-top-bottom;
   const x=v=>left+(v-domain.min)/(domain.max-domain.min)*w,y=v=>top+h-v/domain.top*h;xScale=x;
   svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
   const node=(tag,attrs,txt)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(txt!=null)e.textContent=txt;svg.append(e);return e;};
   const defs=node('defs',{}),clip=document.createElementNS(ns,'clipPath');clip.id=`clip-${group}`;const rect=document.createElementNS(ns,'rect');for(const[k,v]of Object.entries({x:left,y:top,width:w,height:h+1}))rect.setAttribute(k,v);clip.append(rect);defs.append(clip);
   for(let v=0;v<=domain.top;v+=10){node('line',{x1:left,x2:left+w,y1:y(v),y2:y(v),class:'grid'});node('text',{x:left-8,y:y(v)+5,'text-anchor':'end'},v);}
   for(const v of [0,.5,1])node('text',{x:x(v),y:height-10,'text-anchor':v===1?'end':'middle'},v);
   rs.forEach((r,i)=>node('path',{d:histogramPath(r.histogram,x,y),stroke:color,'stroke-dasharray':dashes[i],class:'hist-line','data-line-path':r.id,'clip-path':`url(#clip-${group})`}));
   node('line',{class:'bin-marker',x1:x(.275),x2:x(.275),y1:top,y2:top+h,stroke:'#173e2b','stroke-dasharray':'3 5','pointer-events':'none'});
   svg.onclick=e=>{const r=svg.getBoundingClientRect(),value=domain.min+(((e.clientX-r.left)/r.width*width-left)/w)*(domain.max-domain.min);const bin=nearestBin(rs[0].histogram,value);state.binSelection[group]=rs[0].histogram.indexOf(bin);update();};
   update(x);
  };
  const update=x=>{
   const selected=state.recordSelection[group],idx=state.binSelection[group]??25,bin=rs[0].histogram[idx],middle=(bin.left+bin.right)/2;
   card.querySelectorAll('[data-line]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.line===selected)));
   card.querySelectorAll('[data-line-path]').forEach(p=>{p.style.opacity=selected&&p.dataset.linePath!==selected?'.2':'1';});
   card.querySelector('.bin-range').value=idx;
   const label=`${bin.left.toFixed(2)} ~ ${bin.right.toFixed(2)}`;card.querySelector('.bin-label').textContent=label;
   card.querySelector('.bin-range').setAttribute('aria-valuetext',label);
   card.querySelector('.value-readout').innerHTML=`<dl>${rs.filter(r=>!selected||r.id===selected).map(r=>`<dt>${esc(r.name.replace(/^(SMCC |BTR |별도 크루 )/,''))}</dt><dd>${pct(r.histogram[idx].percent)}</dd>`).join('')}</dl>`;
   if(!x)x=xScale;
   const marker=svg.querySelector('.bin-marker');if(marker){marker.setAttribute('x1',x(middle));marker.setAttribute('x2',x(middle));marker.style.display=middle<domain.min?'none':'';}
  };
  card.querySelectorAll('[data-line]').forEach(b=>b.onclick=()=>{state.recordSelection[group]=state.recordSelection[group]===b.dataset.line?null:b.dataset.line;update();});
  card.querySelector('.bin-range').oninput=e=>{state.binSelection[group]=Number(e.target.value);update();};
  root.querySelector('.histograms').append(card);const ro=new ResizeObserver(()=>{if(card.isConnected)draw();});ro.observe(card);card.draw=draw;
 });
 root.querySelector('.emphasis-toggle').onclick=()=>{state.similarityFocus=!state.similarityFocus;root.update();};
 root.update=()=>{root.querySelector('.emphasis-toggle').setAttribute('aria-pressed',String(state.similarityFocus));root.querySelector('.conclusion').hidden=!state.similarityFocus;root.querySelectorAll('[data-group]').forEach(c=>{c.classList.toggle('muted',state.similarityFocus&&c.dataset.group!=='SMCC');c.draw();});};
 return root;
}

function imageMarkup(e,cls){return e.preview?`<img class="${cls}" src="./${esc(e.preview)}" alt="${cls?esc(e.title):''}" loading="lazy" decoding="async">`:'<span class="missing-thumb" aria-hidden="true">◇</span>';}
function imageRecovery(container){container.querySelectorAll('img').forEach(img=>{img.onerror=()=>{
 const box=element('<div class="image-failed"><span>사진을 불러오지 못했어요.</span><button type="button">다시 보기</button></div>');img.hidden=true;img.after(box);
 box.querySelector('button').onclick=()=>{box.remove();img.hidden=false;img.src=img.getAttribute('src');};
};});}
function eventList(events,title){
 const host=element(`<div><p class="small-note">${events.length}개 행사</p><input class="event-search" type="search" aria-label="행사 제목 검색" placeholder="행사 제목 찾기"><div class="event-list"></div></div>`);
 const update=()=>{const q=host.querySelector('input').value.trim().toLocaleLowerCase(),rs=events.filter(e=>e.title.toLocaleLowerCase().includes(q));
 host.querySelector('.event-list').innerHTML=rs.length?rs.map(e=>`<button type="button" class="event-item" data-event="${e.id}">${imageMarkup(e,'')}<span><span class="event-title">${esc(e.title)}</span><span class="event-date">${e.month?monthName(e.month):'날짜 미확인'}</span></span><span aria-hidden="true">›</span></button>`).join(''):'<p class="empty">조건에 맞는 행사가 없어요.</p>';
 host.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>pushPanel({event:b.dataset.event}));imageRecovery(host);
 };host.querySelector('input').oninput=update;update();return {title,content:host};
}
async function panelContent(q,page){
 if(q.has('event')){
  const events=await json('events'),e=events.find(e=>e.id===q.get('event'));
  if(!e)return {title:'행사 상세',content:element('<p class="empty">이 행사를 찾을 수 없어요.</p>')};
  if(page==='map')mapView?.select(e.id);
  const content=element(`<article>${imageMarkup(e,'detail-photo')}<p class="small-note">${e.month?monthName(e.month):'날짜 미확인'}${e.region?` · ${esc(e.region)}`:''}</p><h3 class="detail-title">${esc(e.title)}</h3><div class="tags">${e.tags.map(t=>`<span class="pill">${esc(t)}</span>`).join('')}</div><p class="detail-copy">${esc(e.summary)}</p>${e.facts.map(f=>`<p class="small-note">${esc(f)}</p>`).join('')}${e.url&&/^https:\/\//.test(e.url)?`<a class="source-link" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">모집 원문 보기 <span aria-hidden="true">↗</span></a>`:''}</article>`);
  const img=content.querySelector('img');if(img&&e.image){img.srcset=`./${e.preview} 360w, ./${e.image} 800w`;img.sizes='(min-width:650px) 606px, calc(100vw - 44px)';}imageRecovery(content);return {title:'행사 상세',content};
 }
 if(page==='map'&&q.get('panel')==='filters'){
  const c=filterData,content=element(`<div><p class="small-note">각 항목에서 하나씩 선택할 수 있어요.</p>${c.groups.map(g=>`<fieldset class="filter-group"><legend>${esc(g.title)}</legend><div class="filter-options">${g.items.map(i=>`<button type="button" data-group-id="${g.id}" data-condition="${i.id}" style="--share:${i.eventIds.length/c.knownTotal*100}%" aria-pressed="${state.selection[g.id]===i.id}"><span>${esc(i.label)}</span><span>${i.eventIds.length}</span></button>`).join('')}</div></fieldset>`).join('')}<button type="button" class="clear-conditions">전체 해제</button><p class="small-note" style="margin-top:20px">본문이 있는 240개 행사의 모집 안내 기준입니다. ‘안내 없음’은 금지나 실제 미참여를 뜻하지 않습니다.</p><div class="filter-footer"><span class="filter-count"></span><button type="button" class="apply-filter">지도 보기</button></div></div>`);
  const update=()=>{content.querySelectorAll('[data-condition]').forEach(b=>b.setAttribute('aria-pressed',String(state.selection[b.dataset.groupId]===b.dataset.condition)));content.querySelector('.filter-count').textContent=`${matchConditions(eventData,c,state.selection).size}개 행사`;updateFilters();};
  content.querySelectorAll('[data-condition]').forEach(b=>b.onclick=()=>{const key=b.dataset.groupId;state.selection[key]=state.selection[key]===b.dataset.condition?null:b.dataset.condition;update();});
  content.querySelector('.clear-conditions').onclick=()=>{state.selection={};update();};content.querySelector('.apply-filter').onclick=closePanel;update();return {title:'조건 선택',content};
 }
 if(page==='map'&&q.get('panel')==='list'){
  const ids=matchConditions(eventData,filterData,state.selection);return eventList(eventData.filter(e=>ids.has(e.id)),'행사 목록');
 }
 if(page==='monthly'&&q.has('month')){
  const events=await json('events'),month=q.get('month');return eventList(events.filter(e=>e.month===month),monthName(month));
 }
 if(page==='topics'&&q.has('record')){
  const d=await json('charts'),r=d.records.find(r=>r.id===q.get('record'));if(!r)return null;
  return {title:r.name,content:element(`<dl class="percent-list">${r.targets.map((t,i)=>`<div><dt><span class="swatch category-${i}" style="background-color:${shades[i]}"></span>${esc(t.category)}</dt><dd>${pct(t.percent)}</dd></div>`).join('')}</dl>`)};
 }
 return null;
}

const factories={home,map:createMap,monthly,topics,similarity};
async function renderRoute(){
 const version=++routeVersion,{page,query}=parseRoute(location.hash),changed=page!==state.page;
 if(changed){scrolls.set(state.page,scrollY);mapView?.setActive(false);if(sheet.open)sheet.close();state.page=page;main.replaceChildren(element('<p class="loading" role="status">자료를 준비하고 있어요.</p>'));}
 state.query=query;document.title=`${page==='home'?'모임 데이터 둘러보기':names[page]} · ORBIT`;
 nav.hidden=page==='home';nav.innerHTML=routes.map(k=>`<a href="#/${k}" ${page===k?'aria-current="page"':''}>${icon(k)}<span>${shortNames[k]}</span></a>`).join('');
 try{
  if(!views.has(page)){
   if(!pendingViews.has(page))pendingViews.set(page,Promise.resolve().then(()=>factories[page]()).then(v=>{views.set(page,v);pendingViews.delete(page);return v;},e=>{pendingViews.delete(page);throw e;}));
   await pendingViews.get(page);
  }
  if(version!==routeVersion)return;
  const view=views.get(page);if(main.firstElementChild!==view)main.replaceChildren(view);
  if(changed){window.scrollTo({top:scrolls.get(page)||0,behavior:'instant'});main.focus({preventScroll:true});}
  const hasPanel=query.has('event')||query.has('panel')||query.has('month')||query.has('record');
  if(hasPanel){
   document.querySelector('#sheet-title').textContent='불러오는 중';sheetContent.replaceChildren(element('<p class="loading" role="status">자료를 준비하고 있어요.</p>'));
   if(!sheet.open)sheet.showModal();mapView?.setActive(false);
   const p=await panelContent(query,page);if(version!==routeVersion)return;
   if(p){document.querySelector('#sheet-title').textContent=p.title;sheetContent.replaceChildren(p.content);sheet.scrollTop=0;}
   else sheet.close();
  }else if(sheet.open){sheet.close();if(opener?.isConnected)opener.focus({preventScroll:true});}
  view.update?.();
 }catch(error){if(version!==routeVersion)return;if(sheet.open){document.querySelector('#sheet-title').textContent='자료 연결 확인';sheetContent.replaceChildren(errorNode(()=>renderRoute()));}else main.replaceChildren(errorNode(()=>renderRoute()));}
}
window.addEventListener('hashchange',renderRoute);window.addEventListener('popstate',()=>{void renderRoute();});
document.addEventListener('visibilitychange',()=>mapView?.setActive(state.page==='map'&&!sheet.open&&!document.hidden));
void renderRoute();
