/* Authored environmental art. All walkable cells and mechanisms remain engine-owned. */
(()=>{
 const B=window.Bloxorz,P=B.GameScene.prototype,baseBuild=P.build,baseBlock=P.createBlock;
 const rnd=n=>{const v=Math.sin(n*127.1+63.4)*43758.545;return v-Math.floor(v);};
 const color=n=>new THREE.Color(n).convertSRGBToLinear();
 P.setAppearance=function(skin='stone',theme='ruins'){
  const changed=this.theme!==theme;this.skin=skin;this.theme=theme;const m=this.materials;
  const palettes={ruins:[0xe8d0a7,0xdcc297,0xf0ddb7,0xc3ae89],garden:[0xe9ddc4,0xe0d1b7,0xf1e6d2,0xc5b79c],frost:[0xa4d3e4,0xc4e2ed,0x91bfce,0xe1edf0]};
  m.stone.forEach((x,i)=>{x.color.copy(color(palettes[theme][i]));x.roughness=theme==='frost'?.43:1;x.envMapIntensity=.14;});
  m.dark.color.copy(color(theme==='frost'?0x4a809b:0x89775b));
  for(const key of ['copper','cube','cap']){m[key].map=m.stone[0].map;m[key].color.copy(color(skin==='jade'?0x318b74:skin==='bronze'?0xb77a4a:0xdac19b));m[key].metalness=skin==='bronze'?.65:.18;m[key].roughness=skin==='jade'?.30:.64;}
  m.edge.color.copy(color(0xbd8c42));m.accent.color.copy(color(0x55e6ee));this.renderer.toneMappingExposure=1;
  if(changed&&this.level)this.buildScenery(this.level,theme);
  if(this.waterMaterial)this.waterMaterial.color.copy(color(theme==='frost'?0x07536b:0x086879));
  this.render();
 };
 P.createBlock=function(cube=false){const group=baseBlock.call(this,cube);for(const z of [-.48,.48]){const gem=this.box(.18,.30,.04,this.materials.accent,.02);gem.position.z=z;gem.rotation.z=Math.PI/4;group.add(gem);}return group;};
 P.build=function(level,state){baseBuild.call(this,level,state);this.buildScenery(level,this.theme||'ruins');this.setAppearance(this.skin||'stone',this.theme||'ruins');};
 P.buildScenery=function(level,theme){
  const frost=theme==='frost',garden=theme==='garden';
  if(!this.decor){this.decor=new THREE.Group();this.scene.add(this.decor);}
  this.decor.clear();this.water=null;this.seabed=null;
  if(!this.artMats){const mat=(c,roughness=1)=>new THREE.MeshStandardMaterial({color:color(c),roughness});this.artMats={leaf:[0x244f32,0x47713a,0x718c3c].map(c=>mat(c)),moss:mat(0x5d783d),bark:mat(0x665340),pink:mat(0xe997c5),purple:mat(0xb94ab0),white:mat(0xf6f4df),gold:mat(0xdec85d),snow:mat(0xeef8fc,.86),ice:mat(0x9fdbea,.23),pine:mat(0x2b6260),bed:mat(0x28595c)};}
  const m=this.artMats,cols=level.grid[0].length,rows=level.grid.length,raw=new THREE.Group(),shore=[];
  const add=(geo,mat,x,y,z,sx=1,sy=1,sz=1,rot=0)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.y=rot;raw.add(mesh);return mesh;};
  const sphere=this.geometry('art-leaf',()=>new THREE.SphereGeometry(1,7,4));
  const lump=this.geometry('art-lump',()=>new THREE.DodecahedronGeometry(1,0));
  const cone=this.geometry('art-cone',()=>new THREE.ConeGeometry(1,1,7));
  const cylinder=this.geometry('art-stem',()=>new THREE.CylinderGeometry(1,1,1,5));
  const rock=(x,y,z,w,h,d,n)=>{
   const key=`weathered:${w}:${h}:${d}:${n%3}`;
   const geo=this.geometry(key,()=>{const g=B.roundedBox(w,h,d,.035),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),v=(rnd(Math.round(x*13)+Math.round(y*17)*31+Math.round(z*13)*67+n%3)-.5)*.022;p.setXYZ(i,x+v,y+v*.6,z+v);}g.computeVertexNormals();return g;});
   return add(geo,this.materials.stone[Math.abs(n)%4],x,y,z,1,1,1,(rnd(n)-.5)*.08);
  };
  const leaf=(x,y,z,n,size=.14)=>{const a=add(sphere,m.leaf[n%3],x,y,z,size*.5,size*.14,size,n*2.4);a.rotation.z=(rnd(n)-.5)*1.3;};
  const moss=(x,y,z,n,size=.3)=>add(lump,m.moss,x,y,z,size,.045,size*.7,n);
  const flower=(x,y,z,n,height=.30)=>{
   add(cylinder,m.leaf[0],x,y+height/2,z,.012,height,.012);
   for(let j=0;j<5;j++){const a=j*Math.PI*.4;add(sphere,n%3===0?m.purple:n%3===1?m.pink:m.white,x+Math.cos(a)*.075,y+height,z+Math.sin(a)*.075,.075,.028,.045,a);}
   add(lump,m.gold,x,y+height+.02,z,.035,.025,.035);
  };
  const shrub=(x,y,z,n,size=.45)=>{
   if(frost){add(lump,m.snow,x,y+.10,z,size,.15,size*.7,n);return;}
   moss(x,y,z,n,size*.65);
   for(let j=0;j<(garden?32:16);j++){const a=j*2.4,r=size*Math.sqrt(rnd(n+j));leaf(x+Math.cos(a)*r,y+.05+rnd(n+j+9)*.23,z+Math.sin(a)*r,n+j,garden?.19:.14);}
   if(garden)for(let j=0;j<12;j++)flower(x+(rnd(n+j)-.5)*size*1.5,y,z+(rnd(n+j+40)-.5)*size*1.5,n+j,.22+rnd(n+j)*.25);
   else if(n%3===0)for(let j=0;j<3;j++)flower(x+j*.10-.1,y,z,n+j,.25);
  };
  const ivy=(x,y,z,n)=>{if(frost){for(let j=0;j<5;j++)add(cone,m.ice,x+j*.09-.18,y-.15-rnd(n+j)*.12,z,.035,-(.24+rnd(n+j)*.3),.035);return;}
   for(let j=0;j<10;j++){const yy=y-j*.085;leaf(x+Math.sin(j*1.4)*.10,yy,z,n+j,.15);if(garden&&j%3===0)flower(x,yy,z+.02,n+j,.08);}
  };
  const pine=(x,y,z,n,h=1.6)=>{add(cylinder,m.bark,x,y+h*.35,z,.065,h*.7,.065);
   for(let j=0;j<4;j++){const radius=h*(.32-j*.06),height=h*.42;add(cone,m.pine,x,y+h*.27+j*h*.19,z,radius,height,radius,n);add(cone,m.snow,x,y+h*.30+j*h*.19,z,radius*.86,height*.87,radius*.86,n);}
  };
  // Only solid engine cells receive foundations. Fragile cells and bridges stay free to fall.
  level.grid.forEach((row,r)=>row.forEach((tile,c)=>{if(!tile||tile>=10||tile===2||tile===9)return;const p=this.world(r,c);shore.push([p.x,p.z,.49]);
   for(let layer=0;layer<6;layer++)rock(p.x,-.56-layer*.34,p.z,.96,.33,.96,r*7+c+layer);
   for(const [dr,dc] of [[0,-1],[0,1],[-1,0],[1,0]])if(!level.grid[r+dr]?.[c+dc]){
    const n=r*cols+c+dr*17+dc*31+100,ex=p.x+dc*.49,ez=p.z+dr*.49;
    if(rnd(n)>.45){if(frost)add(lump,m.snow,ex,-.01,ez,.28,.07,.19,n);else moss(ex,-.04,ez,n,.22);ivy(ex,-.16,ez,n);}
    if(rnd(n)>.78)shrub(ex+dc*.12,-.18,ez+dr*.12,n,garden?.5:.28);
   }
  }));
  // A broken gate, a collapsed terrace and a submerged wall, with different silhouettes.
  const clusters=[[-cols/2-1.9,-rows*.12,1.2],[cols/2+1.6,rows*.24,.95],[cols*.15,-rows/2-2.2,.8]];
  clusters.forEach(([x,z,size],n)=>{
   for(let r=-1;r<=1;r++)for(let c=-1;c<=1;c++){shore.push([x+c*.62*size,z+r*.62*size,.34*size]);for(let j=0;j<6;j++)rock(x+c*.62*size,-2.25+j*.33,z+r*.62*size,.62*size,.32,.62*size,n+r+c+9);}
   const height=n===0?6:n===1?3:2;
   for(let side=0;side<2;side++)for(let j=0;j<height-(side===1?2:0);j++){
    const px=x+(side? .55:-.55)*size,pz=z+(side?.3:-.2);
    rock(px,-.38+j*.38,pz,.60,.37,.62,n+j+side);
    if(j>1&&j%2===0){if(!frost)moss(px+.30,-.25+j*.38,pz,n+j,.2);ivy(px+.31,-.28+j*.38,pz,n+j);}
   }
   if(n===0){const lintel=rock(x-.15,1.85,z-.18,1.35,.33,.66,3);lintel.rotation.z=.12;rock(x+.60,-.22,z+.75,.9,.34,.6,2).rotation.y=.6;}
   else {rock(x-.65,-.28,z+.85,1.15,.37,.65,5).rotation.y=-.4;rock(x+.55,-.38,z-.7,.7,.35,.8,6);}
   for(let j=0;j<4;j++){const a=j*2.4;shrub(x+Math.cos(a)*.85*size,-.40,z+Math.sin(a)*.85*size,n*20+j,garden?.60:.4);}
   if(frost){pine(x-.7,-.38,z-.5,n,1.5);if(n!==0)pine(x+.65,-.4,z+.5,n+1,1.05);}
   else if(garden){for(let j=0;j<3;j++)shrub(x-.5+j*.4,-.08+(j===1?.28:0),z-.65,50+n+j,.55);}
   if(!frost){const padGeo=this.geometry('art-lily',()=>new THREE.CylinderGeometry(.15,.15,.012,18,1,false,.2,5.85));for(let j=0;j<14;j++){const a=j*2.4,r=1.3+rnd(n+j)*1.0;add(padGeo,m.leaf[2],x+Math.cos(a)*r,-.82,z+Math.sin(a)*r,1,1,1,j);}}
   else for(let j=0;j<5;j++)add(lump,m.snow,x+Math.sin(j*2.4)*1.6,-.84,z+Math.cos(j*2.4)*1.6,.25,.06,.22,j);
  });
  // Pebbles below the surface give a real depth reference instead of a flat tint.
  for(let j=0;j<180;j++){const x=(rnd(j+80)-.5)*(cols+7),z=(rnd(j+580)-.5)*(rows+7);add(lump,j%3===0?m.bed:this.materials.dark,x,-2.48,z,.12+rnd(j)*.12,.08,.15,j);}
  raw.updateMatrixWorld(true);this.sceneCeiling=Math.max(3,new THREE.Box3().setFromObject(raw).max.y);
  const batches=new Map();raw.traverse(obj=>{if(!obj.isMesh)return;const key=obj.geometry.uuid+obj.material.uuid;if(!batches.has(key))batches.set(key,{geometry:obj.geometry,material:obj.material,matrices:[]});batches.get(key).matrices.push(obj.matrixWorld.clone());});
  for(const batch of batches.values()){const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);batch.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=true;mesh.receiveShadow=true;this.decor.add(mesh);}
  this.sceneryBounds=new THREE.Box3().setFromObject(raw);this.makeWater(shore,cols,rows,frost);this.setCamera();
 };
 P.makeWater=function(shore,cols,rows,frost){
  const size=128,spanX=cols+12,spanZ=rows+12,data=new Uint8Array(size*size*4);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=(i/(size-1)-.5)*spanX,z=(j/(size-1)-.5)*spanZ;let distance=5;
   for(const [sx,sz,r] of shore)distance=Math.min(distance,Math.hypot(Math.max(0,Math.abs(x-sx)-r),Math.max(0,Math.abs(z-sz)-r)));
   const k=(j*size+i)*4;data[k]=Math.min(255,Math.round(distance/4*255));data[k+1]=Math.round((.45+.2*Math.sin(x*.7)*Math.cos(z*.8))*255);data[k+2]=0;data[k+3]=255;
  }
  this.shoreTexture?.dispose();this.shoreTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);this.shoreTexture.minFilter=this.shoreTexture.magFilter=THREE.LinearFilter;this.shoreTexture.needsUpdate=true;
  this.waterUniforms={gardenTime:{value:0},shoreMap:{value:this.shoreTexture},shoreSpan:{value:new THREE.Vector2(spanX,spanZ)}};
  this.waterMaterial?.dispose();this.waterMaterial=new THREE.MeshStandardMaterial({color:color(frost?0x07536b:0x086879),roughness:.27,metalness:.05,envMapIntensity:.20,transparent:true,opacity:.82,depthWrite:false});
  this.waterMaterial.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.waterUniforms);
   shader.vertexShader='varying vec3 waterWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nwaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='varying vec3 waterWorld;uniform float gardenTime;uniform sampler2D shoreMap;uniform vec2 shoreSpan;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 uv=waterWorld.xz/shoreSpan+.5;vec2 shore=texture2D(shoreMap,uv).rg;
    float depth=smoothstep(0.,.4,shore.r);float contact=(1.-smoothstep(.004,.022,shore.r))*smoothstep(0.,.004,shore.r);
    float t=gardenTime;vec2 q=waterWorld.xz;
    float wave=sin(q.x*5.+sin(q.y*3.)+t*.65)*cos(q.y*5.7+t*.4);
    diffuseColor.rgb*=mix(vec3(.75,1.35,1.20),vec3(.65,.86,1.05),depth);
    diffuseColor.rgb+=vec3(.07,.12,.10)*contact*(.65+.35*sin(t+q.x*8.+q.y*7.));
    diffuseColor.a=mix(.55,.91,depth);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=.24+.12*(wave*.5+.5);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 ripple=vec3(sin(q.x*5.+sin(q.y*2.2)+t*.5)*.022,0.,cos(q.y*6.1+sin(q.x*2.)+t*.43)*.022);
    normal=normalize(normal+mat3(viewMatrix)*ripple);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular*=.24;');
  };
  const plane=this.geometry('water-surface',()=>new THREE.PlaneGeometry(1,1));
  this.water=new THREE.Mesh(plane,this.waterMaterial);this.water.rotation.x=-Math.PI/2;this.water.position.y=-.85;this.water.receiveShadow=true;this.scene.add(this.water);
  // Water lives with decor for lifecycle, but is excluded from thumbnail bounds.
  this.decor.add(this.water);this.water.userData.surface=true;
  this.seabed=new THREE.Mesh(plane,this.artMats.bed);this.seabed.rotation.x=-Math.PI/2;this.seabed.position.y=-2.6;this.seabed.receiveShadow=true;this.seabed.userData.surface=true;this.decor.add(this.seabed);
  if(!this.waterLoop){let last=0;const frame=t=>{this.waterLoop=requestAnimationFrame(frame);if(document.hidden||t-last<33)return;last=t;if(!this.reducedMotion)this.waterUniforms.gardenTime.value=t/1000;this.render();};this.waterLoop=requestAnimationFrame(frame);}
 };
 P.updateWaterCoverage=function(){if(!this.water)return;const ray=new THREE.Raycaster(),point=new THREE.Vector3();for(const mesh of [this.water,this.seabed]){
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-mesh.position.y);let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const x of [-1,1])for(const y of [-1,1]){ray.setFromCamera(new THREE.Vector2(x,y),this.camera);if(ray.ray.intersectPlane(plane,point)){minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minZ=Math.min(minZ,point.z);maxZ=Math.max(maxZ,point.z);}}
  if(Number.isFinite(minX)){mesh.position.x=(minX+maxX)/2;mesh.position.z=(minZ+maxZ)/2;mesh.scale.set(maxX-minX+.1,maxZ-minZ+.1,1);}
 }};
 P.thumbnail=function(kind,id){
  this.previewCache=this.previewCache||new Map();const key=[this.level.id,kind,id,this.skin].join(':');if(this.previewCache.has(key))return this.previewCache.get(key);
  if(!this.previewRenderer){this.previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});this.previewRenderer.setSize(480,360);this.previewRenderer.outputEncoding=THREE.sRGBEncoding;this.previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;}
  const skin=this.skin,theme=this.theme;this.setAppearance(kind==='block'?id:skin,kind==='map'?id:theme);
  const scene=new THREE.Scene();scene.environment=this.scene.environment;scene.add(new THREE.HemisphereLight(0xffffff,0x607080,.8));const light=new THREE.DirectionalLight(0xffe3bc,1.4);light.position.set(-3,6,4);scene.add(light);
  const obj=new THREE.Group();if(kind==='block')obj.add(this.createBlock());else{obj.add(this.board.clone(true));for(const child of this.decor.children)if(!child.userData.surface)obj.add(child.clone(true));}
  scene.add(obj);const box=kind==='block'?new THREE.Box3().setFromObject(obj):this.sceneryBounds.clone().union(new THREE.Box3().setFromObject(this.board));const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());obj.position.sub(center);
  const span=Math.max(size.x/1.33,size.y,size.z)*.69,cam=new THREE.OrthographicCamera(-span*1.33,span*1.33,span,-span,.1,150);cam.position.set(12,13,17);cam.lookAt(0,0,0);this.previewRenderer.render(scene,cam);const result=this.previewRenderer.domElement.toDataURL('image/png');this.setAppearance(skin,theme);this.previewCache.set(key,result);return result;
 };
})();
