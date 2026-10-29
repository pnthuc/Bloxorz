const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadImage}=require('@napi-rs/canvas');
const THREE=require('../static/vendor/three.min.js');
const root=path.resolve(__dirname,'..');
const renderer=()=>({capabilities:{getMaxAnisotropy:()=>8}});
const localImage=url=>loadImage(path.join(root,url.slice(1)));
function assets(){
  const context={window:{},THREE};
  vm.runInNewContext(fs.readFileSync(path.join(root,'static/js/materials.js'),'utf8'),context);
  return context.window.Bloxorz;
}

test('fixed images load once and repeated materials share their texture objects',async()=>{
  const B=assets(),urls=[];
  const pending=B.prepareRenderAssets(url=>{urls.push(url);return localImage(url);});
  assert.equal(B.prepareRenderAssets(),pending);
  assert.throws(()=>B.createMaterials(renderer()),/chưa sẵn sàng/);
  await pending;
  assert.equal(urls.length,38);assert.equal(new Set(urls).size,38);
  await B.prepareRenderAssets(()=>{throw Error('must reuse loaded images');});
  const r=renderer(),a=B.createMaterials(r),b=B.createMaterials(r);
  assert.notEqual(a.stone[0],b.stone[0]);
  for(const key of ['map','normalMap','roughnessMap'])assert.equal(a.stone[0][key],b.stone[0][key]);
  assert.notEqual(a.stone[0].map,B.createMaterials(renderer()).stone[0].map,'GPU texture ownership is per renderer');
  assert.equal(a.copper.map.image.height,2*a.copper.map.image.width);
  assert.equal(a.cube.map.image.height,a.cube.map.image.width);
});

test('a missing image reports the asset and does not permanently poison preload',async()=>{
  const B=assets();
  await assert.rejects(B.prepareRenderAssets(async()=>{throw Error('missing');}),/Không tải được tài nguyên đồ họa:/);
  await B.prepareRenderAssets(localImage);
  assert.equal(B.createMaterials(renderer()).stone[0].map.image.width,256);
});

test('prebuilt maps retain linear data, surface orientation and repeating water sampling',async()=>{
  const B=assets();await B.prepareRenderAssets(localImage);
  const r=renderer(),m=B.createMaterials(r),water=B.createWaterField(r);
  assert.equal(m.stone[0].map.encoding,THREE.sRGBEncoding);
  assert.equal(m.stone[0].normalMap.encoding,THREE.LinearEncoding);
  assert.equal(m.stone[0].roughnessMap.encoding,THREE.LinearEncoding);
  assert.equal(m.stone[0].map.flipY,true);
  assert.equal(water.flipY,false,'water keeps the original DataTexture row direction');
  assert.equal(water.encoding,THREE.LinearEncoding);
  assert.equal(water.wrapS,THREE.RepeatWrapping);assert.equal(water.wrapT,THREE.RepeatWrapping);
  assert.equal(water.minFilter,THREE.LinearMipmapLinearFilter);
  assert.equal(water.generateMipmaps,true);assert.equal(water.anisotropy,8);
  assert.equal(B.createWaterField(r),water);
  assert.equal(B.createSurface(r,'snow',11).roughness,.96);
  assert.equal(B.createSurface(r,'ice',43).roughness,.58);
});
