/* Fixed PBR textures loaded from local assets; lighting and scene layout remain dynamic. */
(() => {
  'use strict';
  const B = window.Bloxorz = window.Bloxorz || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // Fixed surfaces are pre-rendered PNGs; images load once and GPU textures
  // are reused per renderer. Geometry and level-dependent fields stay separate.
  const surfaceNames = ['stone-1','stone-2','stone-3','stone-4','fragile-12','steel-23',
    'copper-7-tall','copper-8','copper-7','masonry-19','ice-43','snow-11'];
  const assetFiles = [...surfaceNames.flatMap(name => ['color','normal','roughness'].map(role => `${name}-${role}.png`)),
    'water-field.png','environment.png'];
  const images = new Map(), textureCaches = new WeakMap();
  let preparing;
  B.prepareRenderAssets = loadImage => {
    if (preparing) return preparing;
    const load = loadImage || (url => new Promise((resolve, reject) =>
      new THREE.ImageLoader().load(url, resolve, undefined, reject)));
    preparing = Promise.all(assetFiles.map(async file => {
      try { images.set(file, await load('/static/textures/' + file)); }
      catch { throw new Error('Không tải được tài nguyên đồ họa: ' + file); }
    })).then(() => undefined).catch(error => { preparing = null; throw error; });
    return preparing;
  };
  function image(file) {
    if (!images.has(file)) throw new Error('Tài nguyên đồ họa chưa sẵn sàng: ' + file);
    return images.get(file);
  }
  function texture(file, renderer, isColor, flipY = true) {
    if (!textureCaches.has(renderer)) textureCaches.set(renderer, new Map());
    const cache = textureCaches.get(renderer);
    if (!cache.has(file)) {
      const tex = new THREE.Texture(image(file));
      tex.encoding = isColor ? THREE.sRGBEncoding : THREE.LinearEncoding;
      tex.flipY = flipY;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;
      cache.set(file, tex);
    }
    return cache.get(file);
  }
  function surface(renderer, kind, seed = 1, tall = false) {
    const key = kind + '-' + seed + (tall ? '-tall' : '');
    const isMetal = kind === 'copper' || kind === 'steel';
    return new THREE.MeshStandardMaterial({
      map: texture(key + '-color.png', renderer, true),
      normalMap: texture(key + '-normal.png', renderer, false),
      roughnessMap: texture(key + '-roughness.png', renderer, false),
      normalScale: new THREE.Vector2(isMetal ? .42 : .7, isMetal ? .42 : .7),
      roughness: kind === 'ice' ? .58 : kind === 'snow' ? .96 : 1,
      metalness: isMetal ? .58 : .02, envMapIntensity: isMetal ? .65 : .3
    });
  }
  B.createSurface = surface;
  B.createWaterField = renderer => {
    const tex = texture('water-field.png', renderer, false, false);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
  };
  B.createMaterials = renderer => {
    const m = {
      stone: [1, 2, 3, 4].map(seed => surface(renderer, 'stone', seed)),
      fragile: surface(renderer, 'fragile', 12), steel: surface(renderer, 'steel', 23),
      copper: surface(renderer, 'copper', 7, true), cap: surface(renderer, 'copper', 8),
      cube: surface(renderer, 'copper', 7),
      dark: new THREE.MeshStandardMaterial({color:0x9d8968, roughness:.85, metalness:.25}),
      edge: new THREE.MeshStandardMaterial({color:0xbf8f61, roughness:.48, metalness:.65, envMapIntensity:.65}),
      switch: new THREE.MeshStandardMaterial({color:0x94b5b9, roughness:.32, metalness:.8}),
      accent: new THREE.MeshStandardMaterial({color:0x82d4bf, emissive:0x346756, emissiveIntensity:.25, roughness:.3, metalness:.5}),
      shaft: new THREE.MeshStandardMaterial({color:0x17232a, roughness:.96}),
      bottom: new THREE.MeshBasicMaterial({color:0x070e14}),
      marker: new THREE.MeshBasicMaterial({color:0x9ce6d0})
    };
    const masonry=surface(renderer,'masonry',19);
    m.architecture=[masonry,...[.94,1.06,.85].map(value=>{const mat=masonry.clone();mat.color.setScalar(value);return mat;})];
    // A wet band is tied to world water elevation, so scaled ruins do not float above it.
    m.underwaterTint={value:new THREE.Color(0x086879).convertSRGBToLinear()};
    for(const material of [...m.stone,...m.architecture,m.dark]){material.onBeforeCompile=shader=>{
      shader.uniforms.underwaterTint=m.underwaterTint;
      shader.vertexShader='varying float masonryY;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 wetPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwetPosition=instanceMatrix*wetPosition;\n#endif\nmasonryY=(modelMatrix*wetPosition).y;');
      shader.fragmentShader='varying float masonryY;uniform vec3 underwaterTint;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wet=1.0-smoothstep(-.87,-.72,masonryY);diffuseColor.rgb*=mix(vec3(1.),vec3(.53,.68,.65),wet);float submerged=1.-smoothstep(-2.6,-.95,masonryY);diffuseColor.rgb=mix(diffuseColor.rgb,underwaterTint,submerged*.78);');
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.44,wet);');
    };}
    return m;
  };
  B.createEnvironment = renderer => {
    const tex = new THREE.Texture(image('environment.png'));
    tex.encoding = THREE.sRGBEncoding; tex.needsUpdate = true;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(tex);
    tex.dispose(); pmrem.dispose();
    return target;
  };
  // Rounded cuboids have real beveled silhouettes and shared face materials.
  B.roundedBox = (w, h, d, radius = .035, segments = 6) => {
    // Thin caps/strips used to have a radius larger than half their thickness,
    // inverting the inner box and producing invalid normals/highlight artifacts.
    radius = Math.max(.00001, Math.min(radius, Math.min(w,h,d) / 2 - .00001));
    const g = new THREE.BoxGeometry(w, h, d, segments, segments, segments);
    const p = g.attributes.position, n = g.attributes.normal;
    const inner = new THREE.Vector3(w / 2 - radius, h / 2 - radius, d / 2 - radius);
    const v = new THREE.Vector3(), q = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      q.set(clamp(v.x, -inner.x, inner.x), clamp(v.y, -inner.y, inner.y), clamp(v.z, -inner.z, inner.z));
      normal.subVectors(v, q).normalize();
      v.copy(q).addScaledVector(normal, radius);
      p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, normal.x, normal.y, normal.z);
    }
    p.needsUpdate = n.needsUpdate = true;
    g.computeBoundingSphere();
    return g;
  };
})();
