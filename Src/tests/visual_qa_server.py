"""Local-only visual QA runner. Never imported by the production app."""
import sys
from pathlib import Path
from collections import deque
from flask import request, send_from_directory, render_template
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import app, load_all_levels, serialize_state
from game_logic import BloxorzBoard

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'screenshots' / 'review-2'
OUT.mkdir(parents=True, exist_ok=True)

@app.get('/qa')
def qa():
    page = render_template('index.html')
    if request.args.get('version') == 'before':
        for name in ['scene', 'garden', 'materials', 'game', 'shell']:
            page = page.replace('/static/js/'+name+'.js', '/qa-baseline/'+name+'.js')
    return page.replace('</body>', '<script src="/qa-runner.js"></script></body>')

@app.get('/qa-baseline/<path:name>')
def baseline(name):
    return send_from_directory(HERE / 'visual_baseline', name)

@app.get('/qa-runner.js')
def runner():
    return send_from_directory(HERE, 'visual_qa.js')

@app.post('/qa-save/<name>')
def save(name):
    if not name.replace('-', '').replace('.', '').replace('_', '').isalnum():
        return 'invalid', 400
    (OUT / name).write_bytes(request.get_data())
    return {'saved': name}

@app.get('/qa-cases')
def cases():
    levels = load_all_levels()
    found = []
    for kind, level_id in [('edge','1'),('fragile','2'),('bridge','11'),('goal','1')]:
        board = BloxorzBoard(levels[level_id]); initial = board.get_initial_state()
        todo = deque([(initial, [])]); seen = {initial}
        while todo:
            state, path = todo.popleft()
            for action in ['UP','DOWN','LEFT','RIGHT']:
                outcome = board.evaluate_move(state, action); candidate = outcome['state']
                match = False
                if kind == 'goal': match = outcome['valid'] and board.is_goal(candidate)
                elif kind == 'bridge': match = outcome.get('failure_reason') == 'bridge_closed'
                elif not outcome['valid'] and candidate is None:
                    # Detect the rendering footprint after the same quarter-turn.
                    dr,dc={'UP':(-1,0),'DOWN':(1,0),'LEFT':(0,-1),'RIGHT':(0,1)}[action]
                    r,c=state.r,state.c
                    if state.orientation=='STANDING':
                        cells=[(r+dr,c+dc),(r+2*dr,c+2*dc)]
                    elif state.orientation=='HORIZONTAL':
                        cells=[(r,c-1 if dc<0 else c+2)] if dc else [(r+dr,c),(r+dr,c+1)]
                    else:
                        cells=[(r-1 if dr<0 else r+2,c)] if dr else [(r,c+dc),(r+1,c+dc)]
                    supported=[board.is_cell_walkable(r,c,state.bridges) for r,c in cells]
                    match = (kind=='edge' and len(cells)==2 and sum(supported)==1) or (kind=='fragile' and len(cells)==1 and supported[0] and board.grid[cells[0][0]][cells[0][1]]==2)
                if match:
                    found.append({'name':kind,'level':levels[level_id],'before':serialize_state(state),'action':action,'outcome':{'valid':outcome['valid'],'next_state':serialize_state(candidate) if outcome['valid'] else None,'failure_state':serialize_state(candidate) if candidate and not outcome['valid'] else None},'path':path})
                    todo.clear(); break
                if outcome['valid'] and candidate not in seen:
                    seen.add(candidate);todo.append((candidate,path+[action]))
            if found and found[-1]['name']==kind: break
    return found

if __name__ == '__main__':
    app.run(host='127.0.0.1',port=5056,debug=False,use_reloader=False)

