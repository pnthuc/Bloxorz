# Kết quả hoàn thiện Q01 đến Q03

Cập nhật 31/10/2026 trên nhánh work/quan-experiment. Bộ 25 màn đã được lưu ở c5d0bc3;
main d763322 đã được ghép tại 5e7a509. Không còn dùng layout game_logic.py/experiments.py
của nhánh cũ để bàn giao code mới.

## Q01

Không viết lại core DFS. Đã cập nhật dfs.docx theo core/board.py và tập
UP LEFT RIGHT DOWN SUP SLEFT SRIGHT SDOWN. SPACE chỉ chọn cube khi chơi tay.
Tài liệu mô tả đánh dấu khi phát hiện, early goal test, thứ tự pop so với thứ tự sinh,
truy vết, graph-search O(V) bộ nhớ và giới hạn tối ưu. Ví dụ riêng hai bước đã khớp code.
Tài liệu ba trang đã xuất và kiểm tra từng trang; có khai báo AI và nguồn code đối chiếu.

## Q02

Điểm vào hiện tại là python -m benchmarks.cli, CSV giữ nguyên 16 cột và các trạng thái
SOLVED, NO_SOLUTION, TIMEOUT, ERROR, INVALID_PATH.

- Đã lấy phần sửa từ main: đọc pipe trước join, replay.reason, bắt lỗi process/pipe và cleanup.
- Đã thêm từ chối thư mục output tồn tại, kể cả thư mục trống. Mỗi batch mới có metadata riêng;
  nếu bỏ --output-dir, CLI tự tạo batch trong benchmarks/. Không append vào dữ liệu cũ.
- Đã kiểm tra ID màn/solver, số lần lặp và timeout hữu hạn dương trước khi tạo output.
  Các ID đã archive bị báo lỗi thay vì bị lọc âm thầm.
- Một exception ở lượt đo được ghi ERROR; các lượt tiếp theo vẫn chạy. CLI trả mã 1 khi có
  ERROR/INVALID_PATH, không dùng thành công giả cho trường hợp đó.
- Metadata có commit, trạng thái thay đổi trong Src, fingerprint source và hash bộ màn.
  Thời gian/bộ nhớ vẫn lấy wrapper công khai; replay/path_cost ở ngoài profiler.
- CSV lỗi/timeout giữ trống metric chưa đo, không dùng 0 thay số không có.

9 regression Q02 đã qua: kết quả lớn, invalid path, worker chết, timeout cleanup, câu trả lời
solver thật, config sai, bảo vệ output cũ, metadata từng batch và tiếp tục sau exception.
Schema comparison_study.py vẫn tách riêng; không dùng CSV của nó thay cho CSV Q04.

## Q03

CSV level-groups.csv đã khớp toàn bộ JSON của 25 màn: 8 cơ bản, 6 gạch cam,
7 công tắc–cầu, 4 tách/ghép. Stress là nhãn phụ cho 23, 30, 33.
17 màn archive có checksum; Git được cấu hình giữ nguyên byte các JSON archive.
Các nhóm xoay được ghi là đối chứng ghép cặp. Xem LEVEL_SELECTION.md và level-curation.json.
T1–T12 là ca kiểm chứng, không cộng thành 12 màn benchmark độc lập.

## Kiểm tra trước commit

- Python regression: 87/87 PASS.
- UI/audio/render-assets: 53/53 PASS, gồm menu 25 màn và replay màn mới.
- Các mốc tối ưu/đường mẫu của màn split đã lấy từ main mới; ca 33 là 110 bước,
  cost tối ưu 110,5, đường mẫu cost 111,0. Không giữ mốc 119 của mô hình SPACE cũ.
- Các trial lịch sử được giữ nguyên source/metadata. Kết quả engine mới lưu ở thư mục mới.
- Bốn solver trên 37 ca của engine mới: đủ 148 tổ hợp hoàn tất đúng kỳ vọng,
  gồm 132 SOLVED và 16 NO_SOLUTION, không timeout/lỗi. Log ở comparison-study/curated-main-check-20261031.

Đã hoàn tất cập nhật Q01–Q03 trong phạm vi code, dữ liệu và tài liệu của Quân.
Q04 vẫn cần snapshot/cấu hình được nhóm chốt; Q05/Q06 không tự đánh dấu hoàn thành.
Chưa push nhánh hoặc gửi nội dung cho thành viên khác.
