# Giao việc và bàn giao — Bloxorz

Bản phân công điều chỉnh ngày 25/10/2026, tiếp tục từ engine, API, UI, levels, test và solver đã có trong repo.

**Cách chia hiện tại:** Quân đo/kiểm chứng dữ liệu; Nam viết/tổng hợp report; Phúc làm UCS/cost, bảng/biểu đồ và video; Thiện phụ trách A*; Thức cung cấp nền tảng và nghiệm thu.

## Mỗi người làm ở đâu?

| Người phụ trách | Công việc chính | Nhánh gợi ý |
| --- | --- | --- |
| [Nguyễn Lê Minh Quân](quan/README.md) | Đo, kiểm chứng và bàn giao số liệu | `work/quan-experiments` |
| [Bùi Phương Nam](nam/README.md) | Đầu mối báo cáo và phân tích tổng hợp | `work/nam-report` |
| [Tống Phúc Thiện](thien/README.md) | Chịu trách nhiệm nội dung A* | `work/thien-astar-report` |
| [Phan Gia Phúc](phuc/README.md) | UCS/cost, biểu đồ và sản xuất video | `work/phuc-charts-video` |
| [Phan Ngọc Thức](thuc/README.md) | Cung cấp nền tảng và nghiệm thu cuối | `work/thuc-final-review` |

File trong `handoff/` là tài liệu, dữ liệu và kết quả bàn giao. Code chạy game/solver/công cụ vẫn ở `Src/` như trước.

```text
handoff/
  README.md                Quy trình chung
  shared/baseline.md       Bản code/policy/cách đo được nhóm chốt
  quan/README.md           Input, yêu cầu, output và nghiệm thu của Quân
  nam/README.md            Input, yêu cầu, output và nghiệm thu của Nam
  thien/README.md          Input, yêu cầu, output và nghiệm thu của Thiện
  phuc/README.md           Input, yêu cầu, output và nghiệm thu của Phúc
  thuc/README.md           Input, yêu cầu, output và nghiệm thu của Thức
```

Các thư mục con như `benchmarks/`, `charts/`, `video/` chỉ tạo khi đã có đầu ra. README giúp Git theo dõi các thư mục hiện tại mà không cần thêm file rỗng `.gitkeep`.

## Bạn Thức cần làm trước

1. Đưa bộ khung này lên `main` sau khi kiểm tra thay đổi. Mỗi người sẽ lấy cùng cấu trúc bằng `git pull`.
2. Kiểm tra bốn bạn đã có quyền cộng tác/push vào repo; thêm tài khoản GitHub nếu còn thiếu.
3. Gửi link README đúng người trong bảng trên. Có thể tạo một GitHub Issue cho mỗi người từ danh sách task bên dưới để theo dõi.
4. Cùng Phúc/Thiện/Quân điền [baseline.md](shared/baseline.md) trước lúc đo chính thức: bản code, cost, heuristic, bộ màn, môi trường và cách đo.

Các nhánh chưa được tạo trên GitHub bởi bộ khung. Mỗi người tự tạo nhánh khi bắt đầu; `git push -u` sẽ tạo nhánh tương ứng trên GitHub.

<a id="tao-nhanh-va-day-cong-viec"></a>
## Tạo nhánh và đẩy công việc

Pull Request (PR) là yêu cầu gộp thay đổi từ nhánh làm việc vào `main`. Thức xem nội dung, đối chiếu đầu ra rồi merge PR để cả nhóm dùng chung.

**Lần đầu nhận việc**, từ thư mục repo, ví dụ của Quân:

```bash
git switch main
git pull --ff-only origin main
git switch -c work/quan-experiments
```

Các bạn khác thay tên nhánh bằng tên của mình trong bảng. Nếu đã có thay đổi chưa commit, hãy lưu/commit chúng trên đúng nhánh trước khi đổi nhánh; không dùng lệnh bỏ thay đổi để làm sạch thư mục.

**Sau khi làm được một phần có thể bàn giao**, ví dụ Quân đã sửa công cụ đo và thêm số liệu:

```bash
git status --short
git add Src/experiments.py handoff/quan
git diff --cached --stat
git commit -m "24120219 - Q02/Q04: them cong cu do va du lieu"
git push -u origin work/quan-experiments
```

Nam có thể chỉ `git add handoff/nam`; Thiện/Phúc stage thư mục của mình và những file code thực sự sửa. Xem `git status` trước khi chọn file. `git add` thư mục sẽ stage cả file mới trong thư mục đó.

Sau khi push: mở repo trên GitHub → mở Pull Request với **base: main**, **compare: nhánh của bạn**. Trong PR ghi mã task, file bàn giao, điều đã kiểm tra, còn thiếu gì và người nhận. Mẫu PR đã được chuẩn bị trong `.github/PULL_REQUEST_TEMPLATE.md`.

**Đang làm mà main có cập nhật**, commit phần đang làm trước, rồi trên nhánh của mình:

```bash
git fetch origin
git merge origin/main
git push
```

Nếu có conflict, đọc và xử lý từng file; phối hợp với người đang sửa cùng file. Sau một PR đã merge, đợt việc mới nên tạo nhánh mới từ `main` mới nhất (có thể thêm hậu tố `-v2`) để tránh lẫn các đợt bàn giao.

## Ai sửa file nào?

| Phạm vi | Người làm chính | Cách phối hợp |
| --- | --- | --- |
| `Src/experiments.py`, dữ liệu và cách đo | Quân | Phúc đọc CSV; Nam dùng kết quả phân tích. |
| `Src/plot_experiments.py` nếu bổ sung; bảng/hình/video | Phúc | Đọc CSV Quân bàn giao, không đổi số đo. |
| Report tổng, mô hình hóa, kết luận | Nam | Mỗi chủ thuật toán tự viết phần mình; Nam ghép. |
| `member4_astar.py` và nội dung heuristic | Thiện | Thống nhất cost với Phúc. |
| `member5_ucs.py`, `costs.py` và policy cost | Phúc | Báo Quân/Thiện/Thức nếu policy thay đổi. |
| Engine/API/UI/levels/tests | Thức | Chủ solver báo lỗi; thống nhất trước khi thay luật/schema. |
| `handoff/shared/baseline.md` | Thức tổng hợp | Phúc xác nhận cost; Thiện xác nhận heuristic; Quân xác nhận cách đo. |

## Chốt bản code và cách đo (M0)

M0 chỉ là tên bước chuẩn bị. Điền [mẫu chung](shared/baseline.md), sau khi các phần cần chạy đã được gộp và kiểm tra.

- Quân chốt bộ màn và cách đo. Đề xuất 33 ID 1–33, bốn solver, mỗi trường hợp 3 lần, timeout 120 giây/lượt; các con số này là phương án tổ chức của nhóm.
- Phúc ghi công thức cost thực sự dùng; Thiện ghi heuristic tương ứng.
- Thức ghi mã commit và trạng thái kiểm tra. Mẫu hiện để **CHƯA CHỐT**, không tự coi commit đang có là bản đã đạt yêu cầu.
- Chưa cần ép mọi người chờ M0 để viết tài liệu hoặc phát triển công cụ. Chỉ chạy số liệu chính thức sau khi bản code/cách đo đã thống nhất.
- Nếu có thay đổi ảnh hưởng thuật toán, cost, heuristic, engine hoặc bộ đo sau đó, báo nhóm và cập nhật phiên bản; Quân xác định phần cần đo lại.

## Bàn giao giữa ba đầu mối

1. **Quân → Phúc + Nam:** `raw.csv`, `summary.csv`, nhóm màn, metadata, phương pháp và mô tả các cột.
2. **Phúc → Nam:** bảng trình bày, hình gốc, chú thích và video URL; Phúc tự viết kịch bản chi tiết/quay dựng.
3. **Nam → Phúc:** đề cương video ngắn, các ý cần thống nhất với report; phản hồi nội dung video nháp.
4. **Thiện + Phúc → Nam:** phần thuật toán, công thức, ví dụ và nhận xét chuyên môn đã kiểm tra.
5. **Nam + Phúc → Thức:** report PDF/nguồn chỉnh sửa, source sạch, YouTube URL và minh chứng để nghiệm thu.

## Cập nhật gì lên Git?

- Code, README, phần viết DOCX/Markdown, CSV/JSON dữ liệu, bảng/hình vừa dung lượng, kịch bản, phụ đề và URL video.
- Mỗi người giữ phần viết trong thư mục của mình. Nam phụ trách sửa report tổng để tránh nhiều người sửa cùng một file Word.
- MP4/MOV/MKV và file dựng video nặng lưu ngoài Git, gửi link. `handoff/phuc/video/video-url.txt` lưu URL YouTube công khai theo đề.
- `submission/`, môi trường ảo, node_modules, cache và file tạm không đưa vào Git. Source nộp và PDF cuối được Thức đóng gói sau nghiệm thu.
- Commit theo phần việc thực tế, có MSSV/mã task nếu thuận tiện; ghi người nhận và mức hoàn thành trong PR.

## Năm Issue gợi ý để theo dõi trên GitHub

Tạo một Issue cho mỗi dòng, gán đúng tài khoản của người nhận và dẫn link README của họ. Đây là hướng dẫn tạo Issue, chưa có Issue nào được bộ khung tự tạo.

| Nhóm mã task | Người nhận | Nội dung để lấy vào Issue |
| --- | --- | --- |
| `Q01–Q06` | Nguyễn Lê Minh Quân | [Danh sách task](quan/README.md) |
| `N01–N05` | Bùi Phương Nam | [Danh sách task](nam/README.md) |
| `H01–H04` | Tống Phúc Thiện | [Danh sách task](thien/README.md) |
| `P01–P06` | Phan Gia Phúc | [Danh sách task](phuc/README.md) |
| `T01–T05` | Phan Ngọc Thức | [Danh sách task](thuc/README.md) |

## Kiểm tra theo loại thay đổi

- Tài liệu: xem GitHub render, đường dẫn, số liệu và nội dung đúng phiên bản; không cần chạy lại solver chỉ vì sửa câu chữ.
- Code/cost/heuristic/engine: chạy kiểm tra phù hợp bằng `Src/run_tests.py`; `--cases` lọc lượt solver nhưng test nền vẫn chạy đầy đủ.
- Dữ liệu/biểu đồ: kiểm tra replay, đơn vị, trạng thái timeout và CSV nguồn. Các test solver đang có là nền tảng kiểm chứng, không thay cho bảng thực nghiệm.
- Không thay kỳ vọng kiểm thử chỉ để làm xanh test; nếu policy đổi, giải thích và đối chiếu lại mốc theo policy đã chốt.
