/* Authored procedural ruin clusters. Decorations never participate in board rules. */
(()=>{
 const B=window.Bloxorz,P=B.GameScene.prototype,baseBuild=P.build,baseBlock=P.createBlock;
 const rand=n=>{const v=Math.sin(n*127.1+63.4)*43758.545;return v-Math.floor(v);};
 P.setAppearance=function(skin='stone',theme='ruins'){
  this.skin=skin;this.theme=theme;const frost=theme==='frost',m=this.materials;
  m.stone.forEach((x,i)=>{x.envMapIntensity=.12;x.color.set(frost?0xb9d9ed:theme==='garden'?0xf4ddd5:[0xffe4bf,0xebd1aa,0xf0dbbb,0xdfc59d][i]).convertSRGBToLinear();});
  m.dark.color.set(frost?0x6a9cb9:0x957957).convertSRGBToLinear();
  for(const key of ['copper','cube','cap']){m[key].map=m.stone[0].map;m[key].color.set(skin==='jade'?0x4ea58a:skin==='bronze'?0xb77a4a:0xe0c598).convertSRGBToLinear();m[key].metalness=skin==='bronze'?.45:.12;m[key].roughness=.75;m[key].needsUpdate=true;}
  m.edge.color.set(0xbd8c42).convertSRGBToLinear();m.accent.color.set(0x54dce7).convertSRGBToLinear();
  this.renderer.toneMappingExposure=1;this.render();
 };
 P.createBlock=function(cube=false){const group=baseBlock.call(this,cube);for(const z of [-.48,.48]){const gem=this.box(.20,.31,.04,this.materials.accent,.02);gem.position.z=z;gem.rotation.z=Math.PI/4;group.add(gem);}return group;};
 P.build=function(level,state){
  baseBuild.call(this,level,state);
  if(!this.decor){this.decor=new THREE.Group();this.scene.add(this.decor);this.leafMats=[0x37602c,0x6a8535,0x94a74c].map(c=>new THREE.MeshStandardMaterial({color:new THREE.Color(c).convertSRGBToLinear(),roughness:.9}));this.flowerMat=new THREE.MeshStandardMaterial({color:new THREE.Color(0xde71aa).convertSRGBToLinear(),roughness:.8});}
  this.decor.clear();const cols=level.grid[0].length,rows=level.grid.length;
  const add=(mesh,x,y,z,parent=this.decor)=>{mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
  const rock=(x,y,z,w,h,d,n,parent)=>{const mesh=this.box(w,h,d,this.materials.stone[n%4],.07);mesh.rotation.y=(rand(n)-.5)*.08;return add(mesh,x,y,z,parent);};
  const leaf=(x,y,z,n,parent=this.decor)=>{const m=new THREE.Mesh(this.geometry('garden-leaf',()=>new THREE.SphereGeometry(1,6,4)),this.leafMats[n%3]);m.scale.set(.075,.024,.17);m.rotation.set(n*.7,n*1.7,.6);add(m,x,y,z,parent);};
  const shrub=(x,y,z,n,parent=this.decor)=>{for(let i=0;i<20;i++){const a=i*2.4,r=.12+rand(n+i)*.3;leaf(x+Math.cos(a)*r,y+.05+rand(n+i+4)*.24,z+Math.sin(a)*r,n+i,parent);}for(let f=0;f<3;f++){const px=x+(rand(n+f+3)-.5)*.45,pz=z+(rand(n+f+8)-.5)*.45;add(this.box(.018,.3,.018,this.leafMats[0],.003),px,y+.15,pz,parent);for(let j=0;j<5;j++){const m=new THREE.Mesh(this.geometry('garden-petal',()=>new THREE.SphereGeometry(.065,6,4)),this.flowerMat);m.scale.set(.7,.35,1.5);m.rotation.y=-j*1.256;add(m,px+Math.cos(j*1.256)*.075,y+.32,pz+Math.sin(j*1.256)*.075,parent);}}};
  // Submerged masonry belongs to each solid tile; fragile tiles and bridges stay unsupported.
  level.grid.forEach((row,r)=>row.forEach((type,c)=>{if(!type||type>=10||type===2||type===9)return;const p=this.world(r,c);for(let layer=0;layer<7;layer++)rock(p.x,-.53-layer*.3,p.z,.95,.29,.95,r+c+layer);if(!level.grid[r+1]?.[c]&&rand(r*cols+c)>.78)shrub(p.x,-.22,p.z+.52,r+c);}));
  // Four deliberately unequal groups, outside the occupied board bounds.
  const clusters=[[-cols/2-2,-rows/2+1,1.1],[cols/2+2,-rows/2-1,.8],[-cols/2-1,rows/2+3,.65],[cols/2+3,rows/2+2,1]];
  clusters.forEach(([x,z,scale],n)=>{
   const g=new THREE.Group();g.position.set(x,0,z);g.scale.set(scale,1,scale);this.decor.add(g);
   for(let r=-1;r<=1;r++)for(let c=-1;c<=1;c++)for(let layer=0;layer<6;layer++)rock(c*.62,-2.33+layer*.32,r*.62,.63,.31,.63,n+r+c+8,g);
   for(let tower=0;tower<(n===2?1:n===1?2:3);tower++){const tx=[-.55,.25,.8][tower],tz=[-.3,.4,-.55][tower],h=[7,4,9][(tower+n)%3];for(let j=0;j<h;j++){rock(tx,-.4+j*.32,tz,.48,.3,.48,n+j+tower,g);for(let k=0;k<3;k++)leaf(tx+.26,-.35+j*.32+k*.08,tz+Math.sin(j+k)*.17,j+k+n,g);}shrub(tx,-.57+h*.32,tz,n+tower,g);const glow=this.box(.05,.64,.015,this.materials.accent,.005);add(glow,tx,-.1+h*.12,tz+.245,g);}
   if(n===1||n===3){const fallen=rock(-.5,-.35,.65,1.45,.38,.48,n+1,g);fallen.rotation.y=.45;}
   for(let j=0;j<4;j++){const a=j*2.4;shrub(Math.cos(a)*.85,-.53,Math.sin(a)*.85,n*10+j,g);}
   // Pads float near these shores, unlike upright ivy and shrubs.
   for(let j=0;j<12;j++){const a=j*2.1,r=1.2+rand(n*20+j)*1.1;const pad=new THREE.Mesh(this.geometry('lily',()=>new THREE.CylinderGeometry(.15,.15,.014,20,1,false,.18,5.85)),this.leafMats[2]);pad.rotation.y=j;add(pad,x+Math.cos(a)*r,-.81,z+Math.sin(a)*r);}
  });
  this.sceneCeiling=Math.max(3,new THREE.Box3().setFromObject(this.decor).max.y);this.setCamera();
  // Lit translucent water: submerged masonry remains visible and receives real shadows.
  if(!this.waterMaterial){
   this.waterTime={value:0};
   this.waterMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(0x076376).convertSRGBToLinear(),roughness:.40,metalness:0,envMapIntensity:.06,transparent:true,opacity:.87,depthWrite:false});
   this.waterMaterial.onBeforeCompile=shader=>{
    shader.uniforms.gardenTime=this.waterTime;
    shader.vertexShader='varying vec3 waterWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nwaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader='varying vec3 waterWorld;uniform float gardenTime;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
     vec2 q=waterWorld.xz;float t=gardenTime;
     vec3 rippleNormal=vec3(sin(q.x*2.4+q.y*.8+t*.45)*.035,0.,cos(q.y*2.8-q.x*.7+t*.3)*.035);
     normal=normalize(normal+mat3(viewMatrix)*rippleNormal);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular*=.18;reflectedLight.indirectSpecular*=.18;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
     float depthVariation=.5+.5*sin(waterWorld.x*.18+sin(waterWorld.z*.21));
     diffuseColor.rgb*=mix(vec3(.68,.86,.94),vec3(1.05,1.08,1.02),depthVariation);`);
   };
  }
  this.water=new THREE.Mesh(this.geometry('water-surface',()=>new THREE.PlaneGeometry(1,1)),this.waterMaterial);this.water.rotation.x=-Math.PI/2;this.water.receiveShadow=true;this.water.position.y=-.85;this.decor.add(this.water);
  const bedMat=this.bedMat||(this.bedMat=new THREE.MeshStandardMaterial({color:new THREE.Color(0x28504c).convertSRGBToLinear(),roughness:1,map:this.materials.stone[0].map}));
  this.seabed=new THREE.Mesh(this.geometry('water-surface',()=>new THREE.PlaneGeometry(1,1)),bedMat);this.seabed.rotation.x=-Math.PI/2;this.seabed.position.y=-2.6;this.seabed.receiveShadow=true;this.decor.add(this.seabed);
  if(!this.waterLoop){let last=0;const frame=t=>{this.waterLoop=requestAnimationFrame(frame);if(document.hidden||t-last<50)return;last=t;if(!this.reducedMotion)this.waterTime.value=t/1000;this.render();};this.waterLoop=requestAnimationFrame(frame);}
  this.setAppearance(this.skin,this.theme);this.render();
 };
 // Derive coverage from actual frustum intersections; never expose a finite plane edge on zoom/orbit.
 P.updateWaterCoverage=function(){
  if(!this.water)return;
  const ray=new THREE.Raycaster(),point=new THREE.Vector3();
  for(const mesh of [this.water,this.seabed]){
   const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-mesh.position.y);
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(const x of [-1,1])for(const y of [-1,1]){ray.setFromCamera(new THREE.Vector2(x,y),this.camera);if(ray.ray.intersectPlane(plane,point)){minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minZ=Math.min(minZ,point.z);maxZ=Math.max(maxZ,point.z);}}
   if(Number.isFinite(minX)){mesh.position.x=(minX+maxX)/2;mesh.position.z=(minZ+maxZ)/2;mesh.scale.set(maxX-minX+.1,maxZ-minZ+.1,1);}
  }
 };
 // Preview is rendered from the exact block/board geometry and materials, offscreen.
 P.thumbnail=function(kind,id){
  if(!this.previewRenderer){this.previewRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});this.previewRenderer.setSize(360,360);this.previewRenderer.outputEncoding=THREE.sRGBEncoding;this.previewRenderer.toneMapping=THREE.ACESFilmicToneMapping;}
  const skin=this.skin,theme=this.theme;this.setAppearance(kind==='block'?id:skin,kind==='map'?id:theme);
  const scene=new THREE.Scene();scene.environment=this.scene.environment;scene.add(new THREE.HemisphereLight(0xffffff,0x607080,.8));const light=new THREE.DirectionalLight(0xffe3bc,1.3);light.position.set(-3,6,4);scene.add(light);
  let obj;if(kind==='block'){obj=this.createBlock();}else{obj=this.board.clone(true);}
  scene.add(obj);const box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());obj.position.sub(center);const span=Math.max(size.x,size.y,size.z)*.8;const cam=new THREE.OrthographicCamera(-span,span,span,-span,.1,100);cam.position.set(5,4,7);cam.lookAt(0,0,0);this.previewRenderer.render(scene,cam);const result=this.previewRenderer.domElement.toDataURL('image/png');this.setAppearance(skin,theme);return result;
 };
})();
