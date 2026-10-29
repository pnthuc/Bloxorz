from main import app
client=app.test_client()
for level in ['1','3','4']:
 for solver in ['bfs','dfs','ucs','astar']:
  result=client.post('/api/solve',json={'level_id':level,'solver':solver}).get_json()
  assert result['found']
  state=client.get('/api/level/'+level).get_json()['initial_state']
  for action in result['moves']:
   move=client.post('/api/move',json={'level_id':level,'state':state,'action':action}).get_json()
   assert move['valid'];state=move['next_state']
  assert move['is_goal']
  print(level,solver,result['solution_length'],'verified')
