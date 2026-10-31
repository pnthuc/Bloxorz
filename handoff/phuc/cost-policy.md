---
title: "Chính sách chi phí cho bộ giải Bloxorz"
subtitle: "P01 · UCS và A*"
author: "Phan Gia Phúc · MSSV 24120503"
date: ""
lang: vi-VN
---

Tài liệu này định nghĩa hàm chi phí dùng chung cho UCS và A* trong Bloxorz. Mỗi hành động lăn hợp lệ có chi phí cơ bản bằng 1. Mỗi ô gạch cam mà khối chiếm giữ sau hành động làm tăng chi phí thêm 0,5. SPACE chỉ chọn khối khi chơi tay, miễn phí và không là cạnh tìm kiếm. Cách tính này kết hợp mục tiêu giảm số bước lăn với mục tiêu hạn chế tiếp xúc với ô dễ vỡ.

Ngày đối chiếu là 30/10/2026. Bản cập nhật giữ nguyên công thức và áp dụng quy ước chọn khối miễn phí đã có trên main. Người nhận gồm Quân, Thiện, Nam và Thức.

Commit đối chiếu là `721c198dfc2a6fff92d451a763015d974fa3b52a` của repo `pnthuc/Bloxorz`, trên nhánh `work/phuc-charts-video`. Source liên quan đã đồng bộ quy ước của main `087d65d`.

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

`board` là bàn chơi chứa lưới `grid`. Giá trị `2` trong lưới biểu thị ô gạch cam dễ vỡ, tương ứng với hằng `FRAGILE` của engine. `next_state` là trạng thái hợp lệ sau một bước lăn và sau khi engine xử lý công tắc, cầu, tách khối hoặc ghép khối. Hàm `get_occupied_cells()` trả các ô mà toàn bộ khối đang chiếm giữ, kể cả cả hai khối đơn khi tách đôi. Vì vậy, chi phí chỉ phụ thuộc vào bàn chơi và vùng chiếm giữ của trạng thái sau. [1][2]

## 1.2 Công thức và miền giá trị

Với một cạnh tìm kiếm hợp lệ từ $s$ sang $s'$ qua hành động lăn $a$, đặt $O(s')$ là tập ô mà khối chiếm giữ ở $s'$. Số ô gạch cam trong tập này là:

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

Mọi cạnh tìm kiếm đều có chi phí dương, với cận dưới bằng 1. Đồ thị mà solver duyệt không có cạnh chi phí 0 hoặc âm. Thao tác chọn khối miễn phí nằm ngoài đồ thị này. Kiểu kết quả của `step_cost()` là `float`.

## 1.3 Vì sao chi phí không âm

Số ô cam $k(s')$ luôn không âm, hệ số phạt 0,5 là số dương và chi phí cơ bản bằng 1. Do đó, $c(s,a,s')=1+0.5k(s')\geq1>0$.

Điều kiện không âm để bảo đảm tính tối ưu của cách tìm kiếm mà UCS dùng chung với Dijkstra. Khi thêm một hành động vào đường đi, chi phí mới là $g(s')=g(s)+c(s,a,s')$. Với $c\geq0$, việc nối dài đường đi không thể làm giảm chi phí. Vì vậy, khi UCS lấy đích có chi phí nhỏ nhất ra khỏi heap, các đường còn chờ không thể nối dài thành một lời giải rẻ hơn. Nếu cho phép cạnh âm, một đường có chi phí ban đầu cao hơn có thể trở nên rẻ hơn về sau, nên cách dừng tại đích này không còn bảo đảm tối ưu. [8]

Ý nghĩa bài toán là một lý do độc lập với thuật toán. Chi phí đang biểu diễn công sức thực hiện hành động và mức phạt khi tiếp xúc gạch cam. Cả hai thành phần đều là phần phải trả. Nếu một cách thiết kế tạo chu trình có tổng chi phí âm trên đường tới đích, người giải có thể lặp chu trình để giảm chi phí mãi. Khi đó, bài toán không còn một chi phí tối ưu hữu hạn. Công thức hiện tại loại trừ tình huống này. [9]

Dijkstra cho phép cạnh có chi phí 0, nên điều kiện dương không phải yêu cầu bắt buộc của thuật toán. Trong mô hình hiện tại, mỗi cạnh luôn gồm một bước lăn có cost ít nhất 1. Thao tác SPACE chọn khối miễn phí nhưng không sinh cạnh tìm kiếm. Vì vậy, mọi chu trình trong đồ thị tìm kiếm đều làm tăng cost. Một lời giải có tổng cost 0 chỉ khi đường đi rỗng và đã ở đích. [1][2][8]

# 2 Lý do chọn chi phí không đồng nhất

Thành phần cơ bản bằng 1 thể hiện công sức thực hiện một hành động. Thành phần phạt thể hiện mong muốn hạn chế tiếp xúc với gạch cam. Trong Bloxorz, gạch cam có hạn chế về tư thế khối: khối lớn không được đứng thẳng trên ô này. Vì vậy, đường đi qua nhiều gạch cam đòi hỏi chú ý hơn đến tư thế và vùng chiếm giữ. [2]

Mức phạt 0,5 tạo một quy đổi dễ giải thích: hai lượt chiếm một ô cam có tổng mức phạt bằng một hành động cơ bản. Nhờ đó, UCS có thể chọn đường dài hơn nếu đường đó giảm đủ số lượt tiếp xúc với gạch cam. Hệ số này là lựa chọn mô hình hóa của nhóm, không phải tham số suy ra từ số liệu đo.

Engine xử lý luật chơi một cách xác định. Mô hình không gán xác suất rơi cho một nước đi hợp lệ. Do đó, chi phí trên là thước đo ưu tiên đường đi, không phải xác suất thất bại, thời gian thực thi hay độ an toàn đã được kiểm chứng bằng thực nghiệm.

Một chuyển trạng thái tới công tắc thường có chi phí 1 nếu trạng thái sau không chiếm gạch cam. Nếu trạng thái sau vẫn chiếm một hoặc hai ô cam, công thức vẫn cộng mức phạt tương ứng.

Nếu mọi hành động đều có chi phí 1, UCS tối ưu số hành động giống BFS. Thứ tự xử lý các trạng thái cùng chi phí và cách kiểm tra đích có thể làm số node mở rộng khác nhau. Với công thức hiện tại, UCS tối ưu tổng chi phí có trọng số nên không bảo đảm lời giải ít hành động nhất. Trên một màn không có gạch cam, công thức trở thành chi phí đồng nhất. [6]

# 3 Quy ước cho các tình huống đặc biệt

**SPACE và chọn khối.** Khi khối đang tách đôi, SPACE chỉ đổi khối đơn đang điều khiển và giữ nguyên tọa độ, cầu. Đây là thao tác chơi tay miễn phí. `get_successors()` không sinh SPACE và `replay_solution()` không nhận SPACE trong lời giải solver. [2][4]

**Đổi khối rồi lăn.** Tập hành động tìm kiếm gồm `UP`, `LEFT`, `RIGHT`, `DOWN`, `SUP`, `SLEFT`, `SRIGHT`, `SDOWN`. Tiền tố S có nghĩa là đổi khối đang điều khiển rồi lăn theo hướng còn lại. Một lệnh có tiền tố S là một cạnh, chỉ tính cost một lần trên trạng thái sau bước lăn. Khi chưa tách khối, engine chỉ sinh bốn hướng thường. [2]

**Tiếp xúc lặp lại với gạch cam.** Công thức tính vùng chiếm giữ sau mỗi hành động, không chỉ tính ô vừa đi vào. Khi một khối đơn giữ nguyên vị trí trên gạch cam và khối còn lại di chuyển, hành động mới vẫn chịu mức phạt cho ô cam đó. Đây là cách tính mức tiếp xúc theo từng hành động, không phải đếm số ô cam khác nhau đã ghé qua.

**Công tắc tách khối và dịch chuyển.** Một lần lăn lên công tắc tách khối là một hành động. Engine tạo trạng thái sau khi tách và dịch chuyển tới hai vị trí đích của công tắc. Hàm tính chi phí trên hai vị trí cuối này, không cộng một hành động riêng cho hiệu ứng tách hoặc dịch chuyển. [2]

**Nước đi tới đích.** Điều kiện thắng yêu cầu khối lớn đứng thẳng trên ô `GOAL`, có mã 9. Khi một hành động kết thúc tại đích, vùng chiếm giữ chỉ gồm ô đích nên hành động đó có chi phí 1. Hành động cuối vẫn nằm trong tổng chi phí. [2]

**Xuất phát tại đích.** Lời giải rỗng có tổng chi phí 0 vì không có hành động.

**Nước đi thua và trạng thái bế tắc.** Nếu nước đi không hợp lệ, `apply_move()` trả `None` và `get_successors()` không đưa cạnh đó vào đồ thị tìm kiếm. Hàm chi phí không gán 0 cho nước đi thua. Nếu một trạng thái hợp lệ không có trạng thái kế tiếp, trạng thái đó không có cạnh đi ra. Chi phí đã tích lũy để tới trạng thái đó vẫn giữ nguyên. Khi không còn trạng thái nào trong hàng đợi và chưa gặp đích, solver trả `found=False`. [2][3]

# 4 Ví dụ tính và đối chiếu

## 4.1 Đường đi thật trên màn 2

Màn 2 trong `Src/levels/level_02.json` có vị trí xuất phát `(2,1)`. Ca kiểm thử `2` cung cấp chuỗi hành động dưới đây. Chỉ số hàng và cột bắt đầu từ 0. Các tọa độ trong bảng là vùng chiếm giữ sau hành động. [4]

| Bước | Hành động | Các ô bị chiếm sau hành động | Số ô cam | Chi phí bước | Tích lũy |
|---:|---|---|---:|---:|---:|
| 1 | RIGHT | (2,2), (2,3) | 2 | 2,0 | 2,0 |
| 2 | UP | (1,2), (1,3) | 0 | 1,0 | 3,0 |
| 3 | RIGHT | (1,4) | 0 | 1,0 | 4,0 |
| 4 | RIGHT | (1,5), (1,6) | 0 | 1,0 | 5,0 |
| 5 | DOWN | (2,5), (2,6) | 1 | 1,5 | 6,5 |
| 6 | RIGHT | (2,7), là đích | 0 | 1,0 | 7,5 |

Chuỗi này có 6 bước lăn và tổng chi phí bằng 7,5. Lần đối chiếu ngày 30/10/2026 bằng `replay_solution()` xác nhận đường đi hợp lệ và trả cùng chi phí. Trên màn này, BFS và UCS trả cùng chuỗi hành động. BFS báo `total_cost=6`, còn UCS báo `total_cost=7.5`.

## 4.2 Ví dụ chọn khối miễn phí rồi lăn

Một board kiểm tra có hàng ô `[1, 2, 1, 1, 9]`. Trạng thái tách đôi có hai khối đơn tại `(0,1)` và `(0,3)`, với khối đơn 0 đang điều khiển. Khi chơi tay, SPACE đổi `active_cube` sang 1, giữ nguyên hai tọa độ và không cộng cost. Việc còn một khối đơn trên gạch cam không làm thao tác chọn khối bị tính phí.

Lệnh `SLEFT` từ trạng thái ban đầu chọn khối đơn 1 rồi lăn sang `(0,2)`. Hai khối đơn ghép thành khối nằm ngang, chiếm `(0,1)` và `(0,2)`. Trạng thái sau có một ô cam nên bước lăn này có cost $1+0.5=1.5$.

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

Trong công thức này, $m=\operatorname{len}(moves)$ là số hành động lăn thuộc tập tám hướng. Lệnh có tiền tố S vẫn tính một hành động. SPACE không nằm trong `moves`. Trạng thái xuất phát không chịu chi phí riêng. Mỗi cạnh đóng góp đúng một lần, gồm cạnh tới đích. Với lời giải rỗng hợp lệ, tổng bằng 0.

Quân tính `path_cost` bằng cách phát lại `moves` từ trạng thái xuất phát trên một board riêng. Danh sách chỉ chứa hành động thuộc `SEARCH_ACTIONS`. Mỗi lần `apply_move()` trả trạng thái hợp lệ, quy trình cộng `step_cost(board, next_state)`. Chỉ đường đi hợp lệ và kết thúc tại đích mới có `path_cost` của lời giải. `replay_solution()` trong `Src/core/replay.py` đã thực hiện cách cộng này. [4]

| Trường | Ý nghĩa tại phiên bản đối chiếu |
|---|---|
| `path_cost` trong CLI | Cost chung tính lại bằng replay cho cả bốn solver |
| `total_cost` gốc của UCS/A* | Cost có trọng số, cần khớp replay khi có lời giải |
| `total_cost` gốc của BFS/DFS | Số hành động lăn, bằng `len(moves)` |
| `len(moves)` và `solution_length` | Số cạnh lăn trong lời giải, gồm cả lệnh có tiền tố S |
| `rolling_steps` trong CLI | Bằng `len(moves)`, cùng ý nghĩa số bước lăn |
| `total_cost` của GUI benchmark | Cost chung đã tính lại |
| `solver_reported_cost` của GUI benchmark | Giá trị `total_cost` gốc mà solver trả |

CLI trong `Src/benchmarks/cli.py` giữ `total_cost` gốc và lưu thêm `path_cost`. GUI benchmark trong `Src/benchmarks/worker.py` tính lại cost chung vào `total_cost` và lưu số gốc ở `solver_reported_cost`. Khi ghép bảng, báo cáo ghi rõ nguồn schema và dùng cột cost chung tương ứng để so chéo. Trong lời giải solver hiện tại, số hành động và số bước lăn bằng nhau vì mỗi lệnh đều lăn đúng một bước. [3][5]

Khi `found=False`, solver hiện trả `total_cost=0.0` để thống nhất cấu trúc kết quả. Với lượt vô nghiệm, timeout, lỗi hoặc đường đi không hợp lệ, bảng thực nghiệm để trống chi phí lời giải dùng chung và giữ trạng thái tương ứng.

# 6 Chi phí và tính tối ưu

UCS hiện dùng tổng chi phí $g(s)$ làm độ ưu tiên trong heap. Khi sinh trạng thái kế tiếp, thuật toán tính `next_g = current_g + step_cost(board, next_state)`. Thuật toán cập nhật đường tốt hơn qua `best_g`, bỏ mục heap lỗi thời và chỉ kết luận thành công khi lấy đích ra khỏi heap. [3]

Vì mỗi cạnh có chi phí ít nhất 1, các đường nối dài không thể giảm tổng chi phí. Với việc lưu đầy đủ `State`, UCS trên đồ thị hữu hạn của màn chơi tìm lời giải có `path_cost` nhỏ nhất khi có đủ tài nguyên. Khi mọi cạnh bằng 1, UCS và BFS cùng tối ưu số bước lăn trong tập tám hướng. [2][3][6]

A* nhập cùng hàm `step_cost()` và cộng hàm này vào $g(s)$. Do đó, UCS và A* dùng cùng đơn vị chi phí cho phần đường đã đi. Nếu Thiện xây dựng một cận dưới đúng cho số hành động còn lại, cận dưới đó cũng là cận dưới cho chi phí còn lại, vì mỗi hành động có chi phí ít nhất 1. [3]

# 7 Đối chiếu tài liệu và trạng thái bàn giao

## 7.1 Nội dung khớp và điểm cần thống nhất

`costs.py`, cách cộng chi phí trong UCS/A* và `core/replay.py` cùng dùng vùng chiếm giữ của trạng thái sau bước lăn. README gốc và `handoff/shared/baseline.md` ghi cùng quy ước tám hướng, SPACE chọn khối miễn phí. Docstring UCS ghi cận dưới `step_cost >= 1`. Docstring của `costs.py` cũng nêu rõ SPACE không sinh cạnh tìm kiếm. [1][2][3][4][5]

README và code BFS/DFS hiện thống nhất `total_cost = len(moves)`. Sự khác nhau giữa cost gốc và cost có trọng số vẫn còn trên đường đi chiếm gạch cam. Dữ liệu đo theo mô hình SPACE riêng trước đây cần được giữ đúng phiên bản và đo lại trước khi so sánh với source hiện tại. Việc sửa tài liệu không chuyển số liệu cũ thành kết quả đo mới. [3][5]

## 7.2 Ảnh hưởng tới mốc kiểm thử

Main đã cập nhật mô hình hành động và các mốc kiểm thử liên quan. Công thức vẫn giữ nguyên, nhưng bỏ cạnh SPACE riêng làm thay đổi cost của các màn có tách khối. Bảng dưới so mốc `ucs_cost` của phiên bản P01/P02 cũ với source hiện tại. Đây là dữ liệu kiểm thử, không phải số liệu hiệu năng của đợt thực nghiệm chính thức. [4]

| Ca | Cost cũ | Cost hiện tại | Ghi chú |
|---|---:|---:|---|
| 2 và T2 | 7,5 | 7,5 | Không đổi |
| 4 | 17,5 | 16,5 | 16 hành động, có một lệnh SUP |
| 10 | 22 | 20 | Đổi khối gộp với hướng lăn |
| 17 | 24 | 22 | Đổi khối gộp với hướng lăn |
| 20 | 21 | 19 | Đổi khối gộp với hướng lăn |
| 22 | 24,5 | 22,5 | Đổi khối gộp với hướng lăn |
| 25 | 57 | 55 | Đổi khối gộp với hướng lăn |
| 28 | 58 | 57 | Đổi khối gộp với hướng lăn |
| 29 | 48 | 47 | Đổi khối gộp với hướng lăn |
| 33 | 119,5 | 110,5 | Đường mẫu trong test có cost 111,0 |
| T3 | 17 | 16 | Ca chức năng tách khối |
| T10 | 0 | 0 | Xuất phát tại đích |

Mốc đường mẫu của ca 33 cũng đổi từ 120 xuống 111. Mốc này khác cost 111,5 của đường BFS hiện trả trong lượt kiểm chứng P02. Nhóm cần phân biệt đường mẫu, kết quả solver và chi phí tối ưu khi dùng số liệu. Nếu tiếp tục đổi hệ số phạt, tập hành động hoặc vùng ô tính cost, Thức kiểm tra lại mốc và Quân xác định phần cần đo lại.

## 7.3 Xác nhận còn lại

Bản nội dung P01 đã có công thức, lý do chọn, ví dụ và commit để bàn giao. Trạng thái M0 trong `handoff/shared/baseline.md` vẫn là “CHƯA CHỐT”. Các xác nhận dưới đây vẫn còn chờ người phụ trách:

- Quân xác nhận có thể tính lại `path_cost` và phân biệt đúng các cột độ dài, chi phí.
- Thiện xác nhận cận dưới chi phí và giả thiết dùng cho heuristic, đồng thời đối chiếu lại tài liệu A*.
- Thức xác nhận phiên bản nguồn và các mốc kiểm thử khi chốt M0.
- Nam nhận công thức và cách diễn giải để ghép báo cáo.

# 8 Nguồn đối chiếu và sử dụng AI

[1] `Src/solvers/costs.py`. Công thức chi phí dùng chung. [Bản nguồn tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/blob/721c198dfc2a6fff92d451a763015d974fa3b52a/Src/solvers/costs.py).

[2] `Src/core/board.py`. Biểu diễn State, vùng chiếm giữ, tập tám hướng và SPACE chơi tay. [Bản nguồn tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/blob/721c198dfc2a6fff92d451a763015d974fa3b52a/Src/core/board.py).

[3] `Src/solvers/member5_ucs.py`, `member4_astar.py`, `member3_bfs.py`, `member2_dfs.py` và `base.py`. Cách cộng và trả chi phí trong bốn solver. [Thư mục solver tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/tree/721c198dfc2a6fff92d451a763015d974fa3b52a/Src/solvers).

[4] `Src/core/replay.py` kiểm tra lời giải. `Src/tests/helpers.py` nạp ca kiểm thử. Các mốc và đường mẫu nằm trong `Src/tests/test_cases.json`. Board ví dụ lấy từ `Src/levels/level_02.json`. [Thư mục source tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/tree/721c198dfc2a6fff92d451a763015d974fa3b52a/Src).

[5] README gốc và `handoff/shared/baseline.md` ghi quy ước chung. CLI nằm trong `Src/benchmarks/cli.py`. Worker của GUI nằm trong `Src/benchmarks/worker.py`. Hai nguồn này xác định schema cost tương ứng, đọc ngày 30/10/2026.

[6] UC Berkeley, CS 188, “1.3 Uninformed Search”, mục BFS và UCS. Nguồn lý thuyết về thứ tự tìm kiếm, tính tối ưu và trường hợp chi phí đồng nhất. [Tài liệu chính thức](https://inst.eecs.berkeley.edu/~cs188/textbook/search/uninformed.html). Truy cập ngày 29/10/2026.

[7] Yêu cầu giảng viên do người thực hiện cung cấp: cài đặt UCS, định nghĩa và giải thích hàm chi phí, làm rõ ý nghĩa của chi phí không đồng nhất. Các ví dụ chi phí trong yêu cầu là gợi ý thiết kế, không bắt buộc một công thức cụ thể.

[8] MIT OpenCourseWare, 6.006 Introduction to Algorithms, Spring 2020, “Recitation 13: Dijkstra’s Algorithm”. Điều kiện trọng số không âm và tính chất chi phí tối ưu khi lấy đỉnh ra khỏi hàng đợi ưu tiên. [Tài liệu chính thức](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/ec187276db0faaa047d655979a44de7f_MIT6_006S20_r13.pdf). Truy cập ngày 29/10/2026.

[9] MIT OpenCourseWare, 6.006 Introduction to Algorithms, Spring 2020, “Lecture 11: Weighted Shortest Paths”. Chu trình âm và trường hợp chi phí đường đi không có giá trị tối ưu hữu hạn. [Tài liệu chính thức](https://live.ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/aa57a9785adf925bc85c1920f53755a0_MIT6_006S20_lec11.pdf). Truy cập ngày 29/10/2026.

ChatGPT Codex hỗ trợ đọc mã nguồn, đối chiếu phép tính, dàn ý nội dung và kiểm tra bản chuyển đổi tài liệu. Người phụ trách đọc lại và xác nhận nội dung trước khi nhóm dùng làm giao ước tại M0.
