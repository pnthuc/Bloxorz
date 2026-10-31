# Tống Phúc Thiện — A* và Heuristic

MSSV: **24120141**. Nhận và bàn giao việc theo [Quy trình chung](../README.md).

Phụ trách: Thuật toán A*, thiết kế hàm heuristic, chứng minh tính chất chấp nhận được (admissible) và nhất quán (consistent).

---

## 1. Đầu vào & Tài nguyên
- **Mã nguồn A***: `Src/solvers/member4_astar.py`, `Src/solvers/costs.py`.
- **Engine & Board**: `Src/core/board.py`.
- **Dữ liệu thực nghiệm**: Nhận từ Quân (`handoff/quan/benchmarks/summary.csv`) và biểu đồ từ Phúc (`handoff/phuc/charts/`).

---

## 2. Danh mục công việc & Sản phẩm bàn giao

| Mã | Nhiệm vụ | Sản phẩm đầu ra | Trạng thái |
| :--- | :--- | :--- | :---: |
| `H01` | Thiết kế hàm heuristic, đặc tả các nhánh tính toán và đơn vị | [heuristic-policy.docx](heuristic-policy.docx) | Đã xong |
| `H02` | Mô tả thuật toán A*, min-heap, quản lý `best_g`, mở lại node | [astar.docx](astar.docx) | Đã xong |
| `H03` | Ví dụ tính tay chi tiết $f(n) = g(n) + h(n)$ và nhận xét hiệu năng | [astar-example.docx](astar-example.docx), [astar-results.docx](astar-results.docx) | Đã xong |
| `H04` | Rà soát nội dung A* và heuristic trong báo cáo tổng | [review-notes.docx](review-notes.docx) | Đã xong |

---

## 3. Đặc tả Heuristic & Tính chất
1. **Thiết kế Heuristic**:
   - Khoảng cách Manhattan từ khối đến ô đích (chia 2 vì mỗi bước có thể tiến 2 ô khi nằm).
   - Trường hợp phân tách (`SPLIT`): Tính tổng khoảng cách từ hai nửa khối đến ô công tắc ghép khối và từ đó về đích.
   - Bảng tra trước đường đi qua công tắc (`precompute_switch_costs_from_goal`) sử dụng BFS ngược từ đích.
2. **Chứng minh tính chất**:
   - **Tính chấp nhận được ($h(n) \le h^*(n)$)**: Hàm $h$ không bao giờ đánh giá quá cao chi phí thực tế ngắn nhất tới đích, đảm bảo A* luôn tìm ra lời giải tối ưu.
   - **Tính nhất quán ($h(n) \le c(n, a, n') + h(n')$)**: Thỏa mãn bất đẳng thức tam giác trên không gian trạng thái, đảm bảo khi một node được lấy ra khỏi priority queue thì đường đi tới nó đã là tối ưu.
