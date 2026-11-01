const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const { createCanvas, ImageData, loadImage } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadFallCases() {
  const levels = new Map(fs.readdirSync(path.join(root, 'levels'))
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const level = JSON.parse(fs.readFileSync(path.join(root, 'levels', file), 'utf8'));
      return [String(level.id), level];
    }));
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fall_cases.json'), 'utf8'))
    .map(({level_id, ...fixture}) => {
      if(fixture.level)return fixture;
      assert(levels.has(level_id), 'Fall fixture must reference a real level');
      return {...fixture, level: levels.get(level_id)};
    });
}

async function wait(check, label, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (check()) return;
    await sleep(20);
  }
  throw new Error('Timed out: ' + label);
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function createUI({savedLevel,storageUnavailable=false}={}) {
  const port = await availablePort();
  const baseURL = 'http://127.0.0.1:' + port;
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const server = spawn(
    python,
    [
      '-m',
      'flask',
      '--app',
      'main',
      'run',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--no-reload',
    ],
    {
      cwd: root,
      env: { ...process.env },
      stdio: 'ignore',
    },
  );
  let dom, serverError;
  server.on('error', (error) => {
    serverError = error;
  });
  const close = () => {
    dom?.window.close();
    server.kill('SIGTERM');
  };
  try {
    let catalog = null;
    for (let i = 0; i < 60; i++) {
      if (serverError) throw serverError;
      if (server.exitCode !== null)
        throw new Error('Flask exited before startup; check Python dependencies');
      try {
        const response = await fetch(baseURL + '/api/levels');
        if (response.ok) {
          catalog = await response.json();
          break;
        }
      } catch {}
      await sleep(100);
    }
    assert(catalog, 'Flask did not return a level catalog');
    const levelIds = Object.keys(catalog);
    assert(levelIds.length > 0, 'The level catalog must not be empty');
    const stageNumber = (id) =>
      `MÀN ${String(levelIds.indexOf(id) + 1).padStart(2, '0')} / ${String(levelIds.length).padStart(2, '0')}`;
    const html = fs.readFileSync(path.join(root, 'templates/index.html'), 'utf8');
    dom = new JSDOM(html, {
      runScripts: 'outside-only',
      pretendToBeVisual: true,
      url: baseURL + '/',
    });
    const w = dom.window,
      d = w.document;
    if(savedLevel!==undefined)w.localStorage.setItem('bloxorz-current-level',savedLevel);
    if(storageUnavailable)Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('Storage unavailable','SecurityError');}});
    w.ImageData = ImageData;
    w.AbortController = AbortController;
    w.matchMedia = () => ({ matches: false });
    w.ResizeObserver = class {
      constructor(fn) {
        this.fn = fn;
      }
      observe() {
        this.fn();
      }
      disconnect() {}
    };
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', {
      get() {
        return 1100;
      },
    });
    Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', {
      get() {
        return 650;
      },
    });
    w.HTMLCanvasElement.prototype.getContext = function () {
      return createCanvas(this.width, this.height).getContext('2d');
    };
    // GPU thumbnail rendering is mocked; support its normal PNG export path.
    w.HTMLCanvasElement.prototype.toDataURL = function () {
      return createCanvas(this.width,this.height).toDataURL('image/png');
    };
    w.HTMLCanvasElement.prototype.setPointerCapture = function () {};
    const errors = [];
    w.addEventListener('error', (e) => errors.push(e.message));
    const moves = [];
    const controls = {
      solveDelay: 0,
      moveFailure: false,
      inflight: 0,
      maxInflight: 0,
      mockSolvers: true,
      solverUnavailable: false,
      benchmarkFixture: null,
      benchmarkDelay: 0,
      benchmarkCalls: [],
      benchmarkInflight: 0,
      benchmarkMaxInflight: 0,
    };
    const cases = JSON.parse(fs.readFileSync(path.join(root, 'tests/test_cases.json'), 'utf8'));
    const canonical = Object.keys(cases).filter((id) => cases[id].level === id);
    assert.deepEqual(canonical, levelIds, 'test_cases.json must cover every game level');
    // Canned API responses exercise replay UI only; they are NOT solver implementations.
    w.fetch = async (url, options = {}) => {
      if(url==='/api/benchmark'){
        const request=JSON.parse(options.body);controls.benchmarkCalls.push(request);
        controls.benchmarkInflight++;controls.benchmarkMaxInflight=Math.max(controls.benchmarkMaxInflight,controls.benchmarkInflight);
        try{
          if(controls.benchmarkDelay)await sleep(controls.benchmarkDelay);
          if(controls.benchmarkFixture)return new Response(JSON.stringify({solver:request.solver,level_id:request.level_id,limit_ms:request.limit_ms,level_revision:'fixture-revision',...controls.benchmarkFixture[request.solver]}),{status:200});
          return await fetch(new URL(url,w.location.href),options);
        }finally{controls.benchmarkInflight--;}
      }
      if (url === '/api/solve' && controls.solveDelay) await sleep(controls.solveDelay);
      // Exercise the unavailable-solver UI independently of real solver progress.
      // Flask's real 501 response is covered by test_game.py.
      if (url === '/api/solve' && controls.solverUnavailable) {
        return new Response(
          JSON.stringify({
            error: 'Thuật toán chưa hoàn thiện (fixture).',
            code: 'SOLVER_NOT_IMPLEMENTED',
          }),
          { status: 501 },
        );
      }
      if (url === '/api/solve' && controls.mockSolvers) {
        const request = JSON.parse(options.body),
          sample = cases[request.level_id],
          actions = sample.walkthrough || [];
        const cost = sample.solvable
          ? ['ucs', 'astar'].includes(request.solver)
            ? sample.walkthrough_cost
            : actions.length
          : 0;
        return new Response(
          JSON.stringify({
            found: sample.solvable,
            moves: actions,
            solution_length: actions.length,
            expanded_nodes: 10,
            search_time_ms: 1,
            memory_kb: 1,
            total_cost: cost,
          }),
          { status: 200 },
        );
      }
      if (url === '/api/move') {
        controls.inflight++;
        controls.maxInflight = Math.max(controls.maxInflight, controls.inflight);
        try {
          if (controls.moveFailure) {
            controls.moveFailure = false;
            return { ok: false, status: 503, json: async () => ({}) };
          }
          const response = await fetch(new URL(url, w.location.href), options);
          const data = await response.clone().json();
          moves.push({ request: JSON.parse(options.body), data });
          return response;
        } finally {
          controls.inflight--;
        }
      }
      return fetch(new URL(url, w.location.href), options);
    };
    // Only the unavailable GPU backend is mocked. Real Three.js transforms,
    // geometry, PBR textures, DOM events, timers and Flask APIs execute normally.
    w.eval(fs.readFileSync(path.join(root, 'static/vendor/three.min.js'), 'utf8'));
    w.THREE.WebGLRenderer = class {
      constructor() {
        this.domElement = d.createElement('canvas');
        this.shadowMap = {};
        this.capabilities = { getMaxAnisotropy: () => 8 };
      }
      setPixelRatio() {}
      setSize() {}
      render(scene, camera) {
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
      }
    };
    w.THREE.PMREMGenerator = class {
      fromEquirectangular() {
        return { texture: new w.THREE.Texture() };
      }
      dispose() {}
    };
    for (const file of ['materials.js', 'scene.js'])
      w.eval(fs.readFileSync(path.join(root, 'static/js', file), 'utf8'));
    await w.Bloxorz.prepareRenderAssets(url => loadImage(path.join(root, url.slice(1))));
    const OriginalScene = w.Bloxorz.GameScene;
    let scene;
    w.Bloxorz.GameScene = class extends OriginalScene {
      constructor(...args) {
        super(...args);
        scene = this;
      }
    };
    w.eval(fs.readFileSync(path.join(root, 'static/js/game.js'), 'utf8'));
    w.eval(fs.readFileSync(path.join(root, 'static/js/comparison.js'), 'utf8'));
    const el = (id) => d.getElementById(id),
      count = () => Number(el('hud-moves').textContent);
    const key = (code, type = 'keydown', extra = {}) => {
      const event = new w.KeyboardEvent(type, {
        code,
        key: code,
        bubbles: true,
        cancelable: true,
        ...extra,
      });
      (d.activeElement || d.body).dispatchEvent(event);
      return event;
    };
    const tap = (code) => {
      key(code);
      key(code, 'keyup');
    };
    const click = (id) => el(id).click();
    const ready = () =>
      d.body.dataset.renderReady === 'true' && d.body.dataset.mode === 'idle' &&
      el('loading').hidden &&
      el('level-select').options.length === levelIds.length &&
      el('status-toast').textContent.includes('WASD');
    async function reset() {
      tap('KeyR');
      await wait(() => count() === 0 && ready(), 'restart');
    }
    async function select(value) {
      el('level-select').value = value;
      el('level-select').dispatchEvent(new w.Event('change', { bubbles: true }));
      await wait(() => ready() && el('level-select').value === value, 'select ' + value);
    }

    async function returnToPlay(){
      for(let i=0;i<8&&w.Bloxorz.ui.screen!=='play';i++){
        if(w.Bloxorz.ui.screen==='pause'&&!el('leave-replay').hidden){click('leave-replay');await wait(()=>w.Bloxorz.ui.screen==='play','explicit return to manual play');}
        else if(w.Bloxorz.ui.screen==='solver')click('back');
        else tap('Escape');
      }
      assert.equal(w.Bloxorz.ui.screen,'play');
    }
    await wait(ready, 'initial load');
    return {
      w,
      d,
      scene,
      controls,
      moves,
      errors,
      levelIds,
      stageNumber,
      el,
      count,
      key,
      tap,
      click,
      ready,
      reset,
      select,
      returnToPlay,
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}

// Các kịch bản UI dùng chung môi trường createUI() ở trên.
test('Bloxorz UI', async (t) => {
  const ui = await createUI();
  const {
    w,
    d,
    scene,
    controls,
    moves,
    errors,
    levelIds,
    stageNumber,
    el,
    count,
    key,
    tap,
    click,
    ready,
    reset,
    select,
    returnToPlay,
  } = ui;
  try {
    await t.test('thin bevel geometry, outward normals and square split-cube maps', async () => {
      assert.deepEqual(
        Array.from(el('level-select').options, (option) => option.value),
        levelIds,
      );
      assert.equal(scene.camera.isOrthographicCamera, true);
      assert.equal(scene.renderer.shadowMap.enabled, true);
      for (const m of [
        scene.materials.stone[0],
        scene.materials.fragile,
        scene.materials.copper,
        scene.materials.cube,
      ]) {
        assert(m.map && m.normalMap && m.roughnessMap);
        assert.notEqual(m.map, m.normalMap);
        assert.equal(m.map.encoding, w.THREE.sRGBEncoding);
        assert.equal(m.normalMap.encoding, w.THREE.LinearEncoding);
      }
      assert.equal(scene.materials.cube.map.image.width, scene.materials.cube.map.image.height);
      assert.equal(
        scene.materials.copper.map.image.height,
        2 * scene.materials.copper.map.image.width,
      );
      assert.equal(/\p{Extended_Pictographic}/u.test(d.body.textContent), false);
      assert.equal(el('stage-number').textContent, stageNumber('1'));
      assert.equal(el('level-difficulty').textContent, scene.level.difficulty);
      // Thin beveled geometry must stay finite, convex and outward-facing.
      for (const dims of [
        [0.78, 0.024, 0.78, 0.015],
        [0.86, 0.032, 0.018, 0.007],
        [0.94, 1.94, 0.94, 0.055],
      ]) {
        const g = w.Bloxorz.roundedBox(...dims),
          p = g.attributes.position,
          n = g.attributes.normal;
        const half = dims.slice(0, 3).map((x) => x / 2);
        for (let i = 0; i < p.count; i++) {
          const pos = new w.THREE.Vector3().fromBufferAttribute(p, i),
            normal = new w.THREE.Vector3().fromBufferAttribute(n, i);
          assert(pos.toArray().every(Number.isFinite));
          assert(normal.toArray().every(Number.isFinite));
          assert(Math.abs(normal.length() - 1) < 1e-5);
          assert(pos.dot(normal) > 0);
          pos.toArray().forEach((value, axis) => assert(Math.abs(value) <= half[axis] + 1e-6));
          // A top/bottom face cannot point through the opposite side of a thin cap.
          if (Math.abs(pos.y) > half[1] - 0.0001) assert(pos.y * normal.y > 0);
        }
        const indices = g.index.array;
        for (let i = 0; i < indices.length; i += 3) {
          const a = new w.THREE.Vector3().fromBufferAttribute(p, indices[i]);
          const b = new w.THREE.Vector3().fromBufferAttribute(p, indices[i + 1]);
          const c = new w.THREE.Vector3().fromBufferAttribute(p, indices[i + 2]);
          const cross = b.clone().sub(a).cross(c.clone().sub(a));
          assert(cross.length() > 1e-12);
          assert(cross.dot(a.clone().add(b).add(c)) > 0);
        }
        g.dispose();
      }
    });
    await t.test(
      'unimplemented solver reports 501 clearly; manual play remains available',
      async () => {
        controls.solverUnavailable = true;
        try {
          await select('1');
          await reset();
          void w.Bloxorz.ui.actions.runSolver('bfs');
          await wait(
            () => el('status-toast').textContent.includes('chưa hoàn thiện'),
            'pending solver notice',
          );
          assert.equal(count(), 0);
          assert.equal(el('playback').hidden, true);
        } finally { controls.solverUnavailable = false; }
      },
    );
    await t.test('WASD, arrow keys, one queued tap, serialized requests', async () => {
      await reset();
      tap('Space');
      await sleep(70);
      assert.equal(count(), 0);
      assert.equal(moves.length, 0);
      tap('KeyD');
      tap('ArrowDown');
      await wait(() => count() === 2, 'queued WASD and arrow');
      assert.equal(moves[0].request.action, 'RIGHT');
      assert.equal(moves[1].request.action, 'DOWN');
      assert.deepEqual(moves[1].request.state, moves[0].data.next_state);
      assert.equal(controls.maxInflight, 1);
    });
    await t.test('hold/release and focus-loss handling', async () => {
      await reset();
      key('KeyD');
      await wait(() => count() === 2, 'held input');
      key('KeyD', 'keyup');
      await sleep(700);
      assert.equal(count(), 2);
      await reset();
      key('KeyD');
      w.dispatchEvent(new w.Event('blur'));
      await wait(() => count() === 1, 'blur release');
      await sleep(500);
      assert.equal(count(), 1);
    });
    await t.test('form focus, modifier shortcuts, loss animation and R restart', async () => {
      await reset();
      el('level-select').focus();
      tap('ArrowDown');
      tap('KeyD');
      await sleep(100);
      assert.equal(count(), 0);
      el('canvas-container').focus();
      key('KeyD', 'keydown', { ctrlKey: true });
      key('KeyD', 'keyup');
      assert.equal(count(), 0);
      tap('ArrowUp');
      await wait(() => !el('game-overlay').hidden, 'invalid fall');
      assert.equal(el('overlay-title').textContent, 'Khối đã rơi');
      await reset();
      assert.equal(el('game-overlay').hidden, true);
    });
    await t.test('solver replay, manual-input lock, goal drop and win lock', async () => {
      await select('1');
      await reset();
      void w.Bloxorz.ui.actions.runSolver('bfs');
      await wait(() => el('status-toast').textContent.includes('Nhấn Phát'), 'solution ready');
      void w.Bloxorz.ui.actions.playReplay();
      await wait(() => el('input-status').textContent === 'ĐANG PHÁT LỜI GIẢI', 'BFS start');
      const before = moves.length;
      tap('KeyD');
      tap('Space');
      await wait(() => w.Bloxorz.ui.actions.inspect().replayOutcome==='complete', 'BFS replay completion');
      assert.equal(count(), 7);
      assert.equal(el('game-overlay').hidden,true);
      assert.equal(el('m-len').textContent, '7 bước');
      assert(moves.length >= before);
      const frozen = count();
      tap('KeyD');
      await sleep(100);
      assert.equal(count(), frozen);
    });
    await t.test(
      'both cube texture rotations persist; Space and parked switch remain stable',
      async () => {
        await select('4');
        tap('ArrowRight');
        await wait(() => count() === 1, 'split approach');
        tap('ArrowRight');
        await wait(() => count() === 2, 'split switch');
        assert.equal(el('hud-orient').textContent, 'Khối 1 / 2');
        const sameRotation = (a, b) =>
          assert(1 - Math.abs(a.dot(b)) < 1e-6, 'rotation changed at animation boundary');
        const rightTurn = new w.THREE.Quaternion().setFromAxisAngle(
          new w.THREE.Vector3(0, 0, -1),
          Math.PI / 2,
        );
        const leftTurn = new w.THREE.Quaternion().setFromAxisAngle(
          new w.THREE.Vector3(0, 0, 1),
          Math.PI / 2,
        );
        const original0 = scene.blocks.children[0].quaternion.clone(),
          original1 = scene.blocks.children[1].quaternion.clone();
        tap('ArrowRight');
        await wait(() => count() === 3, 'first cube roll');
        sameRotation(scene.blocks.children[0].quaternion, original0.clone().premultiply(rightTurn));
        sameRotation(scene.blocks.children[1].quaternion, original1);
        tap('ArrowRight');
        await wait(() => count() === 4, 'cube parked on soft switch');
        const parked = scene.blocks.children[0].quaternion.clone();
        sameRotation(parked, original0.clone().premultiply(rightTurn).premultiply(rightTurn));
        tap('Space');
        await wait(() => el('hud-orient').textContent === 'Khối 2 / 2', 'Space switch');
        assert.equal(count(), 4);
        assert.equal(el('hud-orient').textContent, 'Khối 2 / 2');
        sameRotation(scene.blocks.children[0].quaternion, parked);
        sameRotation(scene.blocks.children[1].quaternion, original1);
        tap('ArrowLeft');
        await wait(() => count() === 5, 'move other cube while switch held');
        sameRotation(scene.blocks.children[0].quaternion, parked);
        sameRotation(scene.blocks.children[1].quaternion, original1.clone().premultiply(leftTurn));
        assert.equal(moves.at(-1).data.next_state.bridges[0], true);
        assert(scene.bridgeGroups.get(0).every((group) => group.visible));
        assert.equal(scene.markers.children.length, 1);
        const marker = scene.markers.children[0];
        assert.equal(marker.parent, scene.markers);
        assert(Math.abs(marker.rotation.x + Math.PI / 2) < 1e-6);
        assert(Math.abs(marker.position.y - scene.blocks.children[1].position.y - 0.65) < 1e-6);
      },
    );
    await t.test('Stop and changing stage discard stale requests/animations', async () => {
      await select('3');
      void w.Bloxorz.ui.actions.runSolver('bfs');
      await wait(() => el('status-toast').textContent.includes('Nhấn Phát'), 'solution ready');
      void w.Bloxorz.ui.actions.playReplay();
      await wait(() => count() === 2, 'replay before Stop');
      click('stop-solver');
      const stopped = count();
      await sleep(750);
      assert.equal(count(), stopped);
      assert.equal(el('playback').hidden, true);
      tap('KeyR');
      await wait(() => count() === 0 && ready(), 'restart after Stop');
      controls.solveDelay = 350;
      void w.Bloxorz.ui.actions.runSolver('bfs');
      await wait(() => el('input-status').textContent === 'ĐANG TÌM LỜI GIẢI', 'slow solver');
      await select('2');
      await sleep(600);
      assert.equal(count(), 0);
      assert.equal(el('stage-title').textContent, scene.level.display_name||scene.level.name);
      controls.solveDelay = 0;
    });
    await t.test('failed move request recovers without locking controls', async () => {
      await select('2');
      await reset();
      controls.moveFailure = true;
      tap('KeyD');
      await wait(() => el('status-toast').textContent.includes('503'), 'API error');
      assert.equal(count(), 0);
      tap('KeyD');
      await wait(() => count() === 1, 'input after error');
    });
    await t.test('advanced stage complete playback, split/rejoin and bridge', async () => {
      await select('4');
      void w.Bloxorz.ui.actions.runSolver('astar');
      await wait(() => el('status-toast').textContent.includes('Nhấn Phát'), 'solution ready');
      void w.Bloxorz.ui.actions.playReplay();
      await wait(() => w.Bloxorz.ui.actions.inspect().replayOutcome==='complete', 'stage 4 A* replay completion', 18000);
      assert.equal(el('game-overlay').hidden,true);
      assert.equal(count(), 16);
      assert(moves.some((m) => ['SUP', 'SLEFT', 'SRIGHT', 'SDOWN'].includes(m.request.action)));
    });
    await t.test('bridge closure drops only unsupported split cube', async () => {
      // A parked cube on a closing bridge falls; the active cube on solid floor stays.
      const fixture = {
        grid: Array.from({ length: 8 }, () => Array(8).fill(1)),
        start_pos: [1, 1],
      };
      fixture.grid[1][1] = 10;
      fixture.grid[6][5] = 3;
      const splitBefore = {
        r: 1,
        c: 1,
        orientation: 'SPLIT',
        bridges: [true],
        r2: 6,
        c2: 4,
        active_cube: 1,
      };
      const splitAfter = { ...splitBefore, c2: 5, bridges: [false] };
      scene.build(fixture, splitBefore);
      const cube0 = scene.blocks.children[0],
        cube1 = scene.blocks.children[1];
      await scene.roll(splitBefore, 'RIGHT', null, false, splitAfter);
      assert.equal(cube0.visible, true);
      assert.equal(cube0.userData.submerged,true);
      assert(cube0.position.y<-.85,'unsupported cube remains on the seabed');
      assert.equal(cube1.visible, true);
      assert(Math.abs(cube1.position.y - 0.5) < 1e-6);
    });
    await t.test('new level metadata, numeric ordering, two bridge groups and reset', async () => {
      await select('12');
      assert.equal(el('stage-title').textContent, scene.level.display_name||scene.level.name);
      assert.equal(el('stage-number').textContent, stageNumber('12'));
      assert.equal(el('level-difficulty').textContent, scene.level.difficulty);
      assert.equal(el('level-summary').textContent, el('stage-description').textContent);
      for (const bridge of scene.bridgeGroups.values())
        assert(bridge.every((group) => !group.visible));
    });
    await t.test('screen stack blocks moves and restores play; settings persist', async () => {
      w.eval(fs.readFileSync(path.join(root, 'static/js/shell.js'), 'utf8'));
      await select('1');
      click('menu-toggle');
      assert.equal(w.Bloxorz.ui.screen, 'pause');
      const before=count();tap('KeyD');await sleep(350);assert.equal(count(),before);
      click('choose-settings');
      const jade=[...d.querySelectorAll('.skin-option')].find(b=>b.textContent==='Ngọc');jade.click();
      click('apply');
      assert.equal(JSON.parse(w.localStorage.getItem('bloxorz-garden')).skin,'jade');
      assert.equal(w.Bloxorz.ui.screen,'pause');click('resume');
      assert.equal(w.Bloxorz.ui.screen,'play');
    });
    await t.test('solver result waits for play and replay seek restores engine state', async () => {
      await select('4');
      controls.mockSolvers=false;
      await w.Bloxorz.ui.actions.runSolver('astar');
      assert.equal(count(),0);
      await w.Bloxorz.ui.actions.seekReplay(4);
      assert.equal(count(),4);assert.equal(el('hud-orient').textContent,'Khối 1 / 2');
      await w.Bloxorz.ui.actions.seekReplay(0);assert.equal(count(),0);
      assert.equal(el('hud-orient').textContent,'Đứng thẳng');
    });
    await t.test('AI completion stays inline while manual victory keeps its outcome dialog', async()=>{
      await returnToPlay();await select('1');assert.equal(d.body.dataset.renderReady,'true');
      await w.Bloxorz.ui.actions.runSolver('astar');await w.Bloxorz.ui.actions.playReplay();
      assert.equal(w.Bloxorz.ui.actions.inspect().replayOutcome,'complete');
      assert(el('game-overlay').hidden);assert.equal(el('shell').inert,false);
      await w.Bloxorz.ui.actions.restart();
      const sample=JSON.parse(fs.readFileSync(path.join(root,'tests/test_cases.json'),'utf8'))['1'];
      for(const [i,action]of sample.walkthrough.entries()){
        tap({UP:'ArrowUp',DOWN:'ArrowDown',LEFT:'ArrowLeft',RIGHT:'ArrowRight'}[action]);
        await wait(()=>count()===i+1&&d.body.dataset.mode!=='moving','manual victory step '+i);
      }
      assert.equal(d.body.dataset.mode,'won');assert(!el('game-overlay').hidden);
      assert.equal(el('shell').inert,true);assert(el('result-strip').hidden);assert.equal(el('end-metrics'),null);
      assert.equal(el('level-select').value,'1','no automatic next level');
      tap('KeyR');await wait(()=>d.body.dataset.mode==='idle','manual outcome restart');
    });
    await t.test('water and bed remain in front of near clip throughout orbit and zoom', async () => {
      const T=w.THREE;
      for(const screen of ['play','settings','solver']){
        d.body.dataset.screen=screen;
        for(const elevation of [.3,.65,1.18])for(const zoom of [.65,1,1.65])for(const azimuth of [0,1.2,3.1,4.8]){
          scene.elevation=elevation;scene.zoom=zoom;scene.azimuth=azimuth;scene.setCamera();
          for(const y of [-.85,-2.6])for(const xN of [-1,1])for(const yN of [-1,1]){
            const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(xN,yN),scene.camera);
            const hit=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-y),new T.Vector3());
            assert(hit,'every screen corner must intersect water in front of the camera');
            const projected=hit.clone().project(scene.camera);
            assert(projected.z>-1&&projected.z<1,'water/bed must be between near and far clipping planes');
          }
        }
      }
      d.body.dataset.screen='play';scene.resetCamera();
    });
    await t.test('fall poses never penetrate surviving floor slabs', async () => {
      const fixtures=loadFallCases();
      const tween=scene.tween;let samples=0;
      scene.tween=async function(duration,update){
        for(let frame=0;frame<=60;frame++){
          update(frame/60);this.scene.updateMatrixWorld(true);samples++;
          for(const obj of [...this.blocks.children,...this.pivot.children]){
            if(!obj.visible||!obj.children[0]?.geometry)continue;
            const mesh=obj.children[0],positions=mesh.geometry.attributes.position;
            for(let j=0;j<positions.count;j++){
              const p=new w.THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld);
              if(p.y>=-.025||p.y<=-.37)continue;
              for(const [key,tile] of this.tiles){const [r,c]=key.split(',').map(Number);if(!tile.visible||tile.position.y<-.02||this.level.grid[r][c]===9)continue;
                assert(!(Math.abs(p.x-tile.position.x)<.45&&Math.abs(p.z-tile.position.z)<.45),'block intersects supported slab '+key);
              }
            }
          }
        }
        return true;
      };
      try{for(const item of fixtures){scene.build(item.level,item.before);scene.rotation.copy(scene.canonicalRotation(item.before.orientation));scene.showState(item.before);
        const out=item.outcome;await scene.roll(item.before,item.action,out.next_state,out.valid,out.failure_state);
        if(item.name==='goal')await scene.victory();
      }assert(samples>400);}finally{scene.tween=tween;}
    });
    await t.test('AI status is replaced across algorithm changes and results', async () => {
      await select('1');click('menu-toggle');click('choose-solver');
      assert.equal(el('solver-status').dataset.state,'ready');
      await w.Bloxorz.ui.actions.runSolver('astar');
      assert.equal(w.Bloxorz.ui.screen,'replay');click('back');
      assert.equal(el('solver-status').dataset.state,'found');
      const bfs=[...el('tabs').querySelectorAll('button')].find(b=>b.textContent==='BFS');bfs.click();
      await wait(()=>d.body.dataset.mode==='idle','algorithm reset');
      assert.equal(el('solver-status').dataset.state,'ready');assert(el('result-strip').hidden);
      assert.equal(d.querySelectorAll('#solver-status').length,1);
    });
    await t.test('map themes change scenery without changing engine cells', async () => {
      w.eval(fs.readFileSync(path.join(root,'static/js/garden.js'),'utf8'));
      await select('2');const grid=JSON.stringify(scene.level.grid),tileCount=scene.tiles.size;
      scene.setAppearance('stone','garden');
      assert(scene.decor.children.some(x=>x.material===scene.artMats.pink));
      scene.setAppearance('stone','frost');
      assert(scene.decor.children.some(x=>x.material===scene.artMats.snow));
      assert(scene.decor.children.some(x=>x.material===scene.artMats.pine));
      assert(!scene.decor.children.some(x=>scene.artMats.leaf.includes(x.material)||x.material===scene.artMats.pink||x.material===scene.artMats.purple));
      assert.equal(JSON.stringify(scene.level.grid),grid);assert.equal(scene.tiles.size,tileCount);
      for(const theme of ['ruins','garden','frost']){
        scene.setAppearance('stone',theme);
        for(const mesh of scene.decor.children){if(!mesh.isInstancedMesh)continue;mesh.geometry.computeBoundingBox();
          for(let i=0;i<mesh.count;i++){const transform=new w.THREE.Matrix4();mesh.getMatrixAt(i,transform);const box=mesh.geometry.boundingBox.clone().applyMatrix4(transform);
            if(box.max.y<=.025||box.min.y>=2.35)continue;
            scene.level.grid.forEach((row,r)=>row.forEach((tile,c)=>{if(!tile)return;const p=scene.world(r,c);assert(!(box.max.x>p.x-.495&&box.min.x<p.x+.495&&box.max.z>p.z-.495&&box.min.z<p.z+.495),'scenery enters playable volume');}));
          }
        }
      }
      assert.equal(scene.water.position.y,-.85);assert.equal(scene.seabed.position.y,-2.6);
      scene.setAppearance('stone','ruins');
    });
    await t.test('frost uses independent ice maps and theme switching restores stone without changing play state', () => {
      const state=JSON.stringify(w.Bloxorz.ui.actions.inspect()),grid=JSON.stringify(scene.level.grid);
      scene.setAppearance('stone','ruins');const stone=scene.materials.stone[0].map;
      scene.setAppearance('stone','frost');assert.notEqual(scene.materials.stone[0].map,stone);assert.equal(scene.materials.stone[0].map,scene.themeSurfaces.frozen.map);
      assert.notEqual(scene.artMats.snow.map,stone);assert(scene.artMats.snow.map);
      scene.setAppearance('stone','garden');assert.equal(scene.materials.stone[0].map,stone);
      assert.equal(JSON.stringify(scene.level.grid),grid);assert.equal(JSON.stringify(w.Bloxorz.ui.actions.inspect()),state);
      scene.setAppearance('stone','ruins');
    });
    await t.test('cinematic camera is gradual, cancellable, and respects reduced motion', async () => {
      scene.azimuth=-1.7;scene.elevation=.35;scene.zoom=.8;scene.setCamera();
      scene.resetCamera(true);
      assert.equal(scene.azimuth,-1.7,'must not snap on C');
      await sleep(180);assert(scene.azimuth>-1.7&&scene.azimuth<.45);
      scene.stopCameraMotion();const stopped=scene.azimuth;await sleep(80);assert.equal(scene.azimuth,stopped);
      scene.resetCamera(true);await sleep(1200);assert.equal(scene.azimuth,.45);assert.equal(scene.zoom,1);
      scene.reducedMotion=true;scene.azimuth=2;scene.resetCamera(true);assert.equal(scene.azimuth,.45);assert.equal(scene.cameraFrame,0);scene.reducedMotion=false;
    });
    await t.test('F frames the active block on a large level, keeps local zoom on resize and C restores overview', async () => {
      await returnToPlay();
      const catalog=await (await w.fetch('/api/levels')).json();
      const boards=await Promise.all(Object.keys(catalog).map(async id=>(await (await w.fetch('/api/level/'+id)).json()).level));
      const largest=boards.reduce((a,b)=>a.grid.length*a.grid[0].length>b.grid.length*b.grid[0].length?a:b);
      await select(String(largest.id));scene.resetCamera();scene.reducedMotion=false;
      const overview=scene.captureView(),state=JSON.parse(JSON.stringify(w.Bloxorz.ui.actions.inspect().state)),p=scene.placements(state)[0];
      tap('KeyF');assert.equal(scene.target.x,overview.target[0],'F must not teleport');await sleep(950);
      assert(scene.localView);assert(scene.distance<=10);assert(scene.distance<overview.distance*.6,'large level requires a genuinely closer framing');
      assert(Math.abs(scene.target.x-p.x)<1e-8);assert(Math.abs(scene.target.z-p.z)<1e-8);assert.equal(scene.azimuth,overview.azimuth);
      const projected=new w.THREE.Vector3(p.x,.5,p.z).project(scene.camera);assert(Math.abs(projected.x)<.25&&Math.abs(projected.y)<.5,'active block stays in usable centre');
      const close=scene.distance;scene.resize();assert.equal(scene.distance,close,'resize must preserve local framing');
      const beforeEdit=scene.captureView();el('level-select').focus();tap('KeyF');assert.equal(scene.cameraFrame,0);assert.deepEqual(scene.captureView(),beforeEdit,'shortcuts ignore editable controls');
      el('canvas-container').focus();tap('KeyC');await sleep(1150);assert.equal(scene.localView,false);assert.deepEqual([...scene.target.toArray()],[0,.15,0]);assert(Math.abs(scene.distance-overview.distance)<1e-8);
      click('focus-block');assert(scene.cameraFrame,'visible focus control is wired');w.Bloxorz.ui.actions.pause();assert.equal(scene.cameraFrame,0,'opening tools cancels camera motion');scene.resetCamera();
      scene.reducedMotion=true;const split={...state,orientation:'SPLIT',r2:state.r+3,c2:state.c+3,active_cube:1};scene.focusBlock(split);const active=scene.placements(split)[1];
      assert.equal(scene.cameraFrame,0);assert.equal(scene.target.x,active.x);assert.equal(scene.target.z,active.z);
      await w.Bloxorz.ui.actions.restart();assert.equal(scene.localView,false);assert.deepEqual([...scene.target.toArray()],[0,.15,0]);scene.reducedMotion=false;
      assert.equal(scene.outerIslandScale,2.35,'large-level islands have a bounded scale');
      const origin=scene.world(0,0),T=w.THREE;
      for(const mesh of scene.decor.children){if(!mesh.isInstancedMesh)continue;mesh.geometry.computeBoundingBox();
        for(let i=0;i<mesh.count;i++){const matrix=new T.Matrix4();mesh.getMatrixAt(i,matrix);const bounds=mesh.geometry.boundingBox.clone().applyMatrix4(matrix);if(bounds.max.y<=.025||bounds.min.y>=2.35)continue;
          const r0=Math.max(0,Math.floor(bounds.min.z-origin.z+.5)),r1=Math.min(scene.level.grid.length-1,Math.ceil(bounds.max.z-origin.z+.5)),c0=Math.max(0,Math.floor(bounds.min.x-origin.x+.5)),c1=Math.min(scene.level.grid[0].length-1,Math.ceil(bounds.max.x-origin.x+.5));
          for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){if(!scene.level.grid[r][c])continue;const p=scene.world(r,c);assert(!(bounds.max.x>p.x-.495&&bounds.min.x<p.x+.495&&bounds.max.z>p.z-.495&&bounds.min.z<p.z+.495),'large island enters playable volume');}
        }
      }
      await select('1');assert.equal(scene.outerIslandScale,1,'small-level scenery remains unchanged');
    });
    await t.test('restart blends the camera and loss popup preserves the exact current view', async () => {
      await returnToPlay();
      await select('1');scene.reducedMotion=false;
      scene.azimuth=-1.4;scene.elevation=.38;scene.zoom=1.25;scene.setCamera();scene.render();
      const restarting=w.Bloxorz.ui.actions.restart();assert.equal(el('loading').hidden,true);
      assert.equal(d.body.dataset.mode,'resetting');assert(scene.azimuth<-.9,'restart must not snap to default');assert(scene.cameraFrame);
      await sleep(180);assert(scene.azimuth>-1.4&&scene.azimuth<.45);await restarting;assert.equal(d.body.dataset.mode,'idle');scene.stopCameraMotion();
      await select('1');scene.azimuth=-1.1;scene.elevation=.42;scene.zoom=1.3;scene.setCamera();scene.render();
      const pose=()=>[...scene.camera.position.toArray(),...scene.camera.quaternion.toArray(),...scene.camera.projectionMatrix.elements];const before=pose();
      for(let i=0;i<6&&d.body.dataset.mode!=='lost';i++){tap('ArrowUp');await wait(()=>['idle','lost'].includes(d.body.dataset.mode),'controlled loss');}
      assert.equal(d.body.dataset.mode,'lost');scene.render();await sleep(60);assert.equal(el('game-overlay').hidden,false);
      pose().forEach((value,i)=>assert(Math.abs(value-before[i])<1e-8,'loss must not reframe camera component '+i));
      tap('KeyR');assert.equal(el('game-overlay').hidden,true);assert(scene.azimuth<-.8);assert.equal(d.body.dataset.mode,'resetting');await wait(()=>d.body.dataset.mode==='idle','cinematic outcome restart');scene.stopCameraMotion();
    });
    await t.test('restart and solver tools reuse the loaded board without a level request or scenery rebuild', async () => {
      await returnToPlay();
      await select('2');const fetchOriginal=w.fetch,buildOriginal=scene.build,water=scene.water,decor=[...scene.decor.children],board=[...scene.board.children];let requests=0,builds=0;
      const first=JSON.stringify(w.Bloxorz.ui.actions.inspect().state);
      w.fetch=async(url,options)=>{if(String(url).startsWith('/api/level/'))requests++;return fetchOriginal(url,options);};
      scene.build=function(...args){builds++;return buildOriginal.apply(this,args);};
      try{
        tap('ArrowRight');await wait(()=>d.body.dataset.mode==='idle','move before instant restart');assert(count()>0);
        const fragile=[...scene.tiles.entries()].find(([key])=>{const [r,c]=key.split(',').map(Number);return scene.level.grid[r][c]===2;})[1];fragile.position.y=-5;fragile.visible=false;
        const reset=w.Bloxorz.ui.actions.restart();assert.equal(el('loading').hidden,true);await reset;
        assert.equal(count(),0);assert.equal(JSON.stringify(w.Bloxorz.ui.actions.inspect().state),first);assert.equal(fragile.position.y,0);assert.equal(fragile.visible,true);
        w.Bloxorz.ui.actions.prepareSolver();await w.Bloxorz.ui.actions.runSolver('astar');
        assert.equal(requests,0,'same-level actions must not request level data');assert.equal(builds,0,'same-level actions must not rebuild board/scenery');
        assert.equal(scene.water,water);assert.deepEqual([...scene.decor.children],decor);assert.deepEqual([...scene.board.children],board);assert.equal(el('loading').hidden,true);
        assert.equal(el('solver-name').textContent,'A*');
      }finally{w.fetch=fetchOriginal;scene.build=buildOriginal;scene.stopCameraMotion();}
    });
    await t.test('a level preview is reused on start and cached initial states cannot be mutated by callers', async () => {
      const original=w.fetch;let requests=0;
      w.fetch=async(url,options)=>{if(String(url).startsWith('/api/level/'))requests++;return original(url,options);};
      try{
        const preview=await w.Bloxorz.ui.actions.getLevelData('3'),initial=JSON.stringify(preview.initial_state),firstCell=preview.level.grid[0][0];
        preview.initial_state.r=999;preview.level.grid[0][0]=99;const repeated=await w.Bloxorz.ui.actions.getLevelData('3');
        assert.equal(JSON.stringify(repeated.initial_state),initial);assert.equal(repeated.level.grid[0][0],firstCell);const beforeStart=requests;
        await w.Bloxorz.ui.actions.loadLevel('3');assert.equal(requests,beforeStart,'starting a previewed level must reuse its data');
        assert.equal(JSON.stringify(w.Bloxorz.ui.actions.inspect().state),initial);assert.equal(el('loading').hidden,true);
      }finally{w.fetch=original;}
    });
    await t.test('loading remains visible and blocks play until the actual request and render finish', async () => {
      const original=w.fetch;let release;const gate=new Promise(resolve=>release=resolve);
      w.fetch=async(url,options)=>{if(String(url).startsWith('/api/level/'))await gate;return original(url,options);};
      try{
        const pendingLoad=w.Bloxorz.ui.actions.loadLevel('1',{forceReload:true});await sleep(60);assert.equal(el('loading').hidden,true,'fast loads do not flash a spinner');await sleep(160);
        assert.equal(d.body.dataset.renderReady,'false');assert.equal(d.body.dataset.mode,'loading');assert.equal(el('loading').hidden,false);
        assert.equal(el('loading').getAttribute('role'),'status');assert(el('loading').querySelector('svg.loading-spinner'));assert(el('loading').textContent.includes('Đang tải'));
        const oldCount=count();tap('ArrowRight');await sleep(40);assert.equal(count(),oldCount,'manual moves are locked during loading');
        release();assert.equal(await pendingLoad,true);assert.equal(el('loading').hidden,true);assert.equal(d.body.dataset.renderReady,'true');
      }finally{release();w.fetch=original;}
    });
    await t.test('fragile shatters only on collapse, stays clear of neighbours and cleans up on restart',async()=>{
      await returnToPlay();await select('2');
      const entry=[...scene.tiles.entries()].find(([key])=>{const [r,c]=key.split(',').map(Number);return scene.level.grid[r][c]===2;}),tile=entry[1];
      const grid=JSON.stringify(scene.level.grid),wasVisible=tile.visible;
      assert.equal((scene.fragileBreaks||[]).length,0);
      const effect=scene.breakFragile(tile);assert.equal(effect.pieces.length,8);assert.equal(tile.visible,false);
      assert(effect.pieces.every(p=>p.mesh.scale.x<1&&p.mesh.position.y===-.096),'crack gaps must exist before any downward movement');
      assert.equal(scene.breakFragile(tile),effect,'one effect per collapsed tile');
      for(let frame=0;frame<=60;frame++){
        const t=frame/60;effect.update(t);scene.scene.updateMatrixWorld(true);
        for(const p of effect.pieces){const positions=p.mesh.geometry.attributes.position;
          for(let j=0;j<positions.count;j++){
            const point=new w.THREE.Vector3().fromBufferAttribute(positions,j).applyMatrix4(p.mesh.matrixWorld);
            if(point.y>-.38)assert(Math.abs(point.x-tile.position.x)<.495&&Math.abs(point.z-tile.position.z)<.495,'shards must clear floor height before scattering toward neighbours');
          }
        }
      }
      const geometry=effect.pieces.map(p=>p.mesh.geometry);scene.cancel();
      assert.equal(scene.fragileBreaks.length,0);assert.equal(tile.visible,wasVisible);assert.equal(effect.group.parent,null);
      const again=scene.breakFragile(tile);assert(again.pieces.every((p,i)=>p.mesh.geometry===geometry[i]));
      scene.reducedMotion=true;again.update(.6);assert(again.pieces.every(p=>p.mesh.quaternion.equals(new w.THREE.Quaternion())));scene.reducedMotion=false;
      await w.Bloxorz.ui.actions.restart();assert.equal(scene.fragileBreaks.length,0);assert.equal(tile.visible,true);assert.equal(JSON.stringify(scene.level.grid),grid);
      scene.stopCameraMotion();
      const tween=scene.tween;let snapshots=0;
      scene.tween=async function(duration,update){for(let i=0;i<=16;i++){update(i/16);if(this.fragileBreaks?.length){snapshots++;assert.equal(this.fragileBreaks[0].pieces.length,8);}}return true;};
      try{
        const fixture=loadFallCases().find(item=>item.name==='fragile');
        scene.build(fixture.level,fixture.before);scene.rotation.copy(scene.canonicalRotation(fixture.before.orientation));scene.showState(fixture.before);
        await scene.roll(fixture.before,fixture.action,null,false,null);
        assert(snapshots>0,'the real unsupported-fragile animation must create fragments');assert.equal(scene.fragileBreaks.length,0);
      }finally{scene.tween=tween;await w.Bloxorz.ui.actions.loadLevel('2');}
    });
    await t.test('failed blocks enter water, settle on seabed and remain visible without changing engine cells',async()=>{
      await returnToPlay();await select('2');
      const fixtures=loadFallCases().filter(item=>item.name!=='goal');
      const edge=fixtures.find(item=>item.name==='edge'),left=await (await w.fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level_id:'1',state:edge.before,action:'LEFT'})})).json();
      assert.equal(left.valid,false);fixtures.push({...edge,name:'left-edge',action:'LEFT',outcome:{...left,next_state:null}});
      const tween=scene.tween;let sinkSamples=0;
      scene.tween=async function(duration,update){
        for(let frame=0;frame<=60;frame++){
          const progress=frame/60;let result=update(Math.min(1,progress),progress);if(frame===60)for(let tail=1;result===false&&tail<=45;tail++)result=update(1,1+tail/60);this.scene.updateMatrixWorld(true);
          if(duration>1000)for(const obj of this.blocks.children){
            const box=new w.THREE.Box3().setFromObject(obj);
            assert(box.min.y>=(this.seabed?.position.y??-2.6)-.001,'block must not fall through seabed');sinkSamples++;
            for(const [key,tile]of this.tiles){const [r,c]=key.split(',').map(Number),type=this.level.grid[r][c];if(![1,3,4,5].includes(type))continue;
              assert(!(box.min.y<-.04&&box.max.y>-2.58&&box.max.x>tile.position.x-.47&&box.min.x<tile.position.x+.47&&box.max.z>tile.position.z-.47&&box.min.z<tile.position.z+.47),'sinking block intersects submerged masonry '+key);
            }
          }
        }
        return true;
      };
      try{
        for(const fixture of fixtures){
          scene.build(fixture.level,fixture.before);scene.rotation.copy(scene.canonicalRotation(fixture.before.orientation));scene.showState(fixture.before);
          const grid=JSON.stringify(scene.level.grid),out=fixture.outcome;
          await scene.roll(fixture.before,fixture.action,out.next_state,out.valid,out.failure_state);
          const sunk=scene.blocks.children.filter(obj=>obj.userData.submerged);assert(sunk.length>0,fixture.name);
          for(const obj of sunk){const box=new w.THREE.Box3().setFromObject(obj);assert(obj.visible);assert(Math.abs(box.min.y-(scene.seabed.position.y+.015))<1e-6);assert(box.max.y<scene.water.position.y,'settled block lies below water surface: '+fixture.name+' top='+box.max.y+' water='+scene.water.position.y);}
          assert.equal(JSON.stringify(scene.level.grid),grid);assert.equal(scene.fragileBreaks.length,0);
        }
        assert(sinkSamples>120);
      }finally{scene.tween=tween;await w.Bloxorz.ui.actions.loadLevel('2');}
    });
    await t.test('R flies the block back, locks moves during flight and can restart mid-flight',async()=>{
      await returnToPlay();await select('1');scene.stopCameraMotion();
      tap('ArrowRight');await wait(()=>count()===1&&d.body.dataset.mode==='idle','move before return flight');
      const from=scene.captureBlocks()[0].position.clone(),moveCalls=moves.length,first=w.Bloxorz.ui.actions.restart();
      assert.equal(d.body.dataset.mode,'resetting');assert(scene.returnFlight);assert(scene.returnFlight.group.children[0].position.distanceTo(from)<1e-8);
      assert(el('loading').hidden);tap('ArrowDown');await sleep(180);assert.equal(moves.length,moveCalls);assert(scene.returnFlight.group.children[0].position.y>from.y);
      const interrupted=scene.captureBlocks()[0].position.clone(),second=w.Bloxorz.ui.actions.restart();
      assert.equal(await first,false);assert(scene.returnFlight.group.children[0].position.distanceTo(interrupted)<1e-8,'repeated R continues from the current visible position');
      assert.equal(await second,true);assert.equal(scene.returnFlight,null);assert.equal(d.body.dataset.mode,'idle');assert.equal(count(),0);
      const state=w.Bloxorz.ui.actions.inspect().state,p=scene.placements(state)[0],obj=scene.blocks.children[0];assert(obj.visible);assert(obj.position.distanceTo(new w.THREE.Vector3(p.x,p.y,p.z))<1e-8);
      scene.reducedMotion=true;const fast=w.Bloxorz.ui.actions.restart();assert.equal(d.body.dataset.mode,'idle');assert.equal(scene.returnFlight,null);await fast;scene.reducedMotion=false;
    });
    await t.test('underwater R exits through clear water before flying over the board',async()=>{
      await returnToPlay();await select('2');
      tap('ArrowRight');await wait(()=>count()===1&&d.body.dataset.mode==='idle','fragile approach');
      tap('ArrowRight');await wait(()=>d.body.dataset.mode==='lost','fragile collapse and sink');
      assert(scene.blocks.children[0].userData.submerged);
      const render=scene.render.bind(scene);let samples=0,collisions=[];
      scene.render=function(){
        render();if(!this.returnFlight)return;this.scene.updateMatrixWorld(true);
        for(const obj of this.returnFlight.group.children){
          const bounds=new w.THREE.Box3().setFromObject(obj);
          for(const [key,tile]of this.tiles){if(!tile.visible)continue;const [r,c]=key.split(',').map(Number),type=this.level.grid[r][c];if(type===9)continue;
            if(bounds.min.y<-.008&&bounds.max.y>-(type===2?.20:.38)+.008&&bounds.max.x>tile.position.x-.48&&bounds.min.x<tile.position.x+.48&&bounds.max.z>tile.position.z-.48&&bounds.min.z<tile.position.z+.48)collisions.push(key);
          }
        }samples++;
      };
      try{tap('KeyR');await wait(()=>d.body.dataset.mode==='idle','return from underwater');assert(samples>20);assert.deepEqual(collisions,[],'return path must not cross surviving or restored floor tiles');}
      finally{scene.render=render;scene.stopCameraMotion();}
    });
    await t.test('water impact fires once at surface crossing and cleans transient effects', async () => {
      const obj=scene.createBlock(true);obj.position.set(0,1,0);scene.blocks.add(obj);
      const plan={obj},original=scene.splashAt;let calls=0;
      scene.splashAt=()=>calls++;
      scene.waterImpact(plan);assert.equal(calls,0);
      obj.position.y=-.5;scene.waterImpact(plan);scene.waterImpact(plan);assert.equal(calls,1);
      scene.splashAt=original;scene.blocks.remove(obj);
      scene.splashAt(0,0);assert.equal(scene.splashes.length,1);scene.clearSplashes();assert.equal(scene.splashes.length,0);
      scene.reducedMotion=true;scene.splashAt(0,0);await sleep(500);assert.equal(scene.splashes.length,0);scene.reducedMotion=false;
    });
    await t.test('submerged shelves affect depth without emitting a surface contact outline', () => {
      scene.makeWater([[0,0,1,true]],10,10,false);
      const submerged=scene.shoreTexture.image.data;
      assert([...submerged].filter((_,i)=>i%4===2).every(x=>x===255),'deep terrain must not generate a waterline');
      assert([...submerged].filter((_,i)=>i%4===0).some(x=>x===0),'deep terrain still contributes shallow depth');
      scene.makeWater([[0,0,1,false]],10,10,false);
      assert([...scene.shoreTexture.image.data].filter((_,i)=>i%4===2).some(x=>x===0),'surface masonry retains its contact field');
      scene.buildScenery(scene.level,scene.theme);
    });
    await t.test('water highlight patch reaches the bundled r128 shader output', () => {
      const source=w.THREE.ShaderLib.standard;
      const shader={uniforms:{},vertexShader:source.vertexShader,fragmentShader:source.fragmentShader};
      scene.waterMaterial.onBeforeCompile(shader);
      const bound=shader.fragmentShader.indexOf('min(reflectedLight.directSpecular,vec3(.018,.032,.040))');
      const output=shader.fragmentShader.indexOf('gl_FragColor = vec4( outgoingLight, diffuseColor.a );');
      assert(bound>=0&&bound<output,'highlight bound must execute before the actual bundled shader output');
      assert.throws(()=>scene.waterMaterial.onBeforeCompile({uniforms:{},vertexShader:'',fragmentShader:''}),/output anchor missing/);
    });
    await t.test('resize updates raster scale when browser zoom changes', async()=>{
      const ratios=[],original=scene.renderer.setPixelRatio;
      scene.renderer.setPixelRatio=r=>ratios.push(r);
      const previous=w.devicePixelRatio;
      Object.defineProperty(w,'devicePixelRatio',{value:.75,configurable:true});scene.resize();
      Object.defineProperty(w,'devicePixelRatio',{value:1,configurable:true});scene.resize();
      assert(ratios.includes(.75));assert.equal(ratios.at(-1),1);
      Object.defineProperty(w,'devicePixelRatio',{value:previous,configurable:true});scene.renderer.setPixelRatio=original;
    });
    await t.test('Esc keeps an orbited or interrupted cinematic view exactly stable',async()=>{
      await returnToPlay();
      await select('2');scene.stopCameraMotion();scene.render();
      const pose=()=>[...scene.camera.position.toArray(),...scene.camera.quaternion.toArray(),...scene.camera.projectionMatrix.elements];
      for(const [azimuth,elevation,zoom]of [[-1.9,.3,.7],[2.5,1.1,1.6],[.7,.6,1]]){
        scene.azimuth=azimuth;scene.elevation=elevation;scene.zoom=zoom;scene.setCamera();scene.render();
        const before=pose(),distance=scene.distance;
        for(let i=0;i<4;i++){tap('Escape');scene.render();
          assert.equal(scene.distance,distance,'Esc must not re-fit board distance');
          pose().forEach((value,j)=>assert(Math.abs(value-before[j])<1e-8,'Esc must preserve camera matrix '+j));
        }
      }
      scene.resetCamera(true);await sleep(140);tap('Escape');scene.render();
      key('Escape','keydown',{repeat:true});assert.equal(w.Bloxorz.ui.screen,'pause','holding Esc must not toggle repeatedly');
      const stopped=pose();assert.equal(scene.cameraFrame,0);
      await sleep(100);scene.resize();scene.render();
      pose().forEach((value,j)=>assert(Math.abs(value-stopped[j])<1e-8,'pause must preserve an in-between cinematic projection '+j));
      tap('Escape');scene.render();pose().forEach((value,j)=>assert(Math.abs(value-stopped[j])<1e-8));
      scene.resetCamera();
    });
    await t.test('replay survives Esc twice, settings, completion and metrics collapse without a popup',async()=>{
      await returnToPlay();await select('1');click('menu-toggle');click('choose-solver');
      controls.mockSolvers=false;await w.Bloxorz.ui.actions.runSolver('astar');
      assert.equal(w.Bloxorz.ui.screen,'replay');assert(!el('result-strip').hidden);
      assert.equal(el('speed'),null,'speed belongs in settings');
      void w.Bloxorz.ui.actions.playReplay();await wait(()=>count()>=1,'replay before menu');
      scene.render();const pose=()=>[...scene.camera.position.toArray(),...scene.camera.projectionMatrix.elements];const before=pose();
      tap('Escape');scene.render();assert.equal(w.Bloxorz.ui.screen,'pause');
      pose().forEach((v,i)=>assert(Math.abs(v-before[i])<1e-8,'replay pause must preserve framing'));
      await wait(()=>d.body.dataset.mode==='idle','finish current replay step');const paused=count();
      tap('Escape');scene.render();assert.equal(w.Bloxorz.ui.screen,'replay');assert(!el('result-strip').hidden);
      assert.equal(count(),paused);assert.equal(el('replay-play').getAttribute('aria-label'),'Phát');
      await sleep(350);assert.equal(count(),paused,'closing menu does not autoplay');
      click('collapse-result');assert(!el('result-strip').hidden);assert.equal(d.body.dataset.replayMetrics,'collapsed');
      click('menu-toggle');click('choose-settings');
      [...el('tabs').querySelectorAll('button')].find(b=>b.textContent==='Phát lại').click();
      const speedButtons=()=>[...el('replay-speed-options').querySelectorAll('button')];
      speedButtons().find(b=>b.textContent==='4×').click();assert.equal(scene.playbackSpeed,4);
      click('back');assert.equal(scene.playbackSpeed,1,'back discards draft speed');
      click('choose-settings');speedButtons().find(b=>b.textContent==='2×').click();click('apply');
      assert.equal(JSON.parse(w.localStorage.getItem('bloxorz-garden')).replaySpeed,2);assert.equal(scene.playbackSpeed,2);
      click('resume');assert.equal(w.Bloxorz.ui.screen,'replay');assert.equal(count(),paused);assert(!el('result-strip').hidden);
      await w.Bloxorz.ui.actions.playReplay();
      assert.equal(w.Bloxorz.ui.actions.inspect().replayOutcome,'complete');assert.equal(w.Bloxorz.ui.screen,'replay');
      assert(el('game-overlay').hidden);assert.equal(el('replay-status').textContent,'Đã phát xong lời giải');
      assert.equal(el('replay-play').getAttribute('aria-label'),'Phát lại');assert.equal(el('level-select').value,'1');
      tap('Escape');tap('Escape');assert.equal(w.Bloxorz.ui.screen,'replay');assert(!el('result-strip').hidden);
      await w.Bloxorz.ui.actions.seekReplay(0);assert.equal(count(),0);assert.equal(el('replay-play').getAttribute('aria-label'),'Phát');
      click('back');assert.equal(w.Bloxorz.ui.screen,'solver');click('show-result');assert.equal(w.Bloxorz.ui.screen,'replay');
      click('menu-toggle');click('leave-replay');await wait(()=>w.Bloxorz.ui.screen==='play','manual play exit');
      assert.equal(w.Bloxorz.ui.actions.inspect().wasAI,false);assert.equal(count(),0);
      controls.mockSolvers=true;
    });
    await t.test('a solver finishing behind the menu does not steal the current screen',async()=>{
      await returnToPlay();await select('1');click('menu-toggle');click('choose-solver');
      controls.mockSolvers=true;controls.solveDelay=220;click('solve-now');tap('Escape');
      assert.equal(w.Bloxorz.ui.screen,'pause');assert.equal(el('resume').querySelector('.action-label').textContent,'Quay lại AI Solver');
      await wait(()=>el('m-len').textContent==='7 bước'&&d.body.dataset.mode==='idle','background solution ready');
      assert.equal(w.Bloxorz.ui.screen,'pause');assert(el('result-strip').hidden);assert(el('game-overlay').hidden);
      tap('Escape');assert.equal(w.Bloxorz.ui.screen,'solver');assert(!el('show-result').hidden);
      assert.equal(el('show-result').textContent,'Xem lời giải');click('show-result');assert.equal(w.Bloxorz.ui.screen,'replay');
      const cursor=count();controls.moveFailure=true;await w.Bloxorz.ui.actions.stepReplay();
      assert.equal(count(),cursor);assert.equal(w.Bloxorz.ui.actions.inspect().replayOutcome,'error');
      assert(el('replay-status').textContent.includes('Không phát được bước này'));assert(el('game-overlay').hidden);
      await w.Bloxorz.ui.actions.stepReplay();assert.equal(count(),cursor+1);assert.equal(w.Bloxorz.ui.actions.inspect().replayOutcome,null);
      controls.solveDelay=0;
    });
    await t.test('comparison runs four real solvers sequentially and replays a selected result', async()=>{
      await returnToPlay();
      await select('1');click('menu-toggle');click('choose-solver');
      el('solver-modes').querySelector('[data-view="compare"]').click();
      controls.benchmarkCalls=[];controls.benchmarkMaxInflight=0;
      click('compare-run');
      assert(el('compare-run').disabled);
      await wait(()=>!w.Bloxorz.comparison.get().busy,'real four solver comparison',20000);
      assert.deepEqual(controls.benchmarkCalls.map(x=>x.solver),['bfs','dfs','ucs','astar']);
      assert.equal(controls.benchmarkMaxInflight,1);
      assert.equal(new Set(controls.benchmarkCalls.slice(1).map(x=>x.level_revision)).size,1);
      assert(d.querySelectorAll('#comparison-table tr[data-status="solved"]').length===4);
      const before=JSON.stringify(w.Bloxorz.comparison.get().rows);
      d.querySelector('tr[data-solver="astar"] button').click();
      assert(!el('result-strip').hidden);assert.equal(d.body.dataset.results,'open');
      assert.equal(el('solver-name').textContent,'A*');assert.equal(count(),0);
      await w.Bloxorz.ui.actions.seekReplay(2);assert.equal(count(),2);
      const metricsBefore=d.body.dataset.replayMetrics;click('collapse-result');assert.notEqual(d.body.dataset.replayMetrics,metricsBefore);assert(!el('result-strip').hidden);click('back');assert.equal(d.body.dataset.results,'closed');
      assert.equal(JSON.stringify(w.Bloxorz.comparison.get().rows),before);
      el('comparison-metric').value='cost';el('comparison-metric').dispatchEvent(new w.Event('change'));
      assert.equal(el('comparison-table').dataset.metric,'cost');
    });
    await t.test('comparison preserves manual game, distinguishes failed rows and stops after current',async()=>{
      await returnToPlay();
      await select('1');tap('KeyD');await wait(()=>count()===1&&d.body.dataset.mode==='idle','manual move before comparison');
      const before=JSON.stringify(w.Bloxorz.ui.actions.inspect());
      const solved={status:'solved',result:{found:true,moves:['RIGHT'],solution_length:1,total_cost:1,expanded_nodes:10,search_time_ms:2,memory_kb:3}};
      controls.benchmarkFixture={bfs:solved,dfs:{status:'timeout'},ucs:{status:'error',error:'Fixture measurement failure'},astar:{status:'unsolved',result:{found:false,moves:[],solution_length:0,total_cost:0,expanded_nodes:20,search_time_ms:3,memory_kb:4}}};
      controls.benchmarkDelay=70;controls.benchmarkCalls=[];
      click('menu-toggle');click('choose-solver');click('compare-run');click('compare-run');
      await wait(()=>!w.Bloxorz.comparison.get().busy,'mixed comparison');
      assert.equal(controls.benchmarkCalls.length,4);
      assert.equal(JSON.stringify(w.Bloxorz.ui.actions.inspect()),before);
      assert.equal(d.querySelector('tr[data-solver="dfs"] [data-field="time"]').textContent,'—');
      assert.equal(d.querySelector('tr[data-solver="ucs"] [data-field="status"] small').textContent,'Fixture measurement failure');
      assert.equal(d.querySelector('tr[data-solver="astar"] [data-field="steps"]').textContent,'—');
      assert.equal(d.querySelector('tr[data-solver="astar"]').dataset.status,'unsolved');
      w.Bloxorz.comparison.setLimit(15000);
      assert.equal(d.querySelector('tr[data-solver="dfs"] [data-field="status"]').textContent,'Hết 5 giây','old results retain their measured budget');
      controls.benchmarkCalls=[];click('compare-run');click('compare-stop');
      assert(el('compare-stop').disabled);
      await wait(()=>!w.Bloxorz.comparison.get().busy,'stop after current');
      assert.equal(controls.benchmarkCalls.length,1);
      assert.equal(controls.benchmarkCalls[0].limit_ms,15000);
      assert.equal(w.Bloxorz.comparison.get().phase,'stopped');
      assert.equal(w.Bloxorz.comparison.get().rows.filter(row=>row.status==='skipped').length,3);
      assert.equal(JSON.stringify(w.Bloxorz.ui.actions.inspect()),before);
    });
    await t.test('level change discards old benchmark responses and clears results',async()=>{
      controls.benchmarkDelay=250;controls.benchmarkCalls=[];click('compare-run');
      await w.Bloxorz.ui.actions.loadLevel('2',{focus:false});
      await wait(()=>!w.Bloxorz.comparison.get().busy,'old benchmark cleanup');
      assert.equal(controls.benchmarkCalls.length,1);
      assert.equal(w.Bloxorz.comparison.get().levelId,'2');
      assert(w.Bloxorz.comparison.get().rows.every(row=>row.status==='idle'&&row.result===null));
      assert.equal(el('comparison-level').textContent,'Màn 2');
      controls.benchmarkFixture=null;controls.benchmarkDelay=0;
    });
    await t.test('remember only a successfully loaded level; picker opens on the current page',async()=>{
      await returnToPlay();await select('12');
      assert.equal(w.localStorage.getItem('bloxorz-current-level'),'12');
      click('menu-toggle');click('choose-level');assert.equal(el('preview-title').textContent,'Màn 12');
      assert.equal([...d.querySelectorAll('.level-row button')].find(b=>b.textContent==='12').getAttribute('aria-pressed'),'true');
      assert.equal(d.querySelectorAll('.level-row button[data-current="true"]').length,1);
      assert.equal(d.querySelector('.level-row button[data-current="true"]').textContent,'12');
      assert.equal(d.querySelector('.level-row button[data-current="true"]').getAttribute('aria-current'),'step');
      [...d.querySelectorAll('.level-row button')].find(b=>b.textContent==='13').click();
      await wait(()=>String(scene.level.id)==='13','preview level 13');assert.equal(w.localStorage.getItem('bloxorz-current-level'),'12');
      assert.equal(d.querySelector('.level-row button[data-current="true"]').textContent,'12','current game stays highlighted while previewing another level');
      click('back');click('choose-level');assert.equal(el('preview-title').textContent,'Màn 12');click('back');click('resume');
      const original=w.fetch;
      try{
        w.fetch=async(url,options)=>url==='/api/level/2'?new Response(JSON.stringify({error:'Fixture failed level load'}),{status:503}):original(url,options);
        assert.equal(await w.Bloxorz.ui.actions.loadLevel('2',{forceReload:true}),false);
        assert.equal(w.localStorage.getItem('bloxorz-current-level'),'12','failed load must not replace remembered level');
      }finally{w.fetch=original;await w.Bloxorz.ui.actions.loadLevel('12');}
    });
    await t.test('distant ridges stay seeded, visible at maximum zoom, safe and resource bounded',async()=>{
      await select('1');scene.setAppearance('stone','ruins');const anchors=JSON.stringify(scene.distantEnvironment.anchors),state=JSON.stringify(w.Bloxorz.ui.actions.inspect());
      assert(scene.distantEnvironment.anchors.length>=8);assert.equal(scene.shoreTexture.image.width,192);assert.equal(scene.farShoreTexture.image.width,128);
      const firstFar=scene.farShoreTexture;let disposed=0;firstFar.addEventListener('dispose',()=>disposed++);
      for(const theme of ['garden','frost','ruins']){
        scene.setAppearance('stone',theme);assert.equal(JSON.stringify(scene.distantEnvironment.anchors),anchors);
        assert.equal(JSON.stringify(w.Bloxorz.ui.actions.inspect()),state);
        const batches=scene.decor.children.filter(x=>x.userData.distant);assert(batches.length>0&&batches.length<=16,'distant land uses a bounded number of shared draw batches');
        assert(batches.every(mesh=>!mesh.castShadow));
        assert(scene.distantEnvironment.anchors.every(anchor=>Math.abs(anchor.x)>scene.level.grid[0].length/2+anchor.w*2||Math.abs(anchor.z)>scene.level.grid.length/2+anchor.d*2));
      }
      assert.equal(disposed,1,'old far depth texture must be released on skin change');
      d.body.dataset.screen='play';scene.resetCamera();
      for(const elevation of [.3,.65,1.18])for(const azimuth of [.45,2.3,4.4]){
        scene.elevation=elevation;scene.azimuth=azimuth;scene.zoom=1.65;scene.setCamera();
        const visible=scene.distantEnvironment.anchors.filter(({x,z})=>{const p=new w.THREE.Vector3(x,-.3,z).project(scene.camera);return Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1;});
        assert(visible.length>=2,'maximum zoom must reveal distant land at '+elevation+'/'+azimuth);
      }
      scene.resetCamera();
    });
    await t.test('no uncaught runtime errors. GPU rasterization was not tested.', async () => {
      assert.deepEqual(errors, []);
    });
  } finally {
    ui.close();
  }
});

test('current level restores after a new page, with safe fallback for stale or unavailable storage',async()=>{
  for(const [options,expected]of [[{savedLevel:'12'},'12'],[{savedLevel:'deleted-level'},'1'],[{storageUnavailable:true},'1']]){
    const ui=await createUI(options);
    try{
      assert.equal(ui.w.Bloxorz.ui.actions.inspect().levelId,expected);
      assert.equal(ui.el('level-select').value,expected);assert.equal(ui.count(),0);
      if(!options.storageUnavailable)assert.equal(ui.w.localStorage.getItem('bloxorz-current-level'),expected);
      else{await ui.select('2');assert.equal(ui.w.Bloxorz.ui.actions.inspect().levelId,'2');}
    }finally{ui.close();}
  }
});
