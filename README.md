# City Gym Face Recognition

Giai đoạn hiện tại: thư viện AI C# độc lập và frontend quản trị có đủ luồng Recognition, chế độ demo và HTTP adapter. Chưa xây dựng backend nghiệp vụ hoặc kết nối SQL Server.

Cấu hình mẫu được tách theo thành phần: [FE](fe/env.example), [BE](be/env.example), [AI](ai/env.example). Xem [hướng dẫn môi trường](doc/backend-environment.md) để điền dữ liệu. Các file này chưa được tự nạp; loader và API sẽ được xây dựng ở bước tiếp theo.

## Chạy frontend

Yêu cầu Node.js 20+; không cần npm install.

```powershell
node fe/server.mjs
```

Mở http://127.0.0.1:5173. Tài khoản demo: `manager@citygym.local` / `CityGymDemo!`.

- Tổng quan, thêm/sửa/xóa, tìm kiếm và lọc hội viên.
- Recognition: status, enroll, extract, identify bằng ảnh/feature, xóa embedding; FaceInfo và terminal/gallery.
- Chọn Demo hoặc Backend API tại màn hình login. Demo dùng kịch bản giả lập có nhãn rõ, không chạy AI trên ảnh. API mode chỉ hoạt động khi BE phục vụ FE cùng origin với `/api`.
- LocalStorage lưu hồ sơ và cấu hình; nhập/xuất bản sao JSON có kiểm tra định dạng.
- SessionStorage giữ phiên demo 8 giờ; không lưu mật khẩu.
- Ảnh và feature chỉ giữ tạm trong RAM; không lưu vào localStorage/bản sao JSON. Không lưu Device Key/Admin Key.
- Auth demo chỉ mô phỏng. API auth dùng session cookie từ BE và CSRF trong RAM; BE phải xác thực và phân quyền mọi request.
- Đổi origin/port/trình duyệt sẽ dùng kho dữ liệu khác. FE không tự nhận diện khuôn mặt khi chưa có API.

```powershell
node --test fe/tests/core.test.mjs fe/tests/recognition.test.mjs
```

## Chạy AI (Windows x64)

Yêu cầu .NET 8 SDK và native dependencies của OpenCvSharp. SDK riêng đã được chuẩn bị tại `.tools/dotnet/` trên máy phát triển này. Có thể thay đường dẫn bên dưới bằng `dotnet` nếu SDK đã có trong PATH.

```powershell
./ai/download-models.ps1
$env:DOTNET_CLI_HOME = Join-Path $PWD '.tools/dotnet-home'
$env:NUGET_PACKAGES = Join-Path $PWD '.tools/nuget'
./.tools/dotnet/dotnet.exe build ai/src/CityGym.AI.Cli/CityGym.AI.Cli.csproj
./.tools/dotnet/dotnet.exe run --project ai/src/CityGym.AI.Cli --no-build -- self-test
./.tools/dotnet/dotnet.exe run --project ai/src/CityGym.AI.Cli --no-build -- smoke-test ai/models
./.tools/dotnet/dotnet.exe run --project ai/src/CityGym.AI.Cli --no-build -- pipeline-test ai/models C:/path/to/single-face.jpg
./.tools/dotnet/dotnet.exe run --project ai/src/CityGym.AI.Cli --no-build -- extract ai/models C:/path/to/face.jpg
./.tools/dotnet/dotnet.exe run --project ai/src/CityGym.AI.Cli --no-build -- compare ai/models C:/path/to/enroll.jpg C:/path/to/probe.jpg 0.5
```

`0.5` chỉ là ngưỡng minh họa, chưa được hiệu chỉnh cho City Gym. `extract` xuất JSON có embedding; không đưa output này vào log công khai.

## Cấu trúc

- `ai/src/CityGym.AI`: detect, align, extract, normalize, binary codec và cosine search.
- `ai/src/CityGym.AI.Cli`: chạy AI thực và kiểm thử không cần BE.
- `ai/models`: manifest và model ONNX đã kiểm tra SHA-256; binary không commit Git.
- `fe`: HTML/CSS/JavaScript thuần và static server chỉ lắng nghe localhost.
- `fe/js/management-client.js`: adapter workspace local/HTTP.
- `fe/js/recognition-client.js`: adapter Recognition demo/HTTP.
- `be`: dành cho bước tích hợp tiếp theo.
- `doc/backend-integration.md`: hợp đồng và thông tin cần khi nối BE.
- `doc/management-api-contract.md`: API contract cụ thể FE đang sử dụng, để xây BE tiếp theo.
- `doc/fe-completion.md`: chức năng FE và kết quả kiểm thử mới nhất.

Mô hình lấy từ [OpenCV Zoo](https://github.com/opencv/opencv_zoo). Kiểm tra giấy phép từng model trong [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) và [SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface). Wrapper: [OpenCvSharp](https://github.com/shimat/opencvsharp).

.NET 8 hết hỗ trợ ngày 10/11/2026 theo [Microsoft](https://dotnet.microsoft.com/en-us/platform/support/policy); cần lên kế hoạch nâng runtime khi triển khai lâu dài.
