# Cấu hình môi trường FE / BE / AI

Các file mẫu đã tách theo thành phần, không còn file env chung tại thư mục gốc:

| File mẫu | Nội dung | Nơi sử dụng dự kiến |
| --- | --- | --- |
| `fe/env.example` | Host/port preview, API base path, timeout và chế độ UI; chỉ cấu hình public | Launcher FE và cấu hình public cho browser |
| `be/env.example` | .NET host, SQL Server, Manager, cookie/CSRF, Data Protection, static hosting và HTTP body limit | Tiến trình BE |
| `ai/env.example` | Model directory, workers, queue, timeout recognition, threshold và giới hạn ảnh | AI module trong tiến trình BE |

Chưa có loader đọc các file này. FE vẫn dùng các giá trị trong code; AI CLI vẫn nhận tham số dòng lệnh. Tách file cấu hình không tạo thêm AI service hoặc endpoint mới.

Khi triển khai: launcher BE nạp `be/.env` và `ai/.env` trước khi tạo WebApplication builder; biến môi trường đã được hệ thống inject được ưu tiên, không ghi đè âm thầm. FE chỉ đọc các khóa public trong `fe/.env`, không đọc hoặc phát hành `be/.env`/`ai/.env` ra browser. `Frontend__RootDirectory` ở BE vì .NET là bên phục vụ static files; host/port trong FE dành cho Node preview.

## Thông tin cần điền

| Nhóm | Thông tin cần chuẩn bị |
| --- | --- |
| SQL Server | Host/instance hoặc host,port; tên database; SQL login/password hoặc Windows Authentication; DB mới hay DB City Gym hiện hữu |
| Manager | Email, tên hiển thị, mật khẩu riêng để bootstrap tài khoản đầu tiên |
| Đường dẫn | Thư mục model AI, static FE và thư mục Data Protection có quyền ghi |
| Hosting | URL/port local; khi triển khai thật cần domain, HTTPS và allowed hosts tương ứng |
| AI | Số worker, queue và threshold ban đầu; sau đó hiệu chỉnh bằng dữ liệu thật |

Không cần điền JWT secret vì FE sử dụng session cookie HttpOnly và CSRF. Không dùng mật khẩu demo của FE làm mật khẩu Manager thật. Device/Admin credentials theo tài liệu cũ là cơ chế riêng cho service/kiosk, không phải dữ liệu cần nhúng vào frontend Manager.

## Sử dụng

```powershell
# Chạy từ thư mục gốc, chỉ tạo file còn thiếu.
foreach ($component in @('fe', 'be', 'ai')) {
    $componentEnvPath = Join-Path $component '.env'
    if (-not (Test-Path -LiteralPath $componentEnvPath)) {
        Copy-Item -LiteralPath (Join-Path $component 'env.example') -Destination $componentEnvPath
    }
}
```

Sau đó chỉnh `be/.env` (SQL/Manager), `ai/.env` (đường dẫn/model processing), `fe/.env` (thiết lập public UI) bằng editor. Không cần gửi mật khẩu thật qua chat. `.gitignore` đã loại `.env` ở cả ba thư mục.

ASP.NET Core mặc định đọc biến môi trường của process, không tự nạp file `.env`. Khi xây BE sẽ thêm launcher/loader phù hợp trước lúc tạo WebApplication builder; không chạy nội dung `.env` bằng Invoke-Expression. Việc copy file chưa làm API chạy được.

Tên biến dùng `__` cho cấu hình phân cấp, ví dụ `ConnectionStrings__CityGym` ánh xạ thành `ConnectionStrings:CityGym`. Đây là quy ước của [ASP.NET Core configuration](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?view=aspnetcore-8.0). `launchSettings.json` có thể ghi đè URL; khi dùng cấu hình env để chạy BE cần thống nhất launch profile hoặc dùng `--no-launch-profile`.

## Ý nghĩa và ràng buộc khi triển khai BE

- `ASPNETCORE_*`, `AllowedHosts`, `Logging__*` là các khóa theo cấu hình ASP.NET Core thông thường. Những section khác cần được bind và validate bằng code BE.
- SQL connection string mẫu có placeholder. BE phải từ chối cấu hình chưa thay thế. Nếu dùng named instance có thể thay `Server=localhost,1433` bằng instance thực tế. Windows Authentication chạy bằng tài khoản tiến trình API.
- Giữ `Database__ApplyMigrationsOnStartup=false` cho tới khi đối chiếu schema. Không chạy migration hoặc seed trên DB hiện hữu chỉ vì có connection string.
- Bootstrap Manager mặc định tắt. Khi triển khai lần đầu, điền email/password, bật bootstrap, tạo tài khoản với password hash; lần sau tắt bootstrap và bỏ password bootstrap khỏi môi trường. Không cập nhật mật khẩu tài khoản đã tồn tại theo biến này.
- Data Protection phải được cấu hình lưu khóa lâu dài để cookie không mất hiệu lực sau restart. Windows local có thể bảo vệ khóa bằng DPAPI khi triển khai; production cần cơ chế bảo vệ khóa và shared key ring nếu có nhiều instance.
- FE và `/api` cùng origin: ví dụ mở FE tại `http://localhost:5088/`. File env này không cấu hình Node demo server tại 5173 hoặc tự tạo proxy/CORS.
- Đường dẫn mẫu là absolute theo workspace hiện tại; thay chúng khi chuyển máy hoặc publish. Static middleware chỉ phục vụ thư mục FE, không phục vụ project root, `.env`, `.local` hoặc model.
- Worker count, queue và timeout là thiết kế BE sắp triển khai. Mỗi worker sở hữu một FaceEngine; timeout phải bao gồm thời gian chờ. Cancellation native inference cần được quản lý riêng, không giả định hủy HTTP sẽ dừng OpenCV tức thì.
- `Recognition__SimilarityThreshold=0.5` trong `ai/.env` chỉ là giá trị khởi đầu cho cosine matching; không phải accuracy đã được kiểm chứng.
- Detection threshold 0.9, canvas 640×640, model/pipeline và số chiều hiện do thư viện AI định nghĩa. Không đưa biến giả cho các giá trị này để tránh tưởng rằng đổi env sẽ đổi engine.
- Giới hạn upload mẫu trùng FE/AI hiện tại: 10 MiB và 24 megapixels. Tổng HTTP body 11 MiB cho multipart. BE phải áp dụng cả limit request, limit file và kiểm tra ảnh; nâng limit phải đối chiếu cả FE/AI.
- Giá trị local `TrustServerCertificate=True` và `CookieSecurePolicy=SameAsRequest` phục vụ HTTP/local SQL. Khi triển khai HTTPS và chứng chỉ SQL hợp lệ: dùng `CookieSecurePolicy=Always`, `TrustServerCertificate=False`, môi trường Production và AllowedHosts phù hợp.

API dự kiến đã được mô tả tại `management-api-contract.md`. File env không chứa model weights, schema SQL, API implementation hoặc dữ liệu hội viên.
