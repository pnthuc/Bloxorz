# Phan Ngọc Thức — Engine/UI và nghiệm thu

MSSV **24120228**. Nhận/gửi việc theo [quy trình chung](../README.md).
Thức giữ luật game/API/UI/level/test thống nhất, cung cấp demo và nghiệm thu gói cuối.

## Đầu vào và hiện trạng

- Engine: `Src/core/board.py`; level/replay: `Src/core/levels.py`, `Src/core/replay.py`.
- API: `Src/web/app.py`; giao diện: `Src/static/`, `Src/templates/`;
  level: `Src/levels/level_01.json` đến `level_25.json`; regression: `Src/tests/`.
- [Tài liệu bàn giao cho Nam](Phan_Ngoc_Thuc.docx) gồm 3 trang: phần A cho mục 2,
  phần B cho mục 3, phần C cho mục 5.2 và phụ lục kiểm thử/demo.
  `kiem_tra_thuc.json` là log cũ; kết quả kiểm tra mới ngày 30/10/2026 ghi trong tài liệu.

## Nhiệm vụ

| Đã bàn giao | Mã | Công việc | Đầu ra |
| --- | --- | --- | --- |
| [x] | `T01` | Mô hình State, luật và kiến trúc game/API/GUI | Các mục trong `Phan_Ngoc_Thuc.docx` → Nam |
| [x] | `T02` | Tư liệu và thao tác demo cho từng cơ chế | Tài liệu, ảnh và chuỗi thao tác → Phúc, Nam |
| [X] | `T03` | Chốt snapshot và giao ước thực nghiệm | `handoff/shared/baseline.md` → cả nhóm |
| [ ] | `T04` | Nghiệm thu tích hợp, dữ liệu và mức hoàn thành | `final-review.docx`, log, bảng phân công → Nam và chủ phần việc |
| [ ] | `T05` | Đóng gói, thử gói nộp và bàn giao | ZIP/RAR tên năm MSSV; Drive nếu cần → người nộp |

Giữ dấu bàn giao trước đây cho T01/T02; phải rà lại đúng bản code dùng để nộp.
Không cần tách tài liệu thành nhiều DOCX có nội dung giống nhau.

## Tiêu chí kiểm tra

**T01:** Mô tả `State(r,c,orientation,bridges,r2,c2,active_cube)`, bốn hướng khối,
initial state, successor, transition và goal. Giải thích switch chỉ kích hoạt ở lần chạm mới,
SPACE chọn cube, các hướng S đổi cube rồi lăn, teleport/split, ghép và cầu đóng gây rơi.
Kiến trúc: browser → Flask → engine/solver → JSON → scene/replay;
profiler đo riêng phần tìm kiếm. Nam phải dùng được nội dung mà không đoán quy ước tọa độ.

**T02:** Cung cấp màn/chuỗi thao tác tái hiện fragile, switch nhẹ/nặng, bridge,
split/merge, thắng/thua và replay. Gửi ảnh rõ, ghi phiên bản/viewport khi cần đối chiếu.
Phúc tự quay lại được; Nam dùng để rà đề cương. Stop ở màn giải đơn hủy chờ/phát lại,
không chứng nhận request solver phía server đã bị kết thúc.

**T03:** Nhận P01/H01 và cấu hình Q04, ghi commit thật vào baseline.
Thống nhất cost, heuristic, bộ màn, quy ước hành động/metric và cách đo.
Nếu code còn thay đổi thì chưa chốt snapshot; thay đổi ảnh hưởng số liệu phải xác định phần cần đo lại.

**T04:** Chạy regression trên bản nộp, xem trực tiếp chơi tay/replay và kiểm tra đường dẫn/asset.
Đối chiếu CSV với bảng/hình PDF, công thức, URL YouTube và phiên bản trong video.
Thu mức hoàn thành do từng thành viên xác nhận để Nam ghi báo cáo;
không suy tỷ lệ từ số file hoặc checkbox. Log phải ghi giới hạn của phép kiểm tra,
đặc biệt test GPU mô phỏng không thay nghiệm thu đồ họa.

**T05:** Nhận `submission/Source/` từ Phúc, PDF/nguồn từ Nam và kết quả T04.
Tạo gói theo cấu trúc [quy định chung](../README.md#gói-nộp), giải nén ở thư mục sạch,
mở game/PDF và thử link YouTube. Nếu trên 20 MB, dùng link Google Drive truy cập được.
Chốt theo deadline lớp công bố; không tự suy ngày từ thời lượng khoảng ba tuần trong đề.
