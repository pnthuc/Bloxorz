---
title: "Thuật toán UCS cho bài toán Bloxorz"
subtitle: "P02 · Mô tả và giả mã theo bản cài đặt"
author: "Phan Gia Phúc · MSSV 24120503"
date: ""
lang: vi-VN
---

Bộ giải UCS tìm đường đi hợp lệ có tổng chi phí nhỏ nhất từ trạng thái xuất phát tới đích. Thuật toán ưu tiên chi phí đã đi $g(s)$, dùng cùng hàm `step_cost()` với A* và chỉ kết luận thành công khi lấy đích ra khỏi hàng đợi ưu tiên. Với policy P01, kết quả tối ưu theo chi phí có trọng số, không nhất thiết ít hành động nhất.

Nội dung đối chiếu ngày 29/10/2026 với commit `572156d7f596372a59bb9ad2e8e6ed200b3162d1` của repo `pnthuc/Bloxorz`. Commit này bổ sung P01 sau commit `71c3a52`; công thức chi phí và code UCS không thay đổi. Tài liệu gửi Nam để ghép báo cáo, video và gửi Thiện để đối chiếu phần $g(s)$ của A*.

# 1 Mô hình tìm kiếm và hàm mục tiêu

Hàm `solve_ucs(board)` là điểm gọi công khai. Hàm `_ucs_core(board)` thực hiện tìm kiếm. Engine cung cấp `get_initial_state()`, `is_goal(state)` và `get_successors(state)` nên UCS không viết lại luật lăn, công tắc hoặc tách khối. Mỗi cạnh của đồ thị tương ứng một hành động hợp lệ do engine sinh. Nước đi thua không nằm trong tập cạnh. [1][2]

Mỗi đỉnh là một `State` đầy đủ, gồm tọa độ, hướng khối, trạng thái các cầu, tọa độ khối phụ và khối đang điều khiển. Hai trạng thái có cùng tọa độ nhưng khác cầu hoặc khác `active_cube` có thể sinh nước đi khác nhau. Vì vậy, UCS dùng toàn bộ `State` làm khóa của các bảng tra. `State` là dataclass bất biến và hash được. [2]

Theo P01, chi phí của một cạnh là:

$$
c(s,a,s')=1+0.5k(s'),
\qquad
g(s')=g(s)+c(s,a,s').
$$

Trong đó, $k(s')$ đếm ô gạch cam mà toàn bộ khối chiếm giữ ở trạng thái sau. Mọi cạnh có chi phí 1, 1,5 hoặc 2. SPACE cũng là một hành động có chi phí. Chi phí xuất phát là $g(s_0)=0$ và chi phí của đường đi bằng tổng chi phí các cạnh, kể cả cạnh tới đích. [3]

# 2 Cấu trúc dữ liệu và cách cập nhật

## 2.1 Hàng đợi ưu tiên theo g

Biến `frontier` là min heap. Mỗi entry có dạng `(g, order, state)`. Heap lấy entry có `g` nhỏ nhất trước. Khi hai entry có cùng `g`, bộ đếm `order` tăng dần quyết định thứ tự lấy ra và tránh so sánh trực tiếp hai đối tượng `State`. `order` không tham gia hàm chi phí. [1]

Thuật toán khởi tạo heap với trạng thái xuất phát và chi phí 0. Sau đó, mỗi lần tìm được đường tốt hơn tới một trạng thái, UCS thêm entry mới vào heap. Bản cài đặt không tìm và sửa entry cũ ngay trong heap.

## 2.2 Bảng best_g và parent

`best_g[state]` lưu chi phí nhỏ nhất đã biết để tới trạng thái đó. Tại thời điểm khởi tạo, bảng chỉ có `best_g[start_state] = 0.0`. Giá trị này là chi phí tốt nhất đã phát hiện, chưa phải lời khẳng định rằng trạng thái đã có chi phí tối ưu cuối cùng.

`parent[state]` lưu cặp `(previous_state, action)` của đường đang tốt nhất. Thuật toán đặt `parent[start_state] = None` làm điểm dừng khi dựng đường. Nếu tìm được đường rẻ hơn, UCS cập nhật cả `best_g` lẫn `parent`. Nhờ đó, đường dựng lại khớp với chi phí đã chọn. [1]

Với cạnh từ `current` tới `next_state`, UCS tính `next_g`. Nếu `next_g` nhỏ hơn giá trị đã lưu, thuật toán ghi nhận đường mới và thêm entry vào heap. Nếu hai đường có cùng chi phí, code giữ đường ghi nhận trước vì điều kiện bỏ qua là `next_g >= best_g.get(next_state, inf)`. Thuật toán không dùng số hành động làm tiêu chí phụ khi hai đường có cùng cost.

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

Trong code Python, các giá trị trả về nằm trong dict với khóa `found`, `moves`, `expanded_nodes` và `total_cost`. Cách viết bộ bốn trong giả mã chỉ rút gọn phần biểu diễn kết quả. Hàm dựng đường có dạng:

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

Đây là đồ thị giả định để giải thích UCS tổng quát, không phải một màn Bloxorz đã đo. Các cạnh có chi phí: `S→A = 1`, `S→B = 1,5`, `A→X = 2`, `B→X = 1` và `X→G = 2`. Đích là `G`. Trọng số được gán trực tiếp cho cạnh. Ví dụ không áp dụng quy tắc chỉ phụ thuộc trạng thái sau của P01, vì hai cạnh đi vào X có trọng số khác nhau.

| Lượt lấy | Entry lấy ra | Cách xử lý | Heap sau xử lý |
|---:|---|---|---|
| 1 | (0; S) | Sinh A và B | (1; A), (1,5; B) |
| 2 | (1; A) | Ghi best_g[X] = 3, parent[X] = A | (1,5; B), (3; X) |
| 3 | (1,5; B) | Sửa best_g[X] = 2,5, parent[X] = B | (2,5; X), (3; X) |
| 4 | (2,5; X) | Sinh G với chi phí 4,5 | (3; X), (4,5; G) |
| 5 | (3; X) | Bỏ vì 3 khác best_g[X] = 2,5 | (4,5; G) |
| 6 | (4,5; G) | Lấy đích, trả đường S→B→X→G | Dừng tìm kiếm |

Bảng chỉ ghi các trường chi phí và trạng thái của entry, lược bỏ bộ đếm. Các entry được trình bày theo thứ tự ưu tiên để dễ đọc, không phải vị trí vật lý trong mảng heap. `parent` thực tế còn lưu hành động trên từng cạnh.

Nếu chọn `X` làm đích trong cùng đồ thị, lần sinh đầu tiên cho cost 3 qua A. Đường qua B có cost 2,5 và chỉ xuất hiện sau đó. Dừng khi vừa sinh X sẽ trả sai chi phí tối ưu. Khi chỉ kết luận lúc lấy X khỏi heap, UCS trả đúng cost 2,5.

# 5 Quan hệ giữa UCS và BFS

Nếu mỗi hành động đều có chi phí 1, chi phí đường đi bằng số hành động. UCS khi đó mở rộng các mức độ sâu tăng dần, cùng mục tiêu tối ưu với BFS. Bộ đếm tăng dần của UCS giữ thứ tự thêm vào giữa các entry cùng chi phí. Nếu mọi cạnh có cùng chi phí dương $q$, kết luận vẫn giữ vì $g=q\times$ số hành động. [4]

Hai bản cài đặt trong repo vẫn có thể báo số node mở rộng khác nhau. BFS kiểm tra đích khi sinh successor, còn UCS kiểm tra khi lấy khỏi heap. Quan hệ trên nói về mục tiêu tối ưu, không khẳng định mọi metric hoặc cách xử lý thời điểm dừng đều giống nhau. [1]

Với P01, cạnh có thể có cost 1, 1,5 hoặc 2. Khi đó, BFS tối ưu số hành động, còn UCS tối ưu tổng cost có trọng số. Một lời giải nhiều hành động hơn vẫn có thể rẻ hơn nếu giảm đủ lượt tiếp xúc gạch cam. Tuy nhiên, hai thuật toán có thể trả cùng lời giải trên một màn cụ thể.

SPACE nằm trong `moves` và là một cạnh của đồ thị. Vì vậy, số hành động là `len(moves)`, còn `solution_length` trong API chỉ đếm bước lăn và loại SPACE. `total_cost` của BFS trong code hiện tại cũng loại SPACE. Khi so chéo chất lượng đường đi, tài liệu ví dụ dùng `path_cost` tính lại theo P01. [1][3]

# 6 Kết quả và các trường hợp biên

| Tình huống | Cách xử lý của UCS |
|---|---|
| Xuất phát đã ở đích | Lấy start khỏi heap, trả found=True, moves rỗng, cost 0, expanded_nodes 0 |
| Sinh successor hợp lệ | Cộng cost của trạng thái sau rồi xét cập nhật đường tốt hơn |
| Trạng thái có đường tới rẻ hơn | Cập nhật best_g và parent, thêm entry mới |
| Entry lỗi thời | Bỏ qua trước kiểm tra đích và trước tăng bộ đếm mở rộng |
| Trạng thái không có successor | Vẫn tính một lần mở rộng khi gọi get_successors, rồi tiếp tục heap |
| Heap cạn, chưa gặp đích | Trả found=False, moves rỗng, total_cost 0 theo quy ước kết quả |

`expanded_nodes` đếm các lần thuật toán thực sự chuẩn bị sinh successor, không đếm số entry được lấy khỏi heap. Đích và entry lỗi thời không làm tăng bộ đếm. Giá trị 0 của `total_cost` khi vô nghiệm là quy ước trả kết quả, không phải chi phí của một lời giải.

Wrapper `solve_ucs()` gọi `run_with_profiler()` để đo thời gian, bộ nhớ Python đỉnh và chuẩn hóa schema. Phần `cost-example` kiểm chứng đường đi và phép cộng chi phí, không dùng thời gian chạy hay bộ nhớ từ lượt kiểm tra làm số liệu thực nghiệm chính thức. [1]

# 7 Nguồn tham khảo và sử dụng AI

[1] `Src/solvers/member5_ucs.py`, `member3_bfs.py` và `base.py`. Luồng UCS, điểm kiểm tra đích của BFS và schema kết quả. [Thư mục solver tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/tree/572156d7f596372a59bb9ad2e8e6ed200b3162d1/Src/solvers).

[2] `Src/game_logic.py`. State, điều kiện thắng, tập hành động và successor hợp lệ. [Mã nguồn tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/blob/572156d7f596372a59bb9ad2e8e6ed200b3162d1/Src/game_logic.py).

[3] `handoff/phuc/cost-policy.md`, `cost-policy.docx` và `Src/solvers/costs.py`. Policy P01 hiện có, đọc ngày 29/10/2026. Đơn vị và công thức trong P02 giữ nguyên P01.

[4] UC Berkeley, CS 188, “1.3 Uninformed Search”, mục BFS và UCS. [Tài liệu chính thức](https://inst.eecs.berkeley.edu/~cs188/textbook/search/uninformed.html). Truy cập ngày 29/10/2026.

[5] MIT OpenCourseWare, 6.006, Spring 2020, “Recitation 13: Dijkstra’s Algorithm”. Điều kiện cạnh không âm và chi phí tối ưu khi lấy đỉnh khỏi hàng đợi ưu tiên. [Tài liệu chính thức](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ec187276db0faaa047d655979a44de7f_MIT6_006S20_r13.pdf). Truy cập ngày 29/10/2026.

ChatGPT Codex hỗ trợ đối chiếu mã nguồn, soạn giả mã và nội dung tiếng Việt, kiểm chứng ví dụ và kiểm tra bản chuyển đổi tài liệu. Nội dung tiếp tục dùng nguyên tắc rõ nghĩa và thuật ngữ nhất quán của First Read theo yêu cầu. Người phụ trách đọc lại, hiểu luồng tìm kiếm và xác nhận trước khi bàn giao cho Nam và Thiện.
