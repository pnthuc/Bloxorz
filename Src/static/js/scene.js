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
      // Pause overlays the game without changing its usable scene area. A UI
      // name change is not a viewport resize and must not re-fit an orbit.
      const screen=document.body.dataset.screen||'play',layout=screen==='pause'?(document.body.dataset.pauseScene||'play'):screen;
      const solver=['solver','results','replay'].includes(layout);
      const layoutKey=[layout,solver?document.body.dataset.results:'',layout==='solver'?document.body.dataset.solverView:'',layout==='replay'?document.body.dataset.replayMetrics:'',this.container.clientWidth,this.container.clientHeight].join(':');
      if(this.layoutKey!==layoutKey){
        const previous=this.layoutKey;this.layoutKey=layoutKey;
        if(previous&&screen!=='outcome'&&!this.cameraLoadPose){
          if(this.viewportWidth!==this.container.clientWidth||this.viewportHeight!==this.container.clientHeight){this.resize();return;}
          const from=this.captureView();
          if(this.localView)this.setCamera();else this.fitCamera();
          const to=this.captureView();this.restoreView(from);
          this.transitionView(to,document.body.dataset.mode==='loading'?0:650);return;
        }
      }
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
      const sizeChanged=this.viewportWidth!==w||this.viewportHeight!==h;
      if(sizeChanged){this.stopCameraMotion();this.viewportWidth=w;this.viewportHeight=h;}
      // Browser zoom and moving between monitors can change DPR after construction.
      const pixelRatio=Math.min(window.devicePixelRatio||1,2);
      if(this.renderer.getPixelRatio?.()!==pixelRatio)this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(w, h, false);
      this.renderer.domElement.dataset.resolution=JSON.stringify({css:[w,h],dpr:window.devicePixelRatio||1,renderRatio:pixelRatio,buffer:[this.renderer.domElement.width,this.renderer.domElement.height]});
      if(!sizeChanged)return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();if(this.cameraLoadPose||this.localView||document.body.dataset.screen==='outcome')this.setCamera();else this.fitCamera();this.render();
    }
    setCamera(framing=null) {
      const d = this.distance * this.zoom, c = Math.cos(this.elevation);
      if(this.camera.isOrthographicCamera){
        const W=Math.max(1,this.container.clientWidth),H=Math.max(1,this.container.clientHeight);
        const currentScreen=document.body.dataset.screen||'play',screen=currentScreen==='pause'?(document.body.dataset.pauseScene||'play'):currentScreen,results=document.body.dataset.results==='open';
        const landscape=H<=500&&W>H,mobile=W<=700;
        let left=0,top=0,width=W,height=H-(mobile?240:150);
        if(landscape){width=W-185;height=H;}
        if(['levels','settings','help'].includes(screen)&&!mobile&&!landscape){left=W*.32;width=W-left;top=screen==='help'?100:180;height=H-top-160;}
        if(['solver','results'].includes(screen)){
          const comparing=document.body.dataset.solverView==='compare';
          top=mobile?230:220;height=H-top-(results?250:comparing?(mobile?300:380):110);
        }
        if(screen==='replay'){top=mobile?210:150;height=H-top-(document.body.dataset.replayMetrics==='collapsed'?160:270);}
        height=Math.max(120,height);width=Math.max(180,width);
        this.safeRect={left,top,width,height,W,H};
        const h=d*.34,hh=h*H/height,hw=h*W/height;
        const cx=(left+width/2-W/2)*2/W,cy=1-(top+height/2)*2/H;
        this.camera.left=-hw-cx*hw;this.camera.right=hw-cx*hw;
        this.camera.top=hh-cy*hh;this.camera.bottom=-hh-cy*hh;this.camera.updateProjectionMatrix();
      }
      if(framing)for(const key of ['left','right','top','bottom'])this.camera[key]=framing[key];
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
    stopCameraMotion(){if(this.cameraFrame)cancelAnimationFrame(this.cameraFrame);this.cameraFrame=0;}
    captureView(){return {azimuth:this.azimuth,elevation:this.elevation,zoom:this.zoom,distance:this.distance,target:this.target.toArray(),localView:!!this.localView,frustum:{left:this.camera.left,right:this.camera.right,top:this.camera.top,bottom:this.camera.bottom}};}
    restoreView(view){Object.assign(this,{azimuth:view.azimuth,elevation:view.elevation,zoom:view.zoom,distance:view.distance,localView:!!view.localView});if(view.target)this.target.fromArray(view.target);this.setCamera(view.frustum);}
    resetCamera(animate=false) {
      this.stopCameraMotion();
      const from=this.captureView();
      this.target.set(0,.15,0);this.localView=false;
      this.azimuth=.45;this.elevation=.65;this.zoom=1;this.fitCamera();
      const to=this.captureView();
      this.restoreView(from);
      this.transitionView(to,animate?1050:0);
    }
    focusBlock(st,animate=true){
      if(!st||!this.level)return;
      this.stopCameraMotion();const from=this.captureView(),p=this.placements(st)[st.orientation==='SPLIT'?st.active_cube:0];
      this.target.set(p.x,.35,p.z);this.localView=true;this.zoom=1;this.elevation=Math.max(.48,this.elevation);
      const rect=this.safeRect||{width:this.container.clientWidth,height:this.container.clientHeight};
      this.distance=Math.min(from.distance,10*Math.max(1,rect.height/Math.max(180,rect.width)*1.1));
      this.setCamera();const to=this.captureView();this.restoreView(from);this.transitionView(to,animate?850:0);
    }
    transitionView(to,duration){
      this.stopCameraMotion();const from=this.captureView();
      if(!duration||this.reducedMotion){this.restoreView(to);this.render();return;}
      this.localView=to.localView;
      const delta=Math.atan2(Math.sin(to.azimuth-from.azimuth),Math.cos(to.azimuth-from.azimuth)),start=performance.now();
      const frame=now=>{const t=Math.min(1,(now-start)/duration),k=t*t*t*(t*(t*6-15)+10);
        this.azimuth=from.azimuth+delta*k;this.elevation=from.elevation+(to.elevation-from.elevation)*k;
        this.zoom=Math.exp(Math.log(from.zoom)*(1-k)+Math.log(to.zoom)*k);this.distance=from.distance+(to.distance-from.distance)*k;
        this.target.set(...from.target.map((value,i)=>value+(to.target[i]-value)*k));
        if(t===1){this.restoreView(to);this.cameraFrame=0;}else{this.cameraFrame=requestAnimationFrame(frame);const framing={};for(const key of ['left','right','top','bottom'])framing[key]=from.frustum[key]+(to.frustum[key]-from.frustum[key])*k;this.setCamera(framing);}
        this.render();
      };this.cameraFrame=requestAnimationFrame(frame);
    }
    bindCamera() {
      const canvas = this.renderer.domElement; let drag = null;
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0 && e.button !== 2) return;
        this.stopCameraMotion();
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
        e.preventDefault();this.stopCameraMotion();this.zoom=THREE.MathUtils.clamp(this.zoom*Math.exp(e.deltaY*.0008),.65,1.65);this.setCamera();this.render();
      },{passive:false});
    }
    world(r,c) {return {x:c-(this.level.grid[0].length-1)/2,z:r-(this.level.grid.length-1)/2};}
    build(level,state,{preserveCamera=false}={}) {
      this.cancel();this.stopCameraMotion();this.clearSplashes();this.shadowDirty=true;this.level=level;
      if(!preserveCamera){this.target.set(0,.15,0);this.localView=false;}
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
      this.showState(state);if(preserveCamera)this.setCamera();else this.resetCamera();
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
      g.userData.cube=cube;
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
      this.clearFragileBreaks();
      // Failed fragile slabs are animated away, not permanently removed by the
      // engine. Restoring a snapshot must also restore their render transforms.
      this.tiles.forEach(tile=>{tile.position.y=0;tile.visible=true;});
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
    resetState(st){
      this.cancel();this.stopCameraMotion();this.clearSplashes();this.rotation.identity();this.cubeRotations.forEach(q=>q.identity());this.showState(st);
    }
    captureBlocks(){
      this.scene.updateMatrixWorld(true);
      const objects=this.returnFlight?[...this.returnFlight.group.children]:[...this.blocks.children,...this.pivot.children];
      const visible=objects.filter(obj=>obj.visible),source=visible.length?visible:objects;
      return source.map(obj=>({position:obj.getWorldPosition(new THREE.Vector3()),rotation:obj.getWorldQuaternion(new THREE.Quaternion()),cube:!!obj.userData.cube}));
    }
    clearReturnFlight(){if(this.returnFlight)this.returnFlight.finish(false);}
    waterReturnRoute(obj,from){
      obj.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(obj),hx=(bounds.max.x-bounds.min.x)/2+.025,hz=(bounds.max.z-bounds.min.z)/2+.025;
      const all=[],foundations=[];
      for(const [key,tile]of this.tiles){const [r,c]=key.split(',').map(Number),type=this.level.grid[r][c];if(type===9)continue;const p={x:tile.position.x,z:tile.position.z};all.push(p);if(type===1||type===3||type===4||type===5)foundations.push(p);}
      const overlaps=(x,z,list)=>list.some(p=>Math.abs(x-p.x)<hx+.49&&Math.abs(z-p.z)<hz+.49);
      if(!overlaps(from.x,from.z,all))return [from.clone()];
      const cols=this.level.grid[0].length,rows=this.level.grid.length,limitX=cols/2+hx+3,limitZ=rows/2+hz+3;
      const queue=[{x:0,z:0,parent:-1}],seen=new Set(['0:0']);let last=-1;
      for(let head=0;head<queue.length&&head<18000;head++){
        const node=queue[head],x=from.x+node.x*.5,z=from.z+node.z*.5;
        if(head&&!overlaps(x,z,all)){last=head;break;}
        for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=node.x+dx,nz=node.z+dz,key=nx+':'+nz,xx=from.x+nx*.5,zz=from.z+nz*.5;
          if(seen.has(key)||Math.abs(xx)>limitX||Math.abs(zz)>limitZ||overlaps(xx,zz,foundations)||overlaps((x+xx)/2,(z+zz)/2,foundations))continue;
          seen.add(key);queue.push({x:nx,z:nz,parent:head});
        }
      }
      if(last<0)return null;
      const path=[];for(let i=last;i>=0;i=queue[i].parent)path.push(new THREE.Vector3(from.x+queue[i].x*.5,from.y,from.z+queue[i].z*.5));path.reverse();
      return path.filter((point,i)=>!i||i===path.length-1||!point.clone().sub(path[i-1]).normalize().equals(path[i+1].clone().sub(point).normalize()));
    }
    returnToStart(poses,openFragile=[]){
      this.clearReturnFlight();
      if(!poses?.length||this.reducedMotion)return Promise.resolve(true);
      const targets=this.blocks.children.slice(),group=new THREE.Group();this.scene.add(group);
      const destination=targets[0]?.position.clone()||new THREE.Vector3(0,1,0),rotation=targets[0]?.quaternion.clone()||new THREE.Quaternion();
      const crest=Math.max(3.4,...poses.map(p=>p.position.y+1.4),destination.y+2.4);
      const actors=poses.map((pose,i)=>{
        const obj=this.createBlock(pose.cube);obj.position.copy(pose.position);obj.quaternion.copy(pose.rotation);group.add(obj);
        const to=destination.clone();if(poses.length===2&&targets.length===1)to.y+=(i? .5:-.5);
        else if(targets[i])to.copy(targets[i].position);
        const underwater=pose.position.y<(this.water?.position.y??-.85);let route=underwater?this.waterReturnRoute(obj,pose.position):null,escapeRotation=pose.rotation.clone(),deep=pose.position.clone(),prelude=false;
        if(underwater&&!route){
          // A narrow flooded pocket may only fit the upright block. Rotate at
          // bed level first; the collapsed tile stays open until it has cleared.
          prelude=true;escapeRotation.copy(rotation);obj.quaternion.copy(escapeRotation);obj.updateMatrixWorld(true);
          const bounds=new THREE.Box3().setFromObject(obj);deep.y+=(this.seabed?.position.y??-2.6)+.002-bounds.min.y;obj.position.copy(deep);obj.updateMatrixWorld(true);
          route=this.waterReturnRoute(obj,deep)||[deep.clone()];obj.position.copy(pose.position);obj.quaternion.copy(pose.rotation);
        }
        const lift=pose.position.clone();
        if(route?.length)lift.copy(route.at(-1));
        const lengths=[0];if(route)for(let j=1;j<route.length;j++)lengths.push(lengths[j-1]+route[j].distanceTo(route[j-1]));
        const travelEnd=underwater&&route?.length>1?.36:prelude?.16:0;
        return {obj,from:pose.position.clone(),rotation:pose.rotation.clone(),escapeRotation,prelude,deep,to,underwater,route,lengths,lift,travelEnd,overFrom:new THREE.Vector3(lift.x,crest,lift.z),overTo:new THREE.Vector3(to.x,crest,to.z)};
      });
      targets.forEach(obj=>obj.visible=false);openFragile.forEach(tile=>tile.visible=false);
      return new Promise(resolve=>{
        let frame=0,done=false;const start=performance.now(),duration=actors.some(actor=>actor.underwater)?1500:1050;
        const finish=ok=>{if(done)return;done=true;cancelAnimationFrame(frame);this.scene.remove(group);group.clear();targets.forEach(obj=>obj.visible=true);openFragile.forEach(tile=>tile.visible=true);if(this.returnFlight?.group===group)this.returnFlight=null;this.shadowDirty=true;resolve(ok);};
        this.returnFlight={group,finish};
        const step=now=>{
          const t=Math.min(1,(now-start)/duration);
          for(const actor of actors){
            if(actor.prelude&&t<.16){
              const k=ease(t/.16);actor.obj.position.lerpVectors(actor.from,actor.deep,k);actor.obj.quaternion.slerpQuaternions(actor.rotation,actor.escapeRotation,k);actor.obj.updateMatrixWorld(true);
              const box=new THREE.Box3().setFromObject(actor.obj);actor.obj.position.y+=Math.max(0,(this.seabed?.position.y??-2.6)+.002-box.min.y);
            }
            else if(actor.underwater&&actor.route&&t<actor.travelEnd){
              const start=actor.prelude?.16:0,distance=ease((t-start)/(actor.travelEnd-start))*actor.lengths.at(-1);let segment=1;
              while(segment<actor.lengths.length-1&&actor.lengths[segment]<distance)segment++;
              if(actor.route.length===1)actor.obj.position.copy(actor.route[0]);
              else{const k=(distance-actor.lengths[segment-1])/Math.max(.0001,actor.lengths[segment]-actor.lengths[segment-1]);actor.obj.position.lerpVectors(actor.route[segment-1],actor.route[segment],k);}
              actor.obj.quaternion.copy(actor.escapeRotation);
            }
            else if(t<.66){const start=actor.travelEnd,k=ease((t-start)/(.66-start)),from=actor.underwater&&actor.route?actor.lift:actor.from;actor.obj.position.copy(from);actor.obj.position.y=from.y+(crest-from.y)*k;actor.obj.quaternion.copy(actor.escapeRotation);}
            else if(t<.84){const k=ease((t-.66)/.18);actor.obj.position.lerpVectors(actor.overFrom,actor.overTo,k);actor.obj.position.y+=Math.sin(k*Math.PI)*.45;actor.obj.quaternion.slerpQuaternions(actor.escapeRotation,rotation,k);}
            else{const k=ease((t-.84)/.16);actor.obj.position.copy(actor.to);actor.obj.position.y=crest+(actor.to.y-crest)*k;actor.obj.quaternion.copy(rotation);}
          }
          if(t>.66)openFragile.forEach(tile=>tile.visible=true);
          this.shadowDirty=true;this.render();
          if(t<1)frame=requestAnimationFrame(step);else{finish(true);this.render();}
        };
        this.render();frame=requestAnimationFrame(step);
      });
    }
    updateBoard(st) {
      this.shadowDirty=true;
      st.bridges.forEach((open,i)=>(this.bridgeGroups.get(i)||[]).forEach(g=>{g.visible=open;}));
      const cells=st.orientation==='SPLIT'?[[st.r,st.c],[st.r2,st.c2]]:st.orientation==='HORIZONTAL'?[[st.r,st.c],[st.r,st.c+1]]:st.orientation==='VERTICAL'?[[st.r,st.c],[st.r+1,st.c]]:[[st.r,st.c]];
      this.switches.forEach(sw=>{const pressed=cells.some(([r,c])=>r===sw.r&&c===sw.c)&&(sw.type===3||st.orientation==='STANDING');sw.button.position.y=pressed?-.018:.025;});
    }
    cancel() {if(this.cancelAnimation)this.cancelAnimation();this.cancelAnimation=null;this.clearFragileBreaks();this.clearReturnFlight();}
    tween(duration,update) {
      if(this.cancelAnimation)this.cancelAnimation();this.cancelAnimation=null;
      return new Promise(resolve=>{
        let raf=0,finished=false;const start=performance.now();
        const end=value=>{if(finished)return;finished=true;cancelAnimationFrame(raf);this.cancelAnimation=null;resolve(value);};
        this.cancelAnimation=()=>end(false);
        const step=now=>{const elapsed=(now-start)/duration,t=Math.min(1,elapsed),settled=update(t,elapsed);this.render();if(t<1||settled===false)raf=requestAnimationFrame(step);else end(true);};
        raf=requestAnimationFrame(step);
      });
    }
    async roll(prev,action,next,valid,failureState=null) {
      if(action==='SPACE'){this.showState(next);return true;}
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
      B.sound?.(JSON.stringify(prev.bridges)!==JSON.stringify(next.bridges)?'switch':'roll');this.showState(next);return true;
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
    clearSplashes(){for(const effect of this.splashes||[])effect.dispose();this.splashes=[];}
    clearFragileBreaks(){for(const effect of [...this.fragileBreaks||[]])effect.dispose();this.fragileBreaks=[];}
    breakFragile(tile){
      if(!tile)return null;
      this.fragileBreaks=this.fragileBreaks||[];
      const existing=this.fragileBreaks.find(effect=>effect.tile===tile);if(existing)return existing;
      const group=new THREE.Group();tile.updateWorldMatrix(true,false);tile.getWorldPosition(group.position);tile.getWorldQuaternion(group.quaternion);this.scene.add(group);
      // Eight irregular wedges tessellate one tile. Reuse their geometry between
      // failures; only the transient groups/meshes belong to this animation.
      const rim=[[-.48,-.48],[.04,-.48],[.48,-.48],[.48,.08],[.48,.48],[-.09,.48],[-.48,.48],[-.48,-.06]],center=[.035,-.025];
      const pieces=rim.map((a,i)=>{
        const b=rim[(i+1)%rim.length],cx=(a[0]+b[0]+center[0])/3,cz=(a[1]+b[1]+center[1])/3;
        const geo=this.geometry('fragile-shard-'+i,()=>{
          const shape=new THREE.Shape();shape.moveTo(center[0],-center[1]);shape.lineTo(a[0],-a[1]);shape.lineTo(b[0],-b[1]);shape.closePath();
          const g=new THREE.ExtrudeGeometry(shape,{depth:.184,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1,steps:1,material:0,extrudeMaterial:1});
          g.rotateX(-Math.PI/2);g.translate(-cx,-.092,-cz);
          // Sample the unbroken tile's top texture in tile coordinates.
          const p=g.attributes.position,uv=g.attributes.uv,n=g.attributes.normal;
          for(let j=0;j<p.count;j++)if(Math.abs(n.getY(j))>.9)uv.setXY(j,p.getX(j)+cx+.5,p.getZ(j)+cz+.5);
          return g;
        });
        const mesh=new THREE.Mesh(geo,[this.materials.fragile,this.materials.dark]);mesh.position.set(cx,-.096,cz);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
        mesh.scale.set(.94,1,.94);
        return {mesh,cx,cz,axis:new THREE.Vector3(cz+.07,.25,cx-.08).normalize(),turn:(i%2?1:-1)*(.45+i*.07)};
      });
      const wasVisible=tile.visible;tile.visible=false;this.shadowDirty=true;
      let disposed=false;
      const effect={tile,group,pieces,update:t=>{
        if(disposed)return;
        const scatter=this.reducedMotion?0:Math.max(0,t-.24),fall=8.5*t*t;
        for(const p of pieces){
          p.mesh.position.set(p.cx*(1+scatter*.42),-.096-fall*(1+(this.reducedMotion?0:(p.cx+.48)*.12)),p.cz*(1+scatter*.42));
          p.mesh.quaternion.setFromAxisAngle(p.axis,p.turn*scatter);
        }
        this.shadowDirty=true;
      },dispose:()=>{
        if(disposed)return;disposed=true;this.scene.remove(group);group.clear();tile.visible=wasVisible;
        this.fragileBreaks=this.fragileBreaks.filter(item=>item!==effect);this.shadowDirty=true;
      }};
      this.fragileBreaks.push(effect);return effect;
    }
    waterImpact(plan){
      if(plan.waterHit||!this.water)return;
      plan.obj.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(plan.obj);
      if(box.min.y>this.water.position.y)return;
      plan.waterHit=true;this.splashAt((box.min.x+box.max.x)/2,(box.min.z+box.max.z)/2,Math.min(1.3,Math.max(box.max.x-box.min.x,box.max.z-box.min.z)));
    }
    splashAt(x,z,size=1){
      if(!this.water)return;this.splashes=this.splashes||[];
      const group=new THREE.Group(),waterY=this.water.position.y+.025;group.position.set(x,waterY,z);this.scene.add(group);
      B.sound?.('splash');
      // Soft, broken ripples blend into the surface instead of white vector rings.
      const rippleMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{age:{value:0},strength:{value:1}},vertexShader:'varying vec2 v;void main(){v=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:`varying vec2 v;uniform float age;uniform float strength;
         void main(){float a=atan(v.y,v.x),r=length(v);float warp=.012*sin(a*7.+age*3.)+.008*cos(a*11.);
          float wave=exp(-pow((r+warp-(.12+age*.72))/.018,2.));
          float second=exp(-pow((r-warp-(age*.70-.04))/.025,2.))*.45;
          float broken=.5+.5*sin(a*5.+r*17.);float alpha=(wave+second)*(.14+.13*broken)*pow(1.-age,1.5)*strength;
          gl_FragColor=vec4(.48,.83,.84,alpha);}`});
      const ripple=new THREE.Mesh(this.geometry('impact-soft-plane',()=>new THREE.PlaneGeometry(1,1)),rippleMat);ripple.rotation.x=-Math.PI/2;ripple.scale.setScalar(size*5);group.add(ripple);
      const crownMat=new THREE.MeshStandardMaterial({color:0x71c4ce,roughness:.28,metalness:.02,transparent:true,opacity:.50,depthWrite:false,side:THREE.DoubleSide});
      const crownGeo=new THREE.BufferGeometry(),positions=new Float32Array(64*6*3);crownGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
      const crown=new THREE.Mesh(crownGeo,crownMat);crown.frustumCulled=false;group.add(crown);
      const dropMat=new THREE.MeshStandardMaterial({color:0x8dd3d9,roughness:.25,transparent:true,opacity:.65,depthWrite:false});
      const drops=[];if(!this.reducedMotion)for(let i=0;i<18;i++){const a=i*2.39996,drop=new THREE.Mesh(this.geometry('impact-drop',()=>new THREE.SphereGeometry(1,7,5)),dropMat);drop.scale.set(.025,.05,.025);group.add(drop);drops.push({mesh:drop,a,speed:.55+(i%5)*.18,up:1.4+(i%4)*.23});}
      let raf=0,dead=false;const start=performance.now(),duration=this.reducedMotion?400:1450;
      const effect={dispose:()=>{if(dead)return;dead=true;cancelAnimationFrame(raf);this.scene.remove(group);rippleMat.dispose();crownMat.dispose();crownGeo.dispose();dropMat.dispose();this.splashes=this.splashes.filter(x=>x!==effect);}};this.splashes.push(effect);
      const frame=now=>{if(dead)return;const elapsed=(now-start)/1000,t=Math.min(1,(now-start)/duration);
        rippleMat.uniforms.age.value=t;
        const ct=Math.min(1,elapsed/.48),radius=size*(.16+ct*.58),height=this.reducedMotion?0:Math.sin(ct*Math.PI)*.34*size;
        crown.visible=ct<1;crownMat.opacity=.45*(1-ct);
        const point=(angle,top)=>{const uneven=.92+.06*Math.sin(angle*3.+.7)+.035*Math.cos(angle*5.-.4),rr=radius*uneven*(top?1.12:1),h=top?height*(.52+.22*Math.sin(angle*3.+.6)+.14*Math.cos(angle*5.-.8)):.005;return [Math.cos(angle)*rr,h,Math.sin(angle)*rr];};
        for(let j=0;j<64;j++){const a=j*Math.PI/32,b=(j+1)*Math.PI/32,verts=[point(a,false),point(b,false),point(a,true),point(b,false),point(b,true),point(a,true)];positions.set(verts.flat(),j*18);}crownGeo.attributes.position.needsUpdate=true;crownGeo.computeVertexNormals();
        for(const drop of drops){const r=drop.speed*elapsed*size,y=drop.up*elapsed-3.8*elapsed*elapsed;drop.mesh.position.set(Math.cos(drop.a)*r,Math.max(-.04,y),Math.sin(drop.a)*r);drop.mesh.visible=y>=-.04;drop.mesh.scale.y=.05*Math.max(.4,1-elapsed*.6);drop.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(drop.a)*drop.speed,drop.up-7.6*elapsed,Math.sin(drop.a)*drop.speed).normalize());}dropMat.opacity=.65*(1-t);
        this.render();if(t<1)raf=requestAnimationFrame(frame);else effect.dispose();
      };raf=requestAnimationFrame(frame);return effect;
    }
    clearRestingPoint(obj,position,rotation,restRotation){
      const foundations=[];
      for(const [key,tile]of this.tiles){const [r,c]=key.split(',').map(Number);if([1,3,4,5].includes(this.level.grid[r][c]))foundations.push(tile.position);}
      const half=(q,pad)=>{obj.quaternion.copy(q);obj.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(obj);return {x:(box.max.x-box.min.x)/2+pad,z:(box.max.z-box.min.z)/2+pad};};
      const start=half(rotation,.002),end={x:0,z:0};
      // The diagonal sweep is wider than the final lying pose. Reserve room
      // for the entire lean, otherwise a corner can wedge against masonry.
      for(let i=0;i<=8;i++){const q=new THREE.Quaternion();q.slerpQuaternions(rotation,restRotation,i/8);const extent=half(q,.045);end.x=Math.max(end.x,extent.x);end.z=Math.max(end.z,extent.z);}
      obj.quaternion.copy(rotation);
      const free=(x,z,h)=>!foundations.some(p=>Math.abs(x-p.x)<h.x+.49&&Math.abs(z-p.z)<h.z+.49);
      if(free(position.x,position.z,end))return position.clone();
      for(let radius=.15;radius<=4.51;radius+=.15)for(let i=0;i<24;i++){
        const angle=i*Math.PI/12,x=position.x+Math.cos(angle)*radius,z=position.z+Math.sin(angle)*radius;
        if(!free(x,z,end))continue;
        let clear=true;for(let step=1;step<=8;step++){const t=step/8;if(!free(position.x+(x-position.x)*t,position.z+(z-position.z)*t,start)){clear=false;break;}}
        if(clear)return new THREE.Vector3(x,position.y,z);
      }
      return position.clone();
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
            p.obj.quaternion.copy(p.rotation).premultiply(q);this.waterImpact(p);
          }
        }))return false;
      }
      const waterY=this.water?.position.y??-.85,bedY=this.seabed?.position.y??-2.6;
      const starts=plans.map(p=>{
        const bounds=new THREE.Box3().setFromObject(p.obj),position=p.obj.position.clone(),entry=position.clone();entry.y-=Math.max(0,bounds.min.y-waterY);
        const half=position.y-bounds.min.y,rotation=p.obj.quaternion.clone(),restRotation=rotation.clone();
        if(bounds.max.y-bounds.min.y>1.5)restRotation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
        const drop=Math.max(0,position.y-entry.y),airTime=Math.sqrt(2*drop/9.8);
        p.obj.quaternion.copy(restRotation);p.obj.updateMatrixWorld(true);const restBounds=new THREE.Box3().setFromObject(p.obj),restY=bedY+.015+(position.y-restBounds.min.y);p.obj.quaternion.copy(rotation);
        const restingPoint=this.clearRestingPoint(p.obj,position,rotation,restRotation);
        // An edge tip may already cross the surface. Carry its downward motion
        // into drag instead of starting the underwater curve at zero velocity.
        const impact=airTime>0?9.8*airTime:p.pivot?3.2:1.2;
        return {...p,position,entry,half,rotation,restRotation,restingPoint,airTime,impact,restY,lean:0,drift:0};
      });
      const breaks=[...new Set(plans.flatMap(p=>p.fragile||[]).filter(Boolean))].map(tile=>this.breakFragile(tile));
      const waterTime=1.8,total=Math.max(...starts.map(p=>p.airTime))+waterTime;let previous=0;
      const intersectsFloor=obj=>{
        obj.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(obj);
        for(const [key,tile]of this.tiles){if(!tile.visible)continue;const [r,c]=key.split(',').map(Number),type=this.level.grid[r][c];if(type===9)continue;
          const depth=[1,3,4,5].includes(type)?Math.abs(bedY):type===2?.20:.38;
          if(bounds.max.y<=-depth-.006||bounds.min.y>=.006)continue;
          if(bounds.max.x>tile.position.x-.495&&bounds.min.x<tile.position.x+.495&&bounds.max.z>tile.position.z-.495&&bounds.min.z<tile.position.z+.495)return true;
        }return false;
      };
      const ok=await this.tween(this.reducedMotion?230:total*1000,(t,elapsed=t)=>{
        const seconds=elapsed*total,dt=Math.max(0,seconds-previous);previous=seconds;
        for(const effect of breaks)effect.update(Math.min(1,t*1.8));
        for(const p of starts){
          p.obj.position.copy(p.position);p.obj.quaternion.copy(p.rotation);
          if(seconds<p.airTime){p.obj.position.y-=.5*9.8*seconds*seconds;}
          else{
            const k=Math.min(1,(seconds-p.airTime)/waterTime),delta=p.restY-p.entry.y,m0=-Math.min(p.impact*waterTime,Math.abs(delta)*2.7);
            const y=(2*k*k*k-3*k*k+1)*p.entry.y+(k*k*k-2*k*k+k)*m0+(-2*k*k*k+3*k*k)*p.restY;
            const drift=ease(Math.min(1,k/.5));
            const desired=this.reducedMotion?1:Math.min(ease(k),p.lean+dt*1.4);
            const pose=(lean,move=p.drift)=>{p.obj.position.set(p.entry.x+(p.restingPoint.x-p.entry.x)*move,y,p.entry.z+(p.restingPoint.z-p.entry.z)*move);p.obj.quaternion.slerpQuaternions(p.rotation,p.restRotation,lean);p.obj.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(p.obj);p.obj.position.y+=Math.max(0,bedY+.015-bounds.min.y);};
            pose(0,drift);
            if(intersectsFloor(p.obj)){let low=0,high=drift;for(let i=0;i<8;i++){const mid=(low+high)/2;pose(0,mid);if(intersectsFloor(p.obj))high=mid;else low=mid;}p.drift=low;}
            else p.drift=drift;
            pose(desired);
            if(intersectsFloor(p.obj)){
              let low=0,high=desired;
              for(let i=0;i<7;i++){const mid=(low+high)/2;pose(mid);if(intersectsFloor(p.obj))high=mid;else low=mid;}
              p.lean=low;pose(low);
            }else p.lean=desired;
          }
          this.waterImpact(p);
        }
        if(t===1&&!this.reducedMotion&&elapsed<1.7){
          const complete=starts.every(p=>{p.obj.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(p.obj);return bounds.max.y<waterY-.025&&p.lean>.995;});
          if(!complete)return false;
        }
      });
      for(const effect of breaks)effect.dispose();
      if(ok){for(const p of plans){p.obj.visible=true;p.obj.userData.submerged=true;for(const tile of p.fragile||[])if(tile)tile.visible=false;}this.render();}
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
      obj.visible=false;clones.forEach(m=>m.dispose());if(ok)B.sound?.('win');this.render();return ok;
    }
  }
  B.GameScene=GameScene;
})();
