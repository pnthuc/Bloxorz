# Tổng hợp kết quả benchmark

Chạy từ thư mục `Src` sau khi hoàn tất một đợt đo:

```powershell
python -m benchmarks.cli summarize ../handoff/quan/benchmarks
```

Tool đọc `raw.csv`, `run-config.json`, `environment.json` và `runs/*.json`,
phân nhóm theo cơ chế trong các JSON màn hiện tại, rồi tạo `summary.csv` trong thư mục đợt đo.
Tool không chạy lại solver, không sửa dữ liệu gốc và không ghi đè file đầu ra đã có.
CLI chạy benchmark vẫn dùng như trước.

Nếu cần tên đầu ra hoặc bảng phân nhóm khác:

```powershell
python -m benchmarks.cli summarize ../handoff/quan/benchmarks --output ../handoff/quan/benchmarks/summary-new.csv
python -m benchmarks.cli summarize PATH_TO_BATCH --groups PATH_TO_GROUPS_CSV
```

Khi tổng hợp đợt đo cũ, dùng `--groups` với bảng phân nhóm đã lưu cùng đợt đó.
Tool kiểm tra tên/ID màn để tránh trộn các bộ dữ liệu khác nhau.

Mỗi dòng đầu ra là một cặp màn–thuật toán, gồm số lượt theo từng trạng thái,
tỷ lệ giải thành công và median/min/max/IQR của các chỉ số. IQR dùng quartile inclusive;
ít hơn hai mẫu thì IQR để trống. Thời gian tính bằng ms, bộ nhớ là đỉnh cấp phát Python tính bằng KiB.

Thời gian, bộ nhớ và node được tổng hợp từ SOLVED và NO_SOLUTION.
Độ dài, total_cost và path_cost chỉ lấy từ SOLVED. Timeout và lỗi vẫn nằm trong mẫu số
tỷ lệ thành công nhưng không được thay thành số 0 trong các thống kê.
So sánh chi phí giữa bốn thuật toán bằng `path_cost`, vì `total_cost` của BFS/DFS là số hành động.

Tool yêu cầu đủ các lượt trong cấu hình, không trùng, CSV khớp JSON và các metric hợp lệ.
Đợt đo mới cần dùng quy ước một hành động là một lần di chuyển; dữ liệu cũ đếm Space
riêng hoặc có tên màn khác bảng phân nhóm cần dùng đúng phiên bản dữ liệu tương ứng.

Kiểm tra:

```powershell
python -m unittest tests.test_summary
```
