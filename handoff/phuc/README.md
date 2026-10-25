# Phan Gia Phúc — UCS/cost, biểu đồ và sản xuất video

MSSV: **24120503** · Nhánh gợi ý: `work/phuc-charts-video`

Phụ trách UCS/cost, nhận thêm bảng/biểu đồ từ Quân và sản xuất video từ Nam; chuẩn bị README và source sạch theo phân công.

[Quy trình làm việc chung](../README.md) · 

## Nhận những gì để bắt đầu?

- `Src/solvers/member5_ucs.py`, `costs.py`, README và requirements.txt hiện có.
- `Src/tests/helpers.py`: replay_solution() đã tính cost từng bước; dùng lại để đối chiếu.
- Dữ liệu UCS/BFS/A* của Quân và phản hồi lý thuyết từ Thiện.
- Bộ source có sẵn, GUI/assets/font/Three.js local và script test.
- Nhận raw.csv, summary.csv, level-groups.csv, environment.json và mô tả cột từ Quân; dùng để trình bày kết quả.
- Nhận video-outline của Nam và demo-notes/ảnh/chuỗi thao tác của Thức; dùng làm kịch bản và video.

## Danh sách nhiệm vụ

Đổi `[ ]` thành `[x]` sau khi có đủ đầu ra và người nhận xác nhận. Việc đánh dấu trong README được lưu qua commit.

| Đã bàn giao | Mã | Nhiệm vụ |
| --- | --- | --- |
| [ ] | `P01` | Chốt và viết policy cost thống nhất |
| [ ] | `P02` | Viết UCS và ví dụ so sánh số bước với cost |
| [ ] | `P03` | Nhận xét UCS và rà các kết luận về cost |
| [ ] | `P04` | Hoàn thiện hướng dẫn và source để giải nén là chạy |
| [ ] | `P05` | Làm bảng trình bày và biểu đồ từ CSV của Quân |
| [ ] | `P06` | Viết kịch bản chi tiết, quay dựng và bàn giao video |

Các đường dẫn đầu ra dưới đây là nơi sẽ tạo file khi thực hiện nhiệm vụ. Thư mục hiện tại mới có README, chưa có kết quả hay báo cáo giả lập.

## P01 — Chốt và viết policy cost thống nhất

**Đầu vào**

- step_cost() trong bản code cuối; các lời giải mẫu và yêu cầu UCS/A* của đề.

**Yêu cầu thực hiện**

- Ghi chữ ký hàm, công thức chính xác, ý nghĩa từng tham số, miền giá trị và trường hợp cost bằng 0 nếu có.
- Giải thích vì sao cost không âm và có ý nghĩa với bài toán; xác định cách tính SPACE, nước đi tới goal và trạng thái không còn nước đi hợp lệ.
- Đối chiếu code, docstring, README và giải thích A*: mô tả phải thống nhất với policy cuối đã chốt. Thực hiện điều chỉnh tài liệu thuộc phạm vi cost nếu cần.
- Quy định path_cost = tổng step_cost trên đường đi để so sánh chung; giữ total_cost gốc của solver thành cột riêng trong benchmark.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/phuc/cost-policy.docx`, gồm công thức, lý do chọn, ví dụ ngắn và commit.

**Tiêu chí hoàn thành**

- Quân có đủ thông tin để tính lại cùng kết quả; Thiện xác nhận giả thiết dùng cho heuristic.
- Nếu cost mới làm thay đổi mốc kỳ vọng test, ghi bảng mốc nào chịu ảnh hưởng để Thức kiểm tra; không lấy cost cũ làm số liệu mới.

**Gửi cho:** Thiện, Quân, Nam và Thức cùng dùng làm giao ước.

**Thực hiện khi:** Ưu tiên hoàn thành tại M0, trước lượt đo chính thức.

## P02 — Viết UCS và ví dụ so sánh số bước với cost

**Đầu vào**

- UCS cuối, P01 và một hoặc hai lời giải thật trên cùng màn.

**Yêu cầu thực hiện**

- Giải thích priority queue theo g, best_g, parent, cập nhật đường tốt hơn và bỏ entry cũ; giả mã sát code.
- Nêu điều kiện bảo đảm tối ưu với chi phí không âm, không kết luận ngay khi goal vừa được sinh nếu code lấy goal ra khỏi heap.
- Lập bảng từng bước: state/action, step_cost, chi phí tích lũy. Có thể đối chiếu hai đường để làm rõ ít bước và ít cost.
- Nếu dữ liệu không có ví dụ hai tiêu chí khác nhau, nói rõ kết quả thực tế và dùng ví dụ minh họa được gắn nhãn, không gán cho một màn chưa đo.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/phuc/ucs.docx`, `cost-example.docx` và nguồn tham khảo.

**Tiêu chí hoàn thành**

- Bảng tính tay khớp replay; giả mã khớp code và cùng đơn vị với P01.
- Giải thích được vì sao UCS với unit cost có quan hệ với BFS.

**Gửi cho:** Nam ghép báo cáo/video; Thiện đối chiếu phần g(n).

**Thực hiện khi:** Sau P01; có thể viết phần thuật toán ngay.

## P03 — Nhận xét UCS và rà các kết luận về cost

**Đầu vào**

- CSV của Quân và biểu đồ P05 của Phúc; bản discussion và kịch bản của Nam.

**Yêu cầu thực hiện**

- Chọn màn đại diện để so UCS/BFS và UCS/A*: cost chung, số bước, node, thời gian và bộ nhớ.
- Kiểm tra không so trực tiếp total_cost của BFS/DFS với total_cost UCS/A* khi hai cột mang ý nghĩa khác nhau.
- Giải thích chi phí tính step_cost trong bản cuối và ảnh hưởng có thể có tới thời gian.
- Gửi đoạn nhận xét, câu sửa và xác nhận công thức cuối; kèm khai báo AI.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/phuc/ucs-results.docx` và phần rà UCS/cost.

**Tiêu chí hoàn thành**

- Nhận xét có ID màn và dẫn số liệu; tách hiệu năng tìm kiếm khỏi chất lượng đường đi.
- Không tuyên bố UCS luôn cho số bước ngắn nhất khi cost không đồng nhất.

**Gửi cho:** Nam ghép; Quân xác nhận nguồn dữ liệu; Thức nhận bản cuối.

**Thực hiện khi:** Sau Q05 và P05.

## P04 — Hoàn thiện hướng dẫn và source để giải nén là chạy

**Đầu vào**

- Source snapshot cuối; README hiện tại; requirements.txt; hướng dẫn thực nghiệm Q06.

**Yêu cầu thực hiện**

- Cập nhật README: phiên bản Python, tạo venv, cài thư viện, chạy main.py, địa chỉ localhost, điều khiển, test và benchmark.
- Nêu Node.js và npm ci trong Src/tests chỉ phục vụ test UI; chạy game dùng Python và trình duyệt WebGL.
- Sao chép bản source nộp vào submission/Source, giữ đủ static, templates, levels, solvers, tests, main.py, game_logic.py, run_tests.py, experiments.py và requirements.txt. Đặt README ở thư mục Source theo ví dụ đề.
- Loại .git, .venv, __pycache__, node_modules, cache và file tạm. Chỉ giữ dữ liệu thực nghiệm cần bàn giao; biểu đồ chính đã có trong report.
- Giải nén thử sang thư mục sạch, làm theo README và ghi lại kết quả. Báo lỗi cho chủ file tương ứng.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `submission/Source/` có README và `handoff/phuc/run-check.docx` ghi môi trường/lệnh/kết quả.

**Tiêu chí hoàn thành**

- Thực hiện được bước cài và mở game từ bản sạch; có thể tái lập test/benchmark theo hướng dẫn.
- Tài nguyên local và giấy phép kèm theo còn đủ; không thêm dữ liệu máy cá nhân vào gói.
- Đổi Src thành Source chỉ ở bản đóng gói; các lệnh README phản ánh đúng thư mục thực tế.

**Gửi cho:** Thức ghép Report.pdf và tạo file nén cuối.

**Thực hiện khi:** Có thể soạn README sớm; đóng gói source sau M0 và Q06.

## P05 — Làm bảng trình bày và biểu đồ từ CSV của Quân

**Đầu vào**

- Q05: raw.csv, summary.csv, nhóm màn và mô tả đơn vị; yêu cầu bảng/biểu đồ §3.6.

**Yêu cầu thực hiện**

- Dùng CSV đã đo để lập bảng đọc được trong báo cáo và vẽ đủ bốn chỉ số: thời gian, bộ nhớ đỉnh, node mở rộng, độ dài. Có thể thêm cost chung nếu giúp phân tích.
- Tách bước vẽ khỏi bước đo: đề xuất tạo Src/plot_experiments.py để đọc CSV do experiments.py của Quân xuất. Kế thừa cách vẽ ban đầu nếu phù hợp.
- Chia hình theo nhóm màn hoặc ví dụ đại diện; giữ màu nhất quán giữa các thuật toán; ghi rõ ms, KiB, node, hành động và cost.
- Ký hiệu timeout/lỗi riêng, ghi số mẫu tổng hợp và log-scale nếu có. Gửi hình gốc, bảng có thể sửa và chú thích nguồn dữ liệu cho Nam.
- Đối chiếu số trên hình với CSV của Quân; đề xuất bố cục hình phù hợp A4, Nam viết nhận xét tổng thể.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `Src/plot_experiments.py` (đề xuất bổ sung), `handoff/phuc/charts/*.png` và SVG nếu tiện.
- `handoff/phuc/result-tables.docx`, `handoff/phuc/chart-notes.docx` và lệnh tái tạo hình.

**Tiêu chí hoàn thành**

- Có đủ bảng/biểu đồ bốn chỉ số bắt buộc, nhãn/đơn vị đọc rõ trong PDF.
- Mỗi hình truy về CSV/snapshot; không sửa số đo hoặc tự chạy lại solver để thay dữ liệu.
- Quân xác nhận số liệu; Nam nhận được ảnh gốc và bảng để ghép ngay vào report.

**Gửi cho:** Nam ghép hình/bảng và viết phân tích; Quân đối chiếu dữ liệu.

**Thực hiện khi:** Sau Q05. Có thể chuẩn bị script vẽ từ CSV chạy thử Q02 trước.

## P06 — Viết kịch bản chi tiết, quay dựng và bàn giao video

**Đầu vào**

- video-outline N05 của Nam; demo-notes/chuỗi thao tác T02 của Thức; snapshot cuối và ví dụ thuật toán đã xác nhận.

**Yêu cầu thực hiện**

- Chuyển đề cương thành video-script.docx gồm cảnh, thao tác và lời dẫn/phụ đề. Thời lượng gợi ý 6–8 phút; đề không bắt buộc một độ dài cố định.
- Dùng các màn đã có để chứng minh GUI, điều khiển tay, win/loss, fragile, soft/heavy, bridge, split, SPACE và ghép lại. Phối hợp Thức để diễn lại cảnh khó.
- Quay đủ BFS, DFS, UCS và A* trên màn nhỏ, cho thấy lời giải/replay và metrics. Phân biệt thời gian tìm kiếm với thời gian animation.
- Dựng video rõ chữ, có thuyết minh hoặc phụ đề tiếng Việt/Anh; gửi một bản nháp cho Nam rà nội dung và Thức rà cơ chế.
- Xuất MP4, đăng YouTube công khai theo đề, kiểm tra xem được từ cửa sổ chưa đăng nhập và gửi URL cho Nam/Thức. Nam chèn URL vào báo cáo.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/phuc/video/video-script.docx`, `demo.mp4`, `video-url.txt`, phụ đề và file dựng nếu có.

**Tiêu chí hoàn thành**

- Bao phủ yêu cầu GUI và chức năng trong đề, âm thanh/phụ đề dễ theo dõi, giữ đủ kết quả solver cần chứng minh.
- Link công khai xem được; Nam nhận đúng URL để chèn vào PDF cuối.
- Nam xác nhận nội dung khớp report; Thức xác nhận cơ chế và bản game trong video.

**Gửi cho:** Nam nhận video và URL để ghép report; Thức kiểm tra trước khi nộp.

**Thực hiện khi:** Sau N05 và T02; có thể quay song song với Q04 khi snapshot đã chốt.


## Video và file lớn

- Commit kịch bản, phụ đề, `video/video-url.txt`, bảng và biểu đồ vào thư mục này.
- Video MP4 gốc và file dựng nặng lưu trên Drive hoặc nơi nhóm thống nhất; gửi link cho nhóm. `.gitignore` loại các định dạng video và file dựng phổ biến khỏi Git.
- `video-url.txt` phải có URL YouTube công khai cuối cùng. Nam nhận URL để chèn vào PDF; Thức kiểm tra trước khi nộp.
- Đề xuất tạo `Src/plot_experiments.py` để đọc CSV của Quân và vẽ hình. Script đo `Src/experiments.py` do Quân phụ trách; phối hợp trước khi sửa chung một file.

## Đẩy công việc lên repo

1. Làm theo quy trình tạo nhánh trong [hướng dẫn chung](../README.md#tao-nhanh-va-day-cong-viec).
2. Commit file trong `handoff/phuc/`; nếu có sửa code, stage thêm đúng các file code đã sửa.
3. Push nhánh, tạo Pull Request vào `main`, ghi mã task và đầu ra đã có. Gửi link PR cho Thức để xem và gộp.
4. Mỗi người gửi nguồn tham khảo và phần sử dụng AI của mình cùng nội dung bàn giao; Nam tổng hợp vào báo cáo.
