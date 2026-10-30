const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const { createCanvas, ImageData } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function createUI() {
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
    w.HTMLCanvasElement.prototype.setPointerCapture = function () {};
    const errors = [];
    w.addEventListener('error', (e) => errors.push(e.message));
    const moves = [];
    const controls = {
      solveDelay: 0,
      moveFailure: false,
      inflight: 0,
      maxInflight: 0,
      mockSolvers: false,
      solverUnavailable: true,
    };
    const cases = JSON.parse(fs.readFileSync(path.join(root, 'tests/test_cases.json'), 'utf8'));
    const canonical = Object.keys(cases).filter((id) => cases[id].level === id);
    assert.deepEqual(canonical, levelIds, 'test_cases.json must cover every game level');
    // Canned API responses exercise replay UI only; they are NOT solver implementations.
    w.fetch = async (url, options = {}) => {
      if (url === '/api/solve' && controls.solveDelay) await sleep(controls.solveDelay);
      // Exercise the unavailable-solver UI independently of real solver progress.
      // Flask's real 501 response is covered by test_api.py.
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
    const OriginalScene = w.Bloxorz.GameScene;
    let scene;
    w.Bloxorz.GameScene = class extends OriginalScene {
      constructor(...args) {
        super(...args);
        scene = this;
      }
    };
    w.eval(fs.readFileSync(path.join(root, 'static/js/game.js'), 'utf8'));
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
  } = ui;
  try {
    await t.test('thin bevel geometry, outward normals and square split-cube maps', async () => {
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
      assert.deepEqual(
        Array.from(el('level-select').options, (option) => option.value),
        levelIds,
      );
      assert.equal(scene.camera.isPerspectiveCamera, true);
      assert.equal(scene.renderer.shadowMap.enabled, false);
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
      assert.equal(el('level-difficulty').textContent, 'Cơ bản');
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
        controls.solverUnavailable = false;
        controls.mockSolvers = true;
        controls.solverUnavailable = true;
        await select('1');
        await reset();
        d.querySelector('[data-solver="bfs"]').click();
        await wait(
          () => el('status-toast').textContent.includes('chưa hoàn thiện'),
          'pending solver notice',
        );
        assert.equal(count(), 0);
        assert.equal(el('playback').hidden, true);
      },
    );
    await t.test('WASD, arrow keys, one queued tap, serialized requests', async () => {
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
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
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
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
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
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
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
      await select('1');
      await reset();
      d.querySelector('[data-solver="bfs"]').click();
      await wait(() => el('input-status').textContent === 'ĐANG PHÁT LỜI GIẢI', 'BFS start');
      const before = moves.length;
      tap('KeyD');
      tap('Space');
      await wait(() => !el('game-overlay').hidden, 'BFS victory');
      assert.equal(count(), 7);
      assert.equal(el('overlay-title').textContent, 'Đã đến đích');
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
        controls.solverUnavailable = false;
        controls.mockSolvers = true;
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
        await wait(() => count() === 5, 'Space switch');
        assert.equal(el('hud-orient').textContent, 'Khối 2 / 2');
        sameRotation(scene.blocks.children[0].quaternion, parked);
        sameRotation(scene.blocks.children[1].quaternion, original1);
        tap('ArrowLeft');
        await wait(() => count() === 6, 'move other cube while switch held');
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
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
      await select('3');
      d.querySelector('[data-solver="bfs"]').click();
      await wait(() => count() === 2, 'replay before Stop');
      click('stop-solver');
      const stopped = count();
      await sleep(750);
      assert.equal(count(), stopped);
      assert.equal(el('playback').hidden, true);
      tap('KeyR');
      await wait(() => count() === 0 && ready(), 'restart after Stop');
      controls.solveDelay = 350;
      d.querySelector('[data-solver="bfs"]').click();
      await wait(() => el('input-status').textContent === 'ĐANG TÌM LỜI GIẢI', 'slow solver');
      await select('2');
      await sleep(600);
      assert.equal(count(), 0);
      assert.equal(el('stage-title').textContent, 'Đường đi mong manh');
      controls.solveDelay = 0;
    });
    await t.test('failed move request recovers without locking controls', async () => {
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
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
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
      await select('4');
      d.querySelector('[data-solver="astar"]').click();
      await wait(() => !el('game-overlay').hidden, 'stage 4 A* victory', 18000);
      assert.equal(el('overlay-title').textContent, 'Đã đến đích');
      assert.equal(count(), 17);
      assert(moves.some((m) => m.request.action === 'SPACE'));
    });
    await t.test(
      'video 2 bridge disappears BEFORE fall, correct loss reason and final orientation',
      async () => {
        controls.solverUnavailable = false;
        controls.mockSolvers = true;
        await select('11');
        for (const [i, code] of ['ArrowRight', 'ArrowDown', 'ArrowRight'].entries()) {
          tap(code);
          await wait(() => count() === i + 1, 'video 2 approach ' + i);
        }
        assert(scene.bridgeGroups.get(0).every((group) => group.visible));
        const render = scene.render.bind(scene);
        let closedBeforeFall = false;
        scene.render = function () {
          render();
          if (
            scene.bridgeGroups.get(0).every((group) => !group.visible) &&
            scene.blocks.children.some((obj) => obj.visible && obj.position.y >= 0.45)
          )
            closedBeforeFall = true;
        };
        tap('ArrowRight');
        await wait(() => !el('game-overlay').hidden, 'video 2 bridge loss');
        scene.render = render;
        assert(closedBeforeFall, 'bridge must disappear while block is still above board');
        assert(scene.bridgeGroups.get(0).every((group) => !group.visible));
        assert.equal(el('hud-orient').textContent, 'Nằm ngang');
        assert(el('overlay-description').textContent.includes('Công tắc vừa đóng cầu'));
        assert(el('status-toast').textContent.includes('Cầu đã đóng'));
      },
    );
    await t.test('bridge closure drops only unsupported split cube', async () => {
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
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
      assert.equal(cube0.visible, false);
      assert.equal(cube1.visible, true);
      assert(Math.abs(cube1.position.y - 0.5) < 1e-6);
    });
    await t.test('new level metadata, numeric ordering, two bridge groups and reset', async () => {
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
      await select('12');
      assert.equal(el('stage-title').textContent, 'Hành trình liên hoàn');
      assert.equal(el('stage-number').textContent, stageNumber('12'));
      assert.equal(el('level-difficulty').textContent, 'Thử thách');
      assert.equal(el('level-summary').textContent, el('stage-description').textContent);
      for (const bridge of scene.bridgeGroups.values())
        assert(bridge.every((group) => !group.visible));
    });
    await t.test('curated level menu excludes archived maps and plays a new shallow goal', async () => {
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
      assert.equal(levelIds.length, 25);
      assert(!levelIds.includes('29'));
      assert(levelIds.includes('36') && levelIds.includes('45'));
      await select('36');
      assert.equal(el('stage-number').textContent, stageNumber('36'));
      d.querySelector('[data-solver="bfs"]').click();
      await wait(() => !el('game-overlay').hidden, 'new shallow goal victory');
      assert.equal(count(), 2);
      assert.equal(el('overlay-title').textContent, 'Đã đến đích');
    });
    await t.test('no uncaught runtime errors. GPU rasterization was not tested.', async () => {
      controls.solverUnavailable = false;
      controls.mockSolvers = true;
      assert.deepEqual(errors, []);
    });
  } finally {
    ui.close();
  }
});
