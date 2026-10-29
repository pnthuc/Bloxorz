/* Sequential benchmark orchestration. Measurements never mutate the live game. */
(()=>{
  'use strict';
  const B=window.Bloxorz,algorithms=['bfs','dfs','ucs','astar'];
  const emptyRows=()=>algorithms.map(solver=>({solver,status:'idle',result:null,error:''}));
  let levelId=null,batchLevel=null,limit=5000,busy=false,stopRequested=false;
  let rows=emptyRows(),phase='ready',generation=0,revision=null;
  const get=()=>({levelId,batchLevel,limit,busy,stopRequested,rows,phase});
  const notify=()=>B.ui.comparisonChanged?.(get());
  function setLevel(id){
    id=String(id);if(id===levelId)return;
    generation++;levelId=id;rows=emptyRows();revision=null;
    phase=busy?'changed':'ready';if(busy)stopRequested=true;notify();
  }
  async function run(){
    if(busy||!levelId||!['idle','won','lost'].includes(B.ui.actions.inspect().mode))return;
    busy=true;stopRequested=false;phase='running';batchLevel=levelId;revision=null;
    rows=emptyRows().map(row=>({...row,status:'queued',limitMs:limit}));
    const token=++generation,budget=limit,id=levelId;notify();
    try{
      for(const row of rows){
        if(stopRequested||token!==generation)break;
        row.status='running';notify();
        const connection=new AbortController(),timeout=setTimeout(()=>connection.abort(),budget+25000);
        try{
          const response=await fetch('/api/benchmark',{signal:connection.signal,method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({level_id:id,solver:row.solver,limit_ms:budget,level_revision:revision})});
          const data=await response.json();if(token!==generation)break;
          if(!response.ok){const error=Error(data.error||`Máy chủ trả về lỗi ${response.status}.`);error.code=data.code;throw error;}
          if(data.solver!==row.solver||String(data.level_id)!==id||data.limit_ms!==budget||
            !['solved','unsolved','timeout','unavailable','error'].includes(data.status))throw Error('Kết quả lượt đo không khớp cấu hình.');
          if(['solved','unsolved'].includes(data.status)&&(!data.result||!Array.isArray(data.result.moves)||
            data.result.found!==(data.status==='solved')||
            !['search_time_ms','memory_kb','expanded_nodes','solution_length','total_cost'].every(key=>Number.isFinite(data.result[key])&&data.result[key]>=0)))throw Error('Số đo trả về không đầy đủ. Hãy chạy lại.');
          if(data.level_revision)revision=data.level_revision;
          row.status=data.status;row.result=data.result||null;row.error=data.error||'';
        }catch(error){
          if(token!==generation)break;
          row.status='error';row.error=error.name==='AbortError'?'Mất phản hồi máy chủ. Hãy kiểm tra kết nối và chạy lại.':error.message;
          if(error.code==='LEVEL_CHANGED'){phase='error';stopRequested=true;}
        }finally{clearTimeout(timeout);}
        notify();
      }
      if(token===generation){
        rows.forEach(row=>{if(row.status==='queued')row.status='skipped';});
        if(phase!=='error')phase=stopRequested?'stopped':'done';
      }
    }finally{
      busy=false;stopRequested=false;notify();
    }
  }
  function stop(){if(busy){stopRequested=true;notify();}}
  function select(solver){
    const row=rows.find(row=>row.solver===solver);
    if(busy||batchLevel!==levelId||row?.status!=='solved'||!row.result?.found)return;
    B.ui.actions.useSolverResult(solver,row.result);
  }
  B.comparison={get,setLevel,run,stop,select,setLimit(value){if(!busy&&[5000,15000,30000].includes(Number(value))){limit=Number(value);notify();}}};
  const context=B.ui.actions.inspect();if(context.state)setLevel(context.levelId);
})();
