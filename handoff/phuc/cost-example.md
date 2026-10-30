---
title: "Ví dụ tính chi phí lời giải Bloxorz"
subtitle: "P02 · Đối chiếu số hành động và chi phí"
author: "Phan Gia Phúc · MSSV 24120503"
date: ""
lang: vi-VN
---

Tài liệu dùng lời giải thật trên màn 2 và màn 4 để tính chi phí từng hành động theo P01. Màn 2 minh họa mức phạt cho một hoặc hai ô cam. Màn 4 minh họa trạng thái cầu, tách khối, SPACE và ghép lại. Phần so sánh bổ sung màn 33 cho thấy hai lời giải có cùng số hành động nhưng khác chi phí.

Ngày kiểm chứng là 29/10/2026. Đây là lượt kiểm tra tính đúng cho P02, không phải bộ benchmark chính thức của Quân. Các ví dụ giả định được ghi riêng và không gán cho một màn đã đo.

Commit đối chiếu là `572156d7f596372a59bb9ad2e8e6ed200b3162d1` trong repo `pnthuc/Bloxorz`.

# 1 Đơn vị và cách kiểm chứng

Với trạng thái sau hành động là $s_i$, P01 quy định:

$$
c_i=1+0.5k(s_i),
\qquad
g_i=\sum_{j=1}^{i}c_j.
$$

$k(s_i)$ là số ô cam mà toàn bộ khối chiếm giữ. $g_i$ là chi phí tích lũy sau hành động thứ $i$, với $g_0=0$. Chi phí lời giải dùng chung là `path_cost`, bằng $g_m$ tại đích. SPACE vẫn có chi phí dù không đổi tọa độ. [1]

Mỗi bảng bắt đầu từ `get_initial_state()`. Với từng hành động, phép đối chiếu gọi `apply_move()`, kiểm tra trạng thái trả về, tính `step_cost()` và cộng chi phí. Sau hành động cuối, trạng thái phải thỏa `is_goal()`. Hàm `replay_solution()` kiểm tra lại toàn bộ chuỗi trên một board riêng và xác nhận cùng tổng cost. [2]

Trong tài liệu, “số hành động” là `len(moves)`, kể cả SPACE. “Số bước lăn” đếm các hành động còn lại và tương ứng `solution_length` của API. Cả hai ví dụ dưới đây đều dùng chi phí có trọng số khi so BFS và UCS. `total_cost` gốc của BFS chỉ là số bước lăn, nên được phân biệt với `path_cost`.

# 2 Ví dụ màn 2

## 2.1 Trạng thái và chuỗi hành động

Màn có ID `2`, lấy từ `Src/levels/level_2_fragile.json`. Vị trí xuất phát là `(2,1)` và đích là `(2,7)`. Chỉ số hàng, cột bắt đầu từ 0. Màn này không có cầu hoặc cơ chế tách khối. Các trường phụ giữ `r2=c2=-1`, `active_cube=0` và `bridges=()`. [2]

Ký hiệu `S(r,c)` là khối đứng thẳng, `H(r,c)` là khối nằm ngang. Với `H(r,c)`, khối chiếm `(r,c)` và `(r,c+1)`. Trạng thái đầu là `S(2,1)`. UCS và BFS hiện trả cùng chuỗi:

```text
RIGHT → UP → RIGHT → RIGHT → DOWN → RIGHT
```

## 2.2 Bảng từng hành động

| Bước | Hành động | Trạng thái sau | Số ô cam k | Chi phí bước | Tích lũy g |
|---:|---|---|---:|---:|---:|
| 1 | RIGHT | H(2,2) | 2 | 2,0 | 2,0 |
| 2 | UP | H(1,2) | 0 | 1,0 | 3,0 |
| 3 | RIGHT | S(1,4) | 0 | 1,0 | 4,0 |
| 4 | RIGHT | H(1,5) | 0 | 1,0 | 5,0 |
| 5 | DOWN | H(2,5) | 1 | 1,5 | 6,5 |
| 6 | RIGHT | S(2,7), đích | 0 | 1,0 | 7,5 |

Ở bước 1, khối nằm trên hai ô cam `(2,2)` và `(2,3)`, nên cost bằng 2. Ở bước 5, chỉ ô `(2,5)` là gạch cam, nên cost bằng 1,5. Bước cuối đứng trên ô đích mã 9 nên vẫn có chi phí cơ bản bằng 1.

Tổng lượt tiếp xúc ô cam là $2+1=3$. Vì có 6 hành động, chi phí tính tay bằng $6+0.5\times3=7.5$. Replay xác nhận đường đi hợp lệ và cùng tổng chi phí 7,5. Mốc này cũng khớp `ucs_cost` của ca kiểm thử `2`. [2]

## 2.3 So sánh kết quả trả về

| Solver | Số hành động | Số bước lăn | total_cost gốc | path_cost theo P01 |
|---|---:|---:|---:|---:|
| BFS | 6 | 6 | 6,0 | 7,5 |
| UCS | 6 | 6 | 7,5 | 7,5 |

Bảng không cho thấy BFS có đường rẻ hơn UCS. Hai solver dùng cùng đường, còn cột `total_cost` gốc có ý nghĩa khác nhau. Sau khi tính lại bằng cùng policy, hai `path_cost` bằng nhau.

# 3 Ví dụ màn 4

## 3.1 Ký hiệu trạng thái đầy đủ

Màn có ID `4`, lấy từ `Src/levels/level_4_combined.json`. Trạng thái đầu là khối đứng tại `(1,1)`, cầu 0 đóng. Màn này có đúng một cầu nên ký hiệu $b=0$ là đóng và $b=1$ là mở. Các ký hiệu dùng trong bảng là:

- `S(r,c;b)`: khối đứng thẳng, chiếm `(r,c)`.
- `H(r,c;b)`: khối nằm ngang, chiếm `(r,c)` và `(r,c+1)`.
- `V(r,c;b)`: khối nằm dọc, chiếm `(r,c)` và `(r+1,c)`.
- `T(r0,c0;r1,c1;a;b)`: hai khối đơn ở hai tọa độ đã ghi, với `active_cube=a`.

Ở các trạng thái S, H, V, các trường phụ trở về `r2=c2=-1` và `active_cube=0`. Như vậy, ký hiệu bảng cùng các quy ước trên mô tả đủ những trường của `State` mà solver dùng. Trạng thái xuất phát là `S(1,1;0)`.

## 3.2 Bảng từng hành động

Phần đầu ghi trạng thái sau các bước 1 đến 9.

| Bước | Hành động | Trạng thái sau | Số ô cam k | Chi phí bước | Tích lũy g |
|---:|---|---|---:|---:|---:|
| 1 | RIGHT | H(1,2;0) | 1 | 1,5 | 1,5 |
| 2 | RIGHT | T(0,4;2,4;0;0) | 0 | 1,0 | 2,5 |
| 3 | RIGHT | T(0,5;2,4;0;0) | 0 | 1,0 | 3,5 |
| 4 | RIGHT | T(0,6;2,4;0;1) | 0 | 1,0 | 4,5 |
| 5 | DOWN | T(1,6;2,4;0;1) | 0 | 1,0 | 5,5 |
| 6 | RIGHT | T(1,7;2,4;0;1) | 0 | 1,0 | 6,5 |
| 7 | RIGHT | T(1,8;2,4;0;1) | 0 | 1,0 | 7,5 |
| 8 | RIGHT | T(1,9;2,4;0;1) | 0 | 1,0 | 8,5 |
| 9 | UP | T(0,9;2,4;0;1) | 0 | 1,0 | 9,5 |

Phần tiếp theo giữ nguyên cách tính tích lũy, từ bước 10 đến đích.

| Bước | Hành động | Trạng thái sau | Số ô cam k | Chi phí bước | Tích lũy g |
|---:|---|---|---:|---:|---:|
| 10 | SPACE | T(0,9;2,4;1;1) | 0 | 1,0 | 10,5 |
| 11 | UP | T(0,9;1,4;1;1) | 0 | 1,0 | 11,5 |
| 12 | RIGHT | T(0,9;1,5;1;1) | 0 | 1,0 | 12,5 |
| 13 | RIGHT | T(0,9;1,6;1;1) | 0 | 1,0 | 13,5 |
| 14 | RIGHT | T(0,9;1,7;1;1) | 0 | 1,0 | 14,5 |
| 15 | RIGHT | T(0,9;1,8;1;1) | 0 | 1,0 | 15,5 |
| 16 | RIGHT | V(0,9;1) | 0 | 1,0 | 16,5 |
| 17 | DOWN | S(2,9;1), đích | 0 | 1,0 | 17,5 |

Ở bước 2, khối đứng trên công tắc tách rồi dịch chuyển thành hai khối đơn. Chi phí tính trên hai vị trí sau dịch chuyển và không cộng thêm một hành động riêng cho hiệu ứng này. Ở bước 4, khối đơn 0 tới công tắc mở cầu. Giá trị $b$ chuyển từ 0 sang 1 trong trạng thái sau.

Ở bước 10, SPACE chỉ đổi `active_cube` từ 0 sang 1. Hai tọa độ giữ nguyên, nhưng hành động vẫn làm cost tăng từ 9,5 lên 10,5. Ở bước 16, hai khối đơn ghép thành khối nằm dọc và các trường phụ trở về mặc định. Bước 17 kết thúc tại đích.

Tổng cộng có 17 hành động, gồm 16 bước lăn và một SPACE. Chỉ trạng thái sau bước 1 chiếm một ô cam, nên chi phí bằng $17+0.5\times1=17.5$. Replay xác nhận cùng tổng chi phí. [1][2]

## 3.3 So sánh kết quả trả về

| Solver | Số hành động | Số bước lăn | total_cost gốc | path_cost theo P01 |
|---|---:|---:|---:|---:|
| BFS | 17 | 16 | 16,0 | 17,5 |
| UCS | 17 | 16 | 17,5 | 17,5 |

BFS và UCS trả cùng chuỗi trong lượt kiểm chứng này. Phép tính $16+0.5=16.5$ sẽ bỏ sót chi phí cơ bản của SPACE và không khớp replay. Tổng đúng là 17,5.

# 4 Khi số hành động và chi phí dẫn tới nhận xét khác nhau

## 4.1 Kết quả thật trên màn 33

Lượt đối chiếu bổ sung dùng màn `33` và cùng hai core BFS/UCS tại commit đã ghi. Cả hai đường đều replay hợp lệ tới đích. Bảng dưới đây chỉ tổng hợp chất lượng đường đi, không trình bày 119 dòng trạng thái và không dùng làm số liệu hiệu năng chính thức.

| Solver | Số hành động | Số bước lăn | Số SPACE | path_cost theo P01 |
|---|---:|---:|---:|---:|
| BFS | 119 | 110 | 9 | 120,0 |
| UCS | 119 | 110 | 9 | 119,5 |

Hai đường có cùng số hành động và số bước lăn, nhưng UCS giảm cost 0,5. Theo công thức P01, đường BFS có hai lượt tiếp xúc ô cam, còn đường UCS có một lượt. Vì vậy, tối ưu số hành động không phân biệt được chất lượng của hai đường này, trong khi cost có trọng số phân biệt được. Chi phí 119,5 khớp mốc `ucs_cost` của ca `33`. [2]

Trong ba màn 2, 4 và 33 vừa đối chiếu, chưa có trường hợp UCS trả đường nhiều hành động hơn BFS mà rẻ hơn. Màn 33 cho thấy cost có thể khác ngay cả khi số hành động bằng nhau. Ví dụ tiếp theo chỉ giải thích tình huống đánh đổi về mặt hàm mục tiêu.

## 4.2 Minh họa giả định về đường dài hơn nhưng rẻ hơn

Giả sử hai đường A và B cùng tới đích. Bảng này là minh họa giả định, không gán cho màn 2, 4, 33 hay một màn khác trong repo. Một trạng thái chiếm hai ô cam đóng góp hai lượt vào tổng tiếp xúc.

| Đường giả định | Số hành động m | Tổng lượt tiếp xúc K | Chi phí m + 0,5K |
|---|---:|---:|---:|
| A | 6 | 6 | 9,0 |
| B | 8 | 0 | 8,0 |

A ngắn hơn B theo số hành động. B rẻ hơn A theo policy P01. Khi chỉ so hai lựa chọn này, BFS ưu tiên số hành động của A, còn mục tiêu chi phí của UCS ưu tiên B. Khác biệt này xuất phát từ hàm mục tiêu, không phải do UCS cố tình tìm đường vòng.

Nếu thay mọi chi phí cạnh bằng 1, hai đường có cost lần lượt là 6 và 8. Khi đó, UCS và BFS cùng tối ưu số hành động. Đây là quan hệ với unit cost được giải thích trong `ucs.md`.

# 5 Cách tái kiểm chứng các tổng chi phí

Đoạn Python dưới đây chạy với thư mục hiện hành là `Src`. Đoạn mã gọi trực tiếp hai core để lấy đường đi, rồi dùng board riêng cho replay. Đoạn mã không đo thời gian hoặc bộ nhớ. Các giá trị `expected` là kết quả của lượt kiểm chứng ngày 29/10/2026 nêu trong tài liệu.

```python
from tests.helpers import load_cases, replay_solution
from solvers.member3_bfs import _bfs_core
from solvers.member5_ucs import _ucs_core

cases = {case.id: case for case in load_cases()}
expected = {
    "2": {"bfs": (6, 6, 7.5), "ucs": (6, 6, 7.5)},
    "4": {"bfs": (17, 16, 17.5), "ucs": (17, 16, 17.5)},
    "33": {"bfs": (119, 110, 120.0),
           "ucs": (119, 110, 119.5)},
}

for level_id, targets in expected.items():
    for name, solve in [("bfs", _bfs_core),
                        ("ucs", _ucs_core)]:
        case = cases[level_id]
        result = solve(case.make_board())
        replay = replay_solution(case.make_board(), result["moves"])
        assert result["found"] and replay.valid
        actions = len(result["moves"])
        rolls = sum(a != "SPACE" for a in result["moves"])
        assert (actions, rolls, replay.cost) == targets[name]
        if name == "ucs":
            assert result["total_cost"] == replay.cost
        print(level_id, name, actions, rolls, replay.cost)
```

Các phép kiểm tra xác nhận tổng chi phí và tính hợp lệ của đường đi mà code trả về. Các bảng từng bước ở mục 2 và 3 còn đối chiếu tọa độ, hướng, cầu và khối đang điều khiển với trạng thái sau từng hành động. Nếu code, cost hoặc dữ liệu màn thay đổi, các kết quả trên cần được đối chiếu lại theo phiên bản mới.

# 6 Nguồn tham khảo và sử dụng AI

[1] `handoff/phuc/cost-policy.md`, `cost-policy.docx` và `Src/solvers/costs.py`. Công thức, SPACE, miền chi phí và ý nghĩa các cột theo P01, đọc ngày 29/10/2026.

[2] `Src/tests/helpers.py`, `Src/tests/test_cases.json`, các màn ID 2, 4, 33 và code core BFS/UCS. Đường đi và trace được tính trực tiếp trên cùng engine, sau đó đối chiếu bằng `replay_solution()`. [Bản nguồn tại commit đối chiếu](https://github.com/pnthuc/Bloxorz/tree/572156d7f596372a59bb9ad2e8e6ed200b3162d1/Src).

[3] `handoff/phuc/ucs.md`. Luồng heap theo g, cập nhật parent, bỏ entry lỗi thời, thời điểm kết luận tại đích và quan hệ UCS/BFS khi chi phí đồng nhất.

ChatGPT Codex hỗ trợ chạy kiểm chứng trên engine, đối chiếu phép cộng, soạn nội dung tiếng Việt và chuyển đổi tài liệu. Các ví dụ giả định có nhãn riêng. Người phụ trách đọc lại các bảng và tái kiểm chứng trước khi Nam ghép báo cáo, video và Thiện dùng để đối chiếu $g(s)$.
