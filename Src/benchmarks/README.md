# Công cụ đo và kiểm chứng

Chạy các lệnh sau từ `Src`. Mọi đợt yêu cầu thư mục output mới.
`results/` chứa đầu ra cục bộ được Git bỏ qua; chỉ đưa đợt đã chọn cho báo cáo vào handoff.

## CSV cho báo cáo

```bash
python -m benchmarks.cli --levels 1 4 --solvers bfs dfs ucs astar --repeats 1 --timeout 10 --output-dir benchmarks/results/smoke
```

CLI giữ 16 cột CSV, ghi `runs/*.json`, `environment.json`, `run-config.json` và replay lời giải.
`path_cost` là cost chung; `total_cost` giữ giá trị gốc solver.
Timeout gồm khởi động worker, còn profiler chỉ đo tìm kiếm; memory là cấp phát Python KiB.
Đợt chính thức cần chốt [baseline](../../handoff/shared/baseline.md), dùng thư mục mới trong
`handoff/quan/benchmarks/`. CLI chưa tạo CSV tổng hợp hoặc biểu đồ chính thức.

## Ca chẩn đoán và kiểm chứng

```bash
python -m benchmarks.comparison --cases C02-r090 C05-r000 B32 --repeats 3 --timeout 10 --output-dir benchmarks/results/diagnostic
python -m benchmarks.comparison --catalog benchmarks/cases/curated.json --cases T11 T12 --repeats 1 --timeout 10 --output-dir benchmarks/results/edges
```

`cases/comparison.json` mô tả các đối chứng: hành lang bắt buộc, đích nông, bàn mở,
đường vòng sau vách, đánh đổi bước/cost và đích cô lập; có thêm sáu màn đại diện cơ chế.
`cases/curated.json` tham chiếu đủ 25 màn và 12 ca biên của bộ kiểm thử hiện tại.
Runner chạy tuần tự, xáo thứ tự bằng seed cố định, kiểm chứng nghiệm và ghi median/IQR.
Schema và timeout của runner chẩn đoán khác CLI báo cáo; không trộn hai bộ dữ liệu.

Vẽ lại một đợt chẩn đoán đầy đủ, cần `matplotlib` và `numpy`:

```bash
python -m benchmarks.comparison --repeats 5 --timeout 10 --output-dir benchmarks/results/comparison
python -m benchmarks.plot_comparison benchmarks/results/comparison
```

Kiểm tra công cụ và đối chứng:

```bash
python -m unittest tests.test_experiments tests.test_comparison_study -v
```
