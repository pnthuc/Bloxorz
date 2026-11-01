# P04 — Tóm tắt bản source nộp và kiểm tra chạy sạch

Ngày thực hiện: **01/11/2026** (Asia/Saigon). Snapshot đầu vào: `14baf1df451db2134b2d92f2cf15aa09d7d21e47`, nhánh `work/phuc-charts-video`; working tree sạch lúc bắt đầu.

Đã tạo **`submission/Source/` gồm 431 file, 6.338.265 byte**. So với các nguồn tương ứng: **418 file sao chép nguyên byte, 9 file điều chỉnh ở bản sao, 4 file mới**. Đối chiếu SHA-256 xác nhận **470 file gốc đang được Git theo dõi vẫn nguyên vẹn**. Không sửa README đính kèm trong Downloads, `README.md` gốc, `Src/` hay các file bàn giao đã có.

## Các file mới hoặc có nội dung điều chỉnh trong bản nộp

Các đường dẫn sau tính từ `submission/Source/`. Đây đều là **file mới trong thư mục nộp**, không ghi đè bản nguồn trước đó.

| File bản nộp | Nguồn đối chiếu | Nội dung mới hoặc điều chỉnh |
| --- | --- | --- |
| `README.md` | `README.md` gốc và code hiện tại | Viết hướng dẫn dành cho thư mục Source độc lập: Python 3.10+, venv Windows/macOS/Linux, cài pip, chạy main, localhost, điều khiển/menu thực tế, test Python/UI, benchmark, vẽ và giấy phép. Nêu rõ Node/npm chỉ cần cho UI test. |
| `main.py` | `Src/main.py` | Cấu hình stdout UTF-8 trước khi in tiếng Việt; sửa lỗi khởi chạy `UnicodeEncodeError` đã tái hiện với stdout cp1252. Giữ cách mở trình duyệt và Flask trên cổng 5000. |
| `requirements.txt` | `Src/requirements.txt` | Giới hạn Flask `>=3.0,<4`; Gunicorn chỉ cài ngoài Windows. Game local dùng `main.py`. |
| `benchmarks/cli.py` | `Src/benchmarks/cli.py` | Chuyển thư mục xuất mặc định về `Source/benchmark-output/new-run`, không ghi ra `../handoff`. Không sửa phép đo hoặc solver. |
| `benchmarks/plot.py` | `handoff/phuc/plot.py` | Mang công cụ vẽ thật vào gói, thay forwarder phụ thuộc handoff; đổi ROOT và các đường dẫn mặc định sang `benchmark-data` và `benchmark-output`. Giữ xử lý, kiểm chứng và công thức số liệu. |
| `benchmarks/summarize.py` | `handoff/quan/summarize.py` | Mang công cụ tổng hợp vào gói; chỉnh import root và hướng dẫn chạy bằng `python -m benchmarks.summarize`. Giữ phép tính median và cơ chế không ghi đè. |
| `benchmarks/level_groups.py` | `handoff/quan/generate_level_groups.py` | Mang công cụ nhóm màn vào gói; đổi import root, mô tả CLI và output mặc định sang `benchmark-output/level-groups.csv`. |
| `benchmarks/README.md` | `Src/benchmarks/README.md` | Thay các lệnh/phụ thuộc handoff bằng các mô-đun trong gói và liên kết README Source. |
| `tests/test_game.py` | `Src/tests/test_game.py` | Import `level_groups` từ `benchmarks.level_groups`. Giữ nguyên các kiểm tra. |
| `tests/test_summary.py` | `Src/tests/test_summary.py` | Import `summarize_batch` từ `benchmarks.summarize`. Giữ nguyên các kiểm tra. |
| `game_logic.py` | File mới | Tên tương thích theo P04, tái xuất luật từ `core.board`, hàm nạp màn và replay; không nhân đôi engine. |
| `experiments.py` | File mới | Entry point tương thích theo P04, gọi `benchmarks.cli.main` và `multiprocessing.freeze_support`. |
| `benchmark-data/README.md` | File mới | Ghi xuất xứ snapshot, phân biệt dữ liệu đo gốc với lần kiểm tra P04 và quy định đầu ra mới. |

`requirements-charts.txt` được sao chép nguyên byte từ `handoff/phuc/requirements.txt` để thư viện vẽ là tùy chọn. Toàn bộ các file còn lại của `Src` được giữ nguyên byte, gồm `core`, `web`, `solvers`, `levels`, `static`, `templates`, `tests`, `run_tests.py` và lockfile npm.

## Dữ liệu và giấy phép được giữ

- `benchmark-data/reference/`: sao chép nguyên byte `raw.csv`, `summary.csv`, `environment.json`, `run-config.json` và 300 `runs/*.json` từ `handoff/quan/benchmarks/`. Giữ JSON vì công cụ kiểm chứng và vẽ cần đối chiếu đường đi từng lượt, không chỉ đọc summary.
- `benchmark-data/level-groups.csv`: sao chép nguyên byte bảng nhóm màn của Quân.
- Giữ đủ Three.js local và `static/vendor/THREE-LICENSE.txt`; font và `static/fonts/OFL.txt`; toàn bộ texture, âm thanh, CSS, JS và template.
- Không mang vào Source: `.git`, `.venv`, `__pycache__`, `node_modules`, cache, log, file tạm, video, báo cáo hay các hình đã nằm trong báo cáo. Không thêm thông tin máy của lần chạy P04 vào gói Source. `environment.json` trong dữ liệu tham chiếu vẫn là metadata của lần đo gốc.

## Kết quả kiểm tra thực tế

Tạo ZIP từ Source, giải nén vào thư mục riêng, tạo venv **không dùng thư viện của venv cũ**, cài requirements rồi chạy. Môi trường kiểm tra: Windows, Python **3.12.14**, Flask **3.1.3**, Node.js **24.22.1**, npm **10.9.2**, matplotlib **3.11.2**. Chi tiết phiên bản pip tại `p04/validated-python-packages.txt`.

| Kiểm tra | Kết quả |
| --- | --- |
| Cài requirements bằng pip vào venv mới | PASS; Gunicorn được bỏ qua đúng marker trên Windows |
| `python -m unittest discover -s tests -t . -v` | **92/92 PASS**; chạy lại trên ZIP cuối đã giải nén cũng 92/92 PASS |
| `npm ci` trong tests | PASS; 41 package được cài theo lockfile |
| `python run_tests.py --ui --cases 1 2 3 4` | **92 Python + 51 UI + 16 ca solver PASS**, không FAIL/PENDING |
| `python run_tests.py --solver astar` | **35/35 ca A* PASS**, ngoài 92 test Python ở đầu lệnh |
| Benchmark màn 1, bốn solver, một lần, timeout 10 giây | **4/4 SOLVED**; BFS/UCS/A* dài 7, DFS dài 23; tổng hợp tạo 4 dòng nhóm |
| Vẽ từ dữ liệu tham chiếu | Kiểm chứng đủ **300 lượt**, xuất **10 PNG** và `result-tables.csv`; không thay dữ liệu gốc |
| HTTP game/API/static | **59/59 phản hồi 200**, dữ liệu không rỗng; API có đủ **25 màn** |
| Trình duyệt WebGL thật | Bàn 3D hiển thị; lăn phải tăng số bước 00 → 01; Menu → AI Solver → A* tìm lời giải 7 bước; phát hết **7/7**, hiện “Đã phát xong lời giải” |
| `main.py` với stdout cp1252, không đặt PYTHONUTF8 | Tái hiện lỗi ở bản gốc trong bản kiểm tra; sau sửa bản sao, server khởi chạy và trả HTTP 200 |
| Kiểm tra gói cuối | 431 file qua vòng ZIP → giải nén khớp SHA-256; không có thành phần bị loại |
| Bảo toàn nguồn | **470/470 file gốc khớp SHA-256**, không sửa/xóa file có sẵn |

Chỉ benchmark ngắn được chạy mới để xác nhận lệnh hoạt động. Không tuyên bố đã đo lại toàn bộ 300 lượt; số liệu và hình của lần kiểm tra không thay bộ kết quả chính thức.

ZIP kiểm tra cuối có SHA-256 `8f4ec3bfb886641384d0a29f1d794ef336d9a03c080dafc2dc483101102c9faf` (4.885.168 byte). Đây là gói kiểm tra Source, không phải file nén nộp cuối có Report.pdf.

Môi trường chạy thử, ZIP kiểm tra và ảnh render PDF tạm đã được dọn sau khi kiểm tra. `submission/Source` chỉ chứa bản source sạch; giữ báo cáo và bằng chứng trong `handoff/phuc`.

Lưu ý quản lý repo: `.gitignore` hiện có loại toàn bộ `/submission/`. Folder vẫn có trên máy; khi nhóm chủ động đưa vào Git phải stage rõ các file cần thiết hoặc dùng `git add -f submission/Source`. Chưa commit, push hay tự đánh dấu thành viên đã nhận bàn giao.

Sử dụng AI: Codex hỗ trợ đọc repo, tạo các bản sao đóng gói, viết hướng dẫn, chạy kiểm tra và soạn báo cáo. Kết quả PASS nêu trên lấy từ lệnh đã chạy; không giả lập kết quả và không tự nhận xác nhận của người bàn giao.
