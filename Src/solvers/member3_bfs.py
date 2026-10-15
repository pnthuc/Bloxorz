"""Thành viên 3: tự cài đặt phần TODO; xem Giao_viec_Bloxorz.pdf.
Không thay chữ ký solve_* hoặc schema kết quả. Không dùng walkthroughs để giải.
Core trả found, moves, expanded_nodes, total_cost; wrapper đo thời gian/bộ nhớ.
"""
from typing import Any, Dict
from game_logic import BloxorzBoard, State
from .base import run_with_profiler
from collections import deque


def _bfs_core(board: BloxorzBoard) -> Dict[str, Any]:
    """TODO TV2: FIFO, chống lặp bằng State, đường ít hành động nhất.
    Dùng get_initial_state(), is_goal(), get_successors(); không viết lại luật game.
    Xử lý start=goal, vô nghiệm, dựng lại danh sách hành động và đếm expanded_nodes.
    """
    "Lấy trạng thái ban đầu"
    start_state = board.get_initial_state()
    
    "Trường hợp bắt đầu ngay goal"
    if board.is_goal(start_state) :
        return {
            "found" : True,
            "moves" : [],
            "expanded_nodes" : 0,
            "total_cost" : 0
        }
    
    queue = deque([start_state])
    parent = {start_state: None}
    expanded_nodes = 0
    
    while queue :
        current = queue.popleft()
        expanded_nodes += 1
        
        for action, nxt in board.get_successors(current):
            if nxt in parent:
                continue
            parent[nxt] = (current, action)
            
            if board.is_goal(nxt):
                moves = []
                node = nxt
                
                while parent[node] is not None :
                    node, act = parent[node]
                    moves.append(act)
                    
                moves.reverse()
                return {
                    "found" : True,
                    "moves" : moves,
                    "expanded_nodes" : expanded_nodes,
                    "total_cost" : len(moves),
                    
                }
            queue.append(nxt)
    return {
        "found" : False,
        "moves" : [],
        "expanded_nodes" : expanded_nodes,
        "total_cost" : 0
    }


def solve_bfs(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_bfs_core, board)