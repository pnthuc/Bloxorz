# Rà soát Q01–Q03 trước lần bàn giao mới

Ngày: 31/10/2026. Nhánh mới: work/quan-experiment.
Nhánh được tạo từ checkout 6b7e3b5, giữ nguyên các thay đổi chưa commit của phiên làm việc.
Chưa commit hoặc push trong bước rà soát này.

## Kết luận theo nhiệm vụ

| Nhiệm vụ | Có cần viết lại code? | Việc còn cần làm |
| --- | --- | --- |
| Q01 — DFS và phần viết | Không cần viết lại thuật toán DFS | Chốt phiên bản engine rồi đồng bộ phần hành động, đường dẫn source, ví dụ và phân tích với đúng phiên bản |
| Q02 — Công cụ đo | Có các lỗi cần xử lý ở công cụ cũ; không cần viết lại từ đầu | Đồng bộ phần sửa đã có trên main, bổ sung bảo vệ metadata/đầu vào trước số liệu chính thức |
| Q03 — Bộ màn/phân nhóm | Không cần viết lại phần chọn/phân nhóm | CSV đã khớp 25 màn; ghép mô tả nhóm và biến thể xoay vào methodology khi làm Q05 |

## Q01

member2_dfs.py đang dùng stack LIFO, parent vừa đánh dấu khi phát hiện vừa lưu vết;
kiểm tra đích khi sinh successor, có nhánh start=goal, trả found=False khi hết frontier.
Phần viết dfs.docx đã mô tả đúng các đặc điểm này và phân biệt bộ nhớ graph-search
O(V) với tree-DFS O(bm). Không có lý do đổi thuật toán chỉ để thay thứ hạng benchmark.

Tuy nhiên hai phiên bản khác nhau:

- Checkout hiện tại: game_logic.py; successor UP, DOWN, LEFT, RIGHT, thêm SPACE khi SPLIT.
- origin/main d763322: core/board.py; UP, LEFT, RIGHT, DOWN và SUP/SLEFT/SRIGHT/SDOWN;
  SPACE chỉ chọn cube khi chơi tay, không còn là cạnh tìm kiếm.

Do đó không thể ghép nguyên phần thứ tự hành động của bản cũ vào báo cáo main mới.
Core DFS gần như giữ nguyên, nhưng đường đi/thời gian có thể đổi vì engine đổi thứ tự
và mô hình hành động. Cần cập nhật tài liệu sau khi chốt source, không đo lại chỉ vì sửa câu chữ.

## Q02

Các vấn đề xác nhận trên Src/experiments.py của checkout hiện tại:

1. Dòng 138 join worker trước khi đọc pipe. Kết quả dài có thể lấp buffer, khiến worker
   kẹt khi send và bị báo TIMEOUT dù đã tìm xong. Lỗi này đã được tái hiện trong lượt review trước.
2. Dòng 188 dùng replay.message, trong khi Replay có trường reason.
   Rà soát lần này tái hiện AttributeError khi worker trả đường đi không hợp lệ.
3. Nhánh recv thiếu bắt EOFError/OSError và xử lý cleanup đầy đủ nếu worker chết đột ngột.
4. environment.json/run-config.json ghi đè, trong khi raw.csv append. Dùng lại output-dir
   có thể giữ số đo cũ dưới metadata mới; cần batch riêng hoặc kiểm tra cấu hình tương thích.
5. ID màn/solver sai bị lọc âm thầm; cần báo lỗi, đặc biệt sau khi rút các ID cũ khỏi menu.

Đây là các vấn đề sẵn có của công cụ cũ, không phải do giảm từ 33 xuống 25 màn.
Định dạng cột CSV và khả năng đọc level mới vẫn tương thích, nhưng chưa đủ để kết luận
mọi nhánh lỗi/timeout của công cụ đo đã an toàn cho Q04.

Main d763322 đã chuyển code sang benchmarks/cli.py và đã sửa việc đọc pipe trước join,
trường reason, lỗi tiến trình và cleanup. Nên đồng bộ các sửa này thay vì tạo lại một
triển khai trùng với main. Vấn đề metadata append vẫn cần xử lý ở CLI main.

comparison_study.py mới dùng output-dir mới, worker cô lập, đọc kết quả trước cleanup,
đặt replay ngoài timeout tìm kiếm, lưu fingerprint và giữ log từng lượt.
Nó đã dùng cho trial và kiểm chứng bộ màn, nhưng schema của nó khác experiments.py:
case_id/repeat thay cho level_id/repeat_index và trạng thái INVALID thay vì INVALID_PATH.
Không âm thầm thay dữ liệu Q04 bằng CSV của công cụ này nếu chưa thống nhất schema với Phúc/Nam.

## Q03

Đã tính lại các trường từ từng JSON và đối chiếu toàn bộ level-groups.csv:

- 25 ID duy nhất, đúng bằng danh sách Src/levels.
- Tên, kích thước, số ô có sàn, số cầu, switch, split switch và fragile đều khớp.
- 8 cơ bản, 6 gạch cam, 7 công tắc–cầu, 4 tách/ghép.
- Stress: 23, 30, 33; không suy độ khó từ khoảng ID.
- 17 màn rút khỏi menu đã được lưu nguyên byte, có checksum và testcase cũ.
- Các cặp/nhóm xoay phải được mô tả là biến thể ghép cặp, không coi là các bài toán độc lập.

Đầu ra còn thiếu theo handoff là phần methodology.docx; nội dung lựa chọn/phân nhóm
đã có ở LEVEL_SELECTION.md để ghép khi làm Q05. Không cần phát triển lại thuật toán phân nhóm.

## Thứ tự chốt để tránh làm lại

1. Lưu các thay đổi bộ 25 màn, testcase, archive và công cụ thử thành các commit có phạm vi rõ.
   tmp/ là file tạm, không đưa vào commit chung.
2. Đồng bộ origin/main và xử lý các đổi tên game_logic → core/board, experiments → benchmarks/cli;
   giữ bộ màn mới và tái kiểm chứng testcase theo mô hình tám hành động của main.
3. Hoàn thiện những lỗi Q02 còn lại, cùng schema CSV đã thống nhất, rồi cập nhật Q01 theo source đó.
4. Chốt baseline/commit và mới chạy Q04 chính thức. Không gán các trial trên hai phiên bản engine
   cho một snapshot; giữ nguyên dữ liệu lịch sử.

Việc rà soát này không tự đánh dấu lại Q04/Q05/Q06 là hoàn thành và không thay nội dung dfs.docx.
