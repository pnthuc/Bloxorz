/* PBR surfaces authored in code: matching albedo, tangent normals and roughness.
 * Geometry supplies the silhouette; normals add only fine surface relief.
 * No network request, random asset dependency, or baked lighting is required. */
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
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed);
    const c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  }
  function textureFromPixels(data, w, h, renderer, isColor) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(data, w, h), 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.encoding = isColor ? THREE.sRGBEncoding : THREE.LinearEncoding;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }
  function surface(renderer, kind, seed = 1, tall = false) {
    const w = 256, h = tall ? 512 : 256, count = w * h;
    const heights = new Float32Array(count), colors = new Uint8ClampedArray(count * 4);
    const rough = new Uint8ClampedArray(count * 4), normals = new Uint8ClampedArray(count * 4);
    const isMetal = kind === 'copper' || kind === 'steel';
    const bases = {stone:[220,191,145], masonry:[211,185,141], fragile:[185,105,46], copper:[154,85,47], steel:[74,100,112], ice:[177,217,229], snow:[235,243,246]};
    const base = bases[kind];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, u = x / w, v = y / w;
      const coarse = noise(u * 7, v * 7, seed), mid = noise(u * 34, v * 34, seed + 1);
      const grain = hash(x, y, seed + 2), fine = noise(u * 90, v * 90, seed + 8);
      let height = coarse * .35 + mid * .18 + fine * .08 + grain * .035;
      let shade = (coarse - .5) * 22 + (mid - .5) * 12 + (grain - .5) * 13;
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const groove = edge > 13 && edge < 16;
      if (groove && kind !== 'masonry' && kind !== 'snow') { height -= .13; shade -= 20; }
      if (isMetal) {
        const brushing = hash(0, y, seed + 3);
        height = mid * .035 + grain * .008 + brushing * .012;
        shade = (coarse - .5) * 14 + (brushing - .5) * 9 + (grain - .5) * 5;
        if (groove) {height -= .15; shade -= 30;}
        if (edge < 7) shade += 16;
        // Oxidation islands create rougher patches on otherwise brushed metal.
        shade -= Math.max(0, .38 - coarse) * 30;
      }
      if(kind==='stone') {
        const seam=Math.abs(u-(.22+seed*.11)-Math.sin(v*11+seed)*.025);
        const branch=Math.abs(v-.73-Math.sin(u*8+seed)*.035);
        if((seam<.0035&&v>.53)||(branch<.0025&&u>.60)){height-=.19;shade-=46;}
        if(edge<5){height-=.035+grain*.045;shade-=8+grain*9;}
      }
      if(kind==='masonry') {
        // Architectural stone has sediment, pores and fractures, rather than
        // the inset rectangular motif used to distinguish playable slabs.
        const strata=noise(u*3,v*21,seed+4),pit=noise(u*100,v*100,seed+6);
        shade+=(strata-.5)*17-Math.max(0,.24-pit)*100;
        height+=strata*.045-Math.max(0,.24-pit)*.27;
        const fracture=Math.abs(u-.36-Math.sin(v*7+seed)*.07-Math.sin(v*23)*.011);
        if(fracture<.004&&v>.12&&v<.82){height-=.17;shade-=34;}
      }
      if(kind==='ice'){
        const vein=Math.abs(u-.38-Math.sin(v*8+seed)*.045),vein2=Math.abs(v-.64-Math.sin(u*6+seed)*.055);
        shade=(coarse-.5)*14+(fine-.5)*8;
        if((vein<.004&&v>.25)||(vein2<.003&&u>.5)){height-=.09;shade+=18;}
        height=height*.3; // Cold slabs have broad crystal planes, not sandstone grit.
      }
      if(kind==='snow'){height=fine*.018+grain*.008;shade=(coarse-.5)*4+(grain-.5)*3;}
      if (kind === 'fragile') {
        const crack = Math.abs(u - .28 - Math.sin(v * 13) * .07 - Math.sin(v * 38) * .015);
        const crack2 = Math.abs(v - .68 - Math.sin(u * 11) * .055);
        if (crack < .006 || crack2 < .004) { height -= .24; shade -= 58; }
      }
      heights[i] = height;
      const j = i * 4;
      for (let k = 0; k < 3; k++) colors[j + k] = clamp(base[k] + shade, 0, 255);
      colors[j + 3] = 255;
      const r = isMetal ? 155 + coarse * 40 + grain * 8 : 190 + coarse * 43;
      rough[j] = rough[j + 1] = rough[j + 2] = r; rough[j + 3] = 255;
    }
    const strength = isMetal ? 2.2 : 3.0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = i * 4;
      const left = heights[y * w + Math.max(0, x - 1)], right = heights[y * w + Math.min(w - 1, x + 1)];
      const up = heights[Math.max(0, y - 1) * w + x], down = heights[Math.min(h - 1, y + 1) * w + x];
      const nx = (left - right) * strength, ny = (down - up) * strength;
      const length = Math.hypot(nx, ny, 1);
      normals[j] = (nx / length * .5 + .5) * 255;
      normals[j + 1] = (ny / length * .5 + .5) * 255;
      normals[j + 2] = (1 / length * .5 + .5) * 255; normals[j + 3] = 255;
    }
    return new THREE.MeshStandardMaterial({
      map: textureFromPixels(colors, w, h, renderer, true),
      normalMap: textureFromPixels(normals, w, h, renderer, false),
      roughnessMap: textureFromPixels(rough, w, h, renderer, false),
      normalScale: new THREE.Vector2(isMetal ? .42 : .7, isMetal ? .42 : .7), roughness:kind==='ice'?.58:kind==='snow'?.96:1,
      metalness:isMetal ? .58 : .02, envMapIntensity:isMetal ? .65 : .3
    });
  }
  B.createSurface=surface;
  // Seamless height/slope field. Two advected samples supply small waves without
  // evaluating a long noise function at every screen pixel on every frame.
  B.createWaterField=renderer=>{
    const size=512,heights=new Float32Array(size*size),data=new Uint8Array(size*size*4);
    const waves=[[3,11,.34,.2],[1,19,.24,1.6],[5,23,.17,2.8],[7,31,.10,.8],[13,35,.065,2.1],[9,43,.035,4.4]];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const u=x/size*Math.PI*2,v=y/size*Math.PI*2,warp=.55*Math.sin(u*2+v*3)+.28*Math.cos(u*3-v*2);
      let h=0;for(const [kx,ky,a,phase] of waves)h+=a*Math.sin(u*kx+v*ky+phase+warp);
      heights[y*size+x]=h;
    }
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=y*size+x,k=i*4,dx=(heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size])*5.6,dz=(heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x])*5.6;
      data[k]=clamp((dx*.5+.5)*255,0,255);data[k+1]=clamp((dz*.5+.5)*255,0,255);data[k+2]=clamp((heights[i]*.5+.5)*255,0,255);data[k+3]=255;
    }
    const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;return texture;
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
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0,'#9daebd'); gradient.addColorStop(.46,'#d4e6de');
    gradient.addColorStop(.53,'#253745'); gradient.addColorStop(1,'#10171e');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 512, 256);
    // Large softbox reflections, kept out of the visible background.
    ctx.fillStyle = '#f9e8d0'; ctx.fillRect(68, 35, 88, 58);
    ctx.fillStyle = '#a1cce2'; ctx.fillRect(330, 40, 52, 90);
    const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding;
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
