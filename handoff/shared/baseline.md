# Bản code và cách đo dùng chung

**Trạng thái: CHƯA CHỐT.** Đây là mẫu để nhóm điền trước lượt đo chính thức, không phải xác nhận code đã pass.

Thức tổng hợp; Phúc xác nhận cost; Thiện xác nhận heuristic; Quân xác nhận bộ màn/cách đo.

## Thông tin đã biết khi tạo bộ khung

- Repo: https://github.com/pnthuc/Bloxorz
- Nhánh tham chiếu khi chuẩn bị: `origin/main`.
- Commit đã đọc: `2596e597c28d9f53811dc3da2d85850ba13e2fd4` — chỉ là căn cứ lập khung.
- Đã có 33 màn trong `Src/levels/`; 43 ca trong `Src/tests/test_cases.json` (10 ca T và 33 ca màn).
- Có sẵn profiler ở `Src/solvers/base.py`, replay ở `Src/tests/helpers.py` và script ban đầu `Src/experiments.py`.

## Nhóm điền khi chốt

| Nội dung | Giá trị thống nhất | Người xác nhận |
| --- | --- | --- |
| Commit thực sự dùng để đo | CHƯA CHỐT — chạy `git rev-parse HEAD` trên bản đã được chọn | Thức + Quân |
| Ngày chốt | Chưa điền | Thức |
| Policy cost | Dẫn file công thức và lý do chọn, đúng code cuối | Phúc |
| Heuristic | Dẫn công thức/giả thiết, cùng cost với UCS | Thiện |
| Bộ màn | Đề xuất ID 1–33, cùng bộ cho bốn solver | Quân |
| Số lần lặp | Đề xuất 3 lần/trường hợp | Quân |
| Giới hạn | Đề xuất 120 giây/lượt, ghi TIMEOUT khi hết hạn | Quân |
| Môi trường | CPU/RAM/OS/Python; dùng cùng máy khi so sánh | Quân |
| Quy ước số đo | Thời gian ms; peak Python KiB; số lần mở rộng; số bước lăn theo 8 hành động (S = đổi khối rồi lăn; SPACE chơi tay miễn phí) | Quân + chủ solver |
| Chi phí để so chéo | Giữ `total_cost` gốc; replay tính thêm `path_cost` theo cùng step_cost | Phúc + Quân |
| Lệnh kiểm tra và kết quả | Điền lệnh đã chạy, ngày, kết quả thực tế và lỗi còn lại nếu có | Thức |

## Cách ghi mã commit

Từ thư mục repo ở bản đã chọn:

```bash
git rev-parse HEAD
```

Sao chép mã Git trả về vào dòng “Commit thực sự dùng để đo”. Đây là mã phiên bản tự có trong Git; không cần tự đặt một mã mới.

Metadata của từng đợt benchmark phải ghi đúng commit đã chạy. Nếu thêm/sửa code sau khi chốt, xác định lại bản chạy và phần dữ liệu chịu ảnh hưởng trước khi dùng vào report.

## Xác nhận cuối bước chuẩn bị

- [ ] Phúc xác nhận cost khớp code, README và diễn giải.
- [ ] Thiện xác nhận heuristic và giả thiết khớp cost/code.
- [ ] Quân xác nhận bộ màn, môi trường, cách đo và định dạng xuất.
- [ ] Thức xác nhận bản code và kết quả kiểm tra thực tế.

Khi bốn mục đã được xác nhận, đổi trạng thái đầu file thành **ĐÃ CHỐT** và ghi ngày/commit. Những phần đang thiếu tiếp tục để rõ ràng, không điền kết quả mẫu như kết quả thật.
