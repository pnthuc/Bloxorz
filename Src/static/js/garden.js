/* Authored environmental art. All walkable cells and mechanisms remain engine-owned. */
(()=>{
 const B=window.Bloxorz,P=B.GameScene.prototype,baseBuild=P.build,baseBlock=P.createBlock;
 const rnd=n=>{const v=Math.sin(n*127.1+63.4)*43758.545;return v-Math.floor(v);};
 const ENVIRONMENTS={ruins:{heights:[7,3,5],foliage:.36,shore:0x286e75},garden:{heights:[2,2,3],foliage:.72,shore:0x387d72},frost:{heights:[4,2,5],foliage:.40,shore:0x346e89}};
 B.environments=ENVIRONMENTS;
 const color=n=>new THREE.Color(n).convertSRGBToLinear();
 P.setAppearance=function(skin='stone',theme='ruins'){
  const changed=this.theme!==theme;this.skin=skin;this.theme=theme;const m=this.materials;
  if(!this.themeSurfaces){const frozen=B.createSurface(this.renderer,'ice',43);this.themeSurfaces={frozen,original:m.stone.map(x=>({map:x.map,normalMap:x.normalMap,roughnessMap:x.roughnessMap}))};}
  m.stone.forEach((mat,i)=>{const source=theme==='frost'?this.themeSurfaces.frozen:this.themeSurfaces.original[i];mat.map=source.map;mat.normalMap=source.normalMap;mat.roughnessMap=source.roughnessMap;});
  const palettes={ruins:[0xe8d0a7,0xdcc297,0xf0ddb7,0xc3ae89],garden:[0xe9ddc4,0xe0d1b7,0xf1e6d2,0xc5b79c],frost:[0xa4d3e4,0xc4e2ed,0x91bfce,0xe1edf0]};
  m.stone.forEach((x,i)=>{x.color.copy(color(palettes[theme][i]));x.roughness=theme==='frost'?.43:1;x.envMapIntensity=.14;});
  m.architecture.forEach((x,i)=>{x.color.copy(color(palettes[theme][i]));x.roughness=1;x.envMapIntensity=.10;});
  m.dark.color.copy(color(theme==='frost'?0x4a809b:0x89775b));
  if(this.artMats&&!this.snowSurface){this.snowSurface=B.createSurface(this.renderer,'snow',11);for(const key of ['map','normalMap','roughnessMap'])this.artMats.snow[key]=this.snowSurface[key];this.artMats.snow.needsUpdate=true;}
  for(const key of ['copper','cube','cap']){m[key].map=this.themeSurfaces.original[0].map;m[key].color.copy(color(skin==='jade'?0x318b74:skin==='bronze'?0xb77a4a:0xdac19b));m[key].metalness=skin==='bronze'?.65:.18;m[key].roughness=skin==='jade'?.30:.64;}
  m.underwaterTint.value.copy(color(theme==='frost'?0x07536b:0x086879));
  m.edge.color.copy(color(0xbd8c42));m.accent.color.copy(color(0x55e6ee));this.renderer.toneMappingExposure=1;
  if(changed&&this.level)this.buildScenery(this.level,theme);
  if(this.waterMaterial)this.waterMaterial.color.copy(color(theme==='frost'?0x07536b:0x086879));
  this.render();
 };
 P.createBlock=function(cube=false){const group=baseBlock.call(this,cube);for(const z of [-.48,.48]){const gem=this.box(.18,.30,.04,this.materials.accent,.02);gem.position.z=z;gem.rotation.z=Math.PI/4;group.add(gem);}return group;};
 P.build=function(level,state,options){this.board.children.filter(x=>x.userData.ownedGeometry).forEach(x=>x.geometry.dispose());baseBuild.call(this,level,state,options);
  const floorBatches=new Map();this.board.updateMatrixWorld(true);
  for(const [cell,group] of this.tiles){const [r,c]=cell.split(',').map(Number),type=level.grid[r][c];if(![1,3,4,5].includes(type))continue;
   for(const slab of group.children.slice(0,2)){if(!slab.isMesh)continue;const mats=Array.isArray(slab.material)?slab.material:[slab.material],key=slab.geometry.uuid+mats.map(m=>m.uuid).join(':');if(!floorBatches.has(key))floorBatches.set(key,{geometry:slab.geometry,material:slab.material,matrices:[]});floorBatches.get(key).matrices.push(slab.matrixWorld.clone());slab.visible=false;}
  }
  for(const batch of floorBatches.values()){const mesh=new THREE.InstancedMesh(batch.geometry.clone(),batch.material,batch.matrices.length);batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.ownedGeometry=true;this.board.add(mesh);}
  this.buildScenery(level,this.theme||'ruins');this.setAppearance(this.skin||'stone',this.theme||'ruins');};
 P.buildScenery=function(level,theme){
  this.shadowDirty=true;
  const frost=theme==='frost',garden=theme==='garden';
  if(!this.decor){this.decor=new THREE.Group();this.scene.add(this.decor);}
  this.decor.children.forEach(mesh=>{if(mesh.userData.ownedGeometry)mesh.geometry.dispose();});this.decor.clear();this.water=null;this.seabed=null;
  if(!this.artMats){const mat=(c,roughness=1)=>new THREE.MeshStandardMaterial({color:color(c),roughness});this.artMats={leaf:[0x244f32,0x47713a,0x718c3c].map(c=>mat(c)),moss:mat(0x5d783d),bark:mat(0x665340),pink:mat(0xe997c5),purple:mat(0xb94ab0),white:mat(0xf6f4df),gold:mat(0xdec85d),snow:mat(0xf0f8fb,.92),ice:mat(0x9fdbea,.23),pine:mat(0x2b6260),bed:mat(0x28595c)};}
  const config=ENVIRONMENTS[theme];this.environmentSeed=Number(level.id)*7919;
  const m=this.artMats,cols=level.grid[0].length,rows=level.grid.length,raw=new THREE.Group(),shore=[];
  const stone=frost?this.materials.stone:this.materials.architecture;
  if(!m.coast)m.coast=this.materials.architecture.map(source=>{const mat=source.clone();mat.onBeforeCompile=source.onBeforeCompile;mat.normalScale.set(.18,.18);mat.roughness=1;return mat;});
  m.coast.forEach((mat,i)=>mat.color.copy(this.materials.architecture[i].color));
  const coastalStone=frost?this.materials.stone:m.coast;
  const add=(geo,mat,x,y,z,sx=1,sy=1,sz=1,rot=0)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.y=rot;raw.add(mesh);return mesh;};
  const sphere=this.geometry('art-leaf',()=>new THREE.SphereGeometry(1,7,4));
  const lump=this.geometry('art-lump',()=>new THREE.DodecahedronGeometry(1,0));
  const boulder=this.geometry('shore-boulder',()=>{const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=1+.09*Math.sin(x*8+z*5)*Math.cos(y*7);p.setXYZ(i,x*f,y*f,z*f);const len=Math.hypot(x,y,z);n.setXYZ(i,x/len,y/len,z/len);}return g;});
  const shelf=this.geometry('coastal-ledge',()=>{
   const shape=new THREE.Shape();for(let j=0;j<14;j++){const a=j/14*Math.PI*2,r=.91+.10*Math.sin(j*2.3)+.05*Math.cos(j*4.1);j?shape.lineTo(Math.cos(a)*r,Math.sin(a)*r):shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);}shape.closePath();
   const g=new THREE.ExtrudeGeometry(shape,{depth:.45,bevelEnabled:true,bevelSize:.10,bevelThickness:.10,bevelSegments:2,steps:1});g.rotateX(-Math.PI/2);return g;
  });
  const cone=this.geometry('art-cone',()=>new THREE.ConeGeometry(1,1,7));
  const cylinder=this.geometry('art-stem',()=>new THREE.CylinderGeometry(1,1,1,5));
  const blossom=this.geometry('garden-blossom',()=>{
   const vertices=[];for(let j=0;j<5;j++){
    const a=j*Math.PI*2/5,point=(r,turn,y)=>[Math.cos(a+turn)*r,y,Math.sin(a+turn)*r];
    vertices.push(...point(.02,0,0),...point(.09,-.60,.035),...point(.145,0,.012),...point(.02,0,0),...point(.145,0,.012),...point(.09,.60,.035));
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
  });
  for(const mat of [m.pink,m.purple,m.white])mat.side=THREE.DoubleSide;
  const snowCap=this.geometry('snow-cap-organic',()=>{
   const shape=new THREE.Shape();const points=20;
   for(let i=0;i<=points;i++){const a=i/points*Math.PI*2,r=.94+.05*Math.sin(i*2.4);const x=Math.cos(a)*r,z=Math.sin(a)*r;i?shape.lineTo(x,z):shape.moveTo(x,z);}
   const g=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.07,bevelThickness:.07,curveSegments:2});g.rotateX(-Math.PI/2);return g;
  });
  const snow=(x,y,z,w,d,n)=>{const cap=add(snowCap,m.snow,x,y,z,w*.49,1,d*.49,n*.2);for(let k=0;k<4;k++){const a=k*Math.PI*.5+n*.3;add(sphere,m.snow,x+Math.cos(a)*w*.44,y-.045-rnd(n+k)*.08,z+Math.sin(a)*d*.44,w*.12,.10+rnd(n+k)*.09,d*.13);}return cap;};
  const rock=(x,y,z,w,h,d,n)=>{
   const key=`weathered:${w}:${h}:${d}:${n%3}`;
   const geo=this.geometry(key,()=>{const g=B.roundedBox(w,h,d,.035,3),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),v=(rnd(Math.round(x*13)+Math.round(y*17)*31+Math.round(z*13)*67+n%3)-.5)*.026;p.setXYZ(i,x+v,y+v*.6,z+v);}g.computeVertexNormals();return g;});
   const mesh=add(geo,stone[Math.abs(n)%4],x,y,z,1,1,1,(rnd(n)-.5)*.08);if(frost&&y+h/2>-.28&&h>.20)snow(x,y+h/2,z,w,d,n);return mesh;
  };
  // Profiled modular masonry: plinth, tapered fluted drum, capital and arch voussoir.
  const profile=this.geometry('temple-column-profile',()=>{
   const pts=[[.46,0],[.46,.10],[.38,.14],[.35,.24],[.29,.30],[.26,.45],[.24,1.25],[.30,1.32],[.34,1.39],[.41,1.43],[.41,1.55]].map(([r,y])=>new THREE.Vector2(r,y));
   const geo=new THREE.LatheGeometry(pts,16),p=geo.attributes.position;
   for(let j=0;j<p.count;j++){const y=p.getY(j);if(y>.32&&y<1.30){const a=Math.atan2(p.getX(j),p.getZ(j)),f=1-.045*(.5+.5*Math.cos(a*8));p.setX(j,p.getX(j)*f);p.setZ(j,p.getZ(j)*f);}}geo.computeVertexNormals();return geo;
  });
  const wedge=this.geometry('temple-arch-wedge',()=>{
   const shape=new THREE.Shape(),a0=-.145,a1=.145;
   shape.moveTo(Math.cos(a0)*.80,Math.sin(a0)*.80);shape.lineTo(Math.cos(a0)*1.14,Math.sin(a0)*1.14);shape.lineTo(Math.cos(a1)*1.14,Math.sin(a1)*1.14);shape.lineTo(Math.cos(a1)*.80,Math.sin(a1)*.80);shape.closePath();
   return new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1});
  });
  const brokenDrum=this.geometry('broken-column-shaft',()=>{
   const g=new THREE.CylinderGeometry(.27,.32,1.55,12,3),p=g.attributes.position;
   for(let i=0;i<p.count;i++)if(p.getY(i)>.60){const a=Math.atan2(p.getZ(i),p.getX(i));p.setY(i,p.getY(i)-.06-.07*(.5+.5*Math.sin(a*3.0+.4))-.035*Math.cos(a*7.));}g.computeVertexNormals();return g;
  });
  const drum=(x,y,z,n,h=1)=>{
   const start=raw.children.length;
   const broken=h<.8;
   if(broken){add(brokenDrum,stone[n%4],x,y+.775*h,z,1,h,1);rock(x,y+.08,z,.85,.16,.79,n);}
   else add(profile,stone[n%4],x,y,z,1,h,1);
   if(!broken)add(this.geometry('column-cut-top',()=>new THREE.CylinderGeometry(.41,.41,.035,16)),stone[n%4],x,y+1.55*h,z);
   if(frost)snow(x,y+1.55*h,z,.9,.9,n);else moss(x+.18,y+.12,z,n,.24);
   const parts=raw.children.slice(start),assembly=new THREE.Group();assembly.position.set(x,y,z);raw.add(assembly);raw.updateMatrixWorld(true);parts.forEach(part=>assembly.attach(part));return assembly;
  };
  const portal=(x,z,n)=>{
   const start=raw.children.length;
   // A remaining wall pier grounds the open arch in a larger architectural mass.
   // Its broken crest and stepped foot read before the smaller carvings/ivy.
   for(let course=0;course<6;course++){
    const w=course<2?1.38:course<4?1.02:.72;
    rock(x-1.43+course*.035,-.30+course*.39,z-.38,w,.38,.83,n+course);
   }
   rock(x-1.46,-.52,z-.35,1.68,.26,1.25,n+1);
   rock(x-1.42,.53,z-.01,1.10,.14,.94,n+2);
   if(!frost){ivy(x-1.78,1.85,z+.05,n+14);moss(x-1.35,1.88,z-.35,n,.32);}
   for(const side of [-1,1]){rock(x+side*.95,-.38,z,.98,.28,.95,n+3);drum(x+side*.95,-.25,z,n,side<0?1.25:.94);}
   for(let j=0;j<6;j++){const a=Math.PI-j*.28;
    const part=add(wedge,stone[j%4],x,1.65,z-.24);part.rotation.z=a;
    if(frost&&j>1&&j<7)snow(x+Math.cos(a),1.65+Math.sin(a)*1.14,z,.45,.56,j);
   }
   rock(x+.7,-.25,z+.7,.62,.26,.43,n+1).rotation.z=.35;
   if(!frost){ivy(x-.71,1.5,z+.28,n);ivy(x-.82,.8,z+.31,n+20);}
   const parts=raw.children.slice(start),assembly=new THREE.Group();assembly.position.set(x,0,z);raw.add(assembly);raw.updateMatrixWorld(true);parts.forEach(part=>assembly.attach(part));return assembly;
  };
  const leafGeometry=this.geometry('pointed-leaf',()=>{
   const shape=new THREE.Shape();shape.moveTo(0,-1);shape.bezierCurveTo(-.72,-.4,-.68,.45,0,1);shape.bezierCurveTo(.68,.45,.72,-.4,0,-1);
   const g=new THREE.ShapeGeometry(shape,4);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,.18*(1-Math.abs(p.getZ(i))));g.computeVertexNormals();return g;
  });
  m.leaf.forEach(mat=>mat.side=THREE.DoubleSide);
  const leaf=(x,y,z,n,size=.14)=>{const a=add(leafGeometry,m.leaf[n%3],x,y,z,size*.62,size*.6,size,n*2.4);a.rotation.z=(rnd(n)-.5)*1.1;};
  const moss=(x,y,z,n,size=.3)=>add(lump,m.moss,x,y,z,size,.045,size*.7,n);
  const flower=(x,y,z,n,height=.30)=>{
   add(cylinder,m.leaf[0],x,y+height/2,z,.012,height,.012);
   const petals=n%4===0?8:5;for(let j=0;j<petals;j++){const a=j*Math.PI*2/petals;add(sphere,n%3===0?m.purple:n%3===1?m.pink:m.white,x+Math.cos(a)*.075,y+height,z+Math.sin(a)*.075,.075,.028,.045,a);}
   add(lump,m.gold,x,y+height+.02,z,.035,.025,.035);if(n%4===0)for(let k=0;k<4;k++)add(sphere,m.purple,x+.02*Math.sin(k*2),y+height+k*.07,z,.045,.07,.045,k);
  };
  const shrub=(x,y,z,n,size=.45)=>{
   if(frost){add(lump,m.snow,x,y+.10,z,size,.15,size*.7,n);return;}
   moss(x,y,z,n,size*.65);
   for(let j=0;j<(garden?32:16);j++){const a=j*2.4,r=size*Math.sqrt(rnd(n+j));leaf(x+Math.cos(a)*r,y+.05+rnd(n+j+9)*.23,z+Math.sin(a)*r,n+j,garden?.19:.14);}
   if(garden)for(let j=0;j<5;j++)flower(x+(rnd(n+j)-.5)*size*1.5,y,z+(rnd(n+j+40)-.5)*size*1.5,n+j,.22+rnd(n+j)*.25);
   else if(n%3===0)for(let j=0;j<3;j++)flower(x+j*.10-.1,y,z,n+j,.25);
  };
  const ivy=(x,y,z,n)=>{if(frost){for(let j=0;j<5;j++)add(cone,m.ice,x+j*.09-.18,y-.15-rnd(n+j)*.12,z,.035,-(.24+rnd(n+j)*.3),.035);return;}
   add(cylinder,m.leaf[0],x,y-.39,z,.012,.85,.012);
   for(let j=0;j<10;j++){const yy=y-j*.085;leaf(x+Math.sin(j*1.4)*.10,yy,z,n+j,.15);if(garden&&j%3===0)flower(x,yy,z+.02,n+j,.08);}
  };
  const pine=(x,y,z,n,h=1.6)=>{
   h*=.88+rnd(n+17)*.25;
   add(cylinder,m.bark,x,y+h*.43,z,.048,h*.86,.048);
   // Snow loads on individual boughs leave dark needles visible beneath each tier.
   for(let tier=0;tier<6;tier++){
    const f=tier/6,r=h*(.31-f*.25),yy=y+h*(.22+f*.74);
    for(let branch=0;branch<5;branch++){const a=branch*Math.PI*.4+tier*.65+n*.3,px=x+Math.cos(a)*r*.5,pz=z+Math.sin(a)*r*.5;
     const bough=add(cone,m.pine,px,yy,pz,r*.63,h*.25,r*.56,a);bough.rotation.z=(rnd(branch+tier+n)-.5)*.12;
     add(sphere,m.snow,px,yy+h*.085,pz,r*.53,h*.060,r*.49,a);
    }
   }
   add(cone,m.snow,x,y+h*1.03,z,h*.07,h*.22,h*.07,n);
  };
  const floweringTree=(tx,base,tz,h,n)=>{
   const branch=(from,to,r)=>{const delta=to.clone().sub(from),mid=from.clone().add(to).multiplyScalar(.5),mesh=add(cylinder,m.bark,mid.x,mid.y,mid.z,r,delta.length(),r);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());};
   branch(new THREE.Vector3(tx,base,tz),new THREE.Vector3(tx+.10,base+h*.75,tz-.04),.065+h*.012);
   for(let j=0;j<6;j++){const a=j*2.4,spread=.36+h*.09,px=tx+Math.cos(a)*spread,pz=tz+Math.sin(a)*spread,yy=base+h*(.82+.25*rnd(j+n+16));
    branch(new THREE.Vector3(tx+.06,base+h*.40,tz),new THREE.Vector3(px,yy,pz),.025+h*.004);add(lump,m.leaf[0],px,yy-.10,pz,.24,.12,.23,j);
    for(let k=0;k<24;k++){const f=k/24,angle=k*2.4,rr=(.28+h*.05)*Math.sqrt(rnd(k+j*31+n)),xx=px+Math.cos(angle)*rr,zz=pz+Math.sin(angle)*rr,y=yy+.16*Math.sin(f*Math.PI)-.07*rnd(k+30);
     add(blossom,k%5===0?m.white:n%3===1?m.purple:m.pink,xx,y,zz,.72+rnd(k+j)*.35,1,.72+rnd(k+j)*.35,angle);if(k%5===0)leaf(xx,y-.06,zz,n+k+j,.14);
    }
   }
  };
  // Only solid engine cells receive foundations. Fragile cells and bridges stay free to fall.
  level.grid.forEach((row,r)=>row.forEach((tile,c)=>{if(!tile||tile>=10||tile===2||tile===9)return;const p=this.world(r,c);shore.push([p.x,p.z,.49]);
   for(let layer=0;layer<6;layer++)rock(p.x,-.56-layer*.34,p.z,.96,.33,.96,r*7+c+layer);
   for(const [dr,dc] of [[0,-1],[0,1],[-1,0],[1,0]])if(!level.grid[r+dr]?.[c+dc]){
    const n=r*cols+c+dr*17+dc*31+100,ex=p.x+dc*.49,ez=p.z+dr*.49;
    if(rnd(n)>.45){if(frost)add(lump,m.snow,ex,-.01,ez,.28,.07,.19,n);else moss(ex,-.04,ez,n,.22);ivy(ex,-.16,ez,n);}
    if(rnd(n)>.93)shrub(ex+dc*.12,-.18,ez+dr*.12,n,garden?.5:.28);
   }
  }));
  // A broken gate, a collapsed terrace and a submerged wall, with different silhouettes.
  const clusters=[[-cols*.29,-rows/2-1.35,1.15],[cols/2+.65,rows*.26,1.0],[cols*.12,-rows/2-1.45,1.1]];
  // Low rocky shelves connect the architecture to the board below the surface.
  // Different lobes and heights form shores, rather than three detached square plinths.
  clusters.forEach(([x,z,size],n)=>{
   const anchorX=Math.max(-cols*.37,Math.min(cols*.37,x)),anchorZ=Math.max(-rows*.32,Math.min(rows*.32,z));
   for(let j=0;j<9;j++){const t=j/8,px=x*(1-t)+anchorX*t,pz=z*(1-t)+anchorZ*t;
    add(boulder,m.bed,px,-1.98+Math.sin(t*Math.PI)*.22,pz,1.05+(.30*rnd(j+n)),.48,.82,j*.7);
    shore.push([px,pz,.68,true]);
   }
   for(let j=0;j<7;j++){const px=x+(rnd(j+n*31)-.5)*2.8,pz=z+(rnd(j+n*31+90)-.5)*2.5;
    add(boulder,this.materials.dark,px,-1.28-rnd(j+4)*.5,pz,.58,.42,.5,j);
   }
  });
  clusters.forEach(([x,z,size],n)=>{
   for(let r=-1;r<=1;r++)for(let c=-1;c<=1;c++){if(r===1&&c===(n%2?1:-1))continue;shore.push([x+c*.62*size,z+r*.62*size,.34*size]);for(let j=0;j<6;j++)rock(x+c*.62*size,-2.25+j*.33,z+r*.62*size,.62*size,.32,.62*size,n+r+c+9);}
   if(n===0)portal(x,z,n+4);
   else if(n===2){
    // A fractured wall and fallen cornice contrast with the open arch silhouette.
    for(let row=0;row<6;row++)for(let c=0;c<Math.max(1,5-row);c++){
     const stone=rock(x-1+c*.46+row*.08,-.23+row*.36,z-.18,.45,.35,.54,10+row+c);stone.rotation.z=(rnd(row+c)-.5)*.10;
    }
    drum(x+.85,-.36,z-.3,2,.57);const fallen=drum(x+.25,-.25,z+.62,3,.8);fallen.rotation.z=1.4;
   }else{
    for(let j=0;j<4;j++)rock(x-.35+j*.16,-.45+j*.13,z+.35,1.50-j*.20,.20,.45,j+30);
    drum(x+.6,-.40,z-.42,1,.42);
   }
   for(let j=0;j<6;j++){const px=x+(rnd(j+n*9)-.5)*1.9*size,pz=z+(rnd(j+n*9+40)-.5)*1.5*size;shrub(px,-.39,pz,n*20+j,config.foliage);}
   if(frost){pine(x-.7,-.38,z-.5,n,1.5);if(n!==0)pine(x+.65,-.4,z+.5,n+1,1.05);}
   else if(garden){for(let j=0;j<3;j++)shrub(x-.5+j*.4,-.08+(j===1?.28:0),z-.65,50+n+j,.55);}
   if(!frost){const padGeo=this.geometry('art-lily',()=>new THREE.CylinderGeometry(.15,.15,.012,18,1,false,.2,5.85));for(let j=0;j<14;j++){const px=x+.8+(rnd(j+n*13)-.5)*1.25,pz=z+.9+(rnd(j+n*13+40)-.5)*1.15,sz=.6+rnd(j+5)*.6;add(padGeo,m.leaf[2],px,-.825+rnd(j)*.012,pz,sz,1,sz,j);}}
   else for(let j=0;j<5;j++)add(lump,m.snow,x+Math.sin(j*2.4)*1.6,-.84,z+Math.cos(j*2.4)*1.6,.25,.06,.22,j);
  });
  // Shore vegetation and rubble are grouped around the three authored land masses.
  clusters.forEach(([x,z,size],n)=>{
   if(garden){for(let j=0;j<10;j++){const px=x-.7+(rnd(j+n*12)-.5)*.8,pz=z+.75+(rnd(j+n*12+40)-.5)*1.2;
     for(let k=0;k<3;k++){const h=.45+rnd(j+k)*.5;const stem=add(cylinder,m.leaf[0],px+k*.05,-.85+h*.5,pz,.012,h,.012);stem.rotation.z=(rnd(j+k)-.5)*.25;add(sphere,m.bark,px+k*.05,-.85+h,pz,.028,.11,.028);}
     moss(px,-1.2,pz,n+j,.26);
   }}
   if(frost){const floe=this.geometry('ice-floe',()=>new THREE.CylinderGeometry(1,1.12,.15,7));for(let j=0;j<4;j++){const a=j*2.4+.4,px=x+Math.cos(a)*(1.7+j*.12),pz=z+Math.sin(a)*(1.7+j*.12),sz=.35+rnd(j+n)*.35;add(floe,m.ice,px,-.85,pz,sz,1,sz,j);add(floe,m.snow,px,-.76,pz,sz*.96,.35,sz*.96,j);}
    for(let j=0;j<4;j++){const px=x+(rnd(j+n)-.5)*1.6,pz=z+(rnd(j+n+8)-.5)*1.6;add(lump,m.snow,px,-.20,pz,.36,.13,.29,j);}
   }
   for(let j=0;j<14;j++){const a=j*2.4,rr=1.15+rnd(n+j)*.7;add(lump,this.materials.stone[j%4],x+Math.cos(a)*rr,-.65-rnd(j)*.5,z+Math.sin(a)*rr,.13+rnd(j)*.20,.14,.20,j);}
  });
  // Midground walls and stair terraces belong to the islands, never to playable cells.
  clusters.forEach(([x,z,size],n)=>{
   for(let j=0;j<3;j++){const step=rock(x-.72+j*.18,-.48+j*.15,z+.65,.90,.16,.30,70+j);if(frost)snow(step.position.x,step.position.y+.08,step.position.z,.90,.30,70+j);}
   if(garden){
    for(let j=0;j<5;j++){const a=j*2.4,rr=1.0+(.3*rnd(j+n)),px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr;
     // Delicate water weeds rise out of shallow rocks, with leaves below the waterline.
     for(let k=0;k<7;k++){const yy=-1.65+k*.12;leaf(px+Math.sin(k*.7+j)*.10,yy,pz,n+j+k,.13);add(cylinder,m.leaf[0],px,yy,pz,.008,.13,.008);}
     // Emergent reeds/weeds are rooted below water. Flowers stay on the terrace.
    }
   }
   if(frost){
    // Exposed coastal boulders and irregular floes give the snowy shore a different silhouette.
    for(let j=0;j<5;j++){const a=j*2.4,px=x+Math.cos(a)*1.45,pz=z+Math.sin(a)*1.45,w=.32+rnd(j+n)*.35;
     add(boulder,this.materials.dark,px,-.65,pz,w,.28,w*.82,j);snow(px,-.39,pz,w*1.7,w*1.35,j);
    }
    if(n===1)pine(x+.95,-.25,z-.55,n+30,1.45);
   }
  });
  clusters.forEach(([x,z,size],n)=>{
   if(garden){
    const tx=x+(n===0?-.4:.45),tz=z-.25,h=n===0?1.6:1.15;
    // Keep the low terrace beside the goal open when viewed from the waterline.
    if(n!==1)floweringTree(tx,-.4,tz,h,n);
   }
   if(frost){
    const tx=x+.7,tz=z-.6;
    for(let j=0;j<5;j++){const branch=add(cylinder,m.bark,tx+(j-2)*.11,-.03+j*.07,tz,.018,.55,.018,j);branch.rotation.z=(j-2)*.27;add(sphere,m.snow,tx+(j-2)*.17,.22+j*.05,tz,.07,.04,.055);}
   }

  });
  // Two broken shorelines, rather than isolated balls or a ring of props.
  // Their terraces continue outside the default frame and reveal depth on zoom-out.
  const coasts=[[[ -cols*.58,rows*.62],[-cols*.58-1.75,rows*.62+1.10],[-cols*.58-3.35,rows*.62+1.45]],[[cols*.56,-rows*.63],[cols*.56+1.50,-rows*.63-.90],[cols*.56+3.1,-rows*.63-1.45]]];
  coasts.forEach((path,n)=>path.forEach(([x,z],j)=>{
   const angle=(n?.4:-.3)+j*.32,w=1.40+(j===1?.18:0),d=1.15+(j===2?.20:0);
   add(shelf,this.materials.dark,x,-1.45,z,w*1.16,1.3,d*1.16,angle);shore.push([x,z,1.05,true]);
   add(shelf,coastalStone[(j+n)%4],x,-.74,z,w,1,d,angle);shore.push([x,z,1.15,false,true]);
   for(let k=0;k<3;k++)add(boulder,this.materials.dark,x+(rnd(j*11+k+n)-.5)*2.1,-1.25,z+(rnd(j*11+k+n+70)-.5)*2,.46,.24,.38,k);
   if(frost){
    snow(x,-.18,z,w*1.95,d*1.85,90+j+n);
    if(n===1&&j===0){for(let k=0;k<3;k++){const px=x+(k-1)*.42,yy=.10+k*.15;add(boulder,this.materials.dark,px,yy,z,.45,.50+k*.13,.42,k);snow(px,yy+.42+k*.12,z,.72,.72,k);}}
    else pine(x+(j===1?.3:-.24),-.16,z-.15,80+j+n*12,j===1?2.25:1.3+j*.18);
    for(let k=0;k<6;k++)add(cone,m.ice,x-w*.65+k*w*.22,-.38-rnd(k+j)*.09,z+d*.75,.035,-(.20+rnd(k+j)*.28),.035);
   }else if(garden){
    add(shelf,m.moss,x,-.27,z,w*.90,.15,d*.90,angle);
    shrub(x-.36,-.16,z+.12,82+j+n*21,.82);shrub(x+.45,-.17,z-.30,102+j+n*21,.65);ivy(x+.25,-.15,z+d*.7,65+j+n*12);
    if(j===2)floweringTree(x,-.16,z-.12,n?2.05:2.35,20+n);
    // Reeds emerge from the wet ledge edge; their roots stay under water.
    for(let k=0;k<7;k++){const px=x+w*.72+(rnd(k+j)-.5)*.28,pz=z+(rnd(k+j+30)-.5)*1.05,h=.50+rnd(k+j+n)*.48;
     const stem=add(cylinder,m.leaf[0],px,-.90+h*.5,pz,.012,h,.012);stem.rotation.z=-.12;add(sphere,m.bark,px-.05,-.90+h,pz,.027,.095,.027);
    }
   }else{
    if(j===1){const courses=n?6:3;for(let row=0;row<courses;row++)for(let c=0;c<3-(row>2?1:0);c++)rock(x-.65+c*.46+row*.08,-.15+row*.35,z,.45,.34,.57,120+row+c);ivy(x-.38,n?1.45:.55,z+.32,82+n);}
    else if(n===1){const fallen=drum(x,-.18,z,j+1,.85);fallen.rotation.z=1.48;for(let k=0;k<3;k++)rock(x+.50+k*.27,-.20,z+.22,.30,.25,.36,98+k).rotation.z=.20+k*.24;}
    else{drum(x,-.18,z,j+1,j===0?.62:1.25);rock(x+.66,-.30,z+.18,.72,.24,.44,98+j).rotation.z=.34;}
    shrub(x-.52,-.16,z+.46,100+j+n,.39);
   }
  }));
  // Secondary archipelago: a northern sanctuary, western fragments and a low
  // foreground landing. Unequal footprints/heights leave water channels open.
  const outerIslands=[[-cols*.62-3.2,-rows*.25-1.7,1.25,1.05],[-cols*.12-1.4,-rows*.70-2.0,1.65,1.25],[cols*.60+4,rows*.10+1.4,1.15,1.45],[cols*.15+1,rows*.70+2.1,1.55,1.10],[cols*.20+1.7,-rows*.95-1.6,.90,.85]];
  this.outerIslandScale=Math.min(2.35,Math.max(1,Math.max(cols,rows)/14));
  outerIslands.forEach(([x,z,w,d],n)=>{
   const start=raw.children.length,shoreStart=shore.length;
   const angle=n*.71;
   add(shelf,this.materials.dark,x,-1.52,z,w*1.18,1.65,d*1.18,angle);add(shelf,coastalStone[(n+1)%4],x,-.72,z,w,1,d,angle);shore.push([x,z,Math.min(w,d)*.90,false,true]);
   add(shelf,this.materials.dark,x+.40,-1.68,z-.35,w*1.55,.70,d*1.45,angle+.25);shore.push([x+.4,z-.35,Math.max(w,d)*1.2,true]);
   for(let k=0;k<6;k++){const a=k*2.4,rr=.8+rnd(n*31+k)*.6;rock(x+Math.cos(a)*w*rr,-.66-rnd(k+n)*.33,z+Math.sin(a)*d*rr,.35,.24,.30,160+n+k);}
   if(frost){
    snow(x,-.16,z,w*1.9,d*1.9,130+n);if(n===1){portal(x+.18,z,40+n).rotation.y=.40;pine(x-.65,-.12,z+.40,140+n,1.5);}else{pine(x-.28,-.12,z-.10,140+n,n===3?2.1:1.4);if(n===2||n===0)pine(x+.48,-.16,z+.35,150+n,.85);}
    for(let k=0;k<4;k++)add(lump,m.snow,x+Math.cos(k*2.4)*(w+.5),-.80,z+Math.sin(k*2.4)*(d+.4),.30,.08,.24,k);
   }else{
    if(n===1)portal(x+.15,z,40+n).rotation.y=.40;
    else if(n===0){for(let row=0;row<5;row++)for(let c=0;c<3-(row>2?1:0);c++)rock(x-.48+c*.44,-.12+row*.34,z-.1,.43,.33,.62,170+row+c);ivy(x-.32,.92,z+.22,180+n);}
    else if(n===2){const fallen=drum(x-.10,-.14,z,2,.9);fallen.rotation.z=1.40;drum(x+.60,-.16,z-.35,3,.45);}
    else{for(let k=0;k<3;k++)rock(x-.3+k*.16,-.22+k*.12,z+.25,1.25-k*.24,.18,.40,190+k);drum(x-.48,-.13,z-.25,1,n===3?.78:.5);}
    if(garden){add(shelf,m.moss,x,-.25,z,w*.89,.14,d*.89,angle);shrub(x+.4,-.13,z+.4,210+n,.70);if(n===0||n===3)floweringTree(x-.35,-.12,z-.25,n===3?1.8:1.5,220+n);else shrub(x-.40,-.12,z-.45,230+n,.58);}
    else{shrub(x+.42,-.13,z+.42,210+n,.36);moss(x-.40,-.13,z-.30,220+n,.38);}
   }
   if(this.outerIslandScale>1){
    const parts=raw.children.slice(start),assembly=new THREE.Group();assembly.position.set(x,-.85,z);raw.add(assembly);raw.updateMatrixWorld(true);parts.forEach(part=>assembly.attach(part));assembly.scale.setScalar(this.outerIslandScale);
    for(const point of shore.slice(shoreStart)){point[0]=x+(point[0]-x)*this.outerIslandScale;point[1]=z+(point[1]-z)*this.outerIslandScale;point[2]*=this.outerIslandScale;}
   }
  });
  if(garden){
   this.environmentTime=this.environmentTime||{value:0};
   if(!m.lily){m.lily=[0x316b42,0x4a8150,0x275e40].map(c=>new THREE.MeshStandardMaterial({color:color(c),vertexColors:true,roughness:.78,side:THREE.DoubleSide}));for(const mat of m.lily)mat.onBeforeCompile=shader=>{shader.uniforms.lilyTime=this.environmentTime;shader.vertexShader='uniform float lilyTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    #ifdef USE_INSTANCING
    vec2 anchor=instanceMatrix[3].xz;transformed.y+=.018*sin(lilyTime*.85+anchor.x*.7+anchor.y*.9);
    #endif`);};}
   const lily=this.geometry('cupped-lily-pad',()=>{
    const positions=[],colours=[],centre=[.96,1,.70],edge=[.65,.84,.58],vein=[1,1,.76],emit=(p,c)=>{positions.push(...p);colours.push(...c);};
    for(let k=0;k<32;k++){const a=.20+k/32*(Math.PI*2-.40),b=.20+(k+1)/32*(Math.PI*2-.40),point=a=>[Math.cos(a),.045+.018*Math.sin(a*3),Math.sin(a)];emit([0,0,0],centre);emit(point(b),edge);emit(point(a),edge);}
    for(let k=0;k<7;k++){const a=.35+k*(Math.PI*2-.7)/6,dx=Math.cos(a),dz=Math.sin(a),w=.009,tip=[dx*.84,.048,dz*.84];for(const p of [[-dz*w,.012,dx*w],[dz*w,.012,-dx*w],tip])emit(p,vein);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.computeVertexNormals();return g;
   });
   const patches=[[-cols*.45,rows*.65,2.0,1.25,32],[-cols*.70,-rows*.10,1.35,.85,19],[cols*.40,-rows*.82,1.90,1.1,29],[cols*.63,rows*.70,1.10,1.45,24],[-cols*.62-3.7,-rows*.25-1.3,1.35,.9,17],[cols*.15+1.6,rows*.70+2.5,1.55,1.1,21]];
   patches.forEach(([x,z,rx,rz,count],n)=>{const pads=[];for(let k=0;k<count*5&&pads.length<count;k++){
    const seed=this.environmentSeed+n*613+k*7,a=rnd(seed)*Math.PI*2,r=Math.sqrt(rnd(seed+1)),px=x+Math.cos(a)*rx*r,pz=z+Math.sin(a)*rz*r,size=.16+rnd(seed+2)*.16;
    if(pads.some(p=>Math.hypot(px-p[0],pz-p[1])<(size+p[2])*.72))continue;pads.push([px,pz,size]);
    const pad=add(lily,m.lily[k%3],px,-.827,pz,size,1,size,rnd(seed+3)*Math.PI*2);pad.userData.floatingLeaf=true;
   }
   for(let k=0;k<2&&k*3<pads.length;k++){const [px,pz]=pads[k*3];for(let petal=0;petal<9;petal++){const a=petal*Math.PI*2/9;const p=add(sphere,n%2?m.white:m.pink,px+Math.cos(a)*.085,-.77,pz+Math.sin(a)*.085,.09,.035,.045,a);p.rotation.z=.16;}add(lump,m.gold,px,-.75,pz,.035,.025,.035);}
   });
  }
  // Pebbles below the surface give a real depth reference instead of a flat tint.
  for(let j=0;j<180;j++){const cluster=clusters[j%3],a=j*2.4,r=.6+rnd(j+80)*2.0,x=cluster[0]+Math.cos(a)*r,z=cluster[1]+Math.sin(a)*r;add(lump,j%3===0?m.bed:this.materials.dark,x,-2.48,z,.12+rnd(j)*.12,.08,.15,j);}
  // Three uneven coastal ridges continue well beyond the overview. Their low
  // detail assets share geometry/materials; they remain world-anchored on orbit.
  const distantStart=raw.children.length,farShore=[],anchors=[];
  const farScale=Math.max(1,Math.max(cols,rows)/14),reachX=cols/2+farScale*8,reachZ=rows/2+farScale*8;
  const ridges=[
   [[-1.15,-.55],[-1.02,-1.02],[-.40,-1.24],[.20,-1.18],[.72,-.82],[1.10,-.88]],
   [[-1.20,.10],[-1.35,.62],[-.96,1.12],[-.35,1.27]],
   [[.90,.25],[1.35,.60],[1.15,1.25],[.55,1.47]],
   [[-1.85,-.26],[-1.62,-1.62],[1.70,-1.30],[1.85,.70]]
  ];
  const ashlar=this.geometry('distant-ashlar',()=>B.roundedBox(1,1,1,.07,2));
  const farRock=(x,y,z,w,h,d,turn=0)=>add(ashlar,stone[1],x,y,z,w,h,d,turn);
  const farTree=(x,z,n,h)=>{
   const base=-.33;
   add(cylinder,m.bark,x,base+h*.42,z,.07*farScale,h*.84,.07*farScale);
   if(frost){
    for(let k=0;k<4;k++){const f=k/4,r=h*(.30-.22*f),yy=base+h*(.30+.65*f);
     add(cone,m.pine,x,yy,z,r,h*.44,r,n+k*.4);
     add(cone,m.snow,x,yy+h*.07,z,r*.82,h*.38,r*.82,n+k*.4);
    }
   }else{
    for(let k=0;k<3;k++){const a=k*2.4+n,rr=h*.19,xx=x+Math.cos(a)*rr,zz=z+Math.sin(a)*rr,yy=base+h*(.75+rnd(n+k)*.15);
     add(sphere,m.leaf[0],xx,yy,zz,h*.32,h*.24,h*.29,a);
     if(garden){
      add(sphere,n%3?m.pink:m.white,xx,yy+h*.10,zz,h*.29,h*.18,h*.27,a+.4);
      for(let petal=0;petal<4;petal++){const pa=petal*2.4+n,rr=h*.22;add(blossom,petal%3?m.pink:m.white,xx+Math.cos(pa)*rr,yy+h*.26,zz+Math.sin(pa)*rr,farScale,farScale,farScale,pa);}
     }
    }
   }
  };
  ridges.forEach((path,band)=>path.forEach(([u,v],part)=>{
   const n=band*37+part,seed=this.environmentSeed+n*91,x=u*reachX+(rnd(seed)-.5)*farScale*2,z=v*reachZ+(rnd(seed+1)-.5)*farScale*2;
   const w=(1.35+rnd(seed+2)*1.0)*farScale,d=(1.05+rnd(seed+3)*.85)*farScale,turn=rnd(seed+4)*Math.PI;
   if(Math.abs(x)<cols/2+w*2+1.2&&Math.abs(z)<rows/2+d*2+1.2)return;
   anchors.push({x,z,w,d,band});
   for(let lobe=0;lobe<3;lobe++){
    const off=(lobe-1)*w*.85,px=x+Math.cos(turn)*off,pz=z+Math.sin(turn)*off,sw=w*(.82+rnd(seed+lobe+8)*.30),sd=d*(.85+rnd(seed+lobe+18)*.22);
    // Extrusion rises to +.55 in this shared ledge geometry. Keep foundations
    // below the exposed cap rather than accidentally covering plants/stonework.
    add(shelf,this.materials.dark,px,-2.0,pz,sw*1.12,2.6,sd*1.12,turn+lobe*.21);
    add(shelf,coastalStone[1],px,-.73+(lobe===1?.03:-.06),pz,sw,1,sd,turn+lobe*.21);
    farShore.push([px,pz,Math.min(sw,sd),false,true]);
    if(frost)add(snowCap,m.snow,px,-.32,pz,sw*.96,1.15,sd*.96,turn+lobe*.21);
    else add(lump,m.moss,px,-.14,pz,sw*.72,.055,sd*.65,turn+lobe*.2);
   }
   for(let k=0;k<6;k++){const a=k*2.4+turn,xx=x+Math.cos(a)*w*1.12,zz=z+Math.sin(a)*d*.9,sz=(.28+rnd(seed+k+82)*.24)*farScale;
    add(lump,stone[1],xx,-.61-rnd(seed+k+93)*.28,zz,sz,.20*farScale,sz*.76,a);
   }
   // Landmarks are attached to the broad ledges, with substantial open channels
   // between ridges instead of one evenly spaced circle of decoration.
   if(theme==='ruins'||frost&&n%3===0){
    if(n%3===0){
     for(const side of [-1,1])add(profile,stone[1],x+side*.90*farScale,-.32,z,.90*farScale,1.05*farScale,.90*farScale);
     for(let k=0;k<5;k++){const a=Math.PI-k*.30,part=add(wedge,stone[1],x,1.36*farScale-.32,z-.23*farScale,farScale,farScale,farScale);part.rotation.z=a;}
    }else if(n%3===1){
     for(let row=0;row<3;row++)for(let c=0;c<4-row;c++)farRock(x+(c-1.3)*.56*farScale+row*.10*farScale,-.10+row*.44*farScale,z,.54*farScale,.42*farScale,.66*farScale,turn*.08);
     farRock(x,-.30,z+farScale*.50,2.3*farScale,.18*farScale,.65*farScale);
    }else{
     add(profile,stone[1],x-.55*farScale,-.32,z,.90*farScale,1.20*farScale,.90*farScale);
     const fallen=add(brokenDrum,stone[1],x+.60*farScale,-.18,z+.2*farScale,farScale,farScale,farScale);fallen.rotation.z=1.40;
    }
    if(frost)add(snowCap,m.snow,x,-.28,z,1.4*farScale,.9,farScale,turn);
   }
   if(garden||frost){
    const trees=garden?3:4;
    for(let k=0;k<trees;k++){const xx=x+(rnd(seed+k+31)-.5)*w*1.45,zz=z+(rnd(seed+k+51)-.5)*d*1.1;
     farTree(xx,zz,n+k,(1.5+rnd(seed+k+61)*1.2)*farScale);
    }
    if(garden)for(let k=0;k<5;k++){const a=k*2.4;add(lump,m.leaf[0],x+Math.cos(a)*w*.72,-.21,z+Math.sin(a)*d*.66,.42*farScale,.22*farScale,.38*farScale,a);}
    if(garden){const pad=this.geometryCache.get('cupped-lily-pad');if(pad)for(let k=0;k<8;k++){const a=rnd(seed+k+100)*Math.PI*2,rr=.3+rnd(seed+k+110)*.65,sz=(.16+rnd(seed+k+120)*.12)*farScale;
     add(pad,m.lily[1],x+w*.9+Math.cos(a)*rr*farScale,-.827,z+d*.8+Math.sin(a)*rr*farScale,sz,1,sz,a);
    }}
    if(frost)for(let k=0;k<3;k++){const a=k*2.4+.2,px=x+Math.cos(a)*(w+farScale),pz=z+Math.sin(a)*(d+farScale);
     add(shelf,m.ice,px,-.79,pz,.42*farScale,.22,.34*farScale,a);add(snowCap,m.snow,px,-.76,pz,.40*farScale,.5,.33*farScale,a);
    }
   }else for(let k=0;k<3;k++)add(lump,m.moss,x+(k-1)*.47*farScale,-.28,z+.42*farScale,.35*farScale,.09,.28*farScale,k);
  }));
  raw.children.slice(distantStart).forEach(root=>root.traverse(obj=>{obj.userData.distant=true;}));
  this.distantEnvironment={seed:this.environmentSeed,reachX,reachZ,scale:farScale,anchors};this.farShore=farShore;
  raw.updateMatrixWorld(true);
  const occupied=[];level.grid.forEach((row,r)=>row.forEach((tile,c)=>{if(tile)occupied.push(this.world(r,c));}));
  let excluded=0;
  for(const obj of raw.children.slice()){
   const bounds=new THREE.Box3().setFromObject(obj);
   if((bounds.max.y> -1.4&&level.grid.some((row,r)=>row.some((tile,c)=>{if(tile!==9)return false;const p=this.world(r,c);return bounds.max.x>p.x-.55&&bounds.min.x<p.x+.55&&bounds.max.z>p.z-.55&&bounds.min.z<p.z+.55;})))||(bounds.max.y>.025&&bounds.min.y<2.35&&occupied.some(p=>bounds.max.x>p.x-.495&&bounds.min.x<p.x+.495&&bounds.max.z>p.z-.495&&bounds.min.z<p.z+.495))){raw.remove(obj);excluded++;}
  }
  this.scenerySafety={excluded,protectedCells:occupied.length};
  this.sceneCeiling=Math.max(3,new THREE.Box3().setFromObject(raw).max.y);
  const batches=new Map();raw.traverse(obj=>{if(!obj.isMesh)return;const distant=!!obj.userData.distant,key=obj.geometry.uuid+obj.material.uuid+(distant?':distant':'');if(!batches.has(key))batches.set(key,{geometry:obj.geometry,material:obj.material,matrices:[],distant});batches.get(key).matrices.push(obj.matrixWorld.clone());});
  for(const batch of batches.values()){const mesh=new THREE.InstancedMesh(batch.geometry.clone(),batch.material,batch.matrices.length);mesh.userData.ownedGeometry=true;mesh.userData.distant=batch.distant;batch.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=!batch.distant&&![sphere,cone,cylinder,lump,boulder,leafGeometry].includes(batch.geometry);mesh.receiveShadow=mesh.castShadow;if(batch.distant)mesh.frustumCulled=false;this.decor.add(mesh);}
  this.sceneryBounds=new THREE.Box3();raw.children.filter(obj=>!obj.userData.distant).forEach(obj=>this.sceneryBounds.expandByObject(obj));this.makeWater(shore,cols,rows,frost);this.setCamera();
 };
 const shoreField=(shore,cols,rows,size=192)=>{
  const spanX=Math.max(cols+16,2*Math.max(...shore.map(p=>Math.abs(p[0])+p[2]))+8),spanZ=Math.max(rows+16,2*Math.max(...shore.map(p=>Math.abs(p[1])+p[2]))+8),data=new Uint8Array(size*size*4);
  const depths=new Float32Array(size*size).fill(5),contacts=new Float32Array(size*size).fill(5),xs=Array.from({length:size},(_,i)=>(i/(size-1)-.5)*spanX),zs=Array.from({length:size},(_,i)=>(i/(size-1)-.5)*spanZ);
  // Rasterize only each shore's finite influence. The old all-pixels × all-cells
  // loop grew needlessly on large levels and every skin change.
  for(const [sx,sz,r,submerged,round] of shore){
   const minX=Math.max(0,Math.floor(((sx-r-4)/spanX+.5)*(size-1))),maxX=Math.min(size-1,Math.ceil(((sx+r+4)/spanX+.5)*(size-1))),minZ=Math.max(0,Math.floor(((sz-r-4)/spanZ+.5)*(size-1))),maxZ=Math.min(size-1,Math.ceil(((sz+r+4)/spanZ+.5)*(size-1)));
   for(let j=minZ;j<=maxZ;j++)for(let i=minX;i<=maxX;i++){
    const dx=xs[i]-sx,dz=zs[j]-sz,d=submerged||round?Math.max(0,Math.hypot(dx,dz)-r):Math.hypot(Math.max(0,Math.abs(dx)-r),Math.max(0,Math.abs(dz)-r)),index=j*size+i;
    depths[index]=Math.min(depths[index],d);if(!submerged)contacts[index]=Math.min(contacts[index],d);
   }
  }
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){const index=j*size+i,k=index*4;data[k]=Math.min(255,Math.round(depths[index]/4*255));data[k+1]=Math.round((.45+.2*Math.sin(xs[i]*.7)*Math.cos(zs[j]*.8))*255);data[k+2]=Math.min(255,Math.round(contacts[index]/4*255));data[k+3]=255;}
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return {texture,spanX,spanZ};
 };
 P.makeWater=function(shore,cols,rows,frost){
  // Keep the original near-board texel density. A separate, coarser field adds
  // depth around distant ridges without blurring contacts on functional cells.
  const near=shoreField(shore,cols,rows),far=shoreField(this.farShore||[],0,0,128),{spanX,spanZ}=near;
  this.shoreTexture?.dispose();this.shoreTexture=near.texture;
  this.farShoreTexture?.dispose();this.farShoreTexture=far.texture;
  this.waterField=this.waterField||B.createWaterField(this.renderer);this.environmentTime=this.environmentTime||{value:0};
  this.waterUniforms={gardenTime:this.environmentTime,waveField:{value:this.waterField},shoreMap:{value:this.shoreTexture},shoreSpan:{value:new THREE.Vector2(spanX,spanZ)},farShoreMap:{value:this.farShoreTexture},farShoreSpan:{value:new THREE.Vector2(far.spanX,far.spanZ)}};
  this.waterMaterial?.dispose();this.waterMaterial=new THREE.MeshStandardMaterial({color:color(frost?0x07536b:0x086879),roughness:.42,metalness:.02,envMapIntensity:.08,transparent:true,opacity:.82,depthWrite:false});
  this.waterMaterial.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.waterUniforms);
   shader.vertexShader='varying vec3 waterWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nwaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='varying vec3 waterWorld;uniform float gardenTime;uniform sampler2D shoreMap;uniform sampler2D waveField;uniform vec2 shoreSpan;uniform sampler2D farShoreMap;uniform vec2 farShoreSpan;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 uv=waterWorld.xz/shoreSpan+.5;vec3 shore=texture2D(shoreMap,uv).rgb;vec3 farShore=texture2D(farShoreMap,waterWorld.xz/farShoreSpan+.5).rgb;shore.r=min(shore.r,farShore.r);shore.b=min(shore.b,farShore.b);
    float depth=smoothstep(0.,.4,shore.r);float contact=(1.-smoothstep(.004,.022,shore.b))*smoothstep(0.,.004,shore.b);
    float t=gardenTime;vec2 q=waterWorld.xz;
    vec3 wavesA=texture2D(waveField,q*vec2(.045,.105)+vec2(t*.007,t*.003)).rgb;
    vec3 wavesB=texture2D(waveField,mat2(.98,.20,-.20,.98)*q*vec2(.055,.085)+vec2(-t*.005,t*.006)).rgb;
    float pixelFootprint=max(length(dFdx(q)),length(dFdy(q)));
    float fineFade=1.-smoothstep(.09,.28,pixelFootprint);
    float wave=(wavesA.b*.62+wavesB.b*.38)*2.-1.;
    float swell=sin(q.x*.63+q.y*.42+t*.14)*cos(q.y*.8-q.x*.31-t*.11);
    float coverage=smoothstep(-.20,.65,swell)*(.30+.70*smoothstep(.28,.75,wavesB.b));
    float angleFade=.35+.65*abs((mat3(viewMatrix)*vec3(0.,1.,0.)).z);
    float crest=smoothstep(.28,.68,wave)*fineFade*coverage*angleFade;
    vec2 slope=((wavesA.rg-.5)*1.1+(wavesB.rg-.5)*.7)*fineFade*coverage*angleFade;
    diffuseColor.rgb*=mix(vec3(.85,1.42,1.18),vec3(.43,.68,.92),depth)*(.95+.07*swell+.07*wave*coverage);
    // Coloured wave shoulders remain readable when zoomed out, independently
    // of the bounded sun glint. They never approach white foam over open water.
    diffuseColor.rgb+=vec3(.006,.015,.016)*crest;
    diffuseColor.rgb+=vec3(.07,.12,.10)*contact*(.65+.35*sin(t+q.x*8.+q.y*7.));
    diffuseColor.a=mix(.55,.91,depth);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=.48+.14*(wave*.5+.5);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 ripple=vec3(slope.x,0.,slope.y)*.055;
    normal=normalize(normal+mat3(viewMatrix)*ripple);`);
   // r128 writes gl_FragColor directly: output_fragment does not exist here.
   // Keep diffuse/depth/normal and environment light; bound only the direct
   // light glint responsible for the reported low-angle full-surface washout.
   const output='gl_FragColor = vec4( outgoingLight, diffuseColor.a );';
   if(!shader.fragmentShader.includes(output))throw new Error('Water shader output anchor missing');
   shader.fragmentShader=shader.fragmentShader.replace(output,'outgoingLight=reflectedLight.directDiffuse+reflectedLight.indirectDiffuse+totalEmissiveRadiance+reflectedLight.indirectSpecular+min(reflectedLight.directSpecular,vec3(.018,.032,.040));\n'+output);
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directSpecular*=.24;');
  };
  const plane=this.geometry('water-surface',()=>new THREE.PlaneGeometry(1,1));
  this.water=new THREE.Mesh(plane,this.waterMaterial);this.water.rotation.x=-Math.PI/2;this.water.position.y=-.85;this.water.receiveShadow=true;this.scene.add(this.water);
  // Water lives with decor for lifecycle, but is excluded from thumbnail bounds.
  this.decor.add(this.water);this.water.userData.surface=true;
  this.bedMaterial?.dispose();this.bedMaterial=this.artMats.bed.clone();
  this.bedMaterial.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.waterUniforms);
   shader.vertexShader='varying vec3 bedWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nbedWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=`varying vec3 bedWorld;uniform sampler2D shoreMap;uniform vec2 shoreSpan;uniform sampler2D farShoreMap;uniform vec2 farShoreSpan;
    vec2 bedHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
    `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 q=bedWorld.xz*3.1,id=floor(q),f=fract(q);float near=8.,second=8.;vec2 cell=id;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 offset=vec2(float(x),float(y)),h=bedHash(id+offset),v=offset+.18+h*.64-f;float d=dot(v,v);if(d<near){second=near;near=d;cell=id+offset;}else second=min(second,d);}
    float joint=1.-smoothstep(.012,.065,second-near),variation=bedHash(cell).x;
    vec3 stones=mix(vec3(.075,.14,.115),vec3(.20,.27,.20),variation)*(1.-joint*.32);
    float shallow=1.-smoothstep(.06,.42,min(texture2D(shoreMap,bedWorld.xz/shoreSpan+.5).r,texture2D(farShoreMap,bedWorld.xz/farShoreSpan+.5).r));
    diffuseColor.rgb=mix(diffuseColor.rgb,stones,shallow*.80);`);
  };
  this.seabed=new THREE.Mesh(plane,this.bedMaterial);this.seabed.rotation.x=-Math.PI/2;this.seabed.position.y=-2.6;this.seabed.receiveShadow=true;this.seabed.userData.surface=true;this.decor.add(this.seabed);
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
  const scene=kind==='block'?new THREE.Scene():this.scene;
  let obj,box;if(kind==='block'){scene.environment=this.scene.environment;scene.add(new THREE.HemisphereLight(0xffffff,0x607080,.8));const light=new THREE.DirectionalLight(0xffe3bc,1.4);light.position.set(-3,6,4);scene.add(light);obj=this.createBlock();scene.add(obj);box=new THREE.Box3().setFromObject(obj);}else{box=new THREE.Box3().setFromObject(this.board).union(this.sceneryBounds);}
  const surfaces=this.decor.children.filter(x=>x.userData.surface),visibility=surfaces.map(x=>x.visible),blocksVisible=this.blocks.visible;
  if(kind==='map'){surfaces.forEach(x=>x.visible=false);this.blocks.visible=false;}
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const span=Math.max(size.x/1.33,size.y,size.z)*.55;
  const cam=new THREE.OrthographicCamera(-span*1.33,span*1.33,span,-span,.1,150);cam.position.copy(center).add(new THREE.Vector3(12,13,17));cam.lookAt(center);this.previewRenderer.render(scene,cam);
  const result=this.previewRenderer.domElement.toDataURL('image/png');surfaces.forEach((x,i)=>x.visible=visibility[i]);this.blocks.visible=blocksVisible;this.setAppearance(skin,theme);this.previewCache.set(key,result);return result;
 };
 P.helpIllustration=function(kind){
  this.helpCache=this.helpCache||new Map();const key=kind+':'+this.theme;if(this.helpCache.has(key))return this.helpCache.get(key);
  if(!this.helpRenderer){this.helpRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});this.helpRenderer.setSize(240,180);this.helpRenderer.outputEncoding=THREE.sRGBEncoding;this.helpRenderer.toneMapping=THREE.ACESFilmicToneMapping;}
  const preview=new THREE.Scene();preview.environment=this.scene.environment;
  preview.add(new THREE.HemisphereLight(0xe3f4ff,0x526c76,.9));const sun=new THREE.DirectionalLight(0xffebcc,1.3);sun.position.set(-3,6,4);preview.add(sun);
  const specimen=new THREE.Group(),m=this.materials;preview.add(specimen);
  if(kind==='goal'){this.addGoal(specimen);specimen.children.forEach(o=>{if(o.position.y<-.4){o.scale.y=.28;o.position.y=-.23;}});}else{
   const mat=kind==='fragile'?m.fragile:kind==='bridge'?m.steel:m.stone[0];
   const slab=this.box(.97,.24,.97,[m.dark,m.dark,mat,m.dark,m.dark,m.dark],.035);slab.position.y=-.12;specimen.add(slab);
   if(kind==='bridge')for(let i=-3;i<=3;i++){const rib=this.box(.79,.024,.035,m.switch,.007);rib.position.set(0,.013,i*.11);specimen.add(rib);}
   const type=kind==='soft'?3:kind==='heavy'?4:kind==='split'?5:0;
   if(type){const count=this.switches.length;this.addSwitch(specimen,type,0,0);this.switches.length=count;}
  }
  const cam=new THREE.OrthographicCamera(-.91,.91,.68,-.68,.1,30);cam.position.set(2.6,2.8,3.8);cam.lookAt(0,-.12,0);this.helpRenderer.render(preview,cam);
  const result=this.helpRenderer.domElement.toDataURL('image/png');this.helpCache.set(key,result);return result;
 };
})();
