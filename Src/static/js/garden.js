/* Authored environmental art. All walkable cells and mechanisms remain engine-owned. */
(()=>{
 const B=window.Bloxorz,P=B.GameScene.prototype,baseBuild=P.build,baseBlock=P.createBlock;
 const rnd=n=>{const v=Math.sin(n*127.1+63.4)*43758.545;return v-Math.floor(v);};
 const ENVIRONMENTS={ruins:{heights:[7,3,5],foliage:.36,shore:0x286e75},garden:{heights:[2,2,3],foliage:.72,shore:0x387d72},frost:{heights:[4,2,5],foliage:.40,shore:0x346e89}};
 B.environments=ENVIRONMENTS;
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
 P.build=function(level,state){this.board.children.filter(x=>x.userData.ownedGeometry).forEach(x=>x.geometry.dispose());baseBuild.call(this,level,state);
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
  const add=(geo,mat,x,y,z,sx=1,sy=1,sz=1,rot=0)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.y=rot;raw.add(mesh);return mesh;};
  const sphere=this.geometry('art-leaf',()=>new THREE.SphereGeometry(1,7,4));
  const lump=this.geometry('art-lump',()=>new THREE.DodecahedronGeometry(1,0));
  const cone=this.geometry('art-cone',()=>new THREE.ConeGeometry(1,1,7));
  const cylinder=this.geometry('art-stem',()=>new THREE.CylinderGeometry(1,1,1,5));
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
   const mesh=add(geo,this.materials.stone[Math.abs(n)%4],x,y,z,1,1,1,(rnd(n)-.5)*.08);if(frost&&y+h/2>-.28&&h>.20)snow(x,y+h/2,z,w,d,n);return mesh;
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
  const drum=(x,y,z,n,h=1)=>{const obj=add(profile,this.materials.stone[n%4],x,y,z,1,h,1);add(this.geometry('column-cut-top',()=>new THREE.CylinderGeometry(.41,.41,.035,16)),this.materials.stone[n%4],x,y+1.55*h,z);if(frost)snow(x,y+1.55*h,z,.9,.9,n);else moss(x+.18,y+.12,z,n,.24);return obj;};
  const portal=(x,z,n)=>{
   for(const side of [-1,1]){rock(x+side*.95,-.38,z,.98,.28,.95,n+3);drum(x+side*.95,-.25,z,n,side<0?1.25:.94);}
   for(let j=0;j<6;j++){const a=Math.PI-j*.28;
    const part=add(wedge,this.materials.stone[j%4],x,1.65,z-.24);part.rotation.z=a;
    if(frost&&j>1&&j<7)snow(x+Math.cos(a),1.65+Math.sin(a)*1.14,z,.45,.56,j);
   }
   rock(x+.7,-.25,z+.7,.62,.26,.43,n+1).rotation.z=.35;
   if(!frost){ivy(x-.71,1.5,z+.28,n);ivy(x-.82,.8,z+.31,n+20);}
  };
  const leaf=(x,y,z,n,size=.14)=>{const a=add(sphere,m.leaf[n%3],x,y,z,size*.5,size*.14,size,n*2.4);a.rotation.z=(rnd(n)-.5)*1.3;};
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
   for(let j=0;j<10;j++){const yy=y-j*.085;leaf(x+Math.sin(j*1.4)*.10,yy,z,n+j,.15);if(garden&&j%3===0)flower(x,yy,z+.02,n+j,.08);}
  };
  const pine=(x,y,z,n,h=1.6)=>{
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
  const clusters=[[-cols/2-1.95,rows*.12,1.15],[cols/2+1.05,rows*.26,1.0],[cols*.12,-rows/2-1.45,1.1]];
  // Low rocky shelves connect the architecture to the board below the surface.
  // Different lobes and heights form shores, rather than three detached square plinths.
  clusters.forEach(([x,z,size],n)=>{
   const anchorX=Math.max(-cols*.37,Math.min(cols*.37,x)),anchorZ=Math.max(-rows*.32,Math.min(rows*.32,z));
   for(let j=0;j<9;j++){const t=j/8,px=x*(1-t)+anchorX*t,pz=z*(1-t)+anchorZ*t;
    add(lump,m.bed,px,-1.98+Math.sin(t*Math.PI)*.22,pz,1.05+(.30*rnd(j+n)),.48,.82,j*.7);
    shore.push([px,pz,.68,true]);
   }
   for(let j=0;j<7;j++){const px=x+(rnd(j+n*31)-.5)*2.8,pz=z+(rnd(j+n*31+90)-.5)*2.5;
    add(lump,this.materials.dark,px,-1.28-rnd(j+4)*.5,pz,.58,.42,.5,j);
   }
  });
  clusters.forEach(([x,z,size],n)=>{
   for(let r=-1;r<=1;r++)for(let c=-1;c<=1;c++){if(r===1&&c===(n%2?1:-1))continue;shore.push([x+c*.62*size,z+r*.62*size,.34*size]);for(let j=0;j<6;j++)rock(x+c*.62*size,-2.25+j*.33,z+r*.62*size,.62*size,.32,.62*size,n+r+c+9);}
   if(n===0)portal(x,z,n+4);
   else if(n===2){
    // A fractured wall and fallen cornice contrast with the open arch silhouette.
    for(let row=0;row<4;row++)for(let c=0;c<5-row;c++){
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
     for(let k=0;k<4;k++)flower(px+(rnd(k+j)-.5)*.45,-.40,pz+(rnd(k+j+9)-.5)*.45,30+j+k,.28+k*.10);
    }
   }
   if(frost){
    // Exposed coastal boulders and irregular floes give the snowy shore a different silhouette.
    for(let j=0;j<5;j++){const a=j*2.4,px=x+Math.cos(a)*1.45,pz=z+Math.sin(a)*1.45,w=.32+rnd(j+n)*.35;
     add(lump,this.materials.dark,px,-.65,pz,w,.28,w*.82,j);snow(px,-.39,pz,w*1.7,w*1.35,j);
    }
    if(n===1)pine(x+.95,-.25,z-.55,n+30,1.45);
   }
  });
  clusters.forEach(([x,z,size],n)=>{
   if(garden){
    const tx=x+(n===0?-.4:.45),tz=z-.25,h=n===0?1.6:1.15;
    add(cylinder,m.bark,tx,-.15+h*.4,tz,.075,h,.075);
    for(let j=0;j<5;j++){const a=j*2.4,px=tx+Math.cos(a)*.36,pz=tz+Math.sin(a)*.35;
     const branch=add(cylinder,m.bark,(tx+px)*.5,h*.5-.15,(tz+pz)*.5,.035,.65,.035,a);branch.rotation.z=.65;
     add(lump,m.leaf[0],px,h*.68,pz,.40,.23,.36,j);
     for(let k=0;k<8;k++){const xx=px+(rnd(j*19+k+n)-.5)*.70,zz=pz+(rnd(j*19+k+n+55)-.5)*.65,yy=h*.68+rnd(k+j)*.25;
      add(sphere,n===1?m.purple:m.pink,xx,yy,zz,.10,.08,.10,k);add(sphere,m.white,xx+.035,yy+.03,zz,.035,.025,.035);
     }
    }
   }
   if(frost){
    const tx=x+.7,tz=z-.6;
    for(let j=0;j<5;j++){const branch=add(cylinder,m.bark,tx+(j-2)*.11,-.03+j*.07,tz,.018,.55,.018,j);branch.rotation.z=(j-2)*.27;add(sphere,m.snow,tx+(j-2)*.17,.22+j*.05,tz,.07,.04,.055);}
   }

  });
  // Two asymmetric shore fragments frame the play space; the centre remains open.
  [[-cols*.68,rows*.64,1.25],[cols*.64,-rows*.68,1.0]].forEach(([x,z,scale],n)=>{
   for(let j=0;j<8;j++){const px=x+(rnd(j+n*60)-.5)*2.6*scale,pz=z+(rnd(j+n*60+60)-.5)*1.8*scale;
    add(lump,this.materials.dark,px,-1.7,pz,.95,.75,.85,j);shore.push([px,pz,.7,true]);
    if(j<4){rock(px,-.6,pz,.76,.42,.67,j+20);shrub(px,-.36,pz,j+40,config.foliage);}
   }
   if(frost){pine(x,-.35,z,n+80,n===0?2.1:1.7);pine(x+.6,-.4,z+.3,n+81,1.0);}
   else if(theme==='ruins'){
    drum(x,-.3,z,3,n===0?1.0:.58);rock(x-.1,-.3+1.55*(n===0?1.0:.58)+.1,z,1.15,.22,.8,3).rotation.z=.15;if(n===0)ivy(x+.33,1.0,z,31);
    for(let j=0;j<3;j++)rock(x+.6+j*.32,-.35+j*.10,z+.1,.31,.3,.42,j+10);
   }else for(let j=0;j<3;j++)shrub(x+(j-1)*.4,-.20,z+.3,j+70,.7);
  });
  // Pebbles below the surface give a real depth reference instead of a flat tint.
  for(let j=0;j<180;j++){const cluster=clusters[j%3],a=j*2.4,r=.6+rnd(j+80)*2.0,x=cluster[0]+Math.cos(a)*r,z=cluster[1]+Math.sin(a)*r;add(lump,j%3===0?m.bed:this.materials.dark,x,-2.48,z,.12+rnd(j)*.12,.08,.15,j);}
  raw.updateMatrixWorld(true);
  const occupied=[];level.grid.forEach((row,r)=>row.forEach((tile,c)=>{if(tile)occupied.push(this.world(r,c));}));
  let excluded=0;
  for(const obj of raw.children.slice()){
   const bounds=new THREE.Box3().setFromObject(obj);
   if((bounds.max.y> -1.4&&level.grid.some((row,r)=>row.some((tile,c)=>{if(tile!==9)return false;const p=this.world(r,c);return bounds.max.x>p.x-.55&&bounds.min.x<p.x+.55&&bounds.max.z>p.z-.55&&bounds.min.z<p.z+.55;})))||(bounds.max.y>.025&&bounds.min.y<2.35&&occupied.some(p=>bounds.max.x>p.x-.495&&bounds.min.x<p.x+.495&&bounds.max.z>p.z-.495&&bounds.min.z<p.z+.495))){raw.remove(obj);excluded++;}
  }
  this.scenerySafety={excluded,protectedCells:occupied.length};
  this.sceneCeiling=Math.max(3,new THREE.Box3().setFromObject(raw).max.y);
  const batches=new Map();raw.traverse(obj=>{if(!obj.isMesh)return;const key=obj.geometry.uuid+obj.material.uuid;if(!batches.has(key))batches.set(key,{geometry:obj.geometry,material:obj.material,matrices:[]});batches.get(key).matrices.push(obj.matrixWorld.clone());});
  for(const batch of batches.values()){const mesh=new THREE.InstancedMesh(batch.geometry.clone(),batch.material,batch.matrices.length);mesh.userData.ownedGeometry=true;batch.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=![sphere,cone,cylinder,lump].includes(batch.geometry);mesh.receiveShadow=mesh.castShadow;this.decor.add(mesh);}
  this.sceneryBounds=new THREE.Box3().setFromObject(raw);this.makeWater(shore,cols,rows,frost);this.setCamera();
 };
 P.makeWater=function(shore,cols,rows,frost){
  const size=128,spanX=cols+12,spanZ=rows+12,data=new Uint8Array(size*size*4);
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=(i/(size-1)-.5)*spanX,z=(j/(size-1)-.5)*spanZ;let distance=5,contactDistance=5;
   for(const [sx,sz,r,submerged] of shore){
    const d=submerged?Math.max(0,Math.hypot(x-sx,z-sz)-r):Math.hypot(Math.max(0,Math.abs(x-sx)-r),Math.max(0,Math.abs(z-sz)-r));
    distance=Math.min(distance,d);if(!submerged)contactDistance=Math.min(contactDistance,d);
   }
   const k=(j*size+i)*4;data[k]=Math.min(255,Math.round(distance/4*255));data[k+1]=Math.round((.45+.2*Math.sin(x*.7)*Math.cos(z*.8))*255);data[k+2]=Math.min(255,Math.round(contactDistance/4*255));data[k+3]=255;
  }
  this.shoreTexture?.dispose();this.shoreTexture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);this.shoreTexture.minFilter=this.shoreTexture.magFilter=THREE.LinearFilter;this.shoreTexture.needsUpdate=true;
  this.waterUniforms={gardenTime:{value:0},shoreMap:{value:this.shoreTexture},shoreSpan:{value:new THREE.Vector2(spanX,spanZ)}};
  this.waterMaterial?.dispose();this.waterMaterial=new THREE.MeshStandardMaterial({color:color(frost?0x07536b:0x086879),roughness:.42,metalness:.02,envMapIntensity:.08,transparent:true,opacity:.82,depthWrite:false});
  this.waterMaterial.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,this.waterUniforms);
   shader.vertexShader='varying vec3 waterWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nwaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='varying vec3 waterWorld;uniform float gardenTime;uniform sampler2D shoreMap;uniform vec2 shoreSpan;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 uv=waterWorld.xz/shoreSpan+.5;vec3 shore=texture2D(shoreMap,uv).rgb;
    float depth=smoothstep(0.,.4,shore.r);float contact=(1.-smoothstep(.004,.022,shore.b))*smoothstep(0.,.004,shore.b);
    float t=gardenTime;vec2 q=waterWorld.xz;
    float wave=sin(q.x*5.+sin(q.y*3.)+t*.65)*cos(q.y*5.7+t*.4);
    float swell=sin(q.x*.63+q.y*.42+t*.14)*cos(q.y*.8-q.x*.31-t*.11);
    float detail=sin(q.x*11.3+q.y*7.9+t*.25)*sin(q.y*9.7-q.x*5.3-t*.18);
    diffuseColor.rgb*=mix(vec3(.85,1.42,1.18),vec3(.43,.68,.92),depth)*(.92+.09*swell+.035*wave+.012*detail);
    diffuseColor.rgb+=vec3(.07,.12,.10)*contact*(.65+.35*sin(t+q.x*8.+q.y*7.));
    diffuseColor.a=mix(.55,.91,depth);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=.40+.12*(wave*.5+.5);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 ripple=vec3(sin(q.x*5.+sin(q.y*2.2)+t*.5)*.010,0.,cos(q.y*6.1+sin(q.x*2.)+t*.43)*.010);
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
  const scene=kind==='block'?new THREE.Scene():this.scene;
  let obj,box;if(kind==='block'){scene.environment=this.scene.environment;scene.add(new THREE.HemisphereLight(0xffffff,0x607080,.8));const light=new THREE.DirectionalLight(0xffe3bc,1.4);light.position.set(-3,6,4);scene.add(light);obj=this.createBlock();scene.add(obj);box=new THREE.Box3().setFromObject(obj);}else{box=new THREE.Box3().setFromObject(this.board).union(this.sceneryBounds);}
  const surfaces=this.decor.children.filter(x=>x.userData.surface),visibility=surfaces.map(x=>x.visible),blocksVisible=this.blocks.visible;
  if(kind==='map'){surfaces.forEach(x=>x.visible=false);this.blocks.visible=false;}
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const span=Math.max(size.x/1.33,size.y,size.z)*.55;
  const cam=new THREE.OrthographicCamera(-span*1.33,span*1.33,span,-span,.1,150);cam.position.copy(center).add(new THREE.Vector3(12,13,17));cam.lookAt(center);this.previewRenderer.render(scene,cam);
  const result=this.previewRenderer.domElement.toDataURL('image/png');surfaces.forEach((x,i)=>x.visible=visibility[i]);this.blocks.visible=blocksVisible;this.setAppearance(skin,theme);this.previewCache.set(key,result);return result;
 };
})();
