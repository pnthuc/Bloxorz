/* Three.js r128 scene for Bloxorz Ha Long Bay Edition (v2).
 * Renders the floating karst stone island, carved emerald jade block, and golden goal portal
 * with dynamic soft shadows, warm golden sunlight chiaroscuro, and contact ambient shading. */
(() => {
  'use strict';
  const B = window.Bloxorz;
  const directions = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };
  const ease = t => t * t * (3 - 2 * t);

  class GameScene {
    constructor(container) {
      this.container = container;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 160);
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.18;

      // Enable dynamic soft shadow maps
      this.renderer.shadowMap.enabled = true;
      if (THREE.PCFSoftShadowMap !== undefined) {
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      this.renderer.localClippingEnabled = true;
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      container.prepend(this.renderer.domElement);

      this.environment = B.createEnvironment(this.renderer);
      this.scene.environment = this.environment.texture;
      this.materials = B.createMaterials(this.renderer);
      this.geometryCache = new Map();

      this.board = new THREE.Group();
      this.blocks = new THREE.Group();
      this.markers = new THREE.Group();
      this.shadows = new THREE.Group();
      this.pivot = new THREE.Group();
      this.scene.add(this.board, this.blocks, this.shadows, this.pivot, this.markers);

      // Ha Long Bay golden dawn lighting + emerald sea bounce light
      this.scene.add(new THREE.HemisphereLight(0xfff1d0, 0x184f40, 0.95));

      // Key sunlight casting soft directional shadows
      this.sun = new THREE.DirectionalLight(0xffe1b5, 2.3);
      this.sun.position.set(-6, 15, -8);
      this.sun.castShadow = true;
      if (this.sun.shadow) {
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 45;
        const d = 14;
        this.sun.shadow.camera.left = -d;
        this.sun.shadow.camera.right = d;
        this.sun.shadow.camera.top = d;
        this.sun.shadow.camera.bottom = -d;
        this.sun.shadow.bias = -0.0004;
      }
      this.scene.add(this.sun);

      // Emerald water ambient bounce fill
      const seaBounce = new THREE.DirectionalLight(0x6bd1b4, 0.72);
      seaBounce.position.set(7, -4, 6);
      this.scene.add(seaBounce);

      // Warm rim light for crisp edge silhouette
      const rim = new THREE.DirectionalLight(0xffe9ba, 0.9);
      rim.position.set(-7, 6, 7);
      this.scene.add(rim);

      this.target = new THREE.Vector3(0, 0.1, 0);
      this.azimuth = 0.58;
      this.elevation = 0.64;
      this.distance = 18;
      this.zoom = 1;
      this.rotation = new THREE.Quaternion();
      this.cubeRotations = [new THREE.Quaternion(), new THREE.Quaternion()];
      this.cancelAnimation = null;
      this.bridgeGroups = new Map();
      this.tiles = new Map();
      this.switches = [];
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.bindCamera();
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(container);
      this.resize();
    }

    geometry(key, make) {
      if (!this.geometryCache.has(key)) this.geometryCache.set(key, make());
      return this.geometryCache.get(key);
    }

    box(w, h, d, mat, radius = 0.025) {
      const key = `box:${w}:${h}:${d}:${radius}`;
      const mesh = new THREE.Mesh(this.geometry(key, () => B.roundedBox(w, h, d, radius)), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }

    render() {
      this.scene.updateMatrixWorld(true);
      this.markers.children.forEach(marker => {
        marker.userData.target.getWorldPosition(marker.position);
        marker.position.y += 0.65;
      });
      this.renderer.render(this.scene, this.camera);
    }

    resize() {
      const w = Math.max(1, this.container.clientWidth);
      const h = Math.max(1, this.container.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.fitCamera();
      this.render();
    }

    setCamera() {
      const d = this.distance * this.zoom, c = Math.cos(this.elevation);
      this.camera.position.set(
        this.target.x + Math.sin(this.azimuth) * c * d,
        this.target.y + Math.sin(this.elevation) * d,
        this.target.z + Math.cos(this.azimuth) * c * d
      );
      this.camera.lookAt(this.target);
      this.camera.updateMatrixWorld();
    }

    fitCamera() {
      if (!this.level) {
        this.setCamera();
        return;
      }
      const oldZoom = this.zoom;
      this.zoom = 1;
      this.distance = 8.8;
      const pts = [];
      this.level.grid.forEach((row, r) => row.forEach((tile, c) => {
        if (!tile) return;
        const p = this.world(r, c);
        for (const dx of [-0.55, 0.55]) {
          for (const dz of [-0.55, 0.55]) {
            pts.push(new THREE.Vector3(p.x + dx, -0.5, p.z + dz));
          }
        }
      }));
      const start = this.world(...this.level.start_pos);
      pts.push(new THREE.Vector3(start.x, 2.3, start.z));
      for (let i = 0; i < 65; i++) {
        this.setCamera();
        if (pts.every(v => {
          const p = v.clone().project(this.camera);
          return Math.abs(p.x) < 0.78 && p.y < 0.62 && p.y > -0.68 && p.z < 1;
        })) break;
        this.distance *= 1.04;
      }
      this.zoom = oldZoom;
      this.setCamera();
    }

    resetCamera() {
      this.azimuth = 0.58;
      this.elevation = 0.64;
      this.zoom = 1;
      this.fitCamera();
      this.render();
    }

    bindCamera() {
      const canvas = this.renderer.domElement;
      let drag = null;
      canvas.addEventListener('pointerdown', e => {
        if (e.button !== 0 && e.button !== 2) return;
        this.container.focus({ preventScroll: true });
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', e => {
        if (!drag || drag.id !== e.pointerId) return;
        this.azimuth -= (e.clientX - drag.x) * 0.006;
        this.elevation = THREE.MathUtils.clamp(this.elevation + (e.clientY - drag.y) * 0.005, 0.32, 1.18);
        drag.x = e.clientX;
        drag.y = e.clientY;
        this.setCamera();
        this.render();
      });
      const end = () => { drag = null; };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('lostpointercapture', end);
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(e.deltaY * 0.0008), 0.65, 1.65);
        this.setCamera();
        this.render();
      }, { passive: false });
    }

    world(r, c) {
      return {
        x: c - (this.level.grid[0].length - 1) / 2,
        z: r - (this.level.grid.length - 1) / 2
      };
    }

    build(level, state) {
      this.cancel();
      this.level = level;
      this.board.clear();
      this.blocks.clear();
      this.pivot.clear();
      this.markers.clear();
      this.shadows.clear();
      this.bridgeGroups.clear();
      this.tiles.clear();
      this.switches = [];
      this.rotation.identity();
      this.cubeRotations.forEach(q => q.identity());

      const m = this.materials;

      // Soft water shadow under the floating karst island
      const gridW = level.grid[0].length;
      const gridH = level.grid.length;
      const islandShadow = new THREE.Mesh(
        this.geometry('island-shadow', () => new THREE.PlaneGeometry(gridW * 1.35, gridH * 1.35)),
        m.islandShadow
      );
      islandShadow.rotation.x = -Math.PI / 2;
      islandShadow.position.set(0, -1.8, 0);
      this.board.add(islandShadow);

      level.grid.forEach((row, r) => row.forEach((type, c) => {
        if (!type) return;
        const p = this.world(r, c);
        const group = new THREE.Group();
        group.position.set(p.x, 0, p.z);
        this.board.add(group);
        this.tiles.set(`${r},${c}`, group);

        if (type === 9) {
          this.addGoal(group);
          return;
        }

        const isFragile = type === 2;
        const isBridge = type >= 10;
        let top = isFragile ? m.fragile : isBridge ? m.steel : m.stone[(r * 7 + c * 3) % 4];
        if (type === 3 && m.switchO) top = m.switchO;
        else if (type === 4 && m.switchX) top = m.switchX;
        else if (type === 5 && m.switchO) top = m.switchO;
        const depth = isFragile ? 0.19 : isBridge ? 0.22 : 0.36;
        const sideMat = isFragile ? m.fragile : m.dark;

        const slab = this.box(0.96, depth, 0.96, [sideMat, sideMat, top, m.cliff, sideMat, sideMat], 0.038);
        slab.position.y = -depth / 2;
        slab.receiveShadow = true;
        slab.castShadow = true;
        group.add(slab);

        if (!isFragile && !isBridge) {
          // Tapered karst stone under-formation for floating island depth
          const underH = 0.22 + ((r * 13 + c * 7) % 3) * 0.07;
          const under = this.box(0.84, underH, 0.84, m.cliff, 0.03);
          under.position.y = -depth - underH / 2 + 0.01;
          under.receiveShadow = true;
          under.castShadow = true;
          group.add(under);

          const tipH = 0.14 + ((r * 5 + c * 11) % 3) * 0.05;
          const tip = this.box(0.62, tipH, 0.62, m.cliff, 0.025);
          tip.position.y = -depth - underH - tipH / 2 + 0.02;
          tip.receiveShadow = true;
          tip.castShadow = true;
          group.add(tip);
        } else if (isFragile) {
          const crack1 = this.box(0.68, 0.012, 0.022, m.cliff, 0.004);
          crack1.rotation.y = 0.45;
          crack1.position.set(0.03, 0.003, -0.04);
          group.add(crack1);
          const crack2 = this.box(0.46, 0.012, 0.02, m.cliff, 0.004);
          crack2.rotation.y = -0.75;
          crack2.position.set(-0.08, 0.003, 0.09);
          group.add(crack2);
        }

        if (isBridge) {
          if (!this.bridgeGroups.has(type - 10)) this.bridgeGroups.set(type - 10, []);
          this.bridgeGroups.get(type - 10).push(group);
          for (let i = -2; i <= 2; i++) {
            const rib = this.box(0.82, 0.026, 0.055, m.edge, 0.008);
            rib.position.set(0, 0.014, i * 0.16);
            group.add(rib);
          }
        }

        if (type >= 3 && type <= 5) this.addSwitch(group, type, r, c);
      }));

      this.showState(state);
      this.resetCamera();
    }

    addGoal(group) {
      const m = this.materials;
      // Warm glowing PointLight inside the goal well
      const goalLight = new THREE.PointLight(0xffb84d, 2.5, 4.2);
      goalLight.position.set(0, -0.15, 0);
      group.add(goalLight);

      for (const sign of [-1, 1]) {
        const a = this.box(1.08, 0.12, 0.065, m.goalRim, 0.01);
        a.position.set(0, -0.02, sign * 0.515);
        group.add(a);
        const b = this.box(0.065, 0.12, 0.96, m.goalRim, 0.01);
        b.position.set(sign * 0.515, -0.02, 0);
        group.add(b);

        const wallA = this.box(1.06, 0.95, 0.055, m.shaft, 0.006);
        wallA.position.set(0, -0.52, sign * 0.515);
        group.add(wallA);
        const wallB = this.box(0.055, 0.95, 0.96, m.shaft, 0.006);
        wallB.position.set(sign * 0.515, -0.52, 0);
        group.add(wallB);

        const beamA = new THREE.Mesh(
          this.geometry('goal-beam-x', () => new THREE.PlaneGeometry(0.92, 0.55)),
          m.goalGlow
        );
        beamA.position.set(0, 0.24, sign * 0.45);
        group.add(beamA);

        const beamB = new THREE.Mesh(
          this.geometry('goal-beam-z', () => new THREE.PlaneGeometry(0.92, 0.55)),
          m.goalGlow
        );
        beamB.rotation.y = Math.PI / 2;
        beamB.position.set(sign * 0.45, 0.24, 0);
        group.add(beamB);
      }

      const bottom = this.box(0.96, 0.04, 0.96, m.bottom, 0.005);
      bottom.position.y = -0.95;
      group.add(bottom);
    }

    addSwitch(group, type, r, c) {
      const m = this.materials;
      const button = new THREE.Group();
      button.position.y = 0.025;
      group.add(button);

      const base = new THREE.Mesh(
        this.geometry('switch-base', () => new THREE.CylinderGeometry(0.36, 0.39, 0.052, 16)),
        m.dark
      );
      base.castShadow = true;
      base.receiveShadow = true;
      button.add(base);

      if (type === 3) {
        const disc = new THREE.Mesh(
          this.geometry('switch-disc', () => new THREE.CylinderGeometry(0.28, 0.29, 0.06, 24)),
          m.switch
        );
        disc.position.y = 0.048;
        disc.castShadow = true;
        disc.receiveShadow = true;
        button.add(disc);

        const outerRing = new THREE.Mesh(
          this.geometry('soft-ring-outer', () => new THREE.TorusGeometry(0.20, 0.024, 10, 32)),
          m.accent
        );
        outerRing.rotation.x = -Math.PI / 2;
        outerRing.position.y = 0.085;
        button.add(outerRing);

        const innerRing = new THREE.Mesh(
          this.geometry('soft-ring-inner', () => new THREE.TorusGeometry(0.09, 0.018, 8, 24)),
          m.accent
        );
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.y = 0.085;
        button.add(innerRing);
      } else if (type === 4) {
        for (const a of [-Math.PI / 4, Math.PI / 4]) {
          const bar = this.box(0.58, 0.075, 0.13, m.heavySwitch, 0.02);
          bar.rotation.y = a;
          bar.position.y = 0.062;
          button.add(bar);
        }
      } else {
        for (const a of [0, Math.PI]) {
          const bracket = new THREE.Mesh(
            this.geometry('split-bracket', () => new THREE.TorusGeometry(0.22, 0.036, 10, 24, Math.PI * 0.75)),
            m.accent
          );
          bracket.rotation.set(-Math.PI / 2, 0, a + Math.PI * 0.125);
          bracket.position.y = 0.072;
          button.add(bracket);
        }
      }
      this.switches.push({ r, c, type, button });
    }

    createBlock(cube = false) {
      const m = this.materials;
      const g = new THREE.Group();
      const h = cube ? 0.94 : 1.94;
      const side = cube ? m.cube : m.copper;

      // 1:1 Monolithic emerald jade block with beveled edges and continuous wave & cloud relief
      const body = this.box(0.94, h, 0.94, [side, side, m.cap, m.cap, side, side], 0.046);
      g.add(body);

      g.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return g;
    }

    placements(st) {
      const p = this.world(st.r, st.c);
      if (st.orientation === 'SPLIT') {
        const p2 = this.world(st.r2, st.c2);
        return [
          { x: p.x, y: 0.5, z: p.z, w: 1, d: 1 },
          { x: p2.x, y: 0.5, z: p2.z, w: 1, d: 1 }
        ];
      }
      const horizontal = st.orientation === 'HORIZONTAL';
      const vertical = st.orientation === 'VERTICAL';
      return [{
        x: p.x + (horizontal ? 0.5 : 0),
        y: st.orientation === 'STANDING' ? 1 : 0.5,
        z: p.z + (vertical ? 0.5 : 0),
        w: horizontal ? 2 : 1,
        d: vertical ? 2 : 1
      }];
    }

    canonicalRotation(orient) {
      const q = new THREE.Quaternion();
      if (orient === 'HORIZONTAL') q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
      if (orient === 'VERTICAL') q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
      return q;
    }

    showState(st) {
      this.pivot.clear();
      this.pivot.position.set(0, 0, 0);
      this.pivot.rotation.set(0, 0, 0);
      this.blocks.clear();
      this.markers.clear();
      this.shadows.clear();

      const split = st.orientation === 'SPLIT';
      const pl = this.placements(st);

      // Dynamic contact shadows directly under the block footprints on the stone tiles
      pl.forEach(p => {
        const shadowMesh = new THREE.Mesh(
          this.geometry('contact-plane', () => new THREE.PlaneGeometry(1, 1)),
          this.materials.contactShadow
        );
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.set(p.x, 0.005, p.z);
        shadowMesh.scale.set(p.w * 1.22, p.d * 1.22, 1);
        this.shadows.add(shadowMesh);
      });

      pl.forEach((p, i) => {
        const obj = this.createBlock(split);
        obj.position.set(p.x, p.y, p.z);
        obj.quaternion.copy(split ? this.cubeRotations[i] : this.rotation);
        this.blocks.add(obj);
        if (split && i === st.active_cube) {
          const marker = new THREE.Mesh(
            this.geometry('active-ring', () => new THREE.TorusGeometry(0.38, 0.022, 10, 40)),
            this.materials.marker
          );
          marker.rotation.x = -Math.PI / 2;
          marker.userData.target = obj;
          this.markers.add(marker);
        }
      });

      this.updateBoard(st);
      this.render();
    }

    updateBoard(st) {
      st.bridges.forEach((open, i) => (this.bridgeGroups.get(i) || []).forEach(g => {
        g.visible = open;
      }));
      const cells = st.orientation === 'SPLIT'
        ? [[st.r, st.c], [st.r2, st.c2]]
        : st.orientation === 'HORIZONTAL'
          ? [[st.r, st.c], [st.r, st.c + 1]]
          : st.orientation === 'VERTICAL'
            ? [[st.r, st.c], [st.r + 1, st.c]]
            : [[st.r, st.c]];
      this.switches.forEach(sw => {
        const pressed = cells.some(([r, c]) => r === sw.r && c === sw.c) &&
          (sw.type === 3 || st.orientation === 'STANDING');
        sw.button.position.y = pressed ? -0.018 : 0.025;
      });
    }

    cancel() {
      if (this.cancelAnimation) this.cancelAnimation();
      this.cancelAnimation = null;
    }

    tween(duration, update) {
      this.cancel();
      return new Promise(resolve => {
        let raf = 0, finished = false;
        const start = performance.now();
        const end = value => {
          if (finished) return;
          finished = true;
          cancelAnimationFrame(raf);
          this.cancelAnimation = null;
          resolve(value);
        };
        this.cancelAnimation = () => end(false);
        const step = now => {
          const t = Math.min(1, (now - start) / duration);
          update(t);
          this.render();
          if (t < 1) raf = requestAnimationFrame(step);
          else end(true);
        };
        raf = requestAnimationFrame(step);
      });
    }

    async roll(prev, action, next, valid, failureState = null) {
      if (action === 'SPACE') {
        this.showState(next);
        return true;
      }
      const objects = this.blocks.children.slice();
      const index = prev.orientation === 'SPLIT' ? prev.active_cube : 0;
      const obj = this.blocks.children[index], pos = this.placements(prev)[index];
      const [dx, dz] = directions[action], axis = new THREE.Vector3(dz, 0, -dx), angle = Math.PI / 2;
      this.pivot.position.set(pos.x + dx * pos.w / 2, 0, pos.z + dz * pos.d / 2);
      this.pivot.rotation.set(0, 0, 0);
      this.scene.updateMatrixWorld(true);
      this.pivot.attach(obj);

      // Fade contact shadow during tilt
      if (this.shadows.children[index]) {
        this.shadows.children[index].visible = false;
      }

      const ok = await this.tween(this.reducedMotion ? 90 : 220, t =>
        this.pivot.quaternion.setFromAxisAngle(axis, angle * ease(t))
      );
      if (!ok) return false;
      if (!valid) {
        if (failureState) return this.fallAfterSwitch(failureState, objects);
        return this.fall(obj, dx, dz, prev, action);
      }
      const turn = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      if (prev.orientation === 'SPLIT' && next.orientation === 'SPLIT') {
        this.cubeRotations[index].premultiply(turn).normalize();
      } else if (prev.orientation !== 'SPLIT' && next.orientation !== 'SPLIT') {
        this.rotation.premultiply(turn).normalize();
      } else if (next.orientation === 'SPLIT') {
        const landing = this.rotation.clone().premultiply(turn).normalize();
        this.cubeRotations.forEach(q => q.copy(landing));
      } else {
        this.rotation.copy(this.canonicalRotation(next.orientation));
      }
      this.showState(next);
      return true;
    }

    async fallAfterSwitch(st, objects) {
      this.scene.updateMatrixWorld(true);
      objects.forEach(obj => this.blocks.attach(obj));
      this.pivot.clear();
      this.markers.clear();
      this.shadows.clear();
      this.updateBoard(st);
      this.render();
      const supported = (r, c) => {
        const tile = this.level.grid[r]?.[c];
        return !!tile && (tile < 10 || st.bridges[tile - 10]);
      };
      const falling = st.orientation === 'SPLIT'
        ? objects.filter((obj, i) => !supported(i === 0 ? st.r : st.r2, i === 0 ? st.c : st.c2))
        : objects;
      const starts = falling.map(obj => ({
        obj,
        position: obj.position.clone(),
        rotation: obj.quaternion.clone()
      }));
      if (!await this.tween(this.reducedMotion ? 50 : 140, () => {})) return false;
      const ok = await this.tween(this.reducedMotion ? 160 : 650, t => {
        starts.forEach(({ obj, position, rotation }) => {
          obj.position.copy(position);
          obj.position.y -= 7.5 * t * t;
          obj.quaternion.copy(rotation).premultiply(
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), t * 0.35)
          );
        });
      });
      if (ok) {
        falling.forEach(obj => { obj.visible = false; });
        this.render();
      }
      return ok;
    }

    async fall(obj, dx, dz, prev, action) {
      this.scene.updateMatrixWorld(true);
      this.blocks.attach(obj);
      this.pivot.clear();
      this.shadows.clear();
      const start = obj.position.clone(), rotation = obj.quaternion.clone();
      let fragile = null;
      if (prev.orientation === 'HORIZONTAL' && (action === 'LEFT' || action === 'RIGHT')) {
        const c = prev.c + (action === 'LEFT' ? -1 : 2);
        if (this.level.grid[prev.r]?.[c] === 2) fragile = this.tiles.get(`${prev.r},${c}`);
      }
      if (prev.orientation === 'VERTICAL' && (action === 'UP' || action === 'DOWN')) {
        const r = prev.r + (action === 'UP' ? -1 : 2);
        if (this.level.grid[r]?.[prev.c] === 2) fragile = this.tiles.get(`${r},${prev.c}`);
      }
      const ok = await this.tween(this.reducedMotion ? 160 : 650, t => {
        obj.position.copy(start).add(new THREE.Vector3(dx * t * 0.55, -7.5 * t * t, dz * t * 0.55));
        obj.quaternion.copy(rotation).premultiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dz, 0, -dx), t * 0.65)
        );
        if (fragile) {
          fragile.position.y = -8 * t * t;
          fragile.rotation.x = t * 0.45;
        }
      });
      if (ok) {
        obj.visible = false;
        this.markers.clear();
        if (fragile) fragile.visible = false;
        this.render();
      }
      return ok;
    }

    async victory() {
      const obj = this.blocks.children[0];
      if (!obj) return true;
      this.shadows.clear();
      const start = obj.position.y, clones = [];
      obj.traverse(child => {
        if (!child.isMesh) return;
        const clone = mat => {
          const m = mat.clone();
          m.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.015)];
          clones.push(m);
          return m;
        };
        child.material = Array.isArray(child.material) ? child.material.map(clone) : clone(child.material);
      });
      const ok = await this.tween(this.reducedMotion ? 150 : 670, t => {
        obj.position.y = start - 3.4 * t * t;
      });
      obj.visible = false;
      clones.forEach(m => m.dispose());
      this.render();
      return ok;
    }
  }

  B.GameScene = GameScene;
})();
