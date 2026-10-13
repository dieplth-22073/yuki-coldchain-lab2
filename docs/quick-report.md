# Quick Report — Ghi chú làm việc với AI (LAB-2)

**Bài:** LAB-2 — Prototype chạy thật, Next.js · Vercel · Supabase
**Case:** Hệ thống hỗ trợ nghiệp vụ chuỗi lạnh thực phẩm (bám đề LAB-1)
**Ngày:** 2026-10-13

---

## 1. Công cụ / skill đã dùng

| Công cụ | Dùng để làm gì |
|---|---|
| Claude Code | Sinh toàn bộ code: schema SQL, seed, 9 API route, 7 màn, middleware auth |
| `create-next-app` 15.5 | Dựng khung Next.js (App Router + TypeScript + Tailwind) |
| `@supabase/ssr` 0.7 | Client Supabase cho server/browser, quản lý session qua cookie |
| Browser automation | Bấm thử từng màn trên local và production — chỗ bắt được nhiều lỗi nhất |
| `node --test` | 8 test cho logic FEFO và日付逆転 |
| `curl` + script Python | Kiểm RLS, soi bundle production tìm giá trị biến môi trường |

Supabase project, tài khoản Vercel và user demo do mình (người học) tự tạo — AI không đăng ký tài khoản thay được.

---

## 2. Chỗ AI sinh sai — phát hiện và sửa thế nào

| # | Sai ở đâu | Phát hiện bằng | Nguyên nhân thật |
|---|---|---|---|
| 1 | **Nền trang đen, chữ bạc màu ở dark mode** | Chụp màn hình sau khi đăng nhập | `globals.css` mặc định của `create-next-app` có `body { background: var(--background) }` + block `prefers-color-scheme: dark`. Tailwind v4 để utility trong `@layer`, mà **CSS unlayered luôn thắng layered** bất kể specificity → class `bg-slate-50` trên `<body>` không bao giờ áp dụng. Light mode trông vẫn trắng nên không lộ |
| 2 | **Cột "引当" hiện `—` dù đã引当 xong** | Gọi `/api/orders` rồi đọc JSON | `allocations.order_id` có ràng buộc UNIQUE → PostgREST coi quan hệ là **one-to-one** và nhúng thành object, không phải array. Code AI viết `allocations[0]` nên luôn `undefined` |
| 3 | **Bấm引当 xong danh sách vẫn "未引当"**, panel vừa báo hoàn tất vừa hiện cảnh báo đỏ | Bấm thử trên UI | Gọi `onDone()` mà không `await`, và không ẩn bảng候補 cũ sau khi thành công |
| 4 | **Lệnh kiểm của chính mình báo "OK" khi đang lỗi** | Đọc kỹ output thấy có dòng lỗi TypeScript ngay phía trên chữ "OK" | Viết `npx tsc \| head -20 && echo OK` — exit code lấy từ `head` (luôn thành công) chứ không phải `tsc`. Sửa bằng cách tách lệnh và đọc `$?` |
| 5 | **`create-next-app` ghim bản Next dính CVE** | Đọc cảnh báo npm lúc cài | Mặc định lấy 15.5.4, có CVE-2025-66478. Nâng lên 15.5.27 (bản vá cùng dòng major) |

### Lỗi không phải do AI nhưng mất nhiều thời gian nhất

**Biến môi trường trên Vercel chứa toàn dấu `•`.** Sau khi deploy, đăng nhập production báo:

```
Failed to read the 'headers' property from 'RequestInit':
String contains non ISO-8859-1 code point.
```

Cách tìm ra: tải file JavaScript bundle mà production đang phục vụ, tìm chỗ gọi `createBrowserClient` rồi in ra đúng chuỗi đã nhúng. Kết quả là `eyJhbGci` + 200 ký tự `•` (U+2022) — tức là lúc copy anon key từ Supabase đã copy nhầm phần **đang bị che**, không phải key thật. Dấu `•` nằm ngoài Latin-1 nên trình duyệt từ chối đặt vào HTTP header.

Hai điểm rút ra:

- Thông báo lỗi của trình duyệt không hề nhắc tới "env" hay "key" — đoán mò sẽ đi sai hướng. Phải đi tìm giá trị thật đang chạy.
- Sửa biến môi trường thôi chưa đủ: `NEXT_PUBLIC_*` bị nhúng cứng vào JS lúc build, nên **bắt buộc redeploy** mới có hiệu lực.

Vercel còn không cho đổi biến từ kiểu `Secret` sang `Config` (secret là write-only), phải xoá hẳn rồi tạo lại.

---

## 3. Rút ra được gì

1. **Lỗi đáng sợ nhất là lỗi không báo gì.** Lỗi #1 và #2 không ném exception, không log, chỉ hiển thị sai. Cách duy nhất bắt được là mở app ra bấm và nhìn.
2. **Đọc output chứ đừng đọc chữ "OK".** Lỗi #4 là script kiểm tra của chính mình nói dối. Exit code trong pipe thuộc về lệnh cuối.
3. **Khi production khác local, đi tìm thứ đang thật sự chạy ở production.** Tải bundle đã build xuống đọc, đừng suy diễn từ source.
4. **Không tin phía client.** Route `allocate` tự chạy lại kiểm tra đảo ngày từ đầu thay vì nhận kết quả màn hình gửi lên — sửa request cũng không bỏ qua được luật.

---

## 4. Số giờ thực tế

| Tuần | Hạng mục | Số giờ |
|---|---|---:|
| Tuần 13/10 | Thiết kế schema, seed dựng kịch bản đảo ngày, viết API + 7 màn | 3,0 |
| Tuần 13/10 | Chạy thử từng màn, tìm và sửa 3 lỗi UI/dữ liệu | 1,5 |
| Tuần 13/10 | Dựng Supabase, deploy Vercel, gỡ lỗi biến môi trường | 1,5 |
| | **Tổng** | **6,0** |

> Ước lượng theo nhật ký làm việc, làm tròn 0,5h. Chưa tính thời gian đọc lại tài liệu LAB-1 để chốt phạm vi.

---

## 5. Kiểm chứng đã chạy

| Hạng mục | Kết quả |
|---|---|
| `npm test` | 8/8 pass |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | exit 0 |
| `npm run build` | exit 0 |
| RLS chặn truy cập ẩn danh | `curl` REST bằng anon key chưa đăng nhập → `[]` |
| Middleware chặn trang | `/` → 307 `/login?redirect=%2F` |
| Middleware chặn API | `/api/orders` → 307 `/login` |
| 7 màn trên local | Đã bấm thử từng màn, đọc lại DB đối chiếu |
| Đăng nhập + dashboard trên production | Đã chạy |
| Bundle production | Đã kiểm key nhúng đúng 208 ký tự, toàn ASCII |
