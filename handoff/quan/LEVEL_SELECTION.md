# Bộ 25 màn: cơ chế, bẫy tìm kiếm và ca biên

Ngày chọn: 31/10/2026. Mục tiêu là giảm trùng vai trò, giữ đủ cơ chế và tạo các
phép so sánh có giải thích. Đây là thay đổi bộ dữ liệu; không thay thuật toán,
thứ tự successor hoặc hàm cost để tạo người thắng.

**33 màn cũ → giữ 16, archive 17, thêm 9 → 25 màn chơi.**
Toàn bộ 25 màn có lời giải. Testcase chuẩn có 37 ca: 25 màn + T1–T12.
Không đánh số lại màn được giữ; các ID có khoảng trống để không đổi nghĩa các
tham chiếu cũ trong báo cáo, log và test regression.

## Giữ những gì?

| Vai trò | ID giữ | Lý do |
| --- | --- | --- |
| Cơ bản / gạch cam | 1, 2, 6 | Baseline nhỏ; phạt địa hình; đường mỏng có điểm tựa |
| Công tắc và cầu | 3, 7, 8 | Kết hợp soft/heavy, mở cố định, yêu cầu tư thế đứng |
| Tương tác nâng cao | 4, 11, 12 | Tách/ghép; cầu đóng dưới khối; chuỗi cơ chế kết hợp |
| Heuristic yếu | 15 | Nhiều bước vòng dù đích hình học gần; heuristic ít giảm node |
| Gạch cam dài / đường tắt | 19, 31 | Trọng số trên đường dài; ví dụ nhỏ có chi phí khác số bước |
| Stress cầu | 23, 30 | Hai mức số cầu; giữ một số stress thay vì cả dãy tương tự |
| Dịch chuyển / stress tách khối | 32, 33 | Chuỗi teleport; màn nhiều cổng để đánh giá giới hạn tài nguyên |

ID 23, 30, 33 có nhãn stress. Giữ timeout như kết quả riêng; không gọi timeout là
vô nghiệm. Màn 33 vẫn có giá trị stress dù chậm, không dùng nó làm demo bắt buộc.

## Rút những gì khỏi danh sách chơi?

| Nhóm rút | ID archive | Đại diện còn giữ |
| --- | --- | --- |
| Hành lang / sàn cơ bản khác | 5, 13 | 1 và các ca mới 35–40 |
| Các biến thể cầu/công tắc trung bình | 9, 16, 18, 21 | 3, 7, 8, 11, 15 |
| Gạch cam tương tự | 14 | 2, 6, 19, 31, 45–46 |
| Tách/ghép kết hợp tương tự | 10, 17, 20, 22 | 4, 12, 32 |
| Cầu stress cùng họ | 24, 26, 27 | 23, 30 |
| Tách khối stress tốn thời gian | 25, 28, 29 | 33 |

Đây là lựa chọn theo vai trò/cơ chế và thời lượng bộ thử, không phải chứng minh các
đồ thị trùng hệt nhau. Các màn rút vẫn được lưu nguyên byte ở
[archive](level-archive/pre-curation-20261031/README.md), có checksum và testcase cũ.

## Thêm những màn nào?

| ID | Nguồn trial | Điểm phân hóa | Tối ưu bước / cost |
| --- | --- | --- | --- |
| 35, 36, 37, 38 | C02 ở bốn góc xoay | Đích nông cạnh vùng mở; độ nhạy DFS với thứ tự hành động | 2 / 2 |
| 39, 40 | C03 ở 0° và 90° | Đích xa trên bàn mở; tốc độ tìm nghiệm đầu tiên đối lập độ dài nghiệm | 16 / 16 |
| 43 | C04-r000 | Đích gần sau bức tường; phải đi vòng dù h(start) nhỏ | 20 / 20 |
| 45, 46 | C05 ở 0° và 180° | Ít bước qua gạch cam so với đường vòng có cost thấp hơn | 16 bước ngắn nhất; cost tối ưu 20 bằng đường 20 bước |

35–38 là **một thiết kế, bốn biến thể ghép cặp**, không phải bốn bài toán độc lập.
39–40 và 45–46 cũng phải phân nhóm khi thống kê. Giữ cả hướng thuận lợi cho DFS
để không chỉ công bố ví dụ nó đi nhầm. Không nên gọi bốn màn đích nông là bốn mức
khó tăng dần; mục đích của chúng là kiểm tra thứ tự duyệt.

Nghiệm mẫu và kỳ vọng đã được đưa vào Src/tests/test_cases.json. Màn 45/46 cho
BFS 16 bước, cost chung 23; UCS/A* 20 bước, cost 20. Các con số này dùng các board
không tách khối nên không phụ thuộc việc SPACE có được tính một hành động hay không.
Số liệu thời gian/độ dài DFS vẫn phụ thuộc phiên bản solver và thứ tự successor.

## Ca biên nằm ngoài menu

- T11: ô đích có thể bị khối nằm đè lên nhưng không thể tới ở tư thế đứng; bài toán vô nghiệm.
- T12: hai soft switch được nhấn trong cùng bước và cùng toggle một cầu; hai hiệu ứng triệt tiêu.
- T4/T6/T9 tiếp tục kiểm tra các trường hợp vô nghiệm cũ; T10 là start=goal.
- C01 (đường bắt buộc), C06 (đích cô lập) và các biến thể trial chưa chọn vẫn có thể
  chạy qua comparison_study.py; không cần đưa chúng vào menu để tăng số màn.

## Kiểm chứng và chạy lại

Danh mục đang hoạt động: [level-groups.csv](level-groups.csv).
Quyết định có cấu trúc: [level-curation.json](level-curation.json).
Kết quả 400 lượt trước curation: [comparison-study](comparison-study/README.md),
được giữ nguyên với source main d763322 và không gán lại cho checkout hiện tại.

Từ Src, kiểm chứng toàn bộ catalog mới bằng worker giới hạn thời gian:

```powershell
python comparison_study.py --catalog benchmark_cases/curated.json --repeats 1 --timeout 10 --output-dir ../handoff/quan/comparison-study/my-curated-check
```

Catalog này gồm cả 12 ca biên để kiểm chứng, không dùng như 37 màn độc lập khi làm
bảng hiệu năng chính thức. Dùng --cases với các ID số để chọn màn chơi hoặc T11/T12
để chọn ca biên. Đặt --source-root nếu muốn đo engine từ checkout khác và dùng đúng
testcase/cost của source được chọn. Không trộn các policy giữa hai nhánh.

Các kiểm tra nền và UI phải qua trước khi chốt bộ đo. Thư mục output luôn phải mới,
không append vào dữ liệu trước curation.

Kết quả kiểm chứng ngày 31/10/2026 trước đồng bộ main, trên engine 6b7e3b5:

- Python: 63/63 test nền PASS, gồm hai ca biên mới và tính toàn vẹn catalog.
- UI: 16/16 PASS, gồm menu 25 màn và phát lời giải màn 36 đến chiến thắng.
- Bốn solver × 37 ca: 148 tổ hợp đã được xác nhận đúng kỳ vọng, replay/schema/cost hợp lệ.
  Lượt giới hạn 10 giây có 147 tổ hợp hoàn tất và A* ở màn 33 timeout.
  Chạy lại riêng tổ hợp đó với giới hạn 60 giây đã SOLVED, search_time_ms=20079.
- 17 màn archive giữ nguyên checksum gốc; CSV phân nhóm khớp đủ 25 ID đang hoạt động.

Log lần đầu ở comparison-study/curated-check-20261031; retry ở
comparison-study/curated-33-astar-retry-20261031. Không ghi đè dòng timeout cũ.
Đây là lượt kiểm chứng một lần, không phải bảng benchmark lặp chính thức; thời gian
không được ghép vào trial 400 lượt trên main. Màn 33 cũng là một ví dụ đáng giữ:
chi phí heuristic trên nhiều cổng có thể khiến A* chậm dù nó có định hướng tìm kiếm.

Sau đó main d763322 đã được ghép tại 5e7a509: engine dùng tám hành động và SPACE
miễn phí ngoài đồ thị. Testcase màn split đã lấy mốc mới từ main; các mốc cũ trong
archive/trial vẫn là dữ liệu lịch sử. Tài liệu Q01 và công cụ Q02 đã cập nhật, xem
[kết quả rà soát](Q01-Q03_REVIEW.md). Lượt kiểm chứng engine mới nằm ở
comparison-study/curated-main-check-20261031, không trộn với các lượt trước.
