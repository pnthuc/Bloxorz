# Bộ ca so sánh bổ sung và nhận xét benchmark

Đã chạy thử **20 ca × 4 solver × 5 lần = 400 lượt** trên source main
`d763322ddd8b41a33fc141b03e75d245cc3d24fa`, ngày 31/10/2026.
Kết quả: **380 SOLVED, 20 NO_SOLUTION, không có TIMEOUT/ERROR/INVALID**.
20 NO_SOLUTION thuộc một ca vô nghiệm × bốn thuật toán × năm lần.

Đây là bộ ca chẩn đoán sự đánh đổi giữa thuật toán, chưa thay thế lượt thực nghiệm
chính thức trên bộ màn đã chốt. Source trong checkout hiện tại vẫn là nhánh cũ
`6b7e3b5`; lượt đo sử dụng snapshot main riêng, có đường dẫn và SHA-256 từng file
trong metadata. Không trộn số liệu này với CSV cũ theo policy SPACE riêng.

**Cập nhật sau thử nghiệm:** bộ chơi đã được tinh gọn thành 25 màn; chín biến thể
được chọn từ trial này đã nằm trong Src/levels. Xem [lựa chọn màn](../LEVEL_SELECTION.md).
400 lượt và các con số trong file này là snapshot lịch sử, không được gán lại cho
bộ 25 màn hoặc phiên bản engine khác.

## DFS có thống trị không?

Nếu chỉ chọn thuật toán có **median thời gian tìm bất kỳ nghiệm nào nhỏ nhất**,
DFS thắng 14/20 ca của bộ này; BFS thắng 3, A* thắng 3. Con số này phụ thuộc bộ ca,
gồm cả biến thể xoay và ca vô nghiệm, không ước lượng tỷ lệ thắng trên mọi màn Bloxorz.
Chênh lệch rất nhỏ dưới mili giây cũng chưa phải kết luận có ý nghĩa thống kê.

Nếu yêu cầu **nghiệm đạt cost tối ưu**, trong 19 ca có nghiệm, thuật toán nhanh nhất
theo median là A* ở 13 ca, DFS ở 3, BFS ở 2 và UCS ở 1. Đây chỉ là phép đếm trên
trial này; không dùng để kết luận A* luôn tốt nhất. Cost chung được replay tính lại
cho cả bốn thuật toán, không so total_cost đơn vị của BFS/DFS trực tiếp với UCS/A*.

Các ví dụ median nổi bật:

| Ca | BFS: ms / bước / cost chung | DFS: ms / bước / cost chung | UCS: ms / bước / cost chung | A*: ms / bước / cost chung |
| --- | --- | --- | --- | --- |
| C02-r090: đích nông | 0,266 / 2 / 2 | 21,623 / 198 / 198 | 0,656 / 2 / 2 | 0,407 / 2 / 2 |
| C03-r000: bàn thoáng | 51,295 / 16 / 16 | 5,576 / 72 / 72 | 76,471 / 16 / 16 | 49,095 / 16 / 16 |
| C05-r000: gạch cam | 10,552 / 16 / 23 | 1,664 / 24 / 24 | 18,880 / 20 / 20 | 9,527 / 20 / 20 |
| B04: màn 4 hiện tại | 348,198 / 16 / 16,5 | 11,195 / 38 / 38,5 | 474,356 / 16 / 16,5 | 321,207 / 16 / 16,5 |
| B32: chuỗi teleport | 3,409 / 6 / 6 | 1,258 / 17 / 17 | 13,049 / 6 / 6 | 2,259 / 6 / 6 |

- **DFS nhạy với thứ tự duyệt.** Bốn góc xoay của C02 là cùng một bài toán hình học,
  có nghiệm tối ưu 2 bước. DFS trả 75, 198, 136, 2 bước tương ứng góc 0°, 90°, 180°, 270°.
  Median thời gian tương ứng 6,455; 21,623; 12,267; 0,273 ms.
  Ở góc 90°, BFS còn dùng 4,27 KiB so với 94,46 KiB của DFS.
- **Ít node không đồng nghĩa ít bộ nhớ.** C03-r000: A* mở 323 node, BFS 594,
  nhưng A* dùng 185,54 KiB, BFS 130,89 KiB. Heap, best_g và các entry cùng tồn tại
  làm chi phí mỗi trạng thái khác nhau.
- **Ít bước không đồng nghĩa ít cost.** C05: BFS 16 bước/cost 23, UCS/A* 20 bước/cost 20.
  Thêm 25% bước nhưng giảm khoảng 13% cost. Đây là ví dụ thực sự có hai mục tiêu khác nhau.
- **Heuristic có lợi khi giảm được tìm kiếm.** B32: A* mở 14 node, UCS 83,
  trả cùng nghiệm 6 bước. Đây là ví dụ nên ghép với C05 để giải thích A*.
- **Heuristic yếu thì lợi ích nhỏ.** B15: BFS và A* đều mở 135 node; UCS 136.
  Median UCS 9,571 ms, A* 10,054 ms. Nên diễn giải là gần nhau và có overhead heuristic,
  không tuyên bố UCS thắng tuyệt đối từ chênh lệch nhỏ.
- **Cần ca đối chứng.** C01: cả bốn mở 10 node và trả 10 bước, nên khác biệt chủ yếu
  ở overhead. C06 vô nghiệm: cả bốn mở hết 645 node; BFS/DFS khoảng 57–59 ms,
  A* khoảng 82 ms. Không có định hướng nào giúp tránh việc phải duyệt hết vùng liên thông này.

Trong main hiện tại, successor thường là UP, LEFT, RIGHT, DOWN. Stack LIFO khiến
DFS ưu tiên các trạng thái đẩy sau. Khi SPLIT còn có các lệnh đổi cube rồi lăn.
DFS kiểm tra goal khi sinh successor, nên không nên mô tả thứ tự duyệt như DFS đệ quy
mà bỏ qua cơ chế đánh dấu khi phát hiện và early goal test.

## Các nhóm ca mới

| Nhóm | Ca | Điều muốn quan sát |
| --- | --- | --- |
| Đường bắt buộc | C01, một hướng | Khi không có nhánh, heuristic/heap thêm chi phí gì? |
| Đích nông, vùng mở rộng | C02, bốn góc xoay | DFS đi nhầm nhánh sâu; BFS hưởng lợi từ độ sâu nghiệm nhỏ |
| Bàn thoáng, đích xa | C03, bốn góc xoay | DFS tìm nhanh nhưng đi vòng; A* giảm node so với BFS/UCS |
| Đích gần sau vách ngăn | C04, hai góc xoay | h(start)=3 nhưng đường tối ưu 20; cận hình học còn lỏng |
| Đường ngắn qua cam / đường vòng an toàn | C05, hai góc xoay | Tách tối ưu số bước khỏi tối ưu cost |
| Đích cô lập | C06, một hướng | Vô nghiệm; cùng duyệt hết không gian đạt tới |

Giữ thêm sáu màn cũ 1, 4, 12, 15, 31, 32 làm baseline.
14 biến thể mới thuộc **sáu thiết kế gốc**, không phải 14 bài toán độc lập.
Các góc xoay là phép thử ghép cặp về thứ tự hành động. Không cộng chúng vào một
điểm trung bình rồi coi đó là mẫu đại diện ngẫu nhiên.

Đã xuất 14 JSON với ID **đề xuất** 34–47 vào
[candidate-levels](trial-main-d763322/candidate-levels/). Các ID 35–40, 43, 45, 46
đã được chọn cho Src/levels, có testcase chuẩn và walkthrough. Những JSON ứng viên
còn lại được giữ để tái lập trial; ID 47 là ca kiểm chứng vô nghiệm, không nằm trong GUI.

## Nên chọn gì cho báo cáo và video?

1. Dùng **bộ 25 màn đã chọn** làm bảng hiệu năng mới; giữ riêng timeout/lỗi và gắn phiên bản bộ màn. Bộ gốc 33 màn chỉ còn dùng cho đối chiếu lịch sử.
2. Thêm C02 đủ bốn góc xoay để chứng minh độ nhạy thứ tự duyệt, không chỉ lấy góc DFS thua.
3. Thêm C05 và một góc xoay đối chứng để minh họa BFS khác UCS/A*.
4. Chọn C03-r000 cùng B04 cho câu chuyện tìm nghiệm nhanh so với chất lượng nghiệm.
5. Ghép B32 với B15 để cho thấy khi heuristic hữu ích và khi lợi ích nhỏ.
6. Đưa C01/C06 vào phụ lục hoặc phần hạn chế. Không cần đưa mọi biến thể lên video.

Trình bày riêng thời gian tìm nghiệm đầu tiên, số bước, cost chung, bộ nhớ và node.
Dùng thêm length_ratio = số bước / tối ưu số bước, cost_ratio = cost chung / cost tối ưu.
Ratio bằng 1 là tối ưu; ca vô nghiệm không có ratio. Nếu cần một tiêu chí chọn solver,
nêu trước: cần nghiệm bất kỳ nhanh, nghiệm ít bước, hay nghiệm ít cost.

Các ca chẩn đoán được chọn theo cơ chế thuật toán, có giữ ca thuận lợi cho DFS.
Không chỉnh solver, thứ tự successor hoặc hàm cost để tạo người thắng; không tìm nhiều
map ngẫu nhiên rồi chỉ công bố các map có kết quả mong muốn. Thiết kế mới vẫn là một
bộ thử có chủ đích, nên cần công bố cả mục đích và kết quả đầy đủ.

## Dữ liệu và hình

- [raw.csv](trial-main-d763322/raw.csv): 400 lượt theo thứ tự thực hiện.
- [summary.csv](trial-main-d763322/summary.csv): 80 nhóm case/solver; median, IQR thời gian,
  min/max, số hoàn tất/timeout/lỗi và median các metric.
- [quality.csv](trial-main-d763322/quality.csv): chất lượng nghiệm chuẩn hóa.
- [metadata.json](trial-main-d763322/metadata.json): Python, OS, CPU, source, fingerprint,
  seed, policy hành động và cấu hình.
- [cases.json](trial-main-d763322/cases.json): toàn bộ board và kỳ vọng đã dùng, không lệ thuộc
  việc level gốc được chỉnh sau đó.
- runs/: một JSON cho mỗi lượt, gồm lời giải để replay/kiểm tra lại.
- [comparison-metrics.png](trial-main-d763322/comparison-metrics.png): bốn chỉ số bắt buộc.
- [rotation-sensitivity.png](trial-main-d763322/rotation-sensitivity.png): độ nhạy DFS với góc xoay.
- [candidate-boards.png](trial-main-d763322/candidate-boards.png): hình sáu thiết kế gốc.

## Cách đo và giới hạn

- Mỗi lượt trong một worker mới; chạy **tuần tự** trên cùng máy.
- Seed 20261031 xáo thứ tự case và solver giữa các lần lặp.
- Dùng đúng solve_* công khai với profiler của repo; thời gian bao gồm overhead tracemalloc.
- Khởi động worker/import/khởi tạo board ở ngoài giới hạn tìm kiếm 10 giây.
- Worker gửi kết quả ngay khi solver xong; replay và tính cost ở tiến trình cha,
  ngoài profiler và ngoài timeout tìm kiếm. Không dùng benchmark cũ có lỗi chờ pipe.
- Mọi SOLVED được replay, kiểm tra goal, số bước, cost và mốc tối ưu của BFS/UCS/A*.
- Mỗi đợt yêu cầu thư mục output mới; không append vào CSV của đợt khác.
- Thời gian dưới mili giây nhạy với scheduler và độ phân giải; dùng median/IQR,
  chú trọng cả node và chất lượng nghiệm. Không suy rộng từ chênh lệch nhỏ.
- Đỉnh bộ nhớ là cấp phát Python KiB, không phải RAM toàn process hoặc GPU.
- Chưa đo thời gian chơi/replay thực tế. Cả 400 lượt không thay thế kiểm chứng toàn bộ 33 màn.

## Tái lập

Script ở Src/comparison_study.py dùng được với layout cũ game_logic.py và layout mới core/board.py.
Chạy sau khi chọn đúng checkout source; --source-root là thư mục Src muốn đo.
--source-commit là nhãn phiên bản, SHA-256 trong metadata ghi byte thực sự đã đọc.

Từ Src, đo bộ rút gọn:

```powershell
python comparison_study.py --cases C02-r090 C05-r000 B32 --repeats 5 --timeout 10 --output-dir ../handoff/quan/comparison-study/my-small-trial
```

Đo toàn bộ và tạo lại hình:

```powershell
python comparison_study.py --repeats 5 --timeout 10 --output-dir ../handoff/quan/comparison-study/my-full-trial
python plot_comparison_study.py ../handoff/quan/comparison-study/my-full-trial
```

Để đo snapshot/checkout khác, thêm --source-root và --source-commit vào lệnh đo.
Không bỏ hai tham số này rồi gán kết quả chạy nhánh cũ cho main.
Script vẽ cần matplotlib và numpy; không gọi lại solver khi tạo hình.

Kiểm tra regression:

```powershell
python -m unittest tests.test_comparison_study -v
```

Bốn test mới xác nhận đối chứng xoay, đánh đổi bước/cost, ca vô nghiệm và tọa độ
teleport sau phép xoay. Toàn bộ test nền của checkout hiện tại: **60/60 PASS**.
Không thay đổi code của bốn solver hay bộ level chính thức.
