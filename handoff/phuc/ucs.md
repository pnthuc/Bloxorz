---
title: "Thuật toán UCS cho bài toán Bloxorz"
subtitle: "P02 · Mô tả và giả mã theo bản cài đặt"
author: "Phan Gia Phúc · MSSV 24120503"
date: ""
lang: vi-VN
---

Bộ giải UCS tìm đường đi hợp lệ có tổng chi phí nhỏ nhất từ trạng thái xuất phát tới đích. Thuật toán ưu tiên chi phí đã đi $g(s)$, dùng cùng hàm `step_cost()` với A* và chỉ kết luận thành công khi lấy đích ra khỏi hàng đợi ưu tiên. Với policy P01, kết quả tối ưu theo chi phí có trọng số, không nhất thiết ít hành động nhất.

Ngày đối chiếu là 30/10/2026. Bản cập nhật dùng mô hình tám hướng, chọn khối miễn phí đã có trên main. Tài liệu gửi Nam để ghép báo cáo, video và gửi Thiện để đối chiếu phần $g(s)$ của A*.

Commit đối chiếu là `721c198dfc2a6fff92d451a763015d974fa3b52a` của repo `pnthuc/Bloxorz`.

# 1 Mô hình tìm kiếm và hàm mục tiêu

Hàm `solve_ucs(board)` là điểm gọi công khai. Hàm `_ucs_core(board)` thực hiện tìm kiếm. Engine trong `Src/core/board.py` cung cấp `get_initial_state()`, `is_goal(state)` và `get_successors(state)` nên UCS không viết lại luật lăn, công tắc hoặc tách khối. Mỗi cạnh tương ứng một bước lăn hợp lệ. [1][2]

Khi khối chưa tách, engine xét bốn hướng `UP`, `LEFT`, `RIGHT`, `DOWN`. Khi tách đôi, engine xét thêm `SUP`, `SLEFT`, `SRIGHT`, `SDOWN`: đổi khối rồi lăn theo hướng tương ứng trong một cạnh. SPACE chỉ chọn khối khi chơi tay, miễn phí và không được sinh bởi `get_successors()`. [2]

Mỗi đỉnh là một `State` đầy đủ, gồm tọa độ, hướng khối, trạng thái các cầu, tọa độ khối phụ và khối đang điều khiển. Hai trạng thái có cùng tọa độ nhưng khác cầu hoặc khác `active_cube` có thể sinh nước đi khác nhau. Vì vậy, UCS dùng toàn bộ `State` làm khóa của các bảng tra. `State` là dataclass bất biến và hash được. [2]

Theo P01, chi phí của một cạnh là:

$$
c(s,a,s')=1+0.5k(s'),
\qquad
g(s')=g(s)+c(s,a,s').
$$

Trong đó, $k(s')$ đếm ô gạch cam mà toàn bộ khối chiếm giữ sau bước lăn. Mọi cạnh có chi phí 1, 1,5 hoặc 2, gồm cả hướng có tiền tố S. Việc chọn khối không cộng một phí riêng. Chi phí xuất phát là $g(s_0)=0$ và chi phí đường đi bằng tổng chi phí các cạnh, kể cả cạnh tới đích. [3]

# 2 Cấu trúc dữ liệu và cách cập nhật

## 2.1 Hàng đợi ưu tiên theo g

Biến `frontier` là min heap. Mỗi entry có dạng `(g, order, state)`. Heap lấy entry có `g` nhỏ nhất trước. Khi hai entry có cùng `g`, bộ đếm `order` tăng dần quyết định thứ tự lấy ra và tránh so sánh trực tiếp hai đối tượng `State`. [1]

Thuật toán khởi tạo heap với trạng thái xuất phát và chi phí 0. Sau đó, mỗi lần tìm được đường tốt hơn tới một trạng thái, UCS thêm entry mới vào heap.

## 2.2 Bảng best_g và parent

`best_g[state]` lưu chi phí nhỏ nhất đã biết để tới trạng thái đó. Tại thời điểm khởi tạo, bảng chỉ có `best_g[start_state] = 0.0`. Giá trị này là chi phí tốt nhất đã phát hiện, chưa phải chi phí tối ưu cuối cùng.

`parent[state]` lưu cặp `(previous_state, action)` của đường đang tốt nhất. Thuật toán đặt `parent[start_state] = None` làm điểm dừng khi dựng đường. Nếu tìm được đường rẻ hơn, UCS cập nhật cả `best_g` lẫn `parent`. Nhờ đó, đường dựng lại khớp với chi phí đã chọn. [1]

Với cạnh từ `current` tới `next_state`, UCS tính `next_g`. Nếu `next_g` nhỏ hơn giá trị đã lưu, thuật toán ghi nhận đường mới và thêm entry vào heap. Nếu hai đường có cùng chi phí, code giữ đường ghi nhận trước vì điều kiện bỏ qua là `next_g >= best_g.get(next_state, inf)`.

## 2.3 Entry lỗi thời

Trong UCS tổng quát, một trạng thái có thể xuất hiện nhiều lần trong heap với chi phí khác nhau. Ví dụ, entry chi phí 3 vẫn còn trong heap sau khi thuật toán tìm được đường chi phí 2,5 tới cùng trạng thái. Entry chi phí 3 lúc này đã lỗi thời. Bản cài đặt giữ cơ chế kiểm tra này để xử lý an toàn khi có nhiều entry cho một trạng thái.

Ngay sau `heappop`, code kiểm tra `current_g != best_g[current]`. Nếu điều kiện đúng, UCS bỏ entry đó. Entry lỗi thời không được kiểm tra đích, không sinh trạng thái kế tiếp và không làm tăng `expanded_nodes`. Với chi phí nguyên hoặc nửa nguyên ở quy mô bài toán hiện tại, phép so sánh trực tiếp này khớp các giá trị mà code cộng. [1][3]

# 3 Giả mã theo code

Giả mã dưới đây giữ thứ tự xử lý của `_ucs_core()`. `NEXT(counter)` trả số thứ tự tăng dần. `POP_MIN` và `PUSH` thao tác trên min heap. `GET` trả giá trị mặc định nếu khóa chưa có.

```text
UCS(board):
    start = board.get_initial_state()
    counter = bộ đếm bắt đầu từ 0
    frontier = [(0.0, NEXT(counter), start)]
    best_g = {start: 0.0}
    parent = {start: None}
    expanded = 0

    while frontier không rỗng:
        (g, _, s) = POP_MIN(frontier)
        if g != best_g[s]:
            continue
        if board.is_goal(s):
            moves = TRACE(parent, s)
            return (True, moves, expanded, g)

        expanded = expanded + 1
        for (action, t) in board.get_successors(s):
            new_g = g + step_cost(board, t)
            if new_g >= GET(best_g, t, vô_cùng):
                continue
            best_g[t] = new_g
            parent[t] = (s, action)
            PUSH(frontier, (new_g, NEXT(counter), t))

    return (False, [], expanded, 0.0)
```

Trong code Python, các giá trị trả về nằm trong dict với khóa `found`, `moves`, `expanded_nodes` và `total_cost`. Hàm dựng đường có dạng:

```text
TRACE(parent, goal):
    moves = []
    node = goal
    while parent[node] != None:
        (node, action) = parent[node]
        thêm action vào cuối moves
    đảo ngược moves
    return moves
```

Hàm `TRACE` đi ngược từ đích qua `parent`, nên danh sách thu được cần đảo trước khi phát lại. Trạng thái xuất phát không có hành động đi vào và không thêm một bước giả vào lời giải.

# 4 Vì sao kiểm tra đích khi lấy khỏi heap

UCS dùng cùng nguyên lý chọn chi phí nhỏ nhất như Dijkstra. Với cạnh không âm, một đường không thể rẻ hơn khi nối dài. Khi thuật toán lấy entry còn hiệu lực có chi phí nhỏ nhất ra khỏi heap, chi phí tới trạng thái đó đã tối ưu. Vì vậy, UCS có thể dừng nếu trạng thái vừa lấy ra là đích. [5]

Trong UCS tổng quát với cạnh không âm, thời điểm vừa sinh đích chưa có bảo đảm tương tự. Một trạng thái khác còn trong heap có thể dẫn tới đích với tổng chi phí thấp hơn. Bản cài đặt đặt phép kiểm tra đích sau khi bỏ entry lỗi thời và trước khi sinh successor. Giả mã giữ đúng vị trí này. [1]

Lập luận tối ưu dựa trên ba điều kiện của bản hiện tại: engine sinh đủ các cạnh hợp lệ, thuật toán phân biệt đúng toàn bộ `State`, và chi phí cạnh không âm. Đồ thị trạng thái của một màn là hữu hạn. Với đủ thời gian và bộ nhớ, UCS tìm được lời giải tối ưu nếu có lời giải. Nếu heap cạn trước khi gặp đích, không còn trạng thái có thể tới để mở rộng. Chi phí hiện có còn thỏa điều kiện mạnh hơn là $c\geq1$. [1][2][3][5]

## 4.1 Ví dụ cập nhật đường tốt hơn và bỏ entry cũ

Đây là đồ thị giả định để giải thích UCS tổng quát. Các cạnh có chi phí: `S→A = 1`, `S→B = 1,5`, `A→X = 2`, `B→X = 1` và `X→G = 2`. Đích là `G`. Trọng số được gán trực tiếp cho cạnh.

| Lượt lấy | Entry lấy ra | Cách xử lý | Heap sau xử lý |
|---:|---|---|---|
| 1 | (0; S) | Sinh A và B | (1; A), (1,5; B) |
| 2 | (1; A) | Ghi best_g[X] = 3, parent[X] = A | (1,5; B), (3; X) |
| 3 | (1,5; B) | Sửa best_g[X] = 2,5, parent[X] = B | (2,5; X), (3; X) |
| 4 | (2,5; X) | Sinh G với chi phí 4,5 | (3; X), (4,5; G) |
| 5 | (3; X) | Bỏ vì 3 khác best_g[X] = 2,5 | (4,5; G) |
| 6 | (4,5; G) | Lấy đích, trả đường S→B→X→G | Dừng tìm kiếm |

Bảng chỉ ghi các trường chi phí và trạng thái của entry, lược bỏ bộ đếm.

Nếu chọn `X` làm đích trong cùng đồ thị, lần sinh đầu tiên cho cost 3 qua A. Đường qua B có cost 2,5 và chỉ xuất hiện sau đó. Dừng khi vừa sinh X sẽ trả sai chi phí tối ưu. Khi chỉ kết luận lúc lấy X khỏi heap, UCS trả đúng cost 2,5.

# 5 Quan hệ giữa UCS và BFS

Nếu mỗi hành động đều có chi phí 1, chi phí đường đi bằng số hành động. UCS khi đó mở rộng các mức độ sâu tăng dần, cùng mục tiêu tối ưu với BFS. Bộ đếm tăng dần của UCS giữ thứ tự thêm vào giữa các entry cùng chi phí. Nếu mọi cạnh có cùng chi phí dương $q$, kết luận vẫn giữ vì $g=q\times$ số hành động. [4]

Hai bản cài đặt trong repo vẫn có thể báo số node mở rộng khác nhau. BFS kiểm tra đích khi sinh successor, còn UCS kiểm tra khi lấy khỏi heap. Mô hình hiện tại giữ SPACE miễn phí ngoài tập cạnh, nên BFS vẫn tối ưu số bước lăn khi dùng tập tám hướng. [1][2]

Với P01, cạnh có thể có cost 1, 1,5 hoặc 2. Khi đó, BFS tối ưu số hành động, còn UCS tối ưu tổng cost có trọng số. Một lời giải nhiều hành động hơn vẫn có thể rẻ hơn nếu giảm đủ lượt tiếp xúc gạch cam. Tuy nhiên, hai thuật toán có thể trả cùng lời giải trên một màn cụ thể.

Lời giải chỉ chứa hành động thuộc `SEARCH_ACTIONS`, không chứa SPACE. Mỗi lệnh thường hoặc có tiền tố S đều là một bước lăn. Vì vậy, `solution_length = len(moves)` và BFS/DFS trả `total_cost = len(moves)`. Khi so chéo chất lượng đường đi, tài liệu ví dụ dùng `path_cost` có trọng số theo P01. GUI benchmark dùng tên cột khác CLI, như bảng quy ước trong P01. [1][2][3]

# 6 Kết quả và các trường hợp biên

| Tình huống | Cách xử lý của UCS |
|---|---|
| Xuất phát đã ở đích | Lấy start khỏi heap, trả found=True, moves rỗng, cost 0, expanded_nodes 0 |
| Sinh successor hợp lệ | Cộng cost của trạng thái sau rồi xét cập nhật đường tốt hơn |
| Trạng thái có đường tới rẻ hơn | Cập nhật best_g và parent, thêm entry mới |
| Entry lỗi thời | Bỏ qua trước kiểm tra đích và trước tăng bộ đếm mở rộng |
| Trạng thái không có successor | Vẫn tính một lần mở rộng khi gọi get_successors, rồi tiếp tục heap |
| Heap cạn, chưa gặp đích | Trả found=False, moves rỗng, total_cost 0 theo quy ước kết quả |

`expanded_nodes` đếm các lần thuật toán thực sự chuẩn bị sinh successor, không đếm số entry được lấy khỏi heap. Đích và entry lỗi thời không làm tăng bộ đếm. Giá trị 0 của `total_cost` khi vô nghiệm là quy ước trả kết quả.

Wrapper `solve_ucs()` gọi `run_with_profiler()` để đo thời gian, bộ nhớ Python đỉnh và chuẩn hóa schema. Phần `cost-example` kiểm chứng đường đi và phép cộng chi phí. [1]

# 7 Nguồn tham khảo và sử dụng AI

[1] `Src/solvers/member5_ucs.py`, `member3_bfs.py` và `base.py`. Luồng UCS, điểm kiểm tra đích của BFS và schema kết quả. [Thư mục solver tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/tree/721c198dfc2a6fff92d451a763015d974fa3b52a/Src/solvers).

[2] `Src/core/board.py`. State, điều kiện thắng, tập tám hướng và successor hợp lệ. [Mã nguồn tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/blob/721c198dfc2a6fff92d451a763015d974fa3b52a/Src/core/board.py).

[3] Policy P01 trong `handoff/phuc/cost-policy.docx`, cập nhật ngày 30/10/2026. Hàm cost nằm trong `Src/solvers/costs.py`, còn replay nằm trong `Src/core/replay.py`. Đơn vị và công thức trong P02 dùng cùng P01.

[4] UC Berkeley, CS 188, “1.3 Uninformed Search”, mục BFS và UCS. [Tài liệu chính thức](https://inst.eecs.berkeley.edu/~cs188/textbook/search/uninformed.html). Truy cập ngày 29/10/2026.

[5] MIT OpenCourseWare, 6.006, Spring 2020, “Recitation 13: Dijkstra’s Algorithm”. Điều kiện cạnh không âm và chi phí tối ưu khi lấy đỉnh khỏi hàng đợi ưu tiên. [Tài liệu chính thức](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ec187276db0faaa047d655979a44de7f_MIT6_006S20_r13.pdf). Truy cập ngày 29/10/2026.

ChatGPT Codex hỗ trợ đối chiếu mã nguồn, giả mã và dàn ý nội dung, kiểm chứng ví dụ và kiểm tra bản chuyển đổi tài liệu. Nội dung tiếp tục dùng nguyên tắc rõ nghĩa và thuật ngữ nhất quán của First Read theo yêu cầu. Người phụ trách đọc lại, hiểu luồng tìm kiếm và xác nhận trước khi bàn giao cho Nam và Thiện.
