# Phan Ngọc Thức — Engine/UI và Nghiệm thu

MSSV: **24120228**. Nhận và bàn giao việc theo [Quy trình chung](../README.md).

Phụ trách: Kiến trúc Game, Core Engine, Web 3D GUI, Flask API, hệ thống Unit Test và điều phối nghiệm thu đồ án.

---

## 1. Đầu vào & Tài nguyên
- **Core Engine**: `Src/core/board.py`, `Src/core/state.py`, `Src/core/levels.py`, `Src/core/replay.py`.
- **Giao diện & API**: `Src/web/app.py`, `Src/templates/`, `Src/static/` (Three.js, textures, CSS).
- **Màn chơi chuẩn**: `Src/levels/level_01.json` đến `level_25.json`.
- **Bộ kiểm thử tự động**: 92 unit tests trong `Src/tests/`.

---

## 2. Danh mục công việc & Sản phẩm bàn giao

| Mã | Nhiệm vụ | Sản phẩm đầu ra | Trạng thái |
| :--- | :--- | :--- | :---: |
| `T01` | Mô hình hóa bài toán, luật chơi, trạng thái và kiến trúc hệ thống | [Phan_Ngoc_Thuc.docx](Phan_Ngoc_Thuc.docx) | Đã xong |
| `T02` | Kịch bản demo và tư liệu các cơ chế đặc biệt cho video | Tài liệu mô tả cơ chế & ảnh chụp trong `Phan_Ngoc_Thuc.docx` | Đã xong |
| `T03` | Thống nhất giao ước thực nghiệm và mốc chốt kỹ thuật | [baseline.md](../shared/baseline.md) | Đã xong |
| `T04` | Rà soát chất lượng tích hợp, kiểm thử hồi quy 92 ca test | Hệ thống test tự động `Src/tests/` | Đã xong |
| `T05` | Đóng gói sản phẩm nộp cuối cùng và kiểm tra tổng thể | Thư mục nộp bài theo quy định | Đang thực hiện |

---

## 3. Kiến trúc hệ thống
1. **Mô hình Trạng thái (`State`)**:
   - `State(r, c, orientation, bridges, r2, c2, active_cube)`: 7 trường dữ liệu bất biến (frozen dataclass), có thể dùng làm key cho `set` và `dict` để tối ưu tra cứu $O(1)$.
   - Bốn tư thế: Đứng thẳng (`STANDING`), Nằm dọc (`HORIZONTAL`), Nằm ngang (`VERTICAL`), và Phân tách hai khối 1x1 (`SPLIT`).
2. **Luồng dữ liệu**:
   - **Frontend**: Three.js render mô hình 3D, nhận input phím/chuột, gọi API `/api/solve` hoặc `/api/validate`.
   - **Backend**: Flask API tiếp nhận yêu cầu, gọi solver tương ứng với profiler đo đạc độc lập, trả về chuỗi hành động và số liệu hiệu năng.
   - **Replay**: Hệ thống tự động diễn hoạt từng bước đi trên mô hình 3D với tốc độ tùy chỉnh.

---

## 4. Kiểm thử toàn diện
Chạy toàn bộ 92 unit test từ thư mục gốc repo:
```powershell
python -m unittest discover -s Src/tests -t Src
```
Đảm bảo 100% test cases đều vượt qua (`OK`).
