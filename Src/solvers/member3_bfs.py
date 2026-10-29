"""Thành viên 3: Breadth-First Search.
Core dùng luật engine; wrapper đo thời gian, bộ nhớ và chuẩn hóa kết quả.
"""
from typing import Any, Dict
from core.board import BloxorzBoard
from .base import run_with_profiler
from collections import deque


def _bfs_core(board: BloxorzBoard) -> Dict[str, Any]:
    """FIFO, đánh dấu khi phát hiện; tìm đường ít hành động nhất."""
    start_state = board.get_initial_state()
    
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
