/* Three.js r128 scene. Rendering never decides whether a move is legal:
 * game_logic.py remains authoritative for all game and solver rules. */
(() => {
  'use strict';
  const B = window.Bloxorz;
  const directions = {UP:[0,-1], DOWN:[0,1], LEFT:[-1,0], RIGHT:[1,0]};
  const ease = t => t * t * (3 - 2 * t);
  class GameScene {
    constructor(container) {
      this.container = container;
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-10,10,10,-10,.1,160);
      this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.enabled = true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      this.renderer.localClippingEnabled = true;
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      container.prepend(this.renderer.domElement);
      this.environment = B.createEnvironment(this.renderer);
      this.scene.environment = this.environment.texture;
      this.materials = B.createMaterials(this.renderer);
      this.geometryCache = new Map();
      this.board = new THREE.Group(); this.blocks = new THREE.Group();
      this.markers = new THREE.Group();
      this.pivot = new THREE.Group();
      this.scene.add(this.board, this.blocks, this.pivot, this.markers);
      this.scene.add(new THREE.HemisphereLight(0xddebf2, 0x233445, .52));
      const key = new THREE.DirectionalLight(0xffe6ca, 1.28); key.position.set(-5, 12, 7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-20,right:20,top:20,bottom:-20});key.shadow.radius=2;key.shadow.bias=-.0003;this.scene.add(key);
      const fill = new THREE.DirectionalLight(0x8db5d7, .55); fill.position.set(8, 5, -5); this.scene.add(fill);
      const rim = new THREE.DirectionalLight(0xc7e9e7, .7); rim.position.set(-5, 4, -7); this.scene.add(rim);
      this.target = new THREE.Vector3(0, .15, 0);
      this.azimuth = .45; this.elevation = .65; this.distance = 18; this.zoom = 1;
      this.rotation = new THREE.Quaternion();
      this.cubeRotations = [new THREE.Quaternion(), new THREE.Quaternion()];
      this.cancelAnimation = null;
      this.bridgeGroups = new Map(); this.tiles = new Map(); this.switches = [];
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.bindCamera();
      this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(container);
      window.addEventListener('resize',()=>this.resize());
      this.resize();
    }
    geometry(key, make) {
      if (!this.geometryCache.has(key)) this.geometryCache.set(key, make());
      return this.geometryCache.get(key);
    }
    box(w, h, d, mat, radius = .025) {
      const key = `box:${w}:${h}:${d}:${radius}`;
      const mesh=new THREE.Mesh(this.geometry(key, () => B.roundedBox(w,h,d,radius)), mat);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
    }
    render() {
      const layoutKey=[document.body.dataset.screen,document.body.dataset.results,this.container.clientWidth,this.container.clientHeight].join(':');
      if(this.layoutKey!==layoutKey){this.layoutKey=layoutKey;this.resize();return;}
      this.updateWaterCoverage?.();
      this.scene.updateMatrixWorld(true);
      // Selection is a world-space overlay, not a face painted on the cube.
      this.markers.children.forEach(marker => {
        marker.userData.target.getWorldPosition(marker.position);
        marker.position.y += .65;
      });
      const shadowSignature=[this.theme,...this.blocks.children.map(o=>o.matrixWorld.elements.join(',')),...this.pivot.children.map(o=>o.matrixWorld.elements.join(',')),...[...this.bridgeGroups.values()].flat().map(o=>o.visible+o.matrixWorld.elements.join(','))].join('|');
      if(this.shadowDirty||this.shadowSignature!==shadowSignature){this.renderer.shadowMap.needsUpdate=true;this.shadowDirty=false;this.shadowSignature=shadowSignature;}
      this.renderer.render(this.scene, this.camera);
    }
    resize() {
      const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
      // Browser zoom and moving between monitors can change DPR after construction.
      const pixelRatio=Math.min(window.devicePixelRatio||1,2);
      if(this.renderer.getPixelRatio?.()!==pixelRatio)this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(w, h, false);
      this.renderer.domElement.dataset.resolution=JSON.stringify({css:[w,h],dpr:window.devicePixelRatio||1,renderRatio:pixelRatio,buffer:[this.renderer.domElement.width,this.renderer.domElement.height]}); this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix(); this.fitCamera(); this.render();
    }
    setCamera() {
      const d = this.distance * this.zoom, c = Math.cos(this.elevation);
      if(this.camera.isOrthographicCamera){
        const W=Math.max(1,this.container.clientWidth),H=Math.max(1,this.container.clientHeight);
        const screen=document.body.dataset.screen||'play',results=document.body.dataset.results==='open';
        const landscape=H<=500&&W>H,mobile=W<=700;
        let left=0,top=0,width=W,height=H-(mobile?240:150);
        if(landscape){width=W-185;height=H;}
        if(['levels','settings','help'].includes(screen)&&!mobile&&!landscape){left=W*.32;width=W-left;top=screen==='help'?100:180;height=H-top-160;}
        if(['solver','results'].includes(screen)){top=150;height=H-top-(results?250:110);}
        height=Math.max(120,height);width=Math.max(180,width);
        this.safeRect={left,top,width,height,W,H};
        const h=d*.34,hh=h*H/height,hw=h*W/height;
        const cx=(left+width/2-W/2)*2/W,cy=1-(top+height/2)*2/H;
        this.camera.left=-hw-cx*hw;this.camera.right=hw-cx*hw;
        this.camera.top=hh-cy*hh;this.camera.bottom=-hh-cy*hh;this.camera.updateProjectionMatrix();
      }
      // Orthographic scale and camera distance are independent. Keep the entire
      // near plane above the highest object even at the minimum orbit elevation.
      const verticalReach=Math.max(Math.abs(this.camera.top),Math.abs(this.camera.bottom))*c;
      const highest=this.sceneCeiling??4;
      const cameraDistance=Math.max(d,(highest+1-this.target.y+verticalReach)/Math.sin(this.elevation));
      this.camera.far=cameraDistance+4*(Math.abs(this.camera.top)+Math.abs(this.camera.bottom)+Math.abs(this.camera.left)+5)/Math.sin(this.elevation);
      this.camera.updateProjectionMatrix();
      this.camera.position.set(this.target.x + Math.sin(this.azimuth)*c*cameraDistance,
        this.target.y + Math.sin(this.elevation)*cameraDistance, this.target.z + Math.cos(this.azimuth)*c*cameraDistance);
      this.camera.lookAt(this.target); this.camera.updateMatrixWorld();
    }
    fitCamera() {
      if (!this.level) {this.setCamera(); return;}
      const oldZoom = this.zoom; this.zoom = 1; this.distance = 9;
      // Fit actual occupied cells, including the upright block, on any aspect ratio.
      const pts = [];
      this.level.grid.forEach((row,r) => row.forEach((tile,c) => {
        if (!tile) return;
        const p = this.world(r,c);
        for (const dx of [-.55,.55]) for (const dz of [-.55,.55]) pts.push(new THREE.Vector3(p.x+dx, -.4,p.z+dz));
      }));
      const start = this.world(...this.level.start_pos);
      pts.push(new THREE.Vector3(start.x,2.2,start.z));
      for (let i=0;i<65;i++) {
        this.setCamera();
        if (pts.every(v => {const p=v.clone().project(this.camera);const a=this.safeRect;const x=(p.x+1)*a.W/2,y=(1-p.y)*a.H/2;return x>a.left+a.width*.10&&x<a.left+a.width*.90&&y>a.top+a.height*.10&&y<a.top+a.height*.90&&p.z<1;})) break;
        this.distance *= 1.04;
      }
      this.zoom = oldZoom; this.setCamera();
    }
    resetCamera() {this.azimuth=.45; this.elevation=.65; this.zoom=1; this.fitCamera(); this.render();}
    bindCamera() {
      const canvas = this.renderer.domElement; let drag = null;
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0 && e.button !== 2) return;
        this.container.focus({preventScroll:true});
        drag = {id:e.pointerId,x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', e => {
        if (!drag || drag.id !== e.pointerId) return;
        this.azimuth -= (e.clientX-drag.x)*.006;
        this.elevation = THREE.MathUtils.clamp(this.elevation+(e.clientY-drag.y)*.005,.3,1.18);
        drag.x=e.clientX;drag.y=e.clientY;this.setCamera();this.render();
      });
      const end = () => {drag=null;};
      canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
      canvas.addEventListener('contextmenu',e=>e.preventDefault());
      canvas.addEventListener('wheel',e=>{
        e.preventDefault();this.zoom=THREE.MathUtils.clamp(this.zoom*Math.exp(e.deltaY*.0008),.65,1.65);this.setCamera();this.render();
      },{passive:false});
    }
    world(r,c) {return {x:c-(this.level.grid[0].length-1)/2,z:r-(this.level.grid.length-1)/2};}
    build(level,state) {
      this.cancel(); this.shadowDirty=true;this.level=level;
      this.board.clear();this.blocks.clear();this.pivot.clear();this.markers.clear();
      this.bridgeGroups.clear();this.tiles.clear();this.switches=[];
      this.rotation.identity();
      this.cubeRotations.forEach(q=>q.identity());
      const m=this.materials;
      level.grid.forEach((row,r)=>row.forEach((type,c)=>{
        if (!type) return;
        const p=this.world(r,c), group=new THREE.Group();group.position.set(p.x,0,p.z);
        this.board.add(group);this.tiles.set(`${r},${c}`,group);
        if(type===9){this.addGoal(group);return;}
        const top=type===2?m.fragile:type>=10?m.steel:m.stone[(r*7+c*3)%4];
        const depth=type===2?.20:.38;
        const slab=this.box(.97,depth,.97,[m.dark,m.dark,top,m.dark,m.dark,m.dark],.035);
        slab.position.y=-depth/2;group.add(slab);
        const lower=this.box(.90,.055,.90,m.dark,.012);lower.position.y=-depth-.012;group.add(lower);
        if(type>=10){
          if(!this.bridgeGroups.has(type-10))this.bridgeGroups.set(type-10,[]);
          this.bridgeGroups.get(type-10).push(group);
          for(let i=-3;i<=3;i++) {const rib=this.box(.79,.024,.035,m.switch,.007);rib.position.set(0,.013,i*.11);group.add(rib);}
        }
        if(type>=3&&type<=5)this.addSwitch(group,type,r,c);
      }));
      this.showState(state);this.resetCamera();
    }
    addGoal(group) {
      const m=this.materials;
      // Opening is .99 units wide; the .94-unit block fits without intersecting the rim.
      for(const sign of [-1,1]) {
        const a=this.box(1.10,.10,.055,m.edge,.008);a.position.set(0,-.025,sign*.5225);group.add(a);
        const b=this.box(.055,.10,.99,m.edge,.008);b.position.set(sign*.5225,-.025,0);group.add(b);
        const wallA=this.box(1.09,1.1,.055,m.shaft,.006);wallA.position.set(0,-.6,sign*.5225);group.add(wallA);
        const wallB=this.box(.055,1.1,.99,m.shaft,.006);wallB.position.set(sign*.5225,-.6,0);group.add(wallB);
        const line=this.box(.7,.012,.016,m.accent,.004);line.position.set(0,.029,sign*.523);group.add(line);
      }
      const bottom=this.box(.99,.02,.99,m.bottom,.004);bottom.position.y=-1.16;group.add(bottom);
    }
    addSwitch(group,type,r,c) {
      const m=this.materials, button=new THREE.Group();button.position.y=.025;group.add(button);
      const base=new THREE.Mesh(this.geometry('switch-base',()=>new THREE.CylinderGeometry(.34,.36,.052,8)),m.dark);button.add(base);
      if(type===3){
        const disc=new THREE.Mesh(this.geometry('switch-disc',()=>new THREE.CylinderGeometry(.25,.26,.06,8)),m.switch);disc.position.y=.052;button.add(disc);
        const ring=new THREE.Mesh(this.geometry('soft-ring',()=>new THREE.TorusGeometry(.18,.017,8,32)),m.accent);ring.rotation.x=-Math.PI/2;ring.position.y=.09;button.add(ring);
      } else if(type===4){
        for(const a of [-Math.PI/4,Math.PI/4]) {const bar=this.box(.54,.065,.10,m.edge,.018);bar.rotation.y=a;bar.position.y=.06;button.add(bar);}
      } else {
        for(const a of [0,Math.PI]) {const bracket=new THREE.Mesh(this.geometry('split-bracket',()=>new THREE.TorusGeometry(.22,.035,8,24,Math.PI*.75)),m.accent);bracket.rotation.set(-Math.PI/2,0,a+Math.PI*.125);bracket.position.y=.07;button.add(bracket);}
      }
      this.switches.push({r,c,type,button});
    }
    createBlock(cube=false) {
      const m=this.materials,g=new THREE.Group(), h=cube?.94:1.94;
      const side=cube?m.cube:m.copper;
      const body=this.box(.94,h,.94,[side,side,m.cap,m.cap,side,side],.045);g.add(body);
      const half=h/2;
      for(const sign of [-1,1]) {
        const cap=this.box(.78,.018,.78,m.cap,.007);cap.position.y=sign*(half+.008);g.add(cap);
        for(const z of [-.477,.477]) {const band=this.box(.86,.032,.018,m.edge,.007);band.position.set(0,sign*(half-.16),z);g.add(band);}
        for(const x of [-.477,.477]) {const band=this.box(.018,.032,.86,m.edge,.007);band.position.set(x,sign*(half-.16),0);g.add(band);}
      }
      const rivet=this.geometry('rivet',()=>new THREE.SphereGeometry(.025,8,6));
      for(const x of [-.35,.35])for(const y of [-half+.17,half-.17])for(const z of [-.467,.467]) {
        const bolt=new THREE.Mesh(rivet,m.edge);bolt.position.set(x,y,z);bolt.scale.z=.35;g.add(bolt);
      }
      return g;
    }
    placements(st) {
      const p=this.world(st.r,st.c);
      if(st.orientation==='SPLIT'){const p2=this.world(st.r2,st.c2);return [{x:p.x,y:.5,z:p.z,w:1,d:1},{x:p2.x,y:.5,z:p2.z,w:1,d:1}];}
      const horizontal=st.orientation==='HORIZONTAL',vertical=st.orientation==='VERTICAL';
      return [{x:p.x+(horizontal?.5:0),y:st.orientation==='STANDING'?1:.5,z:p.z+(vertical?.5:0),w:horizontal?2:1,d:vertical?2:1}];
    }
    canonicalRotation(orient) {
      const q=new THREE.Quaternion();
      if(orient==='HORIZONTAL')q.setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2);
      if(orient==='VERTICAL')q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
      return q;
    }
    showState(st) {
      this.pivot.clear();this.pivot.position.set(0,0,0);this.pivot.rotation.set(0,0,0);this.blocks.clear();this.markers.clear();
      const split=st.orientation==='SPLIT';
      this.placements(st).forEach((p,i)=>{
        const obj=this.createBlock(split);obj.position.set(p.x,p.y,p.z);
        obj.quaternion.copy(split?this.cubeRotations[i]:this.rotation);this.blocks.add(obj);
        if(split&&i===st.active_cube){
          const marker=new THREE.Mesh(this.geometry('active-ring',()=>new THREE.TorusGeometry(.38,.017,8,40)),this.materials.marker);
          marker.rotation.x=-Math.PI/2;marker.userData.target=obj;this.markers.add(marker);
        }
      });
      this.updateBoard(st);
      this.render();
    }
    updateBoard(st) {
      this.shadowDirty=true;
      st.bridges.forEach((open,i)=>(this.bridgeGroups.get(i)||[]).forEach(g=>{g.visible=open;}));
      const cells=st.orientation==='SPLIT'?[[st.r,st.c],[st.r2,st.c2]]:st.orientation==='HORIZONTAL'?[[st.r,st.c],[st.r,st.c+1]]:st.orientation==='VERTICAL'?[[st.r,st.c],[st.r+1,st.c]]:[[st.r,st.c]];
      this.switches.forEach(sw=>{const pressed=cells.some(([r,c])=>r===sw.r&&c===sw.c)&&(sw.type===3||st.orientation==='STANDING');sw.button.position.y=pressed?-.018:.025;});
    }
    cancel() {if(this.cancelAnimation)this.cancelAnimation();this.cancelAnimation=null;}
    tween(duration,update) {
      this.cancel();
      return new Promise(resolve=>{
        let raf=0,finished=false;const start=performance.now();
        const end=value=>{if(finished)return;finished=true;cancelAnimationFrame(raf);this.cancelAnimation=null;resolve(value);};
        this.cancelAnimation=()=>end(false);
        const step=now=>{const t=Math.min(1,(now-start)/duration);update(t);this.render();if(t<1)raf=requestAnimationFrame(step);else end(true);};
        raf=requestAnimationFrame(step);
      });
    }
    async roll(prev,action,next,valid,failureState=null) {
      if(action==='SPACE'){B.sound?.();this.showState(next);return true;}
      if(['SUP','SLEFT','SRIGHT','SDOWN'].includes(action)){
        prev={...prev,active_cube:1-prev.active_cube};action=action.slice(1);
      }
      const objects=this.blocks.children.slice();
      const index=prev.orientation==='SPLIT'?prev.active_cube:0;
      const obj=this.blocks.children[index],pos=this.placements(prev)[index];
      const [dx,dz]=directions[action],axis=new THREE.Vector3(dz,0,-dx),angle=Math.PI/2;
      this.pivot.position.set(pos.x+dx*pos.w/2,0,pos.z+dz*pos.d/2);this.pivot.rotation.set(0,0,0);
      this.scene.updateMatrixWorld(true);this.pivot.attach(obj);
      const ok=await this.tween((this.reducedMotion?90:230)/(this.playbackSpeed||1),t=>this.pivot.quaternion.setFromAxisAngle(axis,angle*ease(t)));
      if(!ok)return false;
      if(!valid) {
        if(failureState)return this.fallAfterSwitch(failureState,objects);
        return this.fall(obj,dx,dz,prev,action);
      }
      const turn=new THREE.Quaternion().setFromAxisAngle(axis,angle);
      if(prev.orientation==='SPLIT'&&next.orientation==='SPLIT') {
        this.cubeRotations[index].premultiply(turn).normalize();
      } else if(prev.orientation!=='SPLIT'&&next.orientation!=='SPLIT') {
        this.rotation.premultiply(turn).normalize();
      } else if(next.orientation==='SPLIT') {
        const landing=this.rotation.clone().premultiply(turn).normalize();
        this.cubeRotations.forEach(q=>q.copy(landing));
      } else {
        this.rotation.copy(this.canonicalRotation(next.orientation));
      }
      B.sound?.();this.showState(next);return true;
    }
    supportPlan(obj, bridges) {
      this.scene.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(obj),supported=[],missing=[],fragile=[];
      const min=this.world(0,0);
      for(let r=Math.floor(box.min.z-min.z+.5);r<=Math.floor(box.max.z-min.z+.5);r++)
      for(let c=Math.floor(box.min.x-min.x+.5);c<=Math.floor(box.max.x-min.x+.5);c++){
        const p=this.world(r,c),tile=this.level.grid[r]?.[c];
        if(Math.min(box.max.x,p.x+.5)-Math.max(box.min.x,p.x-.5)<.12||Math.min(box.max.z,p.z+.5)-Math.max(box.min.z,p.z-.5)<.12)continue;
        const upright=box.max.y-box.min.y>1.5;
        if(tile===2&&upright){fragile.push(this.tiles.get(`${r},${c}`));missing.push(p);}
        else if(tile&&(tile<10||bridges[tile-10]))supported.push(p);else missing.push(p);
      }
      if(!missing.length)return {supported:true};
      if(!supported.length)return {fragile};
      const center=points=>points.reduce((v,p)=>v.add(new THREE.Vector3(p.x,0,p.z)),new THREE.Vector3()).multiplyScalar(1/points.length);
      const delta=center(missing).sub(center(supported));
      const dx=Math.abs(delta.x)>=Math.abs(delta.z)?Math.sign(delta.x):0,dz=dx?0:Math.sign(delta.z);
      const pivot=obj.position.clone();pivot.y=0;
      if(dx)pivot.x=(dx>0?Math.max(...supported.map(p=>p.x))+.5:Math.min(...supported.map(p=>p.x))-.5);
      else pivot.z=(dz>0?Math.max(...supported.map(p=>p.z))+.5:Math.min(...supported.map(p=>p.z))-.5);
      return {pivot,axis:new THREE.Vector3(dz,0,-dx),fragile};
    }
    async animateUnsupported(objects,bridges) {
      this.scene.updateMatrixWorld(true);
      objects.forEach(obj=>this.blocks.attach(obj));this.pivot.clear();this.markers.clear();
      const plans=objects.map(obj=>({obj,...this.supportPlan(obj,bridges),position:obj.position.clone(),rotation:obj.quaternion.clone()})).filter(p=>!p.supported);
      const tipped=plans.filter(p=>p.pivot);
      // A partly supported cuboid first tips about the surviving ledge. Its supported
      // half rises, instead of translating down through a tile that still exists.
      if(tipped.length){
        if(!await this.tween(this.reducedMotion?100:420,t=>{
          for(const p of tipped){const q=new THREE.Quaternion().setFromAxisAngle(p.axis,Math.PI/2*t*t);
            p.obj.position.copy(p.position).sub(p.pivot).applyQuaternion(q).add(p.pivot);
            p.obj.quaternion.copy(p.rotation).premultiply(q);
          }
        }))return false;
      }
      const starts=plans.map(p=>({...p,position:p.obj.position.clone()}));
      const ok=await this.tween(this.reducedMotion?140:520,t=>{
        for(const p of starts){p.obj.position.copy(p.position);p.obj.position.y-=7.5*t*t;
          // A fragile slab breaks beneath the upright block, not through its neighbours.
          for(const tile of p.fragile||[])if(tile)tile.position.y=-7.5*t*t;
        }
      });
      if(ok){for(const p of plans){p.obj.visible=false;for(const tile of p.fragile||[])if(tile)tile.visible=false;}this.render();}
      return ok;
    }
    async fallAfterSwitch(st,objects) {
      this.scene.updateMatrixWorld(true);objects.forEach(obj=>this.blocks.attach(obj));this.pivot.clear();
      this.updateBoard(st);this.render();
      if(!await this.tween(this.reducedMotion?40:100,()=>{}))return false;
      return this.animateUnsupported(objects,st.bridges);
    }
    async fall(obj,dx,dz,prev,action) {
      return this.animateUnsupported([obj],prev.bridges);
    }
    async victory() {
      const obj=this.blocks.children[0];if(!obj)return true;
      const start=obj.position.y,clones=[];
      // Clip only the winning block at floor height; it disappears into the shaft.
      obj.traverse(child=>{
        if(!child.isMesh)return;
        const clone=mat=>{const m=mat.clone();m.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,1,0),.015)];clones.push(m);return m;};
        child.material=Array.isArray(child.material)?child.material.map(clone):clone(child.material);
      });
      const ok=await this.tween(this.reducedMotion?150:670,t=>{obj.position.y=start-3.4*t*t;});
      obj.visible=false;clones.forEach(m=>m.dispose());this.render();return ok;
    }
  }
  B.GameScene=GameScene;
})();
