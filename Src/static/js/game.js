/* Input, async requests and playback controller.
 * One move is in flight at a time. Epochs discard stale responses after restart,
 * level changes or Stop; Python is the single source of truth for legal moves. */
(() => {
  'use strict';
  const B=window.Bloxorz,$=id=>document.getElementById(id);
  const keyActions={ArrowUp:'UP',KeyW:'UP',ArrowDown:'DOWN',KeyS:'DOWN',ArrowLeft:'LEFT',KeyA:'LEFT',ArrowRight:'RIGHT',KeyD:'RIGHT',Space:'SPACE'};
  const labels={STANDING:'Đứng thẳng',HORIZONTAL:'Nằm ngang',VERTICAL:'Nằm dọc',SPLIT:'Hai khối đơn'};
  let scene=null,state=null,initialState=null,level=null,levelId='1',moveCount=0,epoch=0;
  const levelCache=new Map(),copy=value=>JSON.parse(JSON.stringify(value));
  const currentLevelKey='bloxorz-current-level';
  function startingLevel(){
    try{const saved=localStorage.getItem(currentLevelKey);if(Object.hasOwn(allLevels,saved))return saved;}catch{}
    return Object.keys(allLevels)[0];
  }
  function rememberLevel(){try{localStorage.setItem(currentLevelKey,levelId);}catch{}}
  let mode='loading',controller=null,pending=null,held=new Map(),repeatAt=0;
  let allLevels={},activeSolver=null;
  let solverStatus={state:'ready',message:'Sẵn sàng  Giải từ trạng thái ban đầu'};
  let replayMoves=[],snapshots=[],cursor=0,playing=false,replayBusy=false,wasAI=false,replayOutcome=null;
  let loadingTimer=null,loadingShown=true;
  B.ui={screen:'play'};
  function status(text,tone='neutral') {$('status-toast').textContent=text;$('status-toast').dataset.tone=tone;}
  function clearInput() {held.clear();pending=null;document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('is-pressed'));}
  function focusBoard() {$('canvas-container').focus({preventScroll:true});}
  function updateUI() {
    document.body.dataset.mode=mode;document.body.dataset.level=levelId;
    if(level)B.comparison?.setLevel(levelId);
    B.ui.update?.({mode,state,level,levelId,moveCount,allLevels,cursor,total:replayMoves.length,playing,wasAI,replayBusy,replayOutcome,solverStatus});
    const manual=!!state&&!wasAI&&(mode==='idle'||mode==='moving');
    document.querySelectorAll('[data-action]').forEach(button=>{button.disabled=!manual||(button.dataset.action==='SPACE'&&state.orientation!=='SPLIT');});
    document.querySelectorAll('[data-solver]').forEach(button=>{button.disabled=!state||!['idle','won','lost'].includes(mode);button.classList.toggle('is-active',button.dataset.solver===activeSolver);});
    $('hud-moves').textContent=String(moveCount).padStart(2,'0');
    $('hud-orient').textContent=state?labels[state.orientation]||state.orientation:'Đang tải';
    if(state?.orientation==='SPLIT')$('hud-orient').textContent=`Khối ${state.active_cube+1} / 2`;
    $('input-status').textContent=mode==='resetting'?'ĐANG TRỞ VỀ ĐẦU MÀN':mode==='solving'?'ĐANG TÌM LỜI GIẢI':mode==='replay'?'ĐANG PHÁT LỜI GIẢI':mode==='won'?'HOÀN THÀNH':mode==='lost'?'NHẤN R ĐỂ CHƠI LẠI':mode==='error'?'CẦN TẢI LẠI':'BÀN PHÍM SẴN SÀNG';
    $('playback').hidden=!['solving','replay'].includes(mode);
    $('stop-solver').disabled=!['solving','replay'].includes(mode);
    $('canvas-container').setAttribute('aria-busy',String(mode==='loading'));
    $('loading').hidden=mode!=='loading'||!loadingShown;
    if(mode!=='loading'){clearTimeout(loadingTimer);loadingTimer=null;}
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
  function invalidate() {playing=false;epoch++;controller?.abort();controller=null;scene?.cancel();clearInput();}
  async function getLevelData(id){
    const key=String(id);if(levelCache.has(key))return copy(levelCache.get(key));
    const response=await fetch(`/api/level/${encodeURIComponent(key)}`);
    if(!response.ok)throw Error(`Không tải được màn chơi (${response.status}).`);
    const data=await response.json();levelCache.set(key,copy(data));return data;
  }
  function resetCurrent({focus=true,animateCamera=false,preserveCamera=false}={}){
    if(!initialState)return loadLevel(levelId,{focus,animateCamera,forceReload:true});
    const view=animateCamera||preserveCamera?scene.captureView():null;
    const poses=animateCamera?scene.captureBlocks():null;
    const openFragile=animateCamera?[...scene.tiles.entries()].filter(([key,tile])=>{const [r,c]=key.split(',').map(Number);return level.grid[r]?.[c]===2&&!tile.visible;}).map(([,tile])=>tile):[];
    invalidate();scene.stopCameraMotion();scene.cameraLoadPose=view;
    const resetToken=epoch,returning=animateCamera&&!scene.reducedMotion&&poses.length>0;
    state=copy(initialState);moveCount=0;wasAI=false;replayMoves=[];snapshots=[];cursor=0;replayBusy=false;replayOutcome=null;
    solverStatus={state:'ready',message:'Sẵn sàng  Giải từ trạng thái ban đầu'};resetMetrics();$('game-overlay').hidden=true;
    mode=returning?'resetting':'idle';document.body.dataset.renderReady='true';updateUI();
    // Level previews may temporarily replace the scene. Rebuild only in that
    // case; an ordinary restart reuses all board/scenery meshes and textures.
    if(scene.level!==level)scene.build(level,state,{preserveCamera:!!view});else scene.resetState(state);
    B.ui.appearance?.();if(view)scene.restoreView(view);scene.cameraLoadPose=null;
    if(animateCamera)scene.resetCamera(true);else if(!preserveCamera)scene.resetCamera();else scene.render();
    if(returning){
      status('Khối đang trở về đầu màn.');
      return scene.returnToStart(poses,openFragile).then(ok=>{
        if(!ok||resetToken!==epoch)return false;
        mode='idle';status('Dùng mũi tên hoặc WASD để di chuyển.');updateUI();if(focus&&B.ui.screen==='play')focusBoard();return true;
      });
    }
    status('Dùng mũi tên hoặc WASD để di chuyển.');if(focus&&B.ui.screen==='play')focusBoard();return true;
  }
  async function loadLevel(id,{focus=true,animateCamera=false,forceReload=false}={}) {
    if(!scene)return false;
    if(!forceReload&&initialState&&String(id)===levelId)return resetCurrent({focus,animateCamera});
    const view=animateCamera&&String(scene.level?.id)===String(id)?scene.captureView():null;
    scene.stopCameraMotion();scene.cameraLoadPose=view;
    invalidate();playing=false;wasAI=false;replayMoves=[];snapshots=[];cursor=0;replayOutcome=null;const token=epoch;
    solverStatus={state:'ready',message:'Sẵn sàng  Giải từ trạng thái ban đầu'};
    document.body.dataset.renderReady='false';mode='loading';$('game-overlay').hidden=true;resetMetrics();
    clearTimeout(loadingTimer);loadingShown=false;updateUI();loadingTimer=setTimeout(()=>{if(token===epoch&&mode==='loading'){loadingShown=true;updateUI();}},180);
    try {
      const key=String(id),data=!forceReload&&levelCache.has(key)?copy(levelCache.get(key)):await api(`/api/level/${encodeURIComponent(id)}`);if(token!==epoch)return false;
      levelCache.set(key,copy(data));level=data.level;initialState=copy(data.initial_state);state=copy(initialState);levelId=String(level.id);moveCount=0;
      $('level-select').value=levelId;
      const text=[level.name||level.display_name||`Stage ${levelId}`,
        level.description||'Đưa khối đứng thẳng vào ô đích.'];
      $('stage-title').textContent=text[0];$('stage-description').textContent=text[1];
      $('level-difficulty').textContent=level.difficulty||'—';
      $('level-summary').textContent=text[1];
      const index=Object.keys(allLevels).indexOf(levelId)+1;
      $('stage-number').textContent=`MÀN ${String(index).padStart(2,'0')} / ${String(Object.keys(allLevels).length).padStart(2,'0')}`;
      scene.build(level,state,{preserveCamera:!!view});B.ui.appearance?.();if(view)scene.restoreView(view);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(token!==epoch)return false;scene.render();document.body.dataset.renderReady='true';mode='idle';rememberLevel();status('Dùng mũi tên hoặc WASD để di chuyển.');updateUI();scene.cameraLoadPose=null;if(view)scene.resetCamera(true);if(focus&&B.ui.screen==='play')focusBoard();return true;
    } catch(error) {
      if(token!==epoch)return false;
      scene.cameraLoadPose=null;mode='error';status(error.name==='AbortError'?'Tải màn chơi quá lâu. Nhấn Chơi lại để thử lại.':`Không tải được màn chơi. ${error.message}`,'error');updateUI();return false;
    }
  }
  function restart(){return resetCurrent({animateCamera:true});}
  function endGame(won,reason=null) {
    if(wasAI){
      clearInput();playing=false;mode='idle';replayOutcome=won?'complete':'error';
      $('game-overlay').hidden=true;
      solverStatus={state:won?'found':'error',message:won?'Đã phát xong lời giải. Có thể phát lại hoặc xem từng bước.':'Replay gặp nước đi không hợp lệ. Hãy quay lại AI Solver và tìm lại lời giải.'};
      status(solverStatus.message,won?'success':'error');updateUI();return;
    }
    clearInput();scene?.stopCameraMotion();playing=false;mode=won?'won':'lost';
    $('overlay-label').textContent=won?'MÀN CHƠI HOÀN TẤT':'THỬ LẠI';
    $('overlay-title').textContent=won?'Đã đến đích':'Khối đã rơi';
    const lossText=reason==='bridge_closed'?'Công tắc vừa đóng cầu đang đỡ khối. Hãy chọn vị trí nhấn công tắc khác.':'Hãy giữ khối trên sàn. Khối đứng thẳng sẽ làm vỡ gạch cam.';
    $('overlay-description').textContent=won?`Chơi tay  ${moveCount} bước.`:lossText;
    $('game-overlay').hidden=false;$('overlay-restart').focus({preventScroll:true});
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
    if(B.ui.screen!=='play'||wasAI||!state||!['idle','moving'].includes(mode))return;
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
    if(!['idle','won','lost'].includes(mode)||B.comparison?.get().busy)return;
    if(!resetCurrent({focus:false,preserveCamera:true}))return;
    const token=epoch;activeSolver=algo;mode='solving';clearInput();
    const name=algo==='astar'?'A*':algo.toUpperCase();
    $('solver-name').textContent=name;$('playback-label').textContent=`Đang tìm bằng ${name}`;
    solverStatus={state:'solving',message:`Đang tìm lời giải bằng ${name}…`};status(`Đang chạy ${name} từ trạng thái đầu màn chơi.`);updateUI();focusBoard();
    try {
      const result=await api('/api/solve',{level_id:levelId,solver:algo});if(token!==epoch)return;
      displayMetrics(algo,result);
      if(!result.found){solverStatus={state:'empty',message:'Không tìm thấy lời giải cho màn này.'};mode='idle';status('Không tìm thấy lời giải cho màn chơi này.','error');updateUI();return;}
      useSolverResult(algo,result,false);
    } catch(error) {
      if(token!==epoch)return;
      mode='idle';scene.showState(state);solverStatus={state:'error',message:`Không chạy được ${name}. ${error.name==='AbortError'?'Quá thời gian chờ.':error.message} Hãy thử lại.`};status(`Không chạy được thuật toán. ${error.name==='AbortError'?'Quá thời gian chờ.':error.message}`,'error');updateUI();
    }
  }
  function displayMetrics(algo,result){
    activeSolver=algo;$('solver-name').textContent=algo==='astar'?'A*':algo.toUpperCase();
    $('m-time').textContent=`${result.search_time_ms} ms`;$('m-mem').textContent=`${result.memory_kb} KB`;
    $('m-nodes').textContent=Number(result.expanded_nodes).toLocaleString('vi-VN');
    $('m-len').textContent=`${result.solution_length} bước`;$('m-cost').textContent=String(result.total_cost);
  }
  function useSolverResult(algo,result,reset=true){
    if(!result.found)return;
    if(reset&&!resetCurrent({focus:false,preserveCamera:true}))return;
    displayMetrics(algo,result);
    wasAI=true;playing=false;replayMoves=[...result.moves];snapshots=[copy(initialState)];cursor=0;replayOutcome=null;
    mode='idle';$('playback-progress').max=Math.max(1,replayMoves.length);
    const name=algo==='astar'?'A*':algo.toUpperCase();
    solverStatus={state:'found',message:`${name}  Đã tìm thấy lời giải`};status(name+' đã tìm thấy lời giải. Nhấn Phát để xem.','success');updateUI();B.ui.result?.();
  }
  function stopSolver() {
    if(!['solving','replay'].includes(mode))return;
    invalidate();scene.showState(state);mode='idle';solverStatus={state:'ready',message:'Đã ngừng chờ  Có thể tìm lại lời giải'};status('Đã ngừng chờ ở giao diện. Tác vụ máy chủ có thể vẫn đang chạy.');updateUI();focusBoard();
  }
  function isEditable(target) {return target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');}
  function bindInput() {
    document.addEventListener('keydown',e=>{
      const outcomeRestart=e.code==='KeyR'&&!$('game-overlay').hidden&&['won','lost'].includes(mode);
      if(B.ui.screen!=='play'&&!outcomeRestart)return;
      if(e.altKey||e.ctrlKey||e.metaKey||e.isComposing||isEditable(e.target))return;
      if(e.code==='KeyF'){
        if(e.repeat||!state||mode==='loading'||['won','lost'].includes(mode))return;
        e.preventDefault();scene?.focusBlock(state,true);return;
      }
      if(e.code==='KeyR'||e.code==='KeyC') {
        e.preventDefault();if(e.repeat)return;
        if(e.code==='KeyR')void restart();else scene?.resetCamera(true);return;
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
      if(B.ui.screen!=='play'||mode!=='idle'||!held.size||performance.now()<repeatAt)return;
      const action=Array.from(held.values()).at(-1);repeatAt=performance.now()+275;void manualMove(action);
    },35);
    window.addEventListener('blur',clearInput);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
    document.addEventListener('focusin',e=>{if(isEditable(e.target))clearInput();});
    document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{void manualMove(button.dataset.action);focusBoard();}));

    ['restart','restart-top','new-game','overlay-restart'].forEach(id=>$(id).addEventListener('click',()=>void restart()));
    $('level-select').addEventListener('change',e=>void loadLevel(e.target.value));
    $('view-reset').addEventListener('click',()=>{scene?.resetCamera(true);focusBoard();});
    $('stop-solver').addEventListener('click',stopSolver);
  }
  async function stepReplay() {
    if(replayBusy||cursor>=replayMoves.length)return;
    replayOutcome=null;
    replayBusy=true;const token=epoch;mode='replay';updateUI();
    try {
      const ok=await performMove(replayMoves[cursor],token);
      if(token!==epoch)return;
      if(ok){cursor++;snapshots[cursor]=JSON.parse(JSON.stringify(state));}
      if(mode==='replay')mode='idle';
      if(!ok)playing=false;
    } catch(error){if(token===epoch){playing=false;mode='idle';replayOutcome='error';solverStatus={state:'error',message:'Không phát được bước này. '+error.message+' Có thể nhấn Phát để thử lại.'};status(solverStatus.message,'error');}}
    finally{replayBusy=false;updateUI();}
  }
  async function playReplay(){
    if(replayBusy&&!playing)return;
    if(playing){playing=false;updateUI();return;}
    if(cursor>=replayMoves.length)await seekReplay(0);
    playing=true;const playToken=epoch;updateUI();
    while(playing&&playToken===epoch&&cursor<replayMoves.length){await stepReplay();if(mode==='won'||mode==='lost')break;}
    playing=false;updateUI();
  }
  async function seekReplay(index){
    playing=false;if(replayBusy)return;
    index=Math.max(0,Math.min(replayMoves.length,Number(index)));
    const token=epoch;replayBusy=true;
    try{
      while(snapshots.length<=index){
        const last=snapshots.at(-1),action=replayMoves[snapshots.length-1];
        const data=await api('/api/move',{level_id:levelId,state:last,action});
        if(token!==epoch)return;if(!data.valid)throw new Error('Replay không hợp lệ.');
        snapshots.push(data.next_state);
      }
      state=JSON.parse(JSON.stringify(snapshots[index]));cursor=index;moveCount=index;replayOutcome=index===replayMoves.length?'complete':null;
      scene.cancel();scene.rotation.copy(scene.canonicalRotation(state.orientation));
      scene.showState(state);mode='idle';$('game-overlay').hidden=true;
    }catch(e){replayOutcome='error';solverStatus={state:'error',message:'Không chuyển được vị trí replay. '+e.message};status(solverStatus.message,'error');}finally{replayBusy=false;updateUI();}
  }
  B.ui.actions={prepareSolver:()=>resetCurrent({focus:false,preserveCamera:true}),getLevelData,loadLevel,runSolver,useSolverResult,stopSolver,stepReplay,playReplay,seekReplay,
    pause:()=>{clearInput();playing=false;scene?.stopCameraMotion();updateUI();},scene:()=>scene,focusBlock:()=>{if(state&&!['loading','won','lost'].includes(mode)){scene?.focusBlock(state,true);focusBoard();}},
    inspect:()=>JSON.parse(JSON.stringify({state,levelId,moveCount,mode,wasAI,replayOutcome})),
    restart,next:()=>{const ids=Object.keys(allLevels),next=ids[ids.indexOf(levelId)+1];if(next)return loadLevel(next);}};
  async function init() {
    bindInput();updateUI();
    try {
      if(!window.THREE)throw new Error('Không tải được thư viện 3D đi kèm.');
      await B.prepareRenderAssets();
      scene=new B.GameScene($('canvas-container'));
      allLevels=await api('/api/levels');
      $('level-select').replaceChildren();
      Object.values(allLevels).forEach(item=>{
        const option=document.createElement('option');option.value=item.id;
        option.textContent=`${String(item.id).padStart(2,'0')} / ${item.name||item.display_name||`Stage ${item.id}`}`;
        $('level-select').append(option);
      });
      $('level-select').disabled=false;
      await loadLevel(startingLevel());
    } catch(error) {
      mode='error';status(`Không khởi tạo được game. ${error.message} Hãy dùng trình duyệt có WebGL và tải lại trang.`,'error');updateUI();
    }
  }
  void init();
})();
