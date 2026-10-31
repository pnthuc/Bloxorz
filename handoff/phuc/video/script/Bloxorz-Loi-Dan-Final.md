# Lời dẫn video Bloxorz — bản cập nhật

Thời lượng 10:14. Phần xem vật liệu khối đã được kéo dài.

**00:00:01** Xin chào thầy và các bạn.

**00:00:03** Đây là phần demo Bloxorz Solver của nhóm em, kết hợp trò chơi giải đố

**00:00:08** ba chiều với bốn thuật toán tìm kiếm: BFS, DFS, UCS và A*.

**00:00:13** Trong video này, nhóm em sẽ giới thiệu cách chơi, các cơ chế đặc biệt, giao

**00:00:19** diện tùy chỉnh, sau đó giải và so sánh thuật toán trên cùng một màn chơi.

**00:00:25** Các thao tác đều được thực hiện trực tiếp trong game.

**00:00:31** Mục tiêu của Bloxorz là đưa khối đứng thẳng vào ô đích.

**00:00:35** Khối có thể đứng, nằm theo hàng hoặc nằm theo cột.

**00:00:41** Nhấn F để xem gần khối đang điều khiển.

**00:00:46** Góc nhìn này hữu ích với màn chơi lớn.

**00:00:48** Người chơi sử dụng các phím mũi tên hoặc W, A, S, D.

**00:00:53** Hướng di chuyển gắn với hàng và cột của bàn chơi, không thay đổi theo góc camera.

**00:00:58** Số bước ở phía dưới giúp theo dõi quá trình giải.

**00:01:02** Kéo chuột để xoay; nhấn C để trở về toàn cảnh.

**00:01:06** Mỗi lần lăn thay đổi cả vị trí và tư thế.

**00:01:10** Cần căn đúng tư thế để đưa khối vào đích.

**00:01:13** Camera chuyển động mượt để người xem vẫn nhận ra vị trí của khối.

**00:01:18** Ở ví dụ này, khối được căn đúng tư thế trước bước cuối.

**00:01:22** Khi khối đứng vào ô đích, game xác nhận chiến thắng và cung cấp các thao tác tiếp theo.

**00:01:31** Toàn bộ phần khối đang chiếm phải được bàn chơi đỡ.

**00:01:34** Nếu lăn ra ngoài mép, khối rơi xuống nước và màn chơi kết thúc.

**00:01:40** Góc nhìn được giữ lại để người chơi hiểu vì sao thao tác vừa rồi thất bại.

**00:01:46** Phím R khởi động lại màn.

**00:01:48** Khối được đưa trở về vị trí ban đầu bằng chuyển

**00:01:52** động hồi phục, còn bộ đếm bước được đặt lại.

**00:01:55** Ô màu cam là ô dễ vỡ.

**00:01:58** Khối nằm hoặc khối đơn có thể đi qua, nhưng khối đứng thẳng sẽ làm ô vỡ và rơi.

**00:02:05** Vì vậy, khi tìm đường cần xét cả tư thế, thay vì

**00:02:09** chỉ kiểm tra xem tọa độ đó có ô sàn hay không.

**00:02:16** Màn tiếp theo bổ sung công tắc và cầu.

**00:02:19** Công tắc nhẹ được ký hiệu bằng vòng tròn.

**00:02:22** Khi khối chạm vào công tắc, trạng thái cầu liên quan

**00:02:26** thay đổi, tạo ra hoặc đóng lại một đoạn đường đi.

**00:02:29** Ở đây, khối nằm chạm công tắc tròn và cầu đầu tiên được mở.

**00:02:34** Người chơi có thể quan sát đường đi mới xuất

**00:02:38** hiện trước khi tiếp tục sang khu vực bên kia.

**00:02:41** Công tắc nặng mang ký hiệu X có điều kiện khác: khối phải đứng thẳng trên nó.

**00:02:47** Việc khối chỉ nằm ngang qua ô chưa đủ để kích hoạt.

**00:02:51** Nhóm em dừng tại hai tư thế này để làm rõ sự khác biệt.

**00:02:56** Khi căn khối đứng đúng trên công tắc X, cầu tiếp theo được mở.

**00:03:01** Trạng thái cầu cũng là một phần của trạng thái bài toán.

**00:03:05** Hai khối ở cùng tọa độ nhưng có các cầu đang mở

**00:03:09** khác nhau sẽ dẫn đến những khả năng di chuyển khác nhau.

**00:03:16** Cơ chế tách khối làm bài toán phức tạp hơn.

**00:03:19** Khi khối đứng trên ô tách, nó trở thành hai khối

**00:03:23** đơn tại các vị trí được cấu hình trong màn chơi.

**00:03:27** Người chơi dùng Space để đổi khối đang điều khiển.

**00:03:30** Mỗi khối có thể đi theo một đường riêng; chẳng hạn một

**00:03:35** khối tới công tắc để mở cầu cho khối còn lại.

**00:03:39** Dấu nhận biết trên khối giúp theo dõi lượt điều khiển hiện tại.

**00:03:43** Khi hai khối đơn nằm sát cạnh theo điều kiện của game, chúng tự ghép thành khối ban đầu.

**00:03:50** Từ đó, người chơi tiếp tục căn hướng và tư thế để vào đích.

**00:03:55** Trong mô hình tìm kiếm, trạng thái phải ghi được vị trí của

**00:04:00** cả hai khối, khối đang điều khiển và trạng thái các cầu.

**00:04:04** Các hành động đổi khối rồi di chuyển cũng được xử lý theo quy

**00:04:09** ước chung, để lời giải có thể phát lại bằng đúng luật chơi.

**00:04:16** Menu Esc tập trung các chức năng chính: tiếp tục

**00:04:19** chơi, chọn màn, AI Solver, tùy chỉnh và trợ giúp.

**00:04:23** Mở menu không làm mất trạng thái ván đang chơi.

**00:04:27** Trong phần chọn màn, màn hiện tại được đánh dấu để người dùng biết mình đang ở đâu.

**00:04:35** Có thể xem trước màn khác rồi chủ động bắt

**00:04:39** đầu, thay vì chuyển màn ngay khi vừa lựa chọn.

**00:04:43** Trợ giúp được chia thành ba trang ngắn: mục tiêu, điều khiển và các ô đặc biệt.

**00:04:49** Hình minh họa đi cùng mô tả giúp đối chiếu ký hiệu

**00:04:54** trong hướng dẫn với ký hiệu xuất hiện trên bàn chơi.

**00:05:01** Game có ba môi trường: Di tích, Vườn hoa và Băng tuyết.

**00:05:05** Mỗi môi trường có vật liệu và bộ trang trí riêng, nhưng giữ

**00:05:10** nguyên cấu trúc màn chơi cùng ý nghĩa của các ô chức năng.

**00:05:14** Di tích sử dụng kiến trúc đá, vòm gãy và những phần nền móng chìm dưới nước.

**00:05:21** Vườn hoa tăng các tầng thực vật với cây, bụi hoa, dây leo và lá nổi.

**00:05:26** Băng tuyết chuyển sang đá lạnh, tuyết tích tụ, cây mùa đông và băng ven nước.

**00:05:32** Ba môi trường dùng chung cấu trúc màn chơi và các cơ chế đặc biệt.

**00:05:39** Ký hiệu ô thường, ô dễ vỡ, công tắc và đích vẫn được giữ rõ ràng.

**00:05:45** Tiếp theo là phần tùy chỉnh vật liệu của khối.

**00:05:50** Có thể thay vật liệu của khối để nhận biết rõ hơn trên từng môi trường.

**00:05:57** Việc đổi diện mạo không làm thay đổi luật giải hoặc làm mất trạng thái ván chơi.

**00:06:06** Tùy chỉnh cũng có âm lượng và tốc độ diễn hoạt lời giải.

**00:06:11** Tốc độ phát không ảnh hưởng thời gian tìm kiếm.

**00:06:15** Phần trọng tâm của đề tài là AI Solver.

**00:06:17** Chế độ từng thuật toán cho phép chọn BFS, DFS, UCS hoặc

**00:06:21** A* rồi giải từ trạng thái ban đầu của màn.

**00:06:24** Sau khi tìm được đường đi, giao diện cung cấp kết quả và khả năng phát lại.

**00:06:30** BFS mở rộng trạng thái theo từng lớp độ sâu.

**00:06:33** Khi mỗi hành động được xem là một bước, BFS hướng tới lời giải có ít bước nhất.

**00:06:39** Đổi lại, số trạng thái cần lưu có thể tăng nhanh khi không gian tìm kiếm lớn.

**00:06:44** DFS đi sâu theo một nhánh trước rồi quay lui khi cần.

**00:06:48** DFS có thể tìm ra lời giải khác với BFS;

**00:06:51** không nên mặc định lời giải đó là ngắn nhất.

**00:06:54** Thứ tự sinh hành động cũng ảnh hưởng đường đi được tìm thấy.

**00:06:58** UCS ưu tiên trạng thái có tổng chi phí đã đi nhỏ hơn.

**00:07:02** Trong dự án này, chi phí mỗi bước còn xét số

**00:07:05** ô dễ vỡ bị khối chiếm ở trạng thái đến.

**00:07:08** Vì vậy, tối ưu số bước và tối ưu tổng

**00:07:12** chi phí là hai tiêu chí cần được phân biệt.

**00:07:15** A* kết hợp chi phí đã đi với một giá trị ước lượng phần đường còn lại.

**00:07:20** Hàm đánh giá có dạng f bằng g cộng h.

**00:07:23** Heuristic của dự án xét khoảng cách và các tình

**00:07:27** huống tách khối, nhằm định hướng quá trình tìm kiếm.

**00:07:30** Các đường đi đang hiển thị là kết quả thực tế của từng thuật toán.

**00:07:34** Hoạt ảnh giúp quan sát và kiểm chứng lời giải; nó không phải

**00:07:38** hoạt ảnh mô phỏng toàn bộ cây tìm kiếm bên trong thuật toán.

**00:07:45** Để đối chiếu thuận tiện hơn, chế độ so sánh chạy lần lượt cả

**00:07:49** bốn thuật toán trên cùng một màn và cùng giới hạn thời gian.

**00:07:52** Các lượt được chạy tuần tự, tránh việc bốn phép đo cạnh tranh tài nguyên cùng lúc.

**00:07:57** Trước khi đọc số liệu, cần kiểm tra trạng thái của từng lượt.

**00:08:01** Có lời giải, vô nghiệm, quá thời gian hoặc lỗi là các kết quả khác nhau.

**00:08:06** Một lượt quá hạn không được diễn giải thành thuật toán đã chứng minh màn chơi vô nghiệm.

**00:08:11** Chỉ số thời gian thể hiện thời gian tìm kiếm.

**00:08:14** Nó khác với thời gian tải trang, dựng cảnh hoặc thời gian hoạt ảnh khối lăn.

**00:08:18** Vì thế, tăng tốc replay không làm cho kết quả đo thuật toán trở nên nhanh hơn.

**00:08:23** Chỉ số bộ nhớ ghi nhận đỉnh cấp phát Python trong lượt tìm

**00:08:27** kiếm, không phải toàn bộ bộ nhớ máy hay bộ nhớ đồ họa.

**00:08:31** Số trạng thái đã xét phản ánh lượng công việc tìm

**00:08:34** kiếm, còn số bước phản ánh độ dài lời giải.

**00:08:37** Tổng cost dùng công thức chung để tính lại đường đi khi so sánh.

**00:08:41** Điều này đặc biệt quan trọng ở màn có ô dễ vỡ: hai

**00:08:45** lời giải cùng số bước vẫn có thể khác nhau về chi phí.

**00:08:48** Các con số ở đây là một lượt minh họa trên môi trường đang chạy.

**00:08:53** Để kết luận hiệu năng cho báo cáo, cần đo lặp trên nhiều màn với cấu hình cố định.

**00:08:58** Không thể chỉ nhìn một màn nhỏ rồi khẳng định một

**00:09:02** thuật toán luôn tốt hơn ba thuật toán còn lại.

**00:09:04** Sau khi đo, người dùng chủ động chọn một lời giải để xem.

**00:09:08** Việc đo tự nó không chuyển màn và cũng không thay thế ván đang chơi.

**00:09:15** Thanh replay hỗ trợ phát, tạm dừng, tiến hoặc lùi

**00:09:18** từng bước và chọn vị trí trên dòng thời gian.

**00:09:21** Nhờ đó có thể kiểm tra tại sao thuật toán chọn một đoạn đường, hoặc

**00:09:26** quan sát chính xác tư thế khi đi qua công tắc và ô dễ vỡ.

**00:09:31** Khi mở Esc rồi quay lại, lời giải và vị trí phát được giữ để tiếp tục theo dõi.

**00:09:38** Hoàn thành replay được thể hiện trong luồng kết quả AI,

**00:09:41** tránh bật một hộp thoại chơi tay không liên quan.

**00:09:45** Mỗi hành động trong lời giải vẫn được đối chiếu với engine.

**00:09:49** Phần hiển thị ba chiều trình bày kết quả, còn tính hợp lệ của

**00:09:53** trạng thái và điều kiện đích được quyết định bằng luật của game.

**00:10:00** Qua phần demo, nhóm em đã giới thiệu cách chơi Bloxorz, các cơ chế

**00:10:04** đặc biệt, bốn thuật toán và chức năng so sánh, phát lại lời giải.

**00:10:09** Cảm ơn thầy và các bạn đã theo dõi.
