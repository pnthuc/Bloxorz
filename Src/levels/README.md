# Bộ màn chơi

25 màn trong thư mục này đều có lời giải. ID giữ nguyên để các tham chiếu cũ không đổi nghĩa.
Kỳ vọng và walkthrough nằm trong `../tests/test_cases.json`: 25 màn và 12 ca biên T1–T12.

| Vai trò | ID |
| --- | --- |
| Cơ bản, fragile | 1, 2, 6, 19, 31 |
| Soft/heavy switch, cầu và tương tác | 3, 7, 8, 11, 15 |
| Tách/ghép, teleport | 4, 12, 32 |
| Stress cầu và tách khối | 23, 30, 33 |
| Đích nông, kiểm tra độ nhạy thứ tự duyệt DFS | 35, 36, 37, 38 |
| Đích xa trên bàn mở, tốc độ và chất lượng nghiệm | 39, 40 |
| Đích gần sau vách, heuristic phải đối mặt đường vòng | 43 |
| Đường ít bước qua fragile và đường dài hơn có cost thấp | 45, 46 |

35–38 là bốn góc xoay của một thiết kế; 39–40 và 45–46 cũng là đối chứng xoay.
Không coi các góc xoay là những bài toán độc lập khi thống kê.
Màn 45/46 có nghiệm ngắn nhất 16 bước (cost 23), còn cost tối ưu 20 đạt bằng đường 20 bước.

Các màn cũ 5, 9, 10, 13, 14, 16, 17, 18, 20, 21, 22, 24–29 đã bỏ khỏi menu;
có thể lấy lại từ lịch sử Git. Không lưu thêm bản sao archive trong bộ source hiện tại.
T11 kiểm tra chạm goal khi nằm nhưng không thể thắng; T12 kiểm tra hai switch cùng toggle một cầu.
Các ca biên chỉ phục vụ kiểm thử, không nằm trong menu.

CSV bàn giao phân nhóm ở `../../handoff/quan/level-groups.csv`.
Catalog và lệnh kiểm chứng bổ sung ở [benchmarks](../benchmarks/README.md).
