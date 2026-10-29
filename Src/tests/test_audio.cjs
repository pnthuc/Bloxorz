const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('local audio respects gesture, live mixer, mute and background pause',async()=>{
 const tracks=[],events={},sources=[];let requests=0;const urls=[];
 class Audio{constructor(url){this.url=url;this.volume=1;this.paused=true;tracks.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 class AudioContext{resume(){}decodeAudioData(){return Promise.resolve({});}createBufferSource(){const s={connect(){},disconnect(){},start(){sources.push(this);}};return s;}createGain(){return {gain:{value:0},connect(){},disconnect(){}};}}
 const document={hidden:false,addEventListener:(name,fn)=>events[name]=fn};
 const B={};const env={window:{Bloxorz:B,AudioContext},document,Audio,fetch:async(url)=>{urls.push(url);requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/audio.js'),'utf8'),env);
 const settings={master:80,music:40,ambient:60,effects:70,mute:false};B.audio.configure(()=>settings);
 assert(tracks.every(t=>t.paused),'no autoplay before interaction');events.pointerdown();await new Promise(setImmediate);
 assert(tracks.every(t=>!t.paused));assert.equal(tracks[0].volume,.17600000000000002);
 await B.audio.effect('splash');assert.equal(sources.length,1);assert(urls.includes('/static/audio/water-impact.mp3'));assert(!urls.includes('/static/audio/splash.wav'));assert(urls.includes('/static/audio/stone-roll.mp3'));assert(!urls.includes('/static/audio/win.wav'));assert(urls.includes('/static/audio/victory-chime.mp3'));assert(urls.includes('/static/audio/switch-tap.wav'));const loaded=requests;await B.audio.effect('splash');assert.equal(requests,loaded,'effect buffers are reused');
 settings.mute=true;B.audio.sync();assert(tracks.every(t=>t.paused));await B.audio.effect('roll');assert.equal(sources.length,2);
 settings.mute=false;settings.music=0;B.audio.sync();assert(tracks[0].paused);assert(!tracks[1].paused);
 document.hidden=true;events.visibilitychange();assert(tracks.every(t=>t.paused));
 document.hidden=false;events.visibilitychange();assert(tracks[0].paused);assert(!tracks[1].paused);
});
test('authored background WAV assets are valid uncompressed mono audio and below clipping',()=>{
 for(const name of ['lagoon-jig','shore']){
  const b=fs.readFileSync(path.join(__dirname,'../static/audio',name+'.wav'));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),22050);
  let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));assert(peak>20&&peak<32760,name+' is audible without clipped samples');
 }
});
test('supplied switch trim contains its click without leading/trailing recording silence',()=>{
 const b=fs.readFileSync(path.join(__dirname,'../static/audio/switch-tap.wav'));
 const rate=b.readUInt32LE(24),channels=b.readUInt16LE(22),duration=(b.length-44)/(rate*channels*2);
 assert(duration>.07&&duration<.4,'short one-shot click');
 let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));assert(peak>1000&&peak<32767);
 assert(Math.abs(b.readInt16LE(44))<5);assert(Math.abs(b.readInt16LE(b.length-2))<5,'fades avoid waveform discontinuities');
});
