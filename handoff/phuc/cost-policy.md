---
title: "Chính sách chi phí cho bộ giải Bloxorz"
subtitle: "P01 · UCS và A*"
author: "Phan Gia Phúc · MSSV 24120503"
date: ""
lang: vi-VN
---

Tài liệu này định nghĩa hàm chi phí dùng chung cho UCS và A* trong Bloxorz. Mỗi hành động hợp lệ có chi phí cơ bản bằng 1. Mỗi ô gạch cam mà khối chiếm giữ sau hành động làm tăng chi phí thêm 0,5. Cách tính này kết hợp mục tiêu giảm số hành động với mục tiêu hạn chế tiếp xúc với ô dễ vỡ.

Phiên bản đối chiếu ngày 29/10/2026 là commit `71c3a52bb7aba20f50160ce73d24305de92ff0d6` của repo `pnthuc/Bloxorz`, trên nhánh `work/phuc-charts-video`. Tài liệu mô tả code tại commit này và giữ nguyên hàm chi phí cùng các mốc kiểm thử. Người nhận gồm Quân, Thiện, Nam và Thức.

# 1 Định nghĩa hàm chi phí

## 1.1 Chữ ký và đầu vào

Hàm nằm trong `Src/solvers/costs.py`:

```python
def step_cost(board: BloxorzBoard, next_state: State) -> float:
    return 1 + 0.5 * sum(
        board.grid[r][c] == 2
        for r, c in next_state.get_occupied_cells()
    )
```

`board` là bàn chơi chứa lưới `grid`. Giá trị `2` trong lưới biểu thị ô gạch cam dễ vỡ, tương ứng với hằng `FRAGILE` của engine. `next_state` là trạng thái hợp lệ sau khi engine thực hiện hành động và xử lý công tắc, cầu, tách khối hoặc ghép khối. Hàm `get_occupied_cells()` trả các ô mà toàn bộ khối đang chiếm giữ, kể cả cả hai khối đơn khi tách đôi. [1][2]. Vì vậy, chi phí chỉ phụ thuộc vào bàn chơi và vùng chiếm giữ của trạng thái sau.

## 1.2 Công thức và miền giá trị

Với chuyển trạng thái hợp lệ từ $s$ sang $s'$ qua hành động $a$, đặt $O(s')$ là tập ô mà khối chiếm giữ ở $s'$. Số ô gạch cam trong tập này là:

$$
k(s') = \sum_{(r,c)\in O(s')} \mathbf{1}[\mathrm{grid}[r][c]=2].
$$

Ký hiệu $\mathbf{1}[P]$ bằng 1 nếu mệnh đề $P$ đúng và bằng 0 nếu $P$ sai. Chi phí của hành động là:

$$
c(s,a,s') = \operatorname{step\_cost}(board,s') = 1 + 0.5\,k(s').
$$

Một trạng thái hợp lệ chiếm một hoặc hai ô. Vì vậy, $k(s')\in\{0,1,2\}$ và chi phí thuộc tập $\{1.0,1.5,2.0\}$. Khối lớn đứng thẳng trên gạch cam là trạng thái thua nên engine loại trạng thái đó. Khối nằm hoặc hai khối đơn vẫn có thể chiếm gạch cam hợp lệ. [2]

| Số ô cam ở trạng thái sau | Chi phí hành động | Diễn giải |
|---:|---:|---|
| 0 | 1,0 | Chỉ tính chi phí cơ bản |
| 1 | 1,5 | Chi phí cơ bản cộng một mức phạt |
| 2 | 2,0 | Chi phí cơ bản cộng hai mức phạt |

Mọi hành động hợp lệ đều có chi phí dương, với cận dưới bằng 1. Không có cạnh chi phí 0 hoặc âm. Kiểu kết quả là `float`.

## 1.3 Vì sao chi phí không âm

Số ô cam $k(s')$ luôn không âm, hệ số phạt 0,5 là số dương và chi phí cơ bản bằng 1. Do đó, $c(s,a,s')=1+0.5k(s')\geq1>0$.

Điều kiện không âm để bảo đảm tính tối ưu của cách tìm kiếm mà UCS dùng chung với Dijkstra. Khi thêm một hành động vào đường đi, chi phí mới là $g(s')=g(s)+c(s,a,s')$. Với $c\geq0$, việc nối dài đường đi không thể làm giảm chi phí. Vì vậy, khi UCS lấy đích có chi phí nhỏ nhất ra khỏi heap, các đường còn chờ không thể nối dài thành một lời giải rẻ hơn. Nếu cho phép cạnh âm, một đường có chi phí ban đầu cao hơn có thể trở nên rẻ hơn về sau, nên cách dừng tại đích này không còn bảo đảm tối ưu. [8]

Ý nghĩa bài toán là một lý do độc lập với thuật toán. Chi phí đang biểu diễn công sức thực hiện hành động và mức phạt khi tiếp xúc gạch cam. Cả hai thành phần đều là phần phải trả. Nếu một cách thiết kế tạo chu trình có tổng chi phí âm trên đường tới đích, người giải có thể lặp chu trình để giảm chi phí mãi. Khi đó, bài toán không còn một chi phí tối ưu hữu hạn. Công thức hiện tại loại trừ tình huống này. [9]

Dijkstra cho phép cạnh có chi phí 0, nên điều kiện dương không phải yêu cầu bắt buộc của thuật toán. Nhóm chọn cận dưới bằng 1 để mọi hành động, kể cả SPACE, đều có giá phải trả. Với lựa chọn này, mỗi chu trình làm tăng chi phí và việc đi vòng không thể cải thiện lời giải. Tổng chi phí 0 chỉ dành cho đường đi rỗng khi đã ở đích. [1][8]

# 2 Lý do chọn chi phí không đồng nhất

Thành phần cơ bản bằng 1 thể hiện công sức thực hiện một hành động. Thành phần phạt thể hiện mong muốn hạn chế tiếp xúc với gạch cam. Trong Bloxorz, gạch cam có hạn chế về tư thế khối: khối lớn không được đứng thẳng trên ô này. Vì vậy, đường đi qua nhiều gạch cam đòi hỏi chú ý hơn đến tư thế và vùng chiếm giữ. [2]

Mức phạt 0,5 tạo một quy đổi dễ giải thích: hai lượt chiếm một ô cam có tổng mức phạt bằng một hành động cơ bản. Nhờ đó, UCS có thể chọn đường dài hơn nếu đường đó giảm đủ số lượt tiếp xúc với gạch cam. Hệ số này là lựa chọn mô hình hóa của nhóm, không phải tham số suy ra từ số liệu đo.

Engine xử lý luật chơi một cách xác định. Mô hình không gán xác suất rơi cho một nước đi hợp lệ. Do đó, chi phí trên là thước đo ưu tiên đường đi, không phải xác suất thất bại, thời gian thực thi hay độ an toàn đã được kiểm chứng bằng thực nghiệm.

Một chuyển trạng thái tới công tắc thường có chi phí 1 nếu trạng thái sau không chiếm gạch cam. Nếu trạng thái sau vẫn chiếm một hoặc hai ô cam, công thức vẫn cộng mức phạt tương ứng.

Nếu mọi hành động đều có chi phí 1, UCS tối ưu số hành động giống BFS. Thứ tự xử lý các trạng thái cùng chi phí và cách kiểm tra đích có thể làm số node mở rộng khác nhau. Với công thức hiện tại, UCS tối ưu tổng chi phí có trọng số nên không bảo đảm lời giải ít hành động nhất. Trên một màn không có gạch cam, công thức trở thành chi phí đồng nhất. [6]

# 3 Quy ước cho các tình huống đặc biệt

**SPACE.** Khi khối đang tách đôi, SPACE đổi khối đơn đang điều khiển. Hành động này có chi phí cơ bản bằng 1 dù không thay đổi tọa độ. Hàm tiếp tục đếm gạch cam dưới cả hai khối đơn. Nếu một khối đơn còn trên gạch cam, SPACE có chi phí 1,5. Nếu cả hai khối đơn còn trên gạch cam, SPACE có chi phí 2. Ngoài trạng thái tách đôi, engine không sinh SPACE hợp lệ. [1][2]

**Tiếp xúc lặp lại với gạch cam.** Công thức tính vùng chiếm giữ sau mỗi hành động, không chỉ tính ô vừa đi vào. Khi một khối đơn giữ nguyên vị trí trên gạch cam và khối còn lại di chuyển, hành động mới vẫn chịu mức phạt cho ô cam đó. Đây là cách tính mức tiếp xúc theo từng hành động, không phải đếm số ô cam khác nhau đã ghé qua.

**Công tắc tách khối và dịch chuyển.** Một lần lăn lên công tắc tách khối là một hành động. Engine tạo trạng thái sau khi tách và dịch chuyển tới hai vị trí đích của công tắc. Hàm tính chi phí trên hai vị trí cuối này, không cộng một hành động riêng cho hiệu ứng tách hoặc dịch chuyển. [2]

**Nước đi tới đích.** Điều kiện thắng yêu cầu khối lớn đứng thẳng trên ô `GOAL`, có mã 9. Khi một hành động kết thúc tại đích, vùng chiếm giữ chỉ gồm ô đích nên hành động đó có chi phí 1. Hành động cuối vẫn nằm trong tổng chi phí. [2]

**Xuất phát tại đích.** Lời giải rỗng có tổng chi phí 0 vì không có hành động.

**Nước đi thua và trạng thái bế tắc.** Nếu nước đi không hợp lệ, `apply_move()` trả `None` và `get_successors()` không đưa cạnh đó vào đồ thị tìm kiếm. Hàm chi phí không gán 0 cho nước đi thua. Nếu một trạng thái hợp lệ không có trạng thái kế tiếp, trạng thái đó không có cạnh đi ra. Chi phí đã tích lũy để tới trạng thái đó vẫn giữ nguyên. Khi không còn trạng thái nào trong hàng đợi và chưa gặp đích, solver trả `found=False`. [2][3]

# 4 Ví dụ tính và đối chiếu

## 4.1 Đường đi thật trên màn 2

Màn 2 trong `Src/levels/level_2_fragile.json` có vị trí xuất phát `(2,1)`. Ca kiểm thử `2` cung cấp chuỗi hành động dưới đây. Chỉ số hàng và cột bắt đầu từ 0. Các tọa độ trong bảng là vùng chiếm giữ sau hành động. [4]

| Bước | Hành động | Các ô bị chiếm sau hành động | Số ô cam | Chi phí bước | Tích lũy |
|---:|---|---|---:|---:|---:|
| 1 | RIGHT | (2,2), (2,3) | 2 | 2,0 | 2,0 |
| 2 | UP | (1,2), (1,3) | 0 | 1,0 | 3,0 |
| 3 | RIGHT | (1,4) | 0 | 1,0 | 4,0 |
| 4 | RIGHT | (1,5), (1,6) | 0 | 1,0 | 5,0 |
| 5 | DOWN | (2,5), (2,6) | 1 | 1,5 | 6,5 |
| 6 | RIGHT | (2,7), là đích | 0 | 1,0 | 7,5 |

Chuỗi này có 6 hành động, không có SPACE và tổng chi phí bằng 7,5. Lần đối chiếu ngày 29/10/2026 bằng `replay_solution()` xác nhận đường đi hợp lệ và trả cùng chi phí. Trên màn này, BFS và UCS hiện trả cùng chuỗi hành động. BFS báo `total_cost=6.0`, còn UCS báo `total_cost=7.5`.

## 4.2 Ví dụ riêng cho SPACE

Một board kiểm tra có hàng ô `[1, 2, 1, 1, 9]`. Trạng thái tách đôi có hai khối đơn tại `(0,1)` và `(0,3)`, với khối đơn 0 đang điều khiển. Sau SPACE, hai tọa độ giữ nguyên và `active_cube` chuyển sang 1. Trạng thái sau còn chiếm một ô cam nên chi phí bằng $1+0.5=1.5$. Phép tính trực tiếp bằng engine và `step_cost()` cho cùng kết quả.

## 4.3 Minh họa sự đánh đổi giữa hành động và chi phí

Bảng sau là ví dụ giả định để giải thích hàm mục tiêu, không phải kết quả đo trên một màn trong repo. Giả sử hai đường đều hợp lệ và cùng tới đích. Một lượt chiếm hai ô cam đóng góp hai đơn vị vào cột lượt tiếp xúc.

| Đường giả định | Số hành động | Tổng lượt tiếp xúc ô cam | Tổng chi phí |
|---|---:|---:|---:|
| A | 6 | 6 | 9,0 |
| B | 8 | 0 | 8,0 |

Theo số hành động, A ngắn hơn B. Theo hàm chi phí đã chọn, B rẻ hơn A. UCS ưu tiên B nếu đây là hai lựa chọn cần so sánh. Ví dụ thể hiện vai trò của chi phí không đồng nhất mà giảng viên yêu cầu.

# 5 Chi phí đường đi và quy ước thực nghiệm

Với đường đi hợp lệ $\pi=(s_0,a_1,s_1,\ldots,a_m,s_m)$, chi phí dùng chung là:

$$
\operatorname{path\_cost}(\pi)
=\sum_{i=1}^{m}\operatorname{step\_cost}(board,s_i)
=m+0.5\sum_{i=1}^{m}k(s_i).
$$

Trong công thức này, $m$ là số hành động, kể cả SPACE. Trạng thái xuất phát không chịu chi phí riêng. Mỗi hành động hợp lệ đóng góp đúng một lần, gồm hành động tới đích. Với lời giải rỗng hợp lệ, tổng bằng 0.

Quân tính `path_cost` bằng cách phát lại `moves` từ trạng thái xuất phát trên một board riêng. Mỗi lần `apply_move()` trả trạng thái hợp lệ, quy trình cộng `step_cost(board, next_state)`. Chỉ đường đi hợp lệ và kết thúc tại đích mới có `path_cost` của lời giải. `replay_solution()` đã thực hiện cách cộng này. [4]

| Trường | Ý nghĩa tại phiên bản đối chiếu |
|---|---|
| `path_cost` | Tổng chi phí có trọng số tính lại từ đường đi, dùng chung cho bốn solver |
| `total_cost` của UCS và A* | Tổng chi phí có trọng số do solver trả, cần khớp replay khi tìm thấy lời giải |
| `total_cost` của BFS và DFS | Số bước lăn do solver trả, loại SPACE |
| `len(moves)` | Số hành động trong danh sách, kể cả SPACE |
| `solution_length` trong API | Số bước lăn, loại SPACE |
| `solution_length` trong script thực nghiệm | Số hành động, kể cả SPACE |
| `rolling_steps` trong script thực nghiệm | Số bước lăn, loại SPACE |

Benchmark giữ nguyên `total_cost` gốc trong cột riêng. Khi so sánh chất lượng đường đi giữa các solver, báo cáo dùng `path_cost`. Các bảng độ dài ghi rõ đang dùng số hành động hay số bước lăn. Hai đại lượng này khác nhau trên đường đi có SPACE. [3][5]

Khi `found=False`, solver hiện trả `total_cost=0.0` để thống nhất cấu trúc kết quả. Với lượt vô nghiệm, timeout, lỗi hoặc đường đi không hợp lệ, bảng thực nghiệm để trống chi phí lời giải dùng chung và giữ trạng thái tương ứng.

# 6 Chi phí và tính tối ưu

UCS hiện dùng tổng chi phí $g(s)$ làm độ ưu tiên trong heap. Khi sinh trạng thái kế tiếp, thuật toán tính `next_g = current_g + step_cost(board, next_state)`. Thuật toán cập nhật đường tốt hơn qua `best_g`, bỏ mục heap lỗi thời và chỉ kết luận thành công khi lấy đích ra khỏi heap. [3]

Vì mỗi cạnh có chi phí ít nhất 1, các đường nối dài không thể giảm tổng chi phí. Với việc lưu đầy đủ `State`, UCS trên đồ thị hữu hạn của màn chơi tìm lời giải có `path_cost` nhỏ nhất khi có đủ tài nguyên. Trường hợp mọi cạnh bằng 1 cho mục tiêu tối ưu giống BFS. Kết luận này không đồng nhất số bước lăn với số hành động có SPACE. [3][6]

A* nhập cùng hàm `step_cost()` và cộng hàm này vào $g(s)$. Do đó, UCS và A* dùng cùng đơn vị chi phí cho phần đường đã đi. Nếu Thiện xây dựng một cận dưới đúng cho số hành động còn lại, cận dưới đó cũng là cận dưới cho chi phí còn lại, vì mỗi hành động có chi phí ít nhất 1. [3]

Điều kiện $c\geq1$ tự nó không chứng minh rằng heuristic hiện có là chấp nhận được hoặc nhất quán. Thiện vẫn cần kiểm tra công thức heuristic trên cơ chế tách, ghép và dịch chuyển, rồi xác nhận giả thiết dùng trong báo cáo. P01 chỉ xác định hàm chi phí và điều kiện cận dưới mà phần heuristic có thể sử dụng.

# 7 Đối chiếu tài liệu và trạng thái bàn giao

## 7.1 Nội dung khớp và điểm cần thống nhất

`costs.py`, cách cộng chi phí trong UCS/A* và `replay_solution()` cùng dùng vùng chiếm giữ của trạng thái sau. README gốc cũng ghi đúng công thức và cách tính SPACE. Docstring UCS ghi đúng cận dưới `step_cost >= 1`. `costs.py` hiện không có docstring riêng. Tài liệu này cung cấp đặc tả chi tiết cho hàm đó. [1][3][4]

README gốc mô tả `total_cost` của BFS/DFS là số hành động. Code hiện tại thực tế loại SPACE. Tài liệu này dùng ý nghĩa đúng theo code và phân biệt rõ các cột trong mục 5. CSV chạy thử của Quân ghi BFS màn 4 có 17 hành động, 16 bước lăn và `total_cost=17.0`. Metadata của CSV ghi commit `c37fa0d96b4639eb4a6aa6e08197568d3a496e81`, khác phiên bản đối chiếu. Vì vậy, số liệu đó không đại diện cho `total_cost` mà code hiện tại trả. [5]

## 7.2 Ảnh hưởng tới mốc kiểm thử

P01 giữ nguyên công thức tại commit đối chiếu. Vì vậy, không có mốc kỳ vọng nào cần thay đổi do tài liệu này. Các mốc sau giúp Thức đối chiếu khi ghép bản nộp. Đây là dữ liệu kiểm thử, không phải số liệu hiệu năng của một đợt thực nghiệm chính thức. [4]

| Ca | Mốc hiện có | Ảnh hưởng của P01 |
|---|---|---|
| 2 và T2 | Chi phí tối ưu 7,5 | Giữ nguyên |
| 4 | 16 bước lăn, 17 hành động trong đường mẫu, chi phí 17,5 | Giữ nguyên |
| 33 | Chi phí tối ưu 119,5, đường mẫu có chi phí 120 | Giữ nguyên |
| T10 | Xuất phát tại đích, lời giải rỗng, chi phí 0 | Giữ nguyên |

Nếu nhóm đổi hệ số phạt, cách tính SPACE hoặc vùng ô dùng để tính chi phí, nhóm cần cập nhật phiên bản policy. Khi đó, Thức kiểm tra lại các mốc chịu ảnh hưởng và Quân xác định dữ liệu cần đo lại. Các số theo policy cũ giữ nguyên nguồn gốc và không được đổi nhãn thành số liệu mới.

## 7.3 Xác nhận còn lại

Bản nội dung P01 đã có công thức, lý do chọn, ví dụ và commit để bàn giao. Trạng thái M0 trong `handoff/shared/baseline.md` vẫn là “CHƯA CHỐT”. Các xác nhận dưới đây vẫn còn chờ người phụ trách:

- Quân xác nhận có thể tính lại `path_cost` và phân biệt đúng các cột độ dài, chi phí.
- Thiện xác nhận cận dưới chi phí và giả thiết dùng cho heuristic, đồng thời đối chiếu lại tài liệu A*.
- Thức xác nhận phiên bản nguồn và các mốc kiểm thử khi chốt M0.
- Nam nhận công thức và cách diễn giải để ghép báo cáo.

# 8 Nguồn đối chiếu và sử dụng AI

[1] `Src/solvers/costs.py`. Công thức chi phí dùng chung. [Bản nguồn tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/blob/71c3a52bb7aba20f50160ce73d24305de92ff0d6/Src/solvers/costs.py).

[2] `Src/game_logic.py`. Biểu diễn State, vùng chiếm giữ, điều kiện thắng và xử lý hành động. [Bản nguồn tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/blob/71c3a52bb7aba20f50160ce73d24305de92ff0d6/Src/game_logic.py).

[3] `Src/solvers/member5_ucs.py`, `member4_astar.py`, `member3_bfs.py`, `member2_dfs.py` và `base.py`. Cách cộng và trả chi phí trong bốn solver. [Thư mục solver tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/tree/71c3a52bb7aba20f50160ce73d24305de92ff0d6/Src/solvers).

[4] `Src/tests/helpers.py`, `Src/tests/test_cases.json` và `Src/levels/level_2_fragile.json`. Replay, đường đi mẫu và mốc kiểm thử tại cùng commit. [Thư mục kiểm thử](https://github.com/pnthuc/Bloxorz/tree/71c3a52bb7aba20f50160ce73d24305de92ff0d6/Src/tests).

[5] README gốc, `Src/experiments.py`, `handoff/shared/baseline.md`, bộ CSV/metadata trong `handoff/quan/benchmarks/` và `handoff/thien/heuristic-policy.docx`. Nguồn đối chiếu quy ước bàn giao trong repo, đọc ngày 29/10/2026.

[6] UC Berkeley, CS 188, “1.3 Uninformed Search”, mục BFS và UCS. Nguồn lý thuyết về thứ tự tìm kiếm, tính tối ưu và trường hợp chi phí đồng nhất. [Tài liệu chính thức](https://inst.eecs.berkeley.edu/~cs188/textbook/search/uninformed.html). Truy cập ngày 29/10/2026.

[7] Yêu cầu giảng viên do người thực hiện cung cấp: cài đặt UCS, định nghĩa và giải thích hàm chi phí, làm rõ ý nghĩa của chi phí không đồng nhất. Các ví dụ chi phí trong yêu cầu là gợi ý thiết kế, không bắt buộc một công thức cụ thể.

[8] MIT OpenCourseWare, 6.006 Introduction to Algorithms, Spring 2020, “Recitation 13: Dijkstra’s Algorithm”. Điều kiện trọng số không âm và tính chất chi phí tối ưu khi lấy đỉnh ra khỏi hàng đợi ưu tiên. [Tài liệu chính thức](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ec187276db0faaa047d655979a44de7f_MIT6_006S20_r13.pdf). Truy cập ngày 29/10/2026.

[9] MIT OpenCourseWare, 6.006 Introduction to Algorithms, Spring 2020, “Lecture 11: Weighted Shortest Paths”. Chu trình âm và trường hợp chi phí đường đi không có giá trị tối ưu hữu hạn. [Tài liệu chính thức](https://live.ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/aa57a9785adf925bc85c1920f53755a0_MIT6_006S20_lec11.pdf). Truy cập ngày 29/10/2026.

ChatGPT Codex hỗ trợ đọc mã nguồn, đối chiếu phép tính, soạn nội dung tiếng Việt và kiểm tra bản chuyển đổi tài liệu. Người phụ trách đọc lại và xác nhận nội dung trước khi nhóm dùng làm giao ước tại M0.
