/* Input, async requests and playback controller.
 * One move is in flight at a time. Epochs discard stale responses after restart,
 * level changes or Stop; Python is the single source of truth for legal moves. */
(() => {
  'use strict';
  const B=window.Bloxorz,$=id=>document.getElementById(id);
  const keyActions={ArrowUp:'UP',KeyW:'UP',ArrowDown:'DOWN',KeyS:'DOWN',ArrowLeft:'LEFT',KeyA:'LEFT',ArrowRight:'RIGHT',KeyD:'RIGHT',Space:'SPACE'};
  const labels={STANDING:'Đứng thẳng',HORIZONTAL:'Nằm ngang',VERTICAL:'Nằm dọc',SPLIT:'Hai khối đơn'};
  const stages={
    '1':['Khởi đầu','Lăn khối qua sàn đá và đứng thẳng vào ô đích.'],
    '2':['Đường đi mong manh','Gạch cam chỉ chịu được khối nằm. Hãy chọn đường đi cẩn thận.'],
    '3':['Công tắc & cầu nối','Kích hoạt công tắc để mở đường đến đích.'],
    '4':['Tách khối','Ghép hai khối đơn để hoàn thành màn chơi.']
  };
  let scene=null,state=null,level=null,levelId='1',moveCount=0,epoch=0;
  let mode='loading',controller=null,pending=null,held=new Map(),repeatAt=0;
  let allLevels={},activeSolver=null;
  function status(text,tone='neutral') {$('status-toast').textContent=text;$('status-toast').dataset.tone=tone;}
  function clearInput() {held.clear();pending=null;document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('is-pressed'));}
  function focusBoard() {$('canvas-container').focus({preventScroll:true});}
  function updateUI() {
    const manual=!!state&&(mode==='idle'||mode==='moving');
    document.querySelectorAll('[data-action]').forEach(button=>{button.disabled=!manual||(button.dataset.action==='SPACE'&&state.orientation!=='SPLIT');});
    document.querySelectorAll('[data-solver]').forEach(button=>{button.disabled=!state||!['idle','won','lost'].includes(mode);button.classList.toggle('is-active',button.dataset.solver===activeSolver);});
    $('hud-moves').textContent=String(moveCount).padStart(2,'0');
    $('hud-orient').textContent=state?labels[state.orientation]||state.orientation:'Đang tải';
    if(state?.orientation==='SPLIT')$('hud-orient').textContent=`Khối ${state.active_cube+1} / 2`;
    $('input-status').textContent=mode==='solving'?'ĐANG TÌM LỜI GIẢI':mode==='replay'?'ĐANG PHÁT LỜI GIẢI':mode==='won'?'HOÀN THÀNH':mode==='lost'?'NHẤN R ĐỂ CHƠI LẠI':mode==='error'?'CẦN TẢI LẠI':'BÀN PHÍM SẴN SÀNG';
    $('playback').hidden=!['solving','replay'].includes(mode);
    $('stop-solver').disabled=!['solving','replay'].includes(mode);
    $('loading').hidden=mode!=='loading';
  }
  function resetMetrics() {
    ['m-time','m-mem','m-nodes','m-len','m-cost'].forEach(id=>$(id).textContent='—');
    $('solver-name').textContent='CHƯA CHẠY';activeSolver=null;
    $('playback-progress').value=0;
  }
  async function api(url,payload=null) {
    const localController=new AbortController();controller=localController;
    const timeout=setTimeout(()=>localController.abort(),310000);
    try {
      const response=await fetch(url,{signal:localController.signal,...(payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
      if(!response.ok){
        const details=await response.json().catch(()=>({}));
        throw new Error(details.error||`Máy chủ trả về lỗi ${response.status}.`);
      }
      return await response.json();
    } finally {clearTimeout(timeout);if(controller===localController)controller=null;}
  }
  function invalidate() {epoch++;controller?.abort();controller=null;scene?.cancel();clearInput();}
  async function loadLevel(id,{focus=true}={}) {
    if(!scene)return false;
    invalidate();const token=epoch;
    mode='loading';$('game-overlay').hidden=true;resetMetrics();updateUI();
    try {
      const data=await api(`/api/level/${encodeURIComponent(id)}`);if(token!==epoch)return false;
      level=data.level;state=data.initial_state;levelId=String(level.id);moveCount=0;
      $('level-select').value=levelId;
      const text=[level.display_name||stages[levelId]?.[0]||level.name,
        level.description||stages[levelId]?.[1]||'Đưa khối đứng thẳng vào ô đích.'];
      $('stage-title').textContent=text[0];$('stage-description').textContent=text[1];
      $('level-difficulty').textContent=({'1':'Cơ bản','2':'Trung bình','3':'Khó','4':'Nâng cao'})[levelId]||level.difficulty||'Tùy chỉnh';
      $('level-summary').textContent=text[1];
      const index=Object.keys(allLevels).indexOf(levelId)+1;
      $('stage-number').textContent=`MÀN ${String(index).padStart(2,'0')} / ${String(Object.keys(allLevels).length).padStart(2,'0')}`;
      scene.build(level,state);mode='idle';status('Dùng mũi tên hoặc WASD để di chuyển.');updateUI();if(focus)focusBoard();return true;
    } catch(error) {
      if(token!==epoch)return false;
      mode='error';status(error.name==='AbortError'?'Tải màn chơi quá lâu. Nhấn Chơi lại để thử lại.':`Không tải được màn chơi. ${error.message}`,'error');updateUI();return false;
    }
  }
  function endGame(won,reason=null) {
    clearInput();mode=won?'won':'lost';
    $('overlay-label').textContent=won?'MÀN CHƠI HOÀN TẤT':'THỬ LẠI';
    $('overlay-title').textContent=won?'Đã đến đích':'Khối đã rơi';
    const lossText=reason==='bridge_closed'?'Công tắc vừa đóng cầu đang đỡ khối. Hãy chọn vị trí nhấn công tắc khác.':'Hãy giữ khối trên sàn. Khối đứng thẳng sẽ làm vỡ gạch cam.';
    $('overlay-description').textContent=won?`Bạn hoàn thành màn chơi sau ${moveCount} bước.`:lossText;
    $('game-overlay').hidden=false;
    status(won?'Hoàn thành. Nhấn R để chơi lại hoặc chọn màn khác.':reason==='bridge_closed'?'Cầu đã đóng do công tắc. Nhấn R để chơi lại.':'Khối không được đỡ hoàn toàn. Nhấn R để chơi lại.',won?'success':'error');updateUI();
  }
  async function performMove(action,token) {
    const previous=state;
    const data=await api('/api/move',{level_id:levelId,state:previous,action});
    if(token!==epoch)return false;
    if(!data.valid&&action==='SPACE')return false;
    const completed=await scene.roll(previous,action,data.next_state,data.valid,data.failure_state);
    if(!completed||token!==epoch)return false;
    if(action!=='SPACE')moveCount++;
    if(!data.valid){if(data.failure_state)state=data.failure_state;endGame(false,data.failure_reason);return false;}
    state=data.next_state;updateUI();
    if(data.is_goal){
      const dropped=await scene.victory();
      if(!dropped||token!==epoch)return false;
      endGame(true);
    }
    return true;
  }
  async function manualMove(action) {
    if(!state||!['idle','moving'].includes(mode))return;
    if(action==='SPACE'&&state.orientation!=='SPLIT'){status('Space dùng để đổi khối sau khi khối được tách đôi.');return;}
    if(mode==='moving'){pending=action;return;}
    const token=epoch;mode='moving';updateUI();
    try {
      await performMove(action,token);if(token!==epoch)return;
      if(mode==='moving'){
        mode='idle';status(state.orientation==='SPLIT'?`Đang điều khiển khối ${state.active_cube+1}. Nhấn Space để đổi khối.`:'Tiếp tục lăn khối đến ô đích.');updateUI();
        const next=pending;pending=null;if(next)void manualMove(next);
      }
    } catch(error) {
      if(token!==epoch)return;
      mode='idle';clearInput();scene.showState(state);status(`Không thực hiện được nước đi. ${error.name==='AbortError'?'Kết nối quá thời gian chờ.':error.message}`,'error');updateUI();
    }
  }
  async function runSolver(algo) {
    if(!['idle','won','lost'].includes(mode))return;
    if(!await loadLevel(levelId,{focus:false}))return;
    const token=epoch;activeSolver=algo;mode='solving';clearInput();
    const name=algo==='astar'?'A*':algo.toUpperCase();
    $('solver-name').textContent=name;$('playback-label').textContent=`Đang tìm bằng ${name}`;
    status(`Đang chạy ${name} từ trạng thái đầu màn chơi.`);updateUI();focusBoard();
    try {
      const result=await api('/api/solve',{level_id:levelId,solver:algo});if(token!==epoch)return;
      $('m-time').textContent=`${result.search_time_ms} ms`;
      $('m-mem').textContent=`${result.memory_kb} KB`;
      $('m-nodes').textContent=Number(result.expanded_nodes).toLocaleString('vi-VN');
      $('m-len').textContent=`${result.solution_length} bước`;
      $('m-cost').textContent=String(result.total_cost);
      if(!result.found){mode='idle';status('Không tìm thấy lời giải cho màn chơi này.','error');updateUI();return;}
      mode='replay';updateUI();
      $('playback-progress').max=Math.max(1,result.moves.length);
      status(`${name} tìm thấy lời giải ${result.solution_length} bước. Đang phát lại.`,'success');
      for(let i=0;i<result.moves.length;i++) {
        if(token!==epoch)return;
        $('playback-label').textContent=`${name} · Bước ${i+1} / ${result.moves.length}`;
        const valid=await performMove(result.moves[i],token);
        if(token!==epoch)return;
        $('playback-progress').value=i+1;
        if(!valid)return;
        if(mode==='won')break;
        await new Promise(resolve=>setTimeout(resolve,65));
      }
      if(token!==epoch)return;
      if(mode==='replay'){
        mode='idle';status('Đã phát xong lời giải.');updateUI();
      }
    } catch(error) {
      if(token!==epoch)return;
      mode='idle';scene.showState(state);status(`Không chạy được thuật toán. ${error.name==='AbortError'?'Quá thời gian chờ.':error.message}`,'error');updateUI();
    }
  }
  function stopSolver() {
    if(!['solving','replay'].includes(mode))return;
    invalidate();scene.showState(state);mode='idle';status('Đã dừng. Bạn có thể tiếp tục chơi bằng bàn phím.');updateUI();focusBoard();
  }
  function isEditable(target) {return target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');}
  function bindInput() {
    document.addEventListener('keydown',e=>{
      if(e.altKey||e.ctrlKey||e.metaKey||e.isComposing||isEditable(e.target))return;
      if(e.code==='KeyR'||e.code==='KeyC') {
        e.preventDefault();if(e.repeat)return;
        if(e.code==='KeyR')void loadLevel(levelId);else scene?.resetCamera();return;
      }
      const action=keyActions[e.code];if(!action)return;
      // Preserve keyboard activation of focused buttons and disclosure widgets.
      if(e.code==='Space'&&e.target.closest?.('button,summary,a'))return;
      e.preventDefault();if(e.repeat)return;
      if(!['idle','moving'].includes(mode))return;
      document.querySelector(`[data-action="${action}"]`)?.classList.add('is-pressed');
      if(action!=='SPACE'){held.set(e.code,action);repeatAt=performance.now()+360;}
      void manualMove(action);
    });
    document.addEventListener('keyup',e=>{
      held.delete(e.code);const action=keyActions[e.code];
      if(action&&!Array.from(held.values()).includes(action))document.querySelector(`[data-action="${action}"]`)?.classList.remove('is-pressed');
    });
    // Repeat is based on completed moves, independent of OS keyboard repeat rate.
    setInterval(()=>{
      if(mode!=='idle'||!held.size||performance.now()<repeatAt)return;
      const action=Array.from(held.values()).at(-1);repeatAt=performance.now()+275;void manualMove(action);
    },35);
    window.addEventListener('blur',clearInput);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
    document.addEventListener('focusin',e=>{if(isEditable(e.target))clearInput();});
    document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{void manualMove(button.dataset.action);focusBoard();}));
    document.querySelectorAll('[data-solver]').forEach(button=>button.addEventListener('click',()=>void runSolver(button.dataset.solver)));
    ['restart','restart-top','new-game','overlay-restart'].forEach(id=>$(id).addEventListener('click',()=>void loadLevel(levelId)));
    $('level-select').addEventListener('change',e=>void loadLevel(e.target.value));
    $('view-reset').addEventListener('click',()=>{scene?.resetCamera();focusBoard();});
    $('stop-solver').addEventListener('click',stopSolver);
  }
  async function init() {
    bindInput();updateUI();
    try {
      if(!window.THREE)throw new Error('Không tải được thư viện 3D đi kèm.');
      scene=new B.GameScene($('canvas-container'));
      allLevels=await api('/api/levels');
      $('level-select').replaceChildren();
      Object.values(allLevels).forEach(item=>{
        const option=document.createElement('option');option.value=item.id;
        option.textContent=`${String(item.id).padStart(2,'0')} / ${item.display_name||stages[item.id]?.[0]||item.name}`;
        $('level-select').append(option);
      });
      $('level-select').disabled=false;
      await loadLevel(Object.keys(allLevels)[0]);
    } catch(error) {
      mode='error';status(`Không khởi tạo được game. ${error.message} Hãy dùng trình duyệt có WebGL và tải lại trang.`,'error');updateUI();
    }
  }
  void init();
})();
