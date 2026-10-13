# Danh sách màn hình / tính năng bản chốt — LAB-2

**Case:** RFP YCL-RFP-2026-01 v2.0 — Hệ thống hỗ trợ nghiệp vụ chuỗi lạnh thực phẩm
**Stack:** Next.js 15 (App Router) · Supabase (Auth + Postgres + RLS) · Vercel

LAB-1 chốt 48 màn hình / 36 function / 16 feature. LAB-2 dựng **7 màn** — phần xương sống
của đề. Tài liệu này nói rõ: màn nào làm thật, cắt gì so với LAB-1 và vì sao, chỗ nào là mock.

---

## 1. Màn hình đã dựng

| # | Màn hình | Path | LAB-1 | Làm thật tới đâu |
|---|---|---|---|---|
| 1 | ログイン | `/login` | F-035 | **Thật.** Supabase Auth email+password. Chưa đăng nhập thì không vào được màn nào, kể cả API route |
| 2 | ダッシュボード | `/` | — | **Thật.** Đếm tồn kho / đơn chưa引当 / lô cách ly /逸脱 chưa đóng, và lô sắp hết hạn trong 14 ngày. Tất cả query thẳng từ Supabase |
| 3 | 入荷・検品 | `/receiving` | F-002, F-004, F-005 | **Thật.** Ghi lô mới. Nhiệt độ đo được nằm ngoài ngưỡng của dải nhiệt → tự động chuyển trạng thái 隔離 ngay khi lưu. Ngưỡng đọc từ bảng `temp_thresholds`, không hard-code |
| 4 | 在庫一覧 | `/inventory` | F-010, F-011 | **Thật.** Sắp theo hạn sử dụng, lọc theo trạng thái / SKU / mã lô. Lô 隔離 hiện kèm lý do |
| 5 | **受注・引当** | `/orders` | F-012, F-013 | **Thật — đây là màn lõi.** FEFO chọn lô, đối chiếu lịch sử giao hàng cùng khách + cùng SKU để bắt **日付逆転** (giao lô hết hạn sớm hơn lô đã giao trước đó). Chặn引当, đề xuất lô thay thế, muốn vẫn làm thì bắt nhập lý do và ghi thành 逸脱 |
| 6 | 出荷前チェック | `/predispatch` | F-016 | **Thật.** Nhiệt độ xe / hàng ngoài ngưỡng → tạo 逸脱 và chặn xuất. Chỉ đơn đạt mới chuyển sang 出荷済 |
| 7 | トレーサビリティ検索 | `/traceability` | F-028 | **Thật.** Ba lane: mã lô nội bộ / vùng trồng gạo / số nhận dạng cá thể bò. Truy ngược tới đơn và khách. Chỗ nào hết dữ liệu thì ghi rõ "record dừng tại đây", không đoán |

### Màn lõi — kịch bản demo 日付逆転

Dữ liệu seed dựng sẵn đúng tình huống đề bài nêu:

1. Khách **C-001 サンライズ食品** đã được giao `SKU-R001` hạn **2027-03-31** (bảng `delivery_history`)
2. Tồn kho hiện có lô `LOT-2601-001` hạn **2027-01-31** — FEFO sẽ chọn lô này trước
3. Mở đơn `ORD-26-0001` → bấm 引当を検討 → app cảnh báo đỏ: lô này hết hạn **sớm hơn** lô đã giao
4. App đề xuất `LOT-2601-002` (hạn 2027-05-31) không gây đảo ngày
5. Nếu vẫn chọn lô vi phạm → bắt buộc nhập lý do → lưu vào bảng `deviations`

Đơn `ORD-26-0002` (khách C-002) là ca sạch để đối chiếu — FEFO chạy bình thường, không cảnh báo.

---

## 2. Cắt gì so với LAB-1 và vì sao

| Bỏ khỏi phạm vi | LAB-1 | Lý do |
|---|---|---|
| Phân quyền theo vai trò (RBAC) | 10 role, ma trận 360 ô | Mọi user đăng nhập hiện có quyền như nhau. Làm đủ 360 ô vượt xa khối lượng một lab prototype, mà cũng không chứng minh thêm được gì về "FE + BE chạy thật" |
| Tách người lập / người duyệt (maker-checker) | NFR-SEC-02, F-009, F-033 | Phụ thuộc vào RBAC ở trên |
| Nhập CSV từ datalogger | F-024, F-025 | Cần file mẫu của thiết bị và cơ chế idempotent theo hash. Trong LAB-2, nhiệt độ nhập tay ở màn 出荷前チェック — vẫn chạy qua đúng logic so ngưỡng |
| Lập tuyến, kiểm giờ lái xe | F-019 ~ F-023 | Cần dịch vụ bản đồ bên thứ ba. Đề cho phép mock tích hợp ngoài, nhưng mock cả một nhánh nghiệp vụ thì không còn là "chạy thật" nên bỏ hẳn |
| POD, màn hình tài xế | F-017 | Cần thiết bị di động và hàng đợi offline mã hoá. Ngoài tầm prototype web |
| Báo cáo, xuất bằng chứng kiểm toán | F-031, F-032 | Là tầng đọc, không thêm bằng chứng về BE chạy thật |
| Màn quản trị master | F-033, F-034 | Master nằm sẵn trong seed. Ngưỡng nhiệt độ vẫn đọc từ bảng nên sửa trong DB là đổi hành vi ngay, không cần sửa code |
| Quản lý phiên bản rule theo ngày hiệu lực | F-034 | Bảng `temp_thresholds` có cột `version` nhưng chưa chuyển phiên bản theo ngày |

---

## 3. Phần mock / đơn giản hoá — khai rõ

| Chỗ nào | Hiện đang | Làm thật thì cần gì |
|---|---|---|
| **Dữ liệu trong DB** | Seed sẵn bằng `supabase/seed.sql` (3 khách, 3 NCC, 6 SKU, 12 lô, 4 đơn) | Đề bài yêu cầu đúng như vậy. Thật thì lấy từ ERP qua SFTP (IF-ERP-01 trong LAB-1) |
| **Lịch sử giao hàng** `delivery_history` | Seed sẵn, coi như dữ liệu trước khi hệ thống chạy | Phải sinh ra từ chính màn POD khi giao xong. LAB-2 không có màn POD nên seed thay |
| **引当 chỉ trong một lô** | Không đủ số lượng trong một lô thì báo không引当 được | Cần chia引当 nhiều lô + cộng dồn số lượng |
| **引当 chưa nguyên tử** | Đọc rồi ghi qua REST. Hai request đồng thời về lý thuyết có thể引当 vượt tồn | LAB-1 F-013 đòi nguyên tử. Thật thì viết Postgres function (RPC) gói trong một transaction có `select ... for update`, rồi gọi RPC thay vì ghi từng bảng |
| **Nhiệt độ nhập tay** | Người dùng gõ ở màn 出荷前チェック | Nhập CSV từ datalogger, idempotent theo hash file |
| **Chưa có nhật ký kiểm toán append-only** | Chỉ ghi `deviations` khi vi phạm | LAB-1 NFR-AUD-01 đòi ghi sự kiện chỉ-thêm cho mọi thao tác quan trọng |
| **Không gửi thông báo** | Cảnh báo chỉ hiện trên màn hình | Thật thì cần email/in-app notification khi có 逸脱 |

**Không có chỗ nào là ảnh tĩnh hay click-through.** Cả 7 màn đều gọi API route thật →
Supabase thật, đọc và ghi thật. Phần ghi (入荷 / 引当 / 出荷前チェック) đều thay đổi dữ liệu
trong DB và thấy được ngay ở các màn khác.

---

## 4. Kiểm chứng

| Cổng | Kết quả |
|---|---|
| `npm test` | 8/8 pass — FEFO (gồm tie-break theo giờ nhập) và 日付逆転 |
| `npm run build` | exit 0 |
| `npx eslint .` | exit 0, không warning |
| `npx tsc --noEmit` | exit 0 |

Logic FEFO và đảo ngày nằm ở `src/lib/allocation.ts` dưới dạng hàm thuần, không đụng DB —
nên test được trực tiếp, và API route lẫn màn hình đều gọi chung một hàm, không viết lại luật hai nơi.

Phía server **không tin kết quả client gửi lên**: route `allocate` tự chạy lại kiểm tra đảo ngày
từ đầu, nên dù có sửa request cũng không bỏ qua được luật.
