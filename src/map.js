import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {pointShaders,edgeShaders} from './legacy-shaders.mjs';

// Static geometry: the app renders only on interaction, resize or state changes.
export function createMapView(host,data,onSelect){
 let renderer,composer,scene,camera,controls,points,lines,ring,observer,frame=0,active=false,failed=false,selected=null,lastAspect=null;
 let allowed=new Set(data.nodes.map(n=>n.id)),down=null,dragged=false,pointers=new Set();
 const index=new Map(data.nodes.map((n,i)=>[n.id,i])),positions=data.nodes.map(n=>new THREE.Vector3(...n.position));
 const box=new THREE.Box3().setFromPoints(positions),sphere=box.getBoundingSphere(new THREE.Sphere());
 const center=sphere.center.clone(),radius=Math.max(sphere.radius,1),projected=new THREE.Vector3();
 const colors=data.nodes.map(n=>new THREE.Color(data.clusters[n.cluster].color));
 const fallback=host.querySelector('.map-fallback'),zoomBar=host.querySelector('.map-zoom'),stats=host.querySelector('.map-stats');
 function draw(){
  if(!active||document.hidden||!renderer||failed)return;
  camera.updateMatrixWorld();const m=camera.matrixWorldInverse.elements;let near=Infinity,far=-Infinity;
  for(const p of positions){const depth=-(m[2]*p.x+m[6]*p.y+m[10]*p.z+m[14]);near=Math.min(near,depth);far=Math.max(far,depth);}
  points.material.uniforms.uDepthRange.value.set(near,Math.max(near+.1,far));
  points.material.uniforms.uHasFocus.value=selected||allowed.size!==data.nodes.length?1:0;
  ring.quaternion.copy(camera.quaternion);composer.render();
 }
 function request(){if(active&&!document.hidden&&!failed&&!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
 function resize(){
  if(!renderer||failed)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  const aspect=w/h;
  const fit=a=>radius/Math.sin(Math.min(THREE.MathUtils.degToRad(22.5),Math.atan(Math.tan(THREE.MathUtils.degToRad(22.5))*a)))*1.12;
  if(lastAspect&&lastAspect!==aspect){const offset=camera.position.clone().sub(controls.target).multiplyScalar(fit(aspect)/fit(lastAspect));camera.position.copy(controls.target).add(offset);controls.maxDistance=fit(aspect)*2.6;controls.update();}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(w,h,false);camera.aspect=aspect;camera.updateProjectionMatrix();
  if(!lastAspect)setHome();lastAspect=aspect;
  composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);
  points.material.uniforms.uPixel.value=renderer.getPixelRatio();request();
 }
 function setHome(){
  if(!camera)return;const vertical=THREE.MathUtils.degToRad(camera.fov/2),horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
  const distance=radius/Math.sin(Math.min(vertical,horizontal))*1.12;
  camera.position.copy(center).add(new THREE.Vector3(.14,.08,1).normalize().multiplyScalar(distance));controls.target.copy(center);
  controls.minDistance=radius*.35;controls.maxDistance=distance*2.6;controls.update();request();
 }
 function pick(e){
  if(!active||failed)return;const r=host.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;let best=null,min=e.pointerType==='touch'?28:20;
  camera.updateMatrixWorld();
  positions.forEach((p,i)=>{
   const id=data.nodes[i].id;if(!allowed.has(id))return;
   projected.copy(p).project(camera);if(projected.z< -1||projected.z>1)return;
   const x=(projected.x+1)*r.width/2,y=(1-projected.y)*r.height/2,d=Math.hypot(px-x,py-y);
   if(d<min){min=d;best=id;}
  });
  if(best){select(best);onSelect(best);}
 }
 function repaint(){
  if(!points||failed)return;const a=points.geometry.getAttribute('aAlpha');
  const neighbors=new Set(data.edges.flatMap(e=>e.source===selected?[e.target]:e.target===selected?[e.source]:[]));
  data.nodes.forEach((n,i)=>a.setX(i,allowed.has(n.id)?(selected&&selected!==n.id?(neighbors.has(n.id)?.95:.14):1):.07));
  a.needsUpdate=true;
  const alpha=lines.geometry.getAttribute('aAlpha'),focus=lines.geometry.getAttribute('aFocus');let matchingEdges=0;
  data.edges.forEach((e,i)=>{
   const visible=allowed.has(e.source)&&allowed.has(e.target);if(visible)matchingEdges++;
   const direct=selected&&(e.source===selected||e.target===selected);
   const factor=visible?(selected?(direct?.95:.035):allowed.size!==data.nodes.length?.9:.38):.025;
   for(let j=0;j<2;j++){alpha.setX(i*2+j,factor);focus.setX(i*2+j,direct?1:0);}
  });alpha.needsUpdate=true;focus.needsUpdate=true;
  stats.textContent=`행사 ${allowed.size} · 연결 ${matchingEdges}`;
  ring.visible=!!selected&&allowed.has(selected);if(ring.visible)ring.position.copy(positions[index.get(selected)]);
  request();
 }
 function select(id){selected=index.has(id)?id:null;repaint();draw();}
 function pointerDown(e){pointers.add(e.pointerId);if(pointers.size===1){down={x:e.clientX,y:e.clientY};dragged=false;}else dragged=true;}
 function pointerMove(e){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)dragged=true;}
 function pointerUp(e){const tap=pointers.size===1&&!dragged&&down; pointers.delete(e.pointerId);if(!pointers.size)down=null;if(tap)pick(e);}
 function pointerCancel(e){pointers.delete(e.pointerId);dragged=true;down=null;}
 function fail(){failed=true;if(frame)cancelAnimationFrame(frame);frame=0;fallback.hidden=false;zoomBar.hidden=true;stats.hidden=true;if(renderer)renderer.domElement.hidden=true;}
 function dispose(){
  observer?.disconnect();controls?.dispose();if(frame)cancelAnimationFrame(frame);frame=0;
  scene?.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
  composer?.passes.forEach(p=>p.dispose?.());composer?.dispose();renderer?.dispose();renderer?.domElement.remove();renderer=null;
 }
 function init(){
  dispose();failed=false;lastAspect=null;
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
   renderer.setClearColor(0x03040c,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
   renderer.domElement.setAttribute('aria-label','3D 모임 지도. 밀어서 회전, 두 손가락으로 확대. 행사 목록에서도 선택할 수 있습니다.');
   renderer.domElement.setAttribute('role','img');renderer.domElement.tabIndex=0;
   host.prepend(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,radius*20);
   controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=false;controls.autoRotate=false;controls.rotateSpeed=.65;controls.zoomSpeed=.8;controls.addEventListener('change',()=>{if(ring)ring.quaternion.copy(camera.quaternion);request();});
   composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new OutputPass());
   const depthRange={value:new THREE.Vector2(0,1)};
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions.flatMap(p=>p.toArray()),3));
   geometry.setAttribute('aColor',new THREE.Float32BufferAttribute(colors.flatMap(c=>c.toArray()),3));
   for(const key of ['aAlpha','aEntry','aLife','aWave'])geometry.setAttribute(key,new THREE.Float32BufferAttribute(new Float32Array(positions.length).fill(key==='aWave'?0:1),1));
   const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uSteadyGlow:{value:0},uGlowMinSize:{value:6},uViewAlpha:{value:1},uPixel:{value:1},uReveal:{value:1},uDepthRange:depthRange,uHasFocus:{value:0},uTimeline:{value:0},uTimelineSize:{value:7},uTimelineColor:{value:new THREE.Color(0x9de0ef)},uTimelineClip:{value:new THREE.Vector4()},uTimelineClipOn:{value:0}},
    vertexShader:pointShaders.vertex,fragmentShader:pointShaders.fragment});
   points=new THREE.Points(geometry,material);scene.add(points);
   const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(data.edges.flatMap(e=>[...positions[index.get(e.source)].toArray(),...positions[index.get(e.target)].toArray()]),3));
   lineGeometry.setAttribute('aColor',new THREE.Float32BufferAttribute(data.edges.flatMap(e=>{const c=colors[index.get(e.source)].clone().lerp(colors[index.get(e.target)],.5).multiplyScalar(.8);return [...c.toArray(),...c.toArray()];}),3));
   for(const key of ['aAlpha','aFocus','aWave','aDelay'])lineGeometry.setAttribute(key,new THREE.Float32BufferAttribute(new Float32Array(data.edges.length*2),1));
   lineGeometry.setAttribute('aT',new THREE.Float32BufferAttribute(data.edges.flatMap(()=>[0,1]),1));
   lines=new THREE.LineSegments(lineGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uReveal:{value:1},uViewAlpha:{value:1},uDepthRange:depthRange},vertexShader:edgeShaders.vertex,fragmentShader:edgeShaders.fragment}));scene.add(lines);
   ring=new THREE.Mesh(new THREE.RingGeometry(2.7,2.78,64),new THREE.MeshBasicMaterial({color:0xa9e6f4,side:THREE.DoubleSide,transparent:true,opacity:.85,depthTest:false,blending:THREE.AdditiveBlending}));ring.visible=false;scene.add(ring);
   const canvas=renderer.domElement;canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerCancel);
   canvas.addEventListener('keydown',e=>{if(!active)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)){
     e.preventDefault();if(e.key==='Home')setHome();else if(['+','=','-'].includes(e.key))zoom(e.key==='-'?1.25:.8);
     else{const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);s.theta+=e.key==='ArrowLeft'?.15:e.key==='ArrowRight'?-.15:0;s.phi=Math.max(.1,Math.min(Math.PI-.1,s.phi+(e.key==='ArrowUp'?-.15:e.key==='ArrowDown'?.15:0)));camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();request();}
    }
   });
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail();});
   observer=new ResizeObserver(resize);observer.observe(host);resize();setHome();repaint();fallback.hidden=true;zoomBar.hidden=false;stats.hidden=false;
  }catch{fail();}
 }
 function zoom(factor){if(!camera||failed)return;const o=camera.position.clone().sub(controls.target);o.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,o.length()*factor)));camera.position.copy(controls.target).add(o);controls.update();request();}
 init();
 return {zoom,select,retry:init,
  setActive(value){active=!!value&&!document.hidden;if(controls)controls.enabled=active;if(!active&&frame){cancelAnimationFrame(frame);frame=0;}if(active){resize();request();}},
  reset(){selected=null;setHome();repaint();},
  setFilter(ids){allowed=ids;if(selected&&!allowed.has(selected))selected=null;repaint();}
 };
}
