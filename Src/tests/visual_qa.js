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
  await save('performance.json',JSON.stringify({method:'120 warmed scene renders; GPU synchronized with gl.finish; includes no timer wait',viewport:[innerWidth,innerHeight],devicePixelRatio,cpuRenderMs:stats(cpu),completedRenderMs:stats(complete),drawCalls:stats(draws),triangles:stats(triangles)},null,2));status('Performance saved');
 };
})();
