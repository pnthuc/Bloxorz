/* Local score/ambience and user-supplied gameplay recordings; see audio/README.md. */
(()=>{
 const B=window.Bloxorz;let context=null,settings=()=>({}),unlocked=false;
 const music=new Audio('/static/audio/lagoon-jig.wav');music.loop=true;music.preload='none';
 const ambient=new Audio('/static/audio/shore.wav');ambient.loop=true;ambient.preload='none';
 const effectFiles={roll:'stone-roll.mp3',switch:'switch-tap.wav',splash:'water-impact.mp3',win:'victory-chime.mp3'};
 const buffers=new Map(),loading=new Map();
 const volume=channel=>{const p=settings();return p.mute?0:(p.master??80)*(p[channel]??50)/10000;};
 const sync=()=>{for(const [track,channel,scale] of [[music,'music',.55],[ambient,'ambient',.65]]){track.volume=volume(channel)*scale;if(document.hidden||!track.volume)track.pause();else if(unlocked)track.play().catch(()=>{});}};
 const get=async name=>{if(buffers.has(name))return buffers.get(name);if(!loading.has(name))loading.set(name,fetch('/static/audio/'+(effectFiles[name]||effectFiles.roll)).then(r=>{if(!r.ok)throw Error('Audio '+r.status);return r.arrayBuffer();}).then(a=>context.decodeAudioData(a)).then(b=>{buffers.set(name,b);return b;}).catch(()=>null));return loading.get(name);};
 const effect=async(name='roll')=>{if(!context||!unlocked||!volume('effects')||document.hidden)return;const buffer=await get(name);if(!buffer||!volume('effects'))return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume('effects')*(name==='splash'?.52:.65);source.connect(gain);gain.connect(context.destination);source.onended=()=>{source.disconnect();gain.disconnect();};source.start();};
 const unlock=()=>{try{if(!context)context=new (window.AudioContext||window.webkitAudioContext)();context.resume();unlocked=true;sync();['roll','switch','splash','win'].forEach(get);}catch{}};
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 document.addEventListener('visibilitychange',sync);
 B.audio={configure:fn=>{settings=fn;sync();},sync,effect,preview:()=>{unlock();effect('switch');}};
})();
