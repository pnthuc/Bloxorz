/* Procedural PBR textures & geometry for Bloxorz Ha Long Bay Edition (v2).
 * Crafts weathered karst limestone, fractured terracotta, carved Dong Son emerald jade, and soft contact shadows. */
(() => {
  'use strict';
  const B = window.Bloxorz = window.Bloxorz || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function hash(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 73.13) * 43758.5453;
    return n - Math.floor(n);
  }

  function noise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }

  function fbm(x, y, seed) {
    return (
      noise(x, y, seed) * 0.55 +
      noise(x * 2.1, y * 2.1, seed + 11) * 0.28 +
      noise(x * 4.3, y * 4.3, seed + 23) * 0.17
    );
  }

  function textureFromPixels(data, w, h, renderer, isColor) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(data, w, h), 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = isColor ? THREE.sRGBEncoding : THREE.LinearEncoding;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function createSoftShadowMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.32, 'rgba(0, 0, 0, 0.52)');
    grad.addColorStop(0.68, 'rgba(0, 0, 0, 0.18)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  function surface(renderer, kind, seed = 1, tall = false) {
    const w = 256, h = tall ? 512 : 256, count = w * h;
    const heights = new Float32Array(count);
    const colors = new Uint8ClampedArray(count * 4);
    const rough = new Uint8ClampedArray(count * 4);
    const normals = new Uint8ClampedArray(count * 4);

    const bases = {
      stone: [188, 181, 164],     // Warm weathered Ha Long limestone
      fragile: [214, 114, 44],    // Distinct cracked terracotta orange
      jade: [26, 152, 98],        // Translucent emerald jade
      bridge: [92, 134, 116]      // Patinated bronze-jade bridge slab
    };
    const base = bases[kind] || bases.stone;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const u = x / w, v = y / h;
        const coarse = fbm(u * 6, v * (tall ? 12 : 6), seed);
        const mid = noise(u * 28, v * (tall ? 56 : 28), seed + 5);
        const grain = hash(x, y, seed + 9);
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);

        let height = coarse * 0.35 + mid * 0.15 + grain * 0.03;
        let rMod = 0, gMod = 0, bMod = 0;
        let shade = (coarse - 0.5) * 28 + (mid - 0.5) * 14 + (grain - 0.5) * 8;
        let roughnessVal = 195;

        if (kind === 'stone') {
          // Carved recessed border frame for crisp grid readability & self-shadowing
          const frame = edge > 16 && edge < 24;
          const outerBevel = edge < 8;
          if (frame) {
            height -= 0.18;
            shade -= 32; // Ambient shadow inside groove
          }
          if (outerBevel) {
            height -= (8 - edge) * 0.03;
            shade -= 22; // Edge drop-off shadow
          }
          // Moss / weathering patches in crevices
          const cornerDist = Math.hypot(Math.min(u, 1 - u), Math.min(v, 1 - v));
          if (cornerDist < 0.28 && coarse > 0.52) {
            rMod -= 24;
            gMod += 8;
            bMod -= 20;
          }
          roughnessVal = 205 + (coarse - 0.5) * 35;
        } else if (kind === 'fragile') {
          // Deep terracotta fracture lines with dark crevice shadowing
          const c1 = Math.abs((u - 0.32) + Math.sin(v * 9.5) * 0.09 + (mid - 0.5) * 0.04);
          const c2 = Math.abs((v - 0.58) + Math.cos(u * 8.0) * 0.08 + (coarse - 0.5) * 0.05);
          const c3 = Math.abs((u + v - 0.95) + Math.sin((u - v) * 7.0) * 0.07);
          const crack = Math.min(c1, c2, c3);
          if (crack < 0.014) {
            const depthFactor = 1 - crack / 0.014;
            height -= 0.45 * depthFactor;
            shade -= 110 * depthFactor; // Deep crack shadow
            rMod -= 40 * depthFactor;
            gMod -= 35 * depthFactor;
          } else if (crack < 0.026) {
            shade += 18; // Sunlit ridge highlight
          }
          if (edge > 14 && edge < 20) {
            height -= 0.14;
            shade -= 26;
          }
          roughnessVal = 185 + coarse * 40;
        } else if (kind === 'jade') {
          // Polished emerald jade with carved Dong Son wave & cloud relief
          const cx = u - 0.5;
          const cy = (v * (tall ? 2 : 1)) % 1 - 0.5;
          const dist = Math.hypot(cx, cy);
          const angle = Math.atan2(cy, cx);
          const spiral = Math.sin(dist * 28 - angle * 2.0 + Math.sin(u * 12) * 0.7);
          const wave = Math.sin(u * 18.8 + Math.sin(v * (tall ? 24 : 12)) * 1.4);
          const border = edge > 12 && edge < 19;
          const innerFrame = edge > 24 && edge < 28;

          const carving = border ? 1.0 : innerFrame ? 0.6 : Math.max(0, spiral * 0.5 + wave * 0.35 - 0.25);
          height = 0.5 + carving * 0.24 + coarse * 0.06;

          // Subsurface jade depth veins with Fresnel-like inner luminance
          const vein = fbm(u * 9 + coarse * 1.5, v * (tall ? 18 : 9), seed + 31);
          shade = (vein - 0.48) * 54 + carving * 30;
          rMod = carving * 18 + (vein > 0.62 ? 26 : 0);
          gMod = carving * 36 + (vein > 0.62 ? 40 : 0);
          bMod = carving * 22 + (vein > 0.62 ? 20 : 0);

          if (edge < 7) {
            shade += 24; // Bright beveled jade specular ridge
          }
          roughnessVal = 48 + (1 - carving) * 32 + grain * 6;
        } else if (kind === 'bridge') {
          const plank = Math.abs(((v * 6) % 1) - 0.5);
          if (plank > 0.44) {
            height -= 0.24;
            shade -= 45;
          }
          roughnessVal = 145 + coarse * 35;
        }

        heights[i] = height;
        const j = i * 4;
        colors[j] = clamp(base[0] + shade + rMod, 0, 255);
        colors[j + 1] = clamp(base[1] + shade + gMod, 0, 255);
        colors[j + 2] = clamp(base[2] + shade + bMod, 0, 255);
        colors[j + 3] = 255;

        const rClamped = clamp(roughnessVal, 20, 250);
        rough[j] = rough[j + 1] = rough[j + 2] = rClamped;
        rough[j + 3] = 255;
      }
    }

    const strength = kind === 'jade' ? 2.8 : kind === 'fragile' ? 4.0 : 3.4;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, j = i * 4;
        const left = heights[y * w + Math.max(0, x - 1)];
        const right = heights[y * w + Math.min(w - 1, x + 1)];
        const up = heights[Math.max(0, y - 1) * w + x];
        const down = heights[Math.min(h - 1, y + 1) * w + x];
        const nx = (left - right) * strength;
        const ny = (down - up) * strength;
        const length = Math.hypot(nx, ny, 1);
        normals[j] = (nx / length * 0.5 + 0.5) * 255;
        normals[j + 1] = (ny / length * 0.5 + 0.5) * 255;
        normals[j + 2] = (1 / length * 0.5 + 0.5) * 255;
        normals[j + 3] = 255;
      }
    }

    const isJade = kind === 'jade';
    return new THREE.MeshStandardMaterial({
      map: textureFromPixels(colors, w, h, renderer, true),
      normalMap: textureFromPixels(normals, w, h, renderer, false),
      roughnessMap: textureFromPixels(rough, w, h, renderer, false),
      normalScale: new THREE.Vector2(isJade ? 0.65 : 0.88, isJade ? 0.65 : 0.88),
      roughness: 1,
      metalness: isJade ? 0.14 : kind === 'bridge' ? 0.48 : 0.05,
      emissive: isJade ? new THREE.Color(0x0a442a) : new THREE.Color(0x000000),
      emissiveIntensity: isJade ? 0.35 : 0,
      envMapIntensity: isJade ? 1.35 : 0.55
    });
  }

  B.createMaterials = renderer => {
    const shadowTex = createSoftShadowMap();

    // Texture loader with sRGB / Linear encoding and anisotropic filtering
    const texLoader = typeof THREE.TextureLoader === 'function' ? new THREE.TextureLoader() : null;
    function loadTex(url, isColor) {
      if (!texLoader) return null;
      try {
        const tex = texLoader.load(url);
        if (tex) {
          tex.encoding = isColor ? THREE.sRGBEncoding : THREE.LinearEncoding;
          if (renderer && renderer.capabilities) {
            tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          }
          return tex;
        }
      } catch (err) {
        // Fallback to procedural
      }
      return null;
    }

    // PBR Texture Maps pre-baked for 1:1 photorealism
    const jadeTallMap = loadTex('/static/v2/textures/jade_tall_albedo.png', true);
    const jadeTallNorm = loadTex('/static/v2/textures/jade_tall_normal.png', false);
    const jadeTallRough = loadTex('/static/v2/textures/jade_tall_roughness.png', false);
    const jadeCapMap = loadTex('/static/v2/textures/jade_cap_albedo.png', true);
    const jadeCubeMap = loadTex('/static/v2/textures/jade_cube_albedo.png', true);

    const stoneMap = loadTex('/static/v2/textures/tile_stone_albedo.png', true);
    const stoneNorm = loadTex('/static/v2/textures/tile_stone_normal.png', false);
    const stoneRough = loadTex('/static/v2/textures/tile_stone_roughness.png', false);

    const switchXMap = loadTex('/static/v2/textures/tile_switch_x_albedo.png', true);
    const switchXNorm = loadTex('/static/v2/textures/tile_switch_x_normal.png', false);
    const switchXRough = loadTex('/static/v2/textures/tile_switch_x_roughness.png', false);

    const switchOMap = loadTex('/static/v2/textures/tile_switch_o_albedo.png', true);
    const switchONorm = loadTex('/static/v2/textures/tile_switch_o_normal.png', false);
    const switchORough = loadTex('/static/v2/textures/tile_switch_o_roughness.png', false);

    const fragileMap = loadTex('/static/v2/textures/tile_fragile_albedo.png', true);
    const fragileNorm = loadTex('/static/v2/textures/tile_fragile_normal.png', false);
    const fragileRough = loadTex('/static/v2/textures/tile_fragile_roughness.png', false);

    const goalMap = loadTex('/static/v2/textures/tile_goal_albedo.png', true);
    const goalNorm = loadTex('/static/v2/textures/tile_goal_normal.png', false);

    // Procedural fallbacks
    const procJadeTall = surface(renderer, 'jade', 7, true);
    const procJadeCap = surface(renderer, 'jade', 8, false);
    const procJadeCube = surface(renderer, 'jade', 7, false);
    const procStone = surface(renderer, 'stone', 1);
    const procFragile = surface(renderer, 'fragile', 12);
    const procBridge = surface(renderer, 'bridge', 23);

    // 1:1 Monolithic Jade Monolith Side Material (Wave + Cloud Carvings)
    const copperMat = new THREE.MeshStandardMaterial({
      map: jadeTallMap || procJadeTall.map,
      normalMap: jadeTallNorm || procJadeTall.normalMap,
      roughnessMap: jadeTallRough || procJadeTall.roughnessMap,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughness: 0.22,
      metalness: 0.12,
      emissive: new THREE.Color(0x06351d),
      emissiveIntensity: 0.32,
      envMapIntensity: 1.45
    });

    // Jade Monolith Cap Material (Smooth Beveled Top / Bottom)
    const capMat = new THREE.MeshStandardMaterial({
      map: jadeCapMap || procJadeCap.map,
      roughness: 0.18,
      metalness: 0.12,
      emissive: new THREE.Color(0x06351d),
      emissiveIntensity: 0.25,
      envMapIntensity: 1.45
    });

    // Split Cube Jade Material
    const cubeMat = new THREE.MeshStandardMaterial({
      map: jadeCubeMap || procJadeCube.map,
      normalMap: jadeTallNorm || procJadeCube.normalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughness: 0.22,
      metalness: 0.12,
      emissive: new THREE.Color(0x06351d),
      emissiveIntensity: 0.30,
      envMapIntensity: 1.45
    });

    // Weathered Limestone Masonry Pavers
    const stoneMaterials = [1, 2, 3, 4].map(seed => {
      const proc = surface(renderer, 'stone', seed);
      return new THREE.MeshStandardMaterial({
        map: stoneMap || proc.map,
        normalMap: stoneNorm || proc.normalMap,
        roughnessMap: stoneRough || proc.roughnessMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughness: 0.88,
        metalness: 0.05
      });
    });

    // Heavy Switch 'X' Stone Slab
    const switchXMaterial = new THREE.MeshStandardMaterial({
      map: switchXMap || stoneMap || procStone.map,
      normalMap: switchXNorm || stoneNorm || procStone.normalMap,
      roughnessMap: switchXRough || stoneRough || procStone.roughnessMap,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughness: 0.85,
      metalness: 0.08
    });

    // Soft Switch 'O' Stone Slab
    const switchOMaterial = new THREE.MeshStandardMaterial({
      map: switchOMap || stoneMap || procStone.map,
      normalMap: switchONorm || stoneNorm || procStone.normalMap,
      roughnessMap: switchORough || stoneRough || procStone.roughnessMap,
      normalScale: new THREE.Vector2(1.35, 1.35),
      roughness: 0.85,
      metalness: 0.08
    });

    // Fragile Jade Tile (Polished pillow jade paver)
    const fragileMaterial = new THREE.MeshStandardMaterial({
      map: fragileMap || procFragile.map,
      normalMap: fragileNorm || procFragile.normalMap,
      roughnessMap: fragileRough || null,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.24,
      metalness: 0.15,
      emissive: new THREE.Color(0x0b5a32),
      emissiveIntensity: 0.32,
      envMapIntensity: 1.35
    });

    return {
      stone: stoneMaterials,
      fragile: fragileMaterial,
      steel: procBridge,
      copper: copperMat,
      cap: capMat,
      cube: cubeMat,
      switchX: switchXMaterial,
      switchO: switchOMaterial,
      dark: new THREE.MeshStandardMaterial({ color: 0x332d25, roughness: 0.92, metalness: 0.08 }),
      cliff: new THREE.MeshStandardMaterial({ color: 0x24221c, roughness: 0.96, metalness: 0.05 }),
      moss: new THREE.MeshStandardMaterial({ color: 0x334d2f, roughness: 0.9, metalness: 0.04 }),
      edge: new THREE.MeshStandardMaterial({ color: 0xc89d54, roughness: 0.32, metalness: 0.78, envMapIntensity: 0.95 }),
      switch: new THREE.MeshStandardMaterial({ color: 0xd7ccb4, roughness: 0.42, metalness: 0.28 }),
      heavySwitch: new THREE.MeshStandardMaterial({ color: 0xb8863b, roughness: 0.32, metalness: 0.8 }),
      accent: new THREE.MeshStandardMaterial({
        color: 0x3ee69c,
        emissive: 0x168552,
        emissiveIntensity: 0.52,
        roughness: 0.22,
        metalness: 0.38
      }),
      goalRim: new THREE.MeshStandardMaterial({
        color: 0xebb854,
        emissive: 0x996113,
        emissiveIntensity: 0.42,
        roughness: 0.28,
        metalness: 0.72
      }),
      shaft: new THREE.MeshStandardMaterial({
        color: 0xde9021,
        emissive: 0xc46b0a,
        emissiveIntensity: 0.72,
        roughness: 0.35
      }),
      bottom: new THREE.MeshBasicMaterial({ color: 0xfff3b2 }),
      goalGlow: new THREE.MeshBasicMaterial({
        color: 0xffd978,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false
      }),
      marker: new THREE.MeshBasicMaterial({ color: 0xffe285 }),
      contactShadow: new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
      }),
      islandShadow: new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.52,
        depthWrite: false
      })
    };
  };

  B.createEnvironment = renderer => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#fae5b8');   // Warm golden sky zenith
    gradient.addColorStop(0.42, '#c8d9ca'); // Misty karst horizon
    gradient.addColorStop(0.55, '#2b6e5e'); // Emerald Ha Long water reflection
    gradient.addColorStop(1, '#0e332b');    // Deep jade sea shadow
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#fff5dc';
    ctx.fillRect(80, 28, 110, 64);
    ctx.fillStyle = '#8ce0c2';
    ctx.fillRect(320, 48, 70, 95);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = THREE.sRGBEncoding;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(tex);
    tex.dispose();
    pmrem.dispose();
    return target;
  };

  B.roundedBox = (w, h, d, radius = 0.035) => {
    radius = Math.max(0.00001, Math.min(radius, Math.min(w, h, d) / 2 - 0.00001));
    const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6);
    const p = g.attributes.position, n = g.attributes.normal;
    const inner = new THREE.Vector3(w / 2 - radius, h / 2 - radius, d / 2 - radius);
    const v = new THREE.Vector3(), q = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      q.set(clamp(v.x, -inner.x, inner.x), clamp(v.y, -inner.y, inner.y), clamp(v.z, -inner.z, inner.z));
      normal.subVectors(v, q).normalize();
      v.copy(q).addScaledVector(normal, radius);
      p.setXYZ(i, v.x, v.y, v.z);
      n.setXYZ(i, normal.x, normal.y, normal.z);
    }
    p.needsUpdate = n.needsUpdate = true;
    g.computeBoundingSphere();
    return g;
  };
})();
