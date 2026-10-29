/* UI navigation and preferences; Python owns every gameplay transition. */
(()=>{
 const B=window.Bloxorz,U=B.ui,A=U.actions,$=id=>document.getElementById(id);
 const paths={menu:'M4 6h16 M4 12h16 M4 18h16',play:'M8 4l12 8-12 8z',back:'M15 4l-8 8 8 8',levels:'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h6v6h-6z',solver:'M3 6l8 12 10-9 M17 7l4 2-2 4',settings:'M3 6h18 M3 12h18 M3 18h18 M8 3v6 M16 9v6 M9 15v6',help:'M9 8a4 4 0 1 1 5 4l-2 2v2 M12 20h.01',reset:'M4 10a8 8 0 1 1 1 7 M4 4v6h6',check:'M4 12l5 5L20 5',next:'M4 12h16 M13 5l7 7-7 7'};
 const buttonContent=(label,k)=>`<span class="circle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[k]}"/></svg></span><span class="action-label">${label}</span>`;
 const button=(id,label,k)=>`<button id="${id}" class="round-label">${buttonContent(label,k)}</button>`;
 document.body.insertAdjacentHTML('beforeend',`<div id="shell"><button id="menu-toggle" aria-label="Mở menu (Esc)"><span class="circle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths.menu}"/></svg></span><span>Menu<kbd>Esc</kbd></span></button><section id="pause-screen" class="screen" hidden><nav class="menu-row">${button('resume','Tiếp tục','play')}${button('choose-level','Chọn màn','levels')}${button('choose-solver','AI Solver','solver')}${button('choose-settings','Tùy chỉnh','settings')}${button('choose-help','Trợ giúp','help')}${button('leave-replay','Chơi tay từ đầu','reset')}</nav></section><section id="page-screen" class="screen" hidden>${button('back','Quay lại','back')}<header><h1 id="page-title"></h1><div id="tabs" class="tabs"></div></header><div id="page-copy"></div><div id="page-bottom"></div></section><footer id="simple-hud"><div><small>Số bước</small><strong id="simple-moves">00</strong></div>${button('simple-restart','Chơi lại','reset')}</footer><section id="result-strip" hidden><button id="collapse-result">Thu gọn</button><h2>Kết quả tìm kiếm</h2><div id="real-metrics"></div><div class="replay-buttons"><button id="replay-prev" aria-label="Lùi một bước">|‹</button><button id="replay-play">Phát</button><button id="replay-next" aria-label="Tiến một bước">›|</button></div><div class="timeline"><input id="seek" type="range" min="0" max="0" value="0" aria-label="Vị trí replay"><span id="replay-count"></span></div><p id="replay-status" role="status" aria-live="polite" aria-atomic="true"></p></section><button id="show-result" hidden>Kết quả</button></div>`);
 $('real-metrics').append(document.querySelector('.metrics'));
 $('shell').insertAdjacentHTML('beforeend','<button id="focus-block" aria-label="Xem gần khối đang điều khiển" title="Xem gần khối (F). C trở về toàn cảnh"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M8 12h8 M12 8v8"/></svg><span>Gần khối</span><kbd>F</kbd></button>');
 $('focus-block').onclick=A.focusBlock;
 $('simple-hud').append($('switch-cube'));
 const pad=document.querySelector('.dpad');pad.id='touch-pad';$('shell').append(pad);
 document.body.append($('game-overlay'));$('game-overlay').setAttribute('role','dialog');$('game-overlay').setAttribute('aria-label','Kết quả màn chơi'); 
 $('game-overlay').insertAdjacentHTML('beforeend',`<div class="end-actions">${button('end-levels','Chọn màn','levels')}${button('end-next','Màn tiếp theo','next')}</div>`);
 $('tabs').before(Object.assign(document.createElement('nav'),{id:'solver-modes',className:'tabs',hidden:true}));
 $('solver-modes').setAttribute('aria-label','Chế độ AI Solver');
 let current={},stack=[],pauseOrigin='play',replayVisited=false,selected='astar',solverView='single',page=0,tab='block',help=0,preview=0,previewToken=0;
 let prefs={skin:'stone',theme:'ruins',master:80,music:40,effects:70,ambient:60,mute:false,replaySpeed:1};try{prefs={...prefs,...JSON.parse(localStorage.getItem('bloxorz-garden')||'{}')};}catch{}
 if(![.5,1,2,4].includes(prefs.replaySpeed))prefs.replaySpeed=1;
 let draft={...prefs};B.audio?.configure(()=>draft);B.sound=(name='roll')=>B.audio?.effect(name);
 U.appearance=()=>{const scene=A.scene();if(!scene)return;scene.playbackSpeed=draft.replaySpeed;scene.setAppearance?.(draft.skin,draft.theme);};
 function show(name,push=true){
  $('shell').inert=false;A.pause();
  if(name==='levels'&&U.screen!=='levels'){preview=current.levelId;page=Math.max(0,Math.floor(Object.keys(current.allLevels||{}).indexOf(preview)/9));}
  if(name==='pause'&&U.screen!=='pause'&&push)pauseOrigin=['solver','replay'].includes(U.screen)?U.screen:'play';
  if(name==='pause'&&!push&&pauseOrigin==='play'&&current.wasAI){pauseOrigin='replay';if(stack.at(-1)==='play')stack[stack.length-1]='replay';}
  if(push)stack.push(U.screen);U.screen=name;
  document.body.dataset.pauseScene=pauseOrigin;
  document.body.dataset.results=name==='replay'||name==='pause'&&pauseOrigin==='replay'?'open':'closed';
  document.body.dataset.screen=name;
  $('pause-screen').hidden=name!=='pause';$('page-screen').hidden=['play','pause'].includes(name);
  $('simple-hud').hidden=!(name==='play'||name==='pause'&&pauseOrigin==='play');
  $('menu-toggle').hidden=!['play','replay'].includes(name);
  $('result-strip').hidden=name!=='replay';$('show-result').hidden=!(name==='solver'&&current.wasAI);
  $('leave-replay').hidden=!current.wasAI;
  $('resume').querySelector('.action-label').textContent=pauseOrigin==='replay'?'Quay lại lời giải':pauseOrigin==='solver'?'Quay lại AI Solver':'Tiếp tục';
  $('show-result').textContent=replayVisited?'Quay lại lời giải':'Xem lời giải';
  $('canvas-container').inert=!['play','replay'].includes(name);
  if(name==='play'){$('canvas-container').focus();stack=[];}
  else if(name==='pause')$('resume').focus();
  else{renderPage();$('back').focus();}
  if(name==='replay')updateReplayControls();
 }
 function back(){
  previewToken++;
  if(U.screen==='settings'){draft={...prefs};B.audio?.sync();U.appearance();}
  if(U.screen==='levels'&&current.state){A.scene().build(current.level,current.state);A.scene().rotation.copy(A.scene().canonicalRotation(current.state.orientation));A.scene().showState(current.state);U.appearance();}
  if(U.screen==='replay'){stack=[];show('solver',false);return;}
  if(U.screen==='solver'&&!stack.length){pauseOrigin=current.wasAI?'replay':'play';stack=[pauseOrigin];show('pause',false);return;}
  show(stack.pop()||(current.wasAI?'replay':'play'),false);
 }
 function tabs(items,active,fn){$('tabs').replaceChildren();items.forEach(([id,label])=>{const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-pressed',id===active);b.onclick=()=>{fn(id);[...$('tabs').querySelectorAll('button')].find(x=>x.textContent===label)?.focus();};$('tabs').append(b);});}
 function renderPage(){$('page-screen').scrollTop=0;document.body.dataset.settingsTab=tab;const name=U.screen;$('page-title').textContent={levels:'Chọn màn',solver:'AI Solver',replay:'Lời giải',settings:'Tùy chỉnh',help:'Trợ giúp'}[name];$('page-copy').replaceChildren();$('page-bottom').replaceChildren();$('tabs').replaceChildren();$('solver-modes').hidden=name!=='solver';
 if(name==='solver'){
  document.body.dataset.solverView=solverView;renderSolverModes();
  if(solverView==='compare')renderComparison();
  else{tabs([['bfs','BFS'],['dfs','DFS'],['ucs','UCS'],['astar','A*']],selected,id=>{if(current.mode==='solving')A.stopSolver();selected=id;document.body.dataset.results='closed';$('result-strip').hidden=true;$('show-result').hidden=true;A.prepareSolver();renderPage();});$('page-copy').innerHTML='<p id="solver-status" class="solver-note" role="status" aria-live="polite" aria-atomic="true"></p>';$('page-bottom').innerHTML=button('solve-now','Tìm lời giải','play')+'<button id="cancel-wait" hidden>Ngừng chờ</button>';$('solve-now').onclick=()=>{$('result-strip').hidden=true;A.runSolver(selected);};$('cancel-wait').onclick=A.stopSolver;updateSolverStatus();}
 }
 if(name==='replay'){$('page-copy').innerHTML='<p class="replay-context">'+$('solver-name').textContent+'<span>Màn '+current.levelId+'</span></p>';}
 if(name==='levels'){$('game-overlay').hidden=true;const ids=Object.keys(current.allLevels||{});preview=preview||current.levelId;$('page-copy').innerHTML='<div class="side-copy"><h2 id="preview-title"></h2><p>Xem trước màn chơi</p>'+button('start-level','Bắt đầu','play')+'</div>';$('start-level').onclick=async()=>{if(await A.loadLevel(preview))show('play',false);};const row=document.createElement('div');row.className='level-row';const add=(text,fn,pressed=false)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;b.setAttribute('aria-pressed',pressed);row.append(b);return b;};add('‹',()=>{page=Math.max(0,page-1);renderPage();});ids.slice(page*9,page*9+9).forEach(id=>{const b=add(id,()=>{preview=id;renderPage();},id===preview);b.dataset.current=String(id===current.levelId);if(id===current.levelId)b.setAttribute('aria-current','step');b.setAttribute('aria-label',id===current.levelId?'Màn '+id+', đang chơi':'Màn '+id);b.title=id===current.levelId?'Đang chơi':'Xem trước màn '+id;});add('›',()=>{page=Math.min(Math.ceil(ids.length/9)-1,page+1);renderPage();});$('page-bottom').append(row);const count=document.createElement('p');count.className='level-pagination';count.textContent=`Đang chơi: Màn ${current.levelId}\n${page*9+1} – ${Math.min(ids.length,page*9+9)} / ${ids.length}`;$('page-bottom').append(count);$('preview-title').textContent='Màn '+preview;const token=++previewToken;A.getLevelData(preview).then(d=>{if(token===previewToken&&U.screen==='levels'){A.scene().build(d.level,d.initial_state);U.appearance();}}).catch(()=>{$('preview-title').textContent='Không tải được xem trước';});}
 if(name==='settings'){tabs([['block','Khối'],['map','Bản đồ'],['sound','Âm thanh'],['replay','Phát lại']],tab,id=>{tab=id;renderPage();});if(tab==='replay')renderReplaySettings();else if(tab==='sound'){$('page-copy').innerHTML='<div class="sound-panel">'+[['master','Tổng'],['music','Nhạc nền'],['effects','Hiệu ứng'],['ambient','Môi trường']].map(([k,l])=>`<label>${l}<input data-volume="${k}" type="range" min="0" max="100" value="${draft[k]}"><output>${draft[k]}%</output></label>`).join('')+'<button id="listen">Nghe thử</button><button id="mute">'+(draft.mute?'Bật tiếng':'Tắt tiếng')+'</button></div>';$('listen').onclick=()=>{B.audio?.preview();};$('mute').onclick=()=>{draft.mute=!draft.mute;B.audio?.sync();renderPage();};document.querySelectorAll('[data-volume]').forEach(el=>el.oninput=()=>{draft[el.dataset.volume]=Number(el.value);el.nextElementSibling.value=el.value+'%';B.audio?.sync();});}else{const choices=tab==='block'?[['stone','Đá cổ'],['bronze','Đồng'],['jade','Ngọc']]:[['ruins','Di tích'],['garden','Vườn hoa'],['frost','Băng tuyết']];const key=tab==='block'?'skin':'theme';$('page-copy').innerHTML='<div class="side-copy"><h2>'+choices.find(x=>x[0]===draft[key])?.[1]+'</h2><p>Chỉ thay đổi diện mạo.<br>Giữ nguyên cấu trúc và luật chơi.</p></div>';const row=document.createElement('div');row.className='skin-row';choices.forEach(([id,l])=>{const b=document.createElement('button');b.textContent=l;b.className='skin-option '+id;const shot=A.scene()?.thumbnail?.(tab,id);if(shot){const image=new Image();image.src=shot;image.alt=l;b.prepend(image);}b.setAttribute('aria-pressed',draft[key]===id);b.onclick=()=>{draft[key]=id;U.appearance();renderPage();};row.append(b);});$('page-bottom').append(row);if(tab==='block'){const shot=A.scene()?.thumbnail?.('block',draft.skin);if(shot){const image=new Image();image.src=shot;image.id='block-preview';image.alt='Xem trước vật liệu khối';$('page-copy').append(image);}}}$('page-bottom').insertAdjacentHTML('beforeend',button('apply','Áp dụng','check'));$('apply').onclick=()=>{prefs={...draft};try{localStorage.setItem('bloxorz-garden',JSON.stringify(prefs));}catch{}back();};}
 if(name==='help'){
  tabs([['0','Mục tiêu'],['1','Điều khiển'],['2','Ô đặc biệt']],String(help),id=>{help=Number(id);renderPage();});
  const key=t=>`<kbd>${t}</kbd>`,row=(visual,text)=>`<div class="help-row"><div class="help-symbol">${visual}</div><div>${text}</div></div>`;
  const tile=kind=>{const shot=A.scene()?.helpIllustration?.(kind);return shot?`<img class="help-specimen" src="${shot}" alt="${{floor:'Ô đá',goal:'Lỗ đích',fragile:'Ô fragile',soft:'Công tắc nhẹ',heavy:'Công tắc nặng',bridge:'Cầu',split:'Ô tách khối'}[kind]||'Ô chơi'}">`:'';};
  const pages=[`<h2>Mục tiêu màn chơi</h2>${row(tile('goal'),'Đưa khối <strong>đứng thẳng</strong> vào ô đích viền xanh.')}<h2>Luật di chuyển</h2>${row(tile('floor'),'Toàn bộ khối phải được sàn đỡ. Đi ra ngoài mép sẽ rơi.')}${row(tile('fragile'),'Ô cam chịu được khối nằm hoặc khối đơn. Khối đứng làm ô vỡ.')}`,
  `<h2>Điều khiển khối</h2>${row('<div class="key-group">'+['W','A','S','D','↑','←','↓','→'].map(key).join('')+'</div>','Lăn khối theo hàng và cột của bàn.')}${row(key('Space'),'Đổi khối khi tách đôi.')}${row(key('R'),'Chơi lại màn.')}${row(key('Esc'),'Mở hoặc đóng menu.')}<h2>Góc nhìn</h2>${row('<span class="mouse-icon">↔</span>','Kéo chuột để xoay. Cuộn chuột để thu phóng.')}${row(key('F'),'Xem gần khối đang điều khiển. Nhấn lại để căn vào vị trí mới.')}${row(key('C'),'Trở về toàn cảnh.')}`,
  `<h2>Ô đặc biệt</h2>${row(tile('soft'),'Chạm vòng tròn để kích hoạt công tắc nhẹ.')}${row(tile('heavy'),'Công tắc X cần khối đứng thẳng.')}${row(tile('bridge'),'Công tắc quyết định cầu mở hay đóng. Rời rồi chạm lại để kích hoạt lần nữa.')}${row(tile('split'),'Đứng trên ô tách để tạo hai khối đơn. Hai khối sát cạnh sẽ tự ghép.')}`];
  $('page-copy').innerHTML='<article class="help-copy">'+pages[help]+'</article>';
 }

 }
 function renderReplaySettings(){
  $('page-copy').innerHTML='<section class="replay-settings"><h2>Tốc độ phát lời giải</h2><p>Chỉ thay đổi tốc độ diễn hoạt.<br>Không ảnh hưởng thời gian đo thuật toán.</p><div id="replay-speed-options" class="tabs" role="group" aria-label="Tốc độ phát lời giải"></div></section>';
  for(const value of [.5,1,2,4]){const b=document.createElement('button');b.textContent=value+'×';b.setAttribute('aria-pressed',draft.replaySpeed===value);b.onclick=()=>{draft.replaySpeed=value;A.scene().playbackSpeed=value;for(const option of $('replay-speed-options').children)option.setAttribute('aria-pressed',option===b);};$('replay-speed-options').append(b);}
 }
 function renderSolverModes(){
  $('solver-modes').replaceChildren();
  for(const [id,label]of [['single','Từng thuật toán'],['compare','So sánh 4 thuật toán']]){
   const b=document.createElement('button');b.textContent=label;b.dataset.view=id;b.setAttribute('aria-pressed',solverView===id);
   b.onclick=()=>{if(id===solverView)return;if(current.mode==='solving')A.stopSolver();A.pause();solverView=id;document.body.dataset.results='closed';$('result-strip').hidden=true;$('show-result').hidden=true;renderPage();$('solver-modes').querySelector(`[data-view="${id}"]`).focus();};
   $('solver-modes').append(b);
  }
 }
 function renderComparison(){
  $('page-copy').innerHTML='<p class="comparison-context"><span id="comparison-level"></span><span>Từ trạng thái ban đầu</span></p>';
  $('page-bottom').innerHTML=`<section id="comparison-panel" aria-label="So sánh thuật toán">
   <div class="comparison-toolbar"><button id="compare-run" class="comparison-primary"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths.play}"/></svg><span>Chạy cả 4</span></button><label>Giới hạn mỗi thuật <select id="compare-limit"><option value="5000">5 giây</option><option value="15000">15 giây</option><option value="30000">30 giây</option></select></label><button id="compare-stop" hidden>Dừng sau lượt này</button></div>
   <p id="comparison-status" role="status" aria-live="polite" aria-atomic="true"></p>
   <label class="comparison-mobile-metric">Chỉ số <select id="comparison-metric"><option value="time">Thời gian (ms)</option><option value="memory">Bộ nhớ (KB)</option><option value="nodes">Đã xét</option><option value="steps">Số bước</option><option value="cost">Tổng cost</option></select></label>
   <table id="comparison-table" data-metric="time"><caption class="sr-only">Một lượt đo cho mỗi thuật toán, cùng màn chơi và giới hạn thời gian.</caption><thead><tr><th scope="col">Thuật toán</th><th scope="col">Trạng thái</th><th scope="col" class="benchmark-metric" data-metric="time">Thời gian <small>ms</small></th><th scope="col" class="benchmark-metric" data-metric="memory">Bộ nhớ <small>KB</small></th><th scope="col" class="benchmark-metric" data-metric="nodes">Đã xét</th><th scope="col" class="benchmark-metric" data-metric="steps">Bước</th><th scope="col" class="benchmark-metric" data-metric="cost">Cost</th><th scope="col"><span class="sr-only">Lời giải</span></th></tr></thead><tbody></tbody></table>
   <details class="comparison-method"><summary>Cách đo và đọc kết quả</summary><p>Chạy tuần tự BFS, DFS, UCS, A* một lần từ đầu cùng màn. Thời gian tìm kiếm có bật đo bộ nhớ, không tính khởi động tiến trình, kết nối hoặc replay. Bộ nhớ là đỉnh cấp phát Python, không phải tổng RAM. Hết giới hạn không có nghĩa vô nghiệm.</p><p>Đã xét là số trạng thái khối được mở rộng. Cost được tính lại từ lời giải theo cùng mức phạt ô fragile cho cả bốn thuật; phần tính lại không thuộc thời gian tìm kiếm. Ít bước hơn chưa chắc ít cost hơn. Các lần đo có thể dao động; đây là phép so sánh một lượt.</p></details>
  </section>`;
  const body=$('comparison-table').tBodies[0];
  for(const [id,label]of [['bfs','BFS'],['dfs','DFS'],['ucs','UCS'],['astar','A*']]){
   const row=document.createElement('tr');row.dataset.solver=id;
   row.innerHTML=`<th scope="row">${label}</th><td data-field="status"></td>`+['time','memory','nodes','steps','cost'].map(metric=>`<td class="benchmark-metric" data-metric="${metric}" data-field="${metric}">—</td>`).join('')+`<td><button class="compare-replay" aria-label="Xem lời giải ${label}" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths.play}"/></svg><span>Xem lời giải</span></button></td>`;
   row.querySelector('button').onclick=()=>B.comparison.select(id);body.append(row);
  }
  $('compare-run').onclick=()=>{document.body.dataset.results='closed';$('result-strip').hidden=true;$('show-result').hidden=true;void B.comparison.run();};
  $('compare-stop').onclick=()=>B.comparison.stop();$('compare-limit').onchange=e=>B.comparison.setLimit(e.target.value);
  $('comparison-metric').onchange=e=>{$('comparison-table').dataset.metric=e.target.value;};
  updateComparison();
 }
 function updateComparison(){
  const data=B.comparison?.get(),panel=$('comparison-panel');if(!data)return;
  if($('solve-now'))$('solve-now').disabled=data.busy||['loading','resetting','solving','moving','replay'].includes(current.mode);
  if(!panel)return;
  $('comparison-level').textContent='Màn '+(data.levelId||current.levelId||'');
  $('compare-run').disabled=data.busy||!data.levelId||['loading','resetting','solving','moving','replay'].includes(current.mode);
  $('compare-run').querySelector('span').textContent=data.rows.some(row=>row.status!=='idle')?'Chạy lại cả 4':'Chạy cả 4';
  $('compare-limit').disabled=data.busy;$('compare-limit').value=data.limit;
  $('compare-stop').hidden=!data.busy;$('compare-stop').disabled=data.stopRequested;
  $('compare-stop').textContent=data.stopRequested?'Đang chờ lượt này kết thúc':'Dừng sau lượt này';
  const running=data.rows.find(row=>row.status==='running'),finished=data.rows.filter(row=>!['idle','queued','running','skipped'].includes(row.status)).length;
  const label=id=>id==='astar'?'A*':id.toUpperCase();
  $('comparison-status').textContent=data.phase==='changed'&&data.busy?'Đang kết thúc lượt đo màn trước…':data.busy?`${data.stopRequested?'Sẽ dừng sau':'Đang chạy'} ${running?label(running.solver):'lượt hiện tại'}   ${finished} / 4 đã đo`:data.phase==='done'?`Đã đo 4 / 4. Chọn lời giải để replay.`:data.phase==='stopped'?`Đã dừng sau ${finished} / 4 thuật toán.`:data.phase==='error'?'Dữ liệu màn chơi đã đổi. Chạy lại để so sánh cùng cấu hình.':'Sẵn sàng. Ván đang chơi được giữ nguyên cho đến khi chọn lời giải.';
  const statuses={idle:'Chưa đo',queued:'Đang chờ',running:'Đang chạy',solved:'Có lời giải',unsolved:'Vô nghiệm',timeout:`Hết ${data.limit/1000} giây`,unavailable:'Chưa triển khai',error:'Lỗi',skipped:'Chưa chạy'};
  const format=n=>Number(n).toLocaleString('vi-VN',{maximumFractionDigits:3});
  for(const row of data.rows){
   const el=panel.querySelector(`tr[data-solver="${row.solver}"]`),result=row.result;
   el.dataset.status=row.status;const status=el.querySelector('[data-field="status"]');status.textContent=row.status==='timeout'?`Hết ${row.limitMs/1000} giây`:statuses[row.status];
   if(row.error){const message=document.createElement('small');message.className='comparison-error';message.textContent=row.error;status.append(message);}
   const values={time:result?.search_time_ms,memory:result?.memory_kb,nodes:result?.expanded_nodes,steps:result?.found?result.solution_length:null,cost:result?.found?result.total_cost:null};
   for(const [key,value]of Object.entries(values))el.querySelector(`[data-field="${key}"]`).textContent=value==null?'—':format(value);
   el.querySelector('button').disabled=data.busy||row.status!=='solved';
  }
 }
 U.comparisonChanged=updateComparison;
 function updateSolverStatus(){updateComparison();const el=$('solver-status');if(!el)return;const state=current.solverStatus||{state:'ready',message:'Sẵn sàng  Giải từ trạng thái ban đầu'};el.dataset.state=state.state;el.textContent=state.message;el.setAttribute('aria-busy',state.state==='solving');}
 function updateReplayControls(){
  const data=current,complete=data.replayOutcome==='complete',busy=!!data.replayBusy;
  $('seek').max=data.total||0;$('seek').value=data.cursor||0;$('seek').disabled=busy;
  $('replay-count').textContent=(data.cursor||0)+' / '+(data.total||0);
  const label=data.playing?'Tạm dừng':complete?'Phát lại':'Phát';
  $('replay-play').setAttribute('aria-label',label);$('replay-play').title=label;
  $('replay-play').disabled=!data.wasAI||busy&&!data.playing;
  $('replay-play').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(data.playing?'M8 5v14 M16 5v14':complete?paths.reset:paths.play)+'"/></svg>';
  $('replay-prev').disabled=busy||!data.cursor;$('replay-next').disabled=busy||!data.total||data.cursor>=data.total;
  $('replay-status').textContent=complete?'Đã phát xong lời giải':data.replayOutcome==='error'?data.solverStatus.message:data.playing?'Đang phát lời giải':data.cursor?'Đã tạm dừng':'Sẵn sàng phát lời giải';
  $('result-strip').querySelector('h2').textContent='Kết quả  '+$('solver-name').textContent;
 }
 U.update=data=>{
  const previous=current;current=data;if(!data.wasAI)replayVisited=false;
  if(previous.wasAI&&!data.wasAI){pauseOrigin='play';stack=stack.map(screen=>screen==='replay'?'play':screen);}
  if(previous.wasAI&&!data.wasAI&&U.screen==='replay'){stack=[];show('play',false);}
  updateSolverStatus();
  if(document.body.dataset.screen==='outcome'&&!['won','lost'].includes(data.mode)){document.body.dataset.screen='play';show('play',false);}
  if(['won','lost'].includes(data.mode)&&previous.mode!==data.mode){
   $('result-strip').hidden=true;$('show-result').hidden=true;$('page-screen').hidden=true;$('pause-screen').hidden=true;$('simple-hud').hidden=true;$('shell').inert=true;document.body.dataset.screen='outcome';
  }
  if(!['won','lost'].includes(data.mode))$('shell').inert=false;
  $('switch-cube').hidden=data.state?.orientation!=='SPLIT';$('simple-moves').textContent=String(data.moveCount).padStart(2,'0');
  updateReplayControls();$('leave-replay').hidden=!data.wasAI;
  $('end-next').hidden=data.mode!=='won'||Object.keys(data.allLevels).at(-1)===data.levelId;
  if($('solve-now'))$('solve-now').disabled=B.comparison?.get().busy||['loading','resetting','solving','moving','replay'].includes(data.mode);
  if($('cancel-wait'))$('cancel-wait').hidden=data.mode!=='solving';
 };
 U.result=()=>{if(!['solver','replay'].includes(U.screen))return;replayVisited=true;if(U.screen!=='replay'){stack=['solver'];pauseOrigin='replay';show('replay',false);}else updateReplayControls();};
 $('replay-prev').innerHTML='<svg viewBox="0 0 24 24"><path d="M5 5v14 M18 5l-10 7 10 7z"/></svg>';$('replay-next').innerHTML='<svg viewBox="0 0 24 24"><path d="M19 5v14 M6 5l10 7-10 7z"/></svg>';
 $('resume').onclick=back;$('leave-replay').onclick=async()=>{await A.restart();stack=[];pauseOrigin='play';show('play',false);};$('menu-toggle').onclick=()=>show('pause');$('back').onclick=back;
 for(const [id,name]of [['choose-level','levels'],['choose-solver','solver'],['choose-settings','settings'],['choose-help','help'],['end-levels','levels']])$(id).onclick=()=>show(name);
 $('overlay-restart').className='round-label';$('overlay-restart').innerHTML=buttonContent('Chơi lại','reset');
 $('end-next').before($('overlay-restart'));
 $('simple-restart').onclick=A.restart;$('overlay-restart').addEventListener('click',()=>show('play',false));$('end-next').onclick=()=>{show('play',false);A.next();};
 function setReplayMetrics(collapsed){
  document.body.dataset.replayMetrics=collapsed?'collapsed':'expanded';$('collapse-result').textContent=collapsed?'Hiện số liệu':'Ẩn số liệu';$('collapse-result').setAttribute('aria-expanded',String(!collapsed));
 }
 setReplayMetrics(false);
 $('collapse-result').onclick=()=>setReplayMetrics(document.body.dataset.replayMetrics!=='collapsed');
 $('show-result').textContent='Quay lại lời giải';$('show-result').onclick=U.result;
 $('replay-play').onclick=A.playReplay;$('replay-prev').onclick=()=>A.seekReplay(current.cursor-1);$('replay-next').onclick=A.stepReplay;$('seek').onchange=e=>A.seekReplay(e.target.value);
 document.addEventListener('keydown',e=>{if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(e.repeat||!$('game-overlay').hidden)return;['play','solver','replay'].includes(U.screen)?show('pause'):back();}if((U.screen!=='play'||!$('game-overlay').hidden)&&e.code==='Tab'){const root=!$('game-overlay').hidden?$('game-overlay'):$('shell');const items=[...root.querySelectorAll('button,input,select')].filter(x=>!x.disabled&&x.getClientRects().length);const i=items.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&i===items.length-1){e.preventDefault();items[0]?.focus();}}},true);
 document.body.dataset.screen='play';
})();
