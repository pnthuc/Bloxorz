/* Presentation only. API states are never inferred from animation or collision results. */
(() => {
  'use strict';
  const B=window.Bloxorz,V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),Q=()=>new THREE.Quaternion();
  const directions={UP:[0,-1],DOWN:[0,1],LEFT:[-1,0],RIGHT:[1,0]};
  const smooth=t=>t*t*(3-2*t);
  const axes=[V(1,0,0),V(0,1,0),V(0,0,1)];
  // Full 15-axis separating-axis test for a moving oriented block and an intact slab.
  B.intersectsSlab=(position,rotation,cube,slab)=>{
    const basis=axes.map(a=>a.clone().applyQuaternion(rotation));
    const half=cube?[.47,.47,.47]:[.47,.97,.47],bh=[.484,.19,.484];
    const delta=V(slab.x,slab.y??-.19,slab.z).sub(position);
    const candidates=[...axes,...basis];for(const a of axes)for(const b of basis)candidates.push(a.clone().cross(b));
    return candidates.every(a=>{
      if(a.lengthSq()<1e-10)return true;a.normalize();
      const ra=half.reduce((sum,h,i)=>sum+h*Math.abs(a.dot(basis[i])),0);
      const rb=bh.reduce((sum,h,i)=>sum+h*Math.abs(a.dot(axes[i])),0);
      return Math.abs(delta.dot(a))<ra+rb-.0005;
    });
  };
  B.Motion={
    opacity(group,value){
      group.traverse(child=>{
        if(!child.isMesh)return;
        if(!child.userData.fadeMaterials){
          const clone=m=>{const copy=m.clone();copy.transparent=true;return copy;};
          child.material=Array.isArray(child.material)?child.material.map(clone):clone(child.material);child.userData.fadeMaterials=true;
        }
        (Array.isArray(child.material)?child.material:[child.material]).forEach(m=>{m.opacity=value;m.depthWrite=value>=1;});
      });
    },
    releaseVisuals(group){group.traverse(child=>{if(child.userData.fadeMaterials)(Array.isArray(child.material)?child.material:[child.material]).forEach(m=>m.dispose());});},
    cancel(){if(this.cancelAnimation)this.cancelAnimation();this.cancelAnimation=null;},
    tween(duration,update){
      this.cancel();duration=Math.max(1,duration);
      return new Promise(resolve=>{
        let raf=0,finished=false,last=null,elapsed=0;
        const end=value=>{if(finished)return;finished=true;cancelAnimationFrame(raf);this.cancelAnimation=null;resolve(value);};
        this.cancelAnimation=()=>end(false);
        const step=now=>{
          // Pause while hidden. Limit resume gaps; ordinary 15–60 fps remains time based.
          const delta=last===null?0:Math.min(.033,Math.max(0,(now-last)/1000))*1000;last=now;
          if(!document.hidden)elapsed+=delta;
          const t=Math.min(1,elapsed/duration);update(t);this.render();
          if(t<1)raf=requestAnimationFrame(step);else end(true);
        };raf=requestAnimationFrame(step);
      });
    },
    capture(){return {rotation:this.rotation.clone(),cubes:this.cubeRotations.map(q=>q.clone()),camera:{target:this.target.clone(),azimuth:this.azimuth,elevation:this.elevation,zoom:this.zoom,distance:this.distance}};},
    restore(st,snapshot){
      this.cancel();this.build(this.level,st);
      if(snapshot){this.rotation.copy(snapshot.rotation);snapshot.cubes.forEach((q,i)=>this.cubeRotations[i].copy(q));Object.assign(this,snapshot.camera);this.target=snapshot.camera.target.clone();this.setCamera();}
      this.showState(st);
    },
    async animateBoard(prev,next){
      const changed=[];
      next.bridges.forEach((open,i)=>{if(open===prev.bridges[i])return;for(const group of this.bridgeGroups.get(i)||[])changed.push({group,open});});
      if(!changed.length)return true;
      changed.forEach(({group})=>{group.visible=true;});
      const ok=await this.tween(this.reducedMotion?65:180,t=>changed.forEach(({group,open})=>{
        const amount=open?smooth(t):1-smooth(t);group.scale.x=Math.max(.02,amount);group.position.y=-.3*(1-amount);
      }));
      if(ok)changed.forEach(({group,open})=>{group.visible=open;group.scale.set(1,1,1);group.position.y=0;});return ok;
    },
    visualCandidate(prev,action){
      const [dx,dz]=directions[action];
      if(prev.orientation==='SPLIT'){const s={...prev};if(prev.active_cube){s.r2+=dz;s.c2+=dx;}else{s.r+=dz;s.c+=dx;}return s;}
      const obj=this.blocks.children[0],extent=V();
      const q=obj.quaternion;
      axes.forEach((a,i)=>{const v=a.clone().applyQuaternion(q);const length=i===1?2:1;extent.x+=Math.abs(v.x)*length;extent.z+=Math.abs(v.z)*length;});
      const w=Math.round(extent.x),d=Math.round(extent.z),c=Math.round(obj.position.x+(this.level.grid[0].length-1)/2-(w-1)/2),r=Math.round(obj.position.z+(this.level.grid.length-1)/2-(d-1)/2);
      return {...prev,r,c,orientation:w===2?'HORIZONTAL':d===2?'VERTICAL':'STANDING'};
    },
    async roll(prev,action,next,valid,failureState=null){
      this.clearLinks?.();
      if(action==='SPACE'){this.showState(next);B.sound?.('roll');return true;}
      const objects=this.blocks.children.slice(),index=prev.orientation==='SPLIT'?prev.active_cube:0,obj=objects[index],pos=this.placements(prev)[index];
      const [dx,dz]=directions[action],axis=V(dz,0,-dx),angle=Math.PI/2;
      this.pivot.position.set(pos.x+dx*pos.w/2,0,pos.z+dz*pos.d/2);this.pivot.quaternion.identity();
      this.scene.updateMatrixWorld(true);this.pivot.attach(obj);
      // Accelerate through the tipping point and soften only the final contact.
      const ok=await this.tween((this.reducedMotion?70:215)/(this.playbackSpeed||1),t=>{
        const weight=t<.72?.85*Math.pow(t/.72,1.35):.85+.15*Math.sin((t-.72)/.28*Math.PI/2);
        this.pivot.quaternion.setFromAxisAngle(axis,angle*weight);
      });if(!ok)return false;
      this.scene.updateMatrixWorld(true);this.blocks.attach(obj);this.pivot.clear();this.pivot.quaternion.identity();
      const turn=Q().setFromAxisAngle(axis,angle);
      if(prev.orientation==='SPLIT')this.cubeRotations[index].premultiply(turn).normalize();else this.rotation.premultiply(turn).normalize();
      B.sound?.('roll');
      const candidate=failureState||(!valid?this.visualCandidate(prev,action):next);
      if(!valid){
        const cells=candidate.orientation==='HORIZONTAL'?[[candidate.r,candidate.c],[candidate.r,candidate.c+1]]:candidate.orientation==='VERTICAL'?[[candidate.r,candidate.c],[candidate.r+1,candidate.c]]:[];
        this.markers.clear();this.lastFailure=this.level.grid[candidate.r]?.[candidate.c]===2&&candidate.orientation==='STANDING'?'fragile':failureState?'bridge_closed':cells.filter(([r,c])=>this.isSupported(r,c,candidate)).length===1?'partial':'unsupported';
        this.container.dispatchEvent(new CustomEvent('bloxorz:fall',{detail:this.lastFailure}));
        if(failureState)return this.fallAfterSwitch(candidate,objects,prev,dx,dz);
        return this.fall(obj,dx,dz,candidate);
      }
      if(prev.orientation!=='SPLIT'&&next.orientation==='SPLIT'){
        const landing=this.rotation.clone();this.cubeRotations.forEach(q=>q.copy(landing));
        if(!await this.teleport(obj,next))return false;
      }else if(prev.orientation==='SPLIT'&&next.orientation!=='SPLIT'){
        // Keep both cubes in contact while the joined body grows into their volume.
        this.rotation.copy(this.canonicalRotation(next.orientation));
        const p=this.placements(next)[0],joined=this.createBlock(false);joined.position.set(p.x,p.y,p.z);joined.quaternion.copy(this.rotation);this.opacity(joined,0);this.blocks.add(joined);
        const merged=await this.tween(this.reducedMotion?40:160,t=>{this.opacity(joined,smooth(t));objects.forEach(o=>this.opacity(o,1-smooth(t)));});if(!merged)return false;
      }
      if(!await this.animateBoard(prev,next))return false;
      this.showState(next);return true;
    },
    async teleport(obj,next){
      const source=obj.position.clone(),q=obj.quaternion.clone();
      const cubes=[this.createBlock(true),this.createBlock(true)],dest=this.placements(next);
      // Upper and lower halves separate at the source, then follow visible arcs.
      cubes.forEach((cube,i)=>{cube.position.copy(source).add(V(0,i?-.5:.5,0));cube.quaternion.copy(q);this.blocks.add(cube);this.opacity(cube,0);});
      return this.tween(this.reducedMotion?110:480,t=>{
        cubes.forEach((cube,i)=>{const p=dest[i],start=source.clone().add(V(0,i?-.5:.5,0));const travel=Math.max(0,(t-.2)/.8);this.opacity(cube,Math.min(1,t/.2));this.opacity(obj,Math.max(0,1-t/.2));cube.position.lerpVectors(start,V(p.x,p.y,p.z),smooth(travel));cube.position.y+=Math.sin(Math.PI*travel)*(1.0+i*.45);});
      });
    },
    async fallAfterSwitch(st,objects,prev,dx=1,dz=0){
      objects.forEach(obj=>{if(obj.parent!==this.blocks)this.blocks.attach(obj);});this.pivot.clear();this.markers.clear();
      if(!await this.animateBoard(prev||{bridges:st.bridges.map(()=>true)},st))return false;
      this.updateBoard(st);this.render();
      const supported=(r,c)=>this.isSupported(r,c,st);
      const falling=st.orientation==='SPLIT'?objects.filter((o,i)=>!supported(i?st.r2:st.r,i?st.c2:st.c)):objects;
      return this.dropObjects(falling,dx,dz,st);
    },
    isSupported(r,c,st){const type=this.level.grid[r]?.[c];return !!type&&(type<10||st.bridges[type-10]);},
    async fall(obj,dx,dz,st){
      const fragile=st.orientation==='STANDING'&&this.level.grid[st.r]?.[st.c]===2?this.tiles.get(`${st.r},${st.c}`):null;
      if(fragile){
        const cracks=new THREE.Group(),mat=this.materials.crack;
        for(const a of [.3,1.8,3.6]){const line=this.box(.82,.008,.022,mat,.001);line.rotation.y=a;line.position.y=.012;cracks.add(line);}fragile.add(cracks);
        if(!await this.tween(this.reducedMotion?35:130,t=>{cracks.scale.setScalar(.1+.9*t);fragile.position.y=-.04*t;}))return false;
        // Slab breaks into four pieces; their bottom moves faster than the block.
        const debris=[];for(const x of [-.25,.25])for(const z of [-.25,.25]){const bit=this.box(.46,.17,.46,this.materials.fragile,.02);bit.position.copy(fragile.position).add(V(x,-.08,z));this.board.add(bit);debris.push({bit,start:bit.position.clone(),x,z});}fragile.visible=false;
        this.debris=debris;
      }
      return this.dropObjects([obj],dx,dz,st,fragile);
    },
    async dropObjects(objects,dx,dz,st,fragile=null){
      const starts=objects.map(obj=>({obj,position:obj.position.clone(),rotation:obj.quaternion.clone(),cube:st.orientation==='SPLIT'}));
      if(!starts.length)return true;
      const slabs=[];
      for(const [key,g] of this.tiles){const [r,c]=key.split(',').map(Number);if(g.visible&&this.isSupported(r,c,st)&&this.level.grid[r][c]!==9)slabs.push({x:g.position.x,z:g.position.z,y:-.19});}
      objects.forEach(obj=>this.opacity(obj,1));this.collisionDiagnostics={samples:0,contacts:0,penetrations:0};
      const collides=(p,q,cube)=>slabs.some(s=>Math.abs(s.x-p.x)<3&&Math.abs(s.z-p.z)<3&&B.intersectsSlab(p,q,cube,s));
      // A two-cell block with one supporting tile pivots about that tile's exposed edge.
      let tip=null;
      if(st.orientation==='HORIZONTAL'||st.orientation==='VERTICAL'){
        const cells=st.orientation==='HORIZONTAL'?[[st.r,st.c],[st.r,st.c+1]]:[[st.r,st.c],[st.r+1,st.c]];
        const support=cells.filter(([r,c])=>this.isSupported(r,c,st));
        if(support.length===1){const s=this.world(...support[0]),p=starts[0].position;
          dx=Math.sign(p.x-s.x);dz=Math.sign(p.z-s.z);tip={pivot:V(s.x+dx*.485,.03,s.z+dz*.485),axis:V(dz,0,-dx)};
        }
      }
      if(tip){
        const s=starts[0],offset=s.position.clone().sub(tip.pivot);
        if(!await this.tween(this.reducedMotion?70:340,t=>{
          const q=Q().setFromAxisAngle(tip.axis,Math.PI/2*t*t),p=offset.clone().applyQuaternion(q).add(tip.pivot),rotation=s.rotation.clone().premultiply(q);
          this.collisionDiagnostics.samples++;if(!collides(p,rotation,s.cube)){s.obj.position.copy(p);s.obj.quaternion.copy(rotation);}else this.collisionDiagnostics.contacts++;
        }))return false;
        s.position.copy(s.obj.position);s.rotation.copy(s.obj.quaternion);
      }
      const targetStart=this.target.clone(),elevationStart=this.elevation;
      const duration=this.reducedMotion?170:640;
      let lastT=0,velocity=0;
      const ok=await this.tween(duration,t=>{
        const elapsed=(t-lastT)*.80,last=lastT;lastT=t;
        // Small physics substeps prevent tunnelling when a frame arrives late.
        const steps=Math.max(1,Math.ceil(elapsed/.008)),dt=elapsed/steps;
        for(let k=0;k<steps;k++){
          velocity+=23*dt;
          for(const s of starts){
            const confined=!!fragile&&s.obj.position.y>-.75;
            const position=s.obj.position.clone().add(V(confined?0:dx*dt*.7,-velocity*dt,confined?0:dz*dt*.7));
            const rotation=s.obj.quaternion.clone().premultiply(Q().setFromAxisAngle(V(dz,0,-dx),dt*(confined?0:tip?.25:.7)));
            this.collisionDiagnostics.samples++;
            if(!collides(position,rotation,s.cube)){s.obj.position.copy(position);s.obj.quaternion.copy(rotation);}
            else{
              this.collisionDiagnostics.contacts++;
              // Contact locks angular motion while the block slides past a slab edge.
              if(!collides(position,s.obj.quaternion,s.cube))s.obj.position.copy(position);
              else{
                const vertical=s.obj.position.clone().add(V(0,-velocity*dt,0));
                if(!collides(vertical,s.obj.quaternion,s.cube))s.obj.position.copy(vertical);
                else{const slide=s.obj.position.clone().add(V(dx*dt*.8,0,dz*dt*.8));if(!collides(slide,s.obj.quaternion,s.cube))s.obj.position.copy(slide);}
              }
            }
          }
        }
        for(const {bit,start,x,z} of this.debris||[]){bit.position.copy(start).add(V(x*t*.45,-.08-11*t*t,z*t*.45));bit.rotation.set(x*t*2,0,z*t*2);}
        if(this.deathCamera&&!this.reducedMotion){this.target.copy(targetStart);this.target.y-=Math.min(.9,t*t*1.1);this.elevation=elevationStart+.025*smooth(t);this.setCamera();}
        objects.forEach(obj=>this.opacity(obj,1-Math.max(0,(t-.8)/.2)));if(last===0)B.sound?.('fall');
      });
      if(ok){objects.forEach(obj=>obj.visible=false);this.markers.clear();this.render();}return ok;
    },
    async victory(){
      const obj=this.blocks.children[0];if(!obj)return true;
      B.sound?.('win');const start=obj.position.y;
      // Geometry fits inside the .99-wide shaft. No clipping plane hides intersections.
      const light=new THREE.PointLight(0x91d9ee,0,5);light.position.copy(obj.position);light.position.y=.5;this.scene.add(light);
      const ok=await this.tween(this.reducedMotion?130:520,t=>{obj.position.y=start-3.2*t*t;this.opacity(obj,1-Math.max(0,(t-.72)/.28));light.intensity=Math.sin(Math.PI*t)*2;});
      this.scene.remove(light);if(ok)obj.visible=false;this.render();return ok;
    }
  };
})();
