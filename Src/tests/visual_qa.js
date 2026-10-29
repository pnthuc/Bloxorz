/* Test-only browser runner: real renderer and real engine-generated transitions. */
(()=>{
 const version=new URLSearchParams(location.search).get('version')||'after';
 const panel=document.createElement('div');panel.style.cssText='position:fixed;z-index:100;right:12px;top:12px;background:#032f3c;padding:8px';
 panel.innerHTML='<button id="qa-record">Record four falls · ⅓ speed</button><button id="qa-perf">Measure 120 renders</button><output id="qa-status">Ready</output>';document.body.append(panel);
 const status=text=>document.getElementById('qa-status').textContent=text;
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const save=(name,data)=>fetch('/qa-save/'+version+'-'+name,{method:'POST',body:data});
 document.getElementById('qa-record').onclick=async()=>{
  try{
   panel.querySelectorAll('button').forEach(b=>b.disabled=true);
   const scene=Bloxorz.ui.actions.scene(),originalTween=scene.tween.bind(scene);
   scene.tween=(duration,update)=>originalTween(duration*3,update);
   const cases=await (await fetch('/qa-cases')).json();
   for(const item of cases){
    status('Recording '+item.name);scene.build(item.level,item.before);scene.rotation.copy(scene.canonicalRotation(item.before.orientation));scene.showState(item.before);
    scene.elevation=.52;scene.fitCamera();scene.render();await wait(350);
    const stream=scene.renderer.domElement.captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:8000000});
    const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});recorder.start();
    await wait(600);
    const result=item.outcome;await scene.roll(item.before,item.action,result.next_state,result.valid,result.failure_state);
    if(item.name==='goal')await scene.victory();await wait(650);recorder.stop();
    await save(item.name+'.webm',await done);stream.getTracks().forEach(t=>t.stop());
   }
   scene.tween=originalTween;status('Four videos saved');
  }catch(e){status('ERROR: '+e.message);console.error(e);}finally{panel.querySelectorAll('button').forEach(b=>b.disabled=false);}
 };
 document.getElementById('qa-perf').onclick=async()=>{
  const scene=Bloxorz.ui.actions.scene();status('Measuring 120 synchronized renders');
  const gl=scene.renderer.getContext(),cpu=[],complete=[],draws=[],triangles=[];
  // gl.finish includes GPU completion rather than mistaking CPU submission time for FPS.
  for(let i=0;i<125;i++){
   const t=performance.now();scene.render();const submitted=performance.now();gl.finish();
   if(i>=5){cpu.push(submitted-t);complete.push(performance.now()-t);draws.push(scene.renderer.info.render.calls);triangles.push(scene.renderer.info.render.triangles);}
   if(i%20===0)await wait(0);
  }
  const stats=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],count:a.length};};
  await save('performance-'+(scene.theme||'ruins')+'.json',JSON.stringify({method:'120 warmed scene renders; GPU synchronized with gl.finish; includes no timer wait',viewport:[innerWidth,innerHeight],devicePixelRatio,cpuRenderMs:stats(cpu),completedRenderMs:stats(complete),drawCalls:stats(draws),triangles:stats(triangles)},null,2));status('Performance saved');
 };

 const audit=document.createElement('button');audit.id='qa-water';audit.textContent='Audit water and record orbit';panel.prepend(audit);
 audit.onclick=async()=>{try{
  const s=Bloxorz.ui.actions.scene(),gl=s.renderer.getContext(),records=[];let worst={white:-1};
  const measure=()=>{s.setCamera();const objects=[s.board,s.blocks,...s.decor.children.filter(x=>!x.userData.surface)],visible=objects.map(x=>x.visible);objects.forEach(x=>x.visible=false);s.render();const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let n=0,white=0;for(let i=0;i<pixels.length;i+=64){n++;if(pixels[i]>210&&pixels[i+1]>210&&pixels[i+2]>210)white++;}objects.forEach((x,i)=>x.visible=visible[i]);return white/n;};
  for(const theme of ['ruins','garden','frost']){s.setAppearance('stone',theme);for(const elevation of [.3,.45,.6,.75,.85,.9,.95,1,1.1,1.18])for(const zoom of [.65,1.65])for(let i=0;i<24;i++){s.azimuth=i*Math.PI/12;s.elevation=elevation;s.zoom=zoom;const white=measure(),r={theme,elevation,zoom,azimuth:s.azimuth,white};records.push(r);if(white>worst.white){worst=r;await save('water-worst.png',await new Promise(r=>s.renderer.domElement.toBlob(r)));}if(i%4===0)await wait(0);}}
  const isolation=[];s.setAppearance('stone',worst.theme);s.azimuth=worst.azimuth;s.elevation=worst.elevation;s.zoom=worst.zoom;
  const original=s.waterMaterial.onBeforeCompile,exposure=s.renderer.toneMappingExposure,env=s.scene.environment;
  for(const effect of ['all','no-direct-specular','no-indirect-specular','no-normal','no-environment']){
   s.scene.environment=effect==='no-environment'?null:env;
   s.waterMaterial.onBeforeCompile=shader=>{original(shader);if(effect==='no-direct-specular')shader.fragmentShader=shader.fragmentShader.replace('#include <output_fragment>','outgoingLight-=reflectedLight.directSpecular;\n#include <output_fragment>');if(effect==='no-indirect-specular')shader.fragmentShader=shader.fragmentShader.replace('#include <output_fragment>','outgoingLight-=reflectedLight.indirectSpecular;\n#include <output_fragment>');if(effect==='no-normal')shader.fragmentShader=shader.fragmentShader.replace('normal=normalize(normal+mat3(viewMatrix)*ripple);','');};
   s.waterMaterial.customProgramCacheKey=()=>effect;s.waterMaterial.needsUpdate=true;const white=measure();isolation.push({effect,white});await save('isolate-'+effect+'.png',await new Promise(r=>s.renderer.domElement.toBlob(r)));
  }
  s.scene.environment=env;s.waterMaterial.onBeforeCompile=original;s.waterMaterial.customProgramCacheKey=()=>version;s.waterMaterial.needsUpdate=true;
  await save('water-audit.json',JSON.stringify({records,worst,isolation,exposure,fog:s.scene.fog},null,2));
  for(const theme of ['ruins','garden','frost']){s.setAppearance('stone',theme);const chunks=[],stream=s.renderer.domElement.captureStream(30),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:6000000}),done=new Promise(r=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=()=>r(new Blob(chunks,{type:'video/webm'}));});rec.start();const start=performance.now();await new Promise(resolve=>{const frame=t=>{const k=Math.min(1,(t-start)/8000);s.azimuth=k*Math.PI*2;s.elevation=.3+.88*(.5-.5*Math.cos(k*Math.PI*4));s.zoom=.65+k;s.setCamera();s.render();if(k<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});rec.stop();await save('orbit-'+theme+'.webm',await done);stream.getTracks().forEach(t=>t.stop());}
  status('Water audit and videos saved');
 }catch(e){status(e.message);console.error(e);}};

 const resolution=document.createElement('output');resolution.id='qa-resolution';panel.append(resolution);let lastResolution='';
 setInterval(()=>{const canvas=document.querySelector('#canvas-container canvas');if(!canvas)return;const value={dpr:devicePixelRatio,css:[canvas.clientWidth,canvas.clientHeight],buffer:[canvas.width,canvas.height],viewport:[innerWidth,innerHeight]};resolution.textContent=JSON.stringify(value);if(lastResolution!==resolution.textContent){lastResolution=resolution.textContent;save('resolution-'+Math.round(devicePixelRatio*100)+'.json',lastResolution);}},1000);
 const singleBenchmark=document.getElementById('qa-perf').onclick;
 document.getElementById('qa-perf').onclick=async()=>{for(const theme of ['ruins','garden','frost']){Bloxorz.ui.actions.scene().setAppearance('stone',theme);await singleBenchmark();}status('Three theme benchmarks saved');};
})();

(()=>{
 const b=document.createElement('button');b.id='qa-art';b.textContent='Capture environment review';document.body.append(b);b.style.cssText='position:fixed;right:16px;bottom:16px;z-index:1000';
 b.onclick=async()=>{const s=Bloxorz.ui.actions.scene(),records=[],out=document.getElementById('qa-status');
 const wait=ms=>new Promise(r=>setTimeout(r,ms));const save=(name,data)=>fetch('/qa-save/'+(new URLSearchParams(location.search).get('version')==='polish'?'polish-':'art-')+name,{method:'POST',body:data});
 const shot=async name=>{s.render();await save(name+'.png',await new Promise(r=>s.renderer.domElement.toBlob(r)));};
 try{
 await Bloxorz.ui.actions.loadLevel('3');s.resetCamera();
 for(const theme of ['ruins','garden','frost']){
  out.textContent='Capturing '+theme;s.setAppearance('stone',theme);s.resetCamera();await shot(theme);
  const frames=[],gl=s.renderer.getContext();for(let i=0;i<65;i++){const t=performance.now();s.render();gl.finish();if(i>=5)frames.push(performance.now()-t);await wait(0);}frames.sort((a,b)=>a-b);
  records.push({theme,level:3,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,buffer:[s.renderer.domElement.width,s.renderer.domElement.height],calls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,memory:{...s.renderer.info.memory},medianMs:frames[30],p95Ms:frames[57]});
  s.elevation=.3;s.azimuth=.6378000183105472;s.zoom=.65;s.setCamera();await shot(theme+'-low');s.zoom=1.65;s.setCamera();await shot(theme+'-wide');
  const chunks=[],stream=s.renderer.domElement.captureStream(30),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'}),done=new Promise(r=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=()=>r(new Blob(chunks,{type:'video/webm'}));});rec.start();
  const start=performance.now();await new Promise(resolve=>{const frame=t=>{const k=Math.min(1,(t-start)/7000);s.azimuth=.45+k*Math.PI*2;s.elevation=.3+.88*(.5-.5*Math.cos(k*Math.PI*2));s.zoom=.7+k*.8;s.setCamera();s.render();if(k<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});rec.stop();await save(theme+'.webm',await done);stream.getTracks().forEach(t=>t.stop());
 }
 for(const id of ['1','2','11','33']){await Bloxorz.ui.actions.loadLevel(id);for(const theme of ['ruins','garden','frost']){s.setAppearance('stone',theme);s.resetCamera();await shot('level-'+id+'-'+theme);records.push({level:id,theme,calls:s.renderer.info.render.calls,memory:{...s.renderer.info.memory}});}}
 await save('performance.json',JSON.stringify(records,null,2));await Bloxorz.ui.actions.loadLevel('3');s.setAppearance('stone','ruins');s.resetCamera();out.textContent='Environment review saved';
 }catch(e){out.textContent='ERROR '+e.message;console.error(e);}
 };
})();

(()=>{const b=document.createElement('button');b.id='qa-profile';b.textContent='Profile shadow bottleneck';b.style.cssText='position:fixed;right:16px;bottom:65px;z-index:1000';document.body.append(b);b.onclick=async()=>{const s=Bloxorz.ui.actions.scene(),r=s.renderer,gl=r.getContext(),rows=[];await Bloxorz.ui.actions.loadLevel('3');s.resetCamera();const auto=r.shadowMap.autoUpdate;
for(const theme of ['ruins','garden','frost']){s.setAppearance('stone',theme);for(const cached of [false,true]){r.shadowMap.autoUpdate=!cached;r.shadowMap.needsUpdate=true;s.render();gl.finish();const cpu=[],gpu=[];for(let i=0;i<90;i++){const t=performance.now();s.render();const submit=performance.now()-t;gl.finish();if(i>=30){cpu.push(submit);gpu.push(performance.now()-t);}await new Promise(q=>setTimeout(q,0));}const stat=a=>{a.sort((x,y)=>x-y);return {median:a[30],p95:a[57]};};rows.push({theme,cachedShadow:cached,cpu:stat(cpu),synchronized:stat(gpu),calls:r.info.render.calls,triangles:r.info.render.triangles,buffer:[r.domElement.width,r.domElement.height],dpr:devicePixelRatio});}}
r.shadowMap.autoUpdate=auto;await fetch('/qa-save/profile-'+(new URLSearchParams(location.search).get('version')||'current')+'.json',{method:'POST',body:JSON.stringify(rows,null,2)});document.getElementById('qa-status').textContent='Profile saved';};})();

(()=>{const b=document.createElement('button');b.id='qa-shore';b.textContent='Capture shoreline correction';b.style.cssText='position:fixed;right:16px;bottom:110px;z-index:1000';document.body.append(b);b.onclick=async()=>{await Bloxorz.ui.actions.loadLevel('3');const s=Bloxorz.ui.actions.scene();for(const theme of ['ruins','garden','frost']){s.setAppearance('stone',theme);s.resetCamera();s.render();await fetch('/qa-save/shoreline-'+theme+'.png',{method:'POST',body:await new Promise(r=>s.renderer.domElement.toBlob(r))});}document.getElementById('qa-status').textContent='Shoreline correction saved';};})();
