# Kiểm tra AI Image Pipeline — 01/10/2026

Phạm vi: thư viện C# .NET 8, OpenCvSharp4 4.13.0.20260627, Windows x64, CPU. Chưa tích hợp HTTP upload, backend nghiệp vụ hoặc SQL Server.

## Kết quả

- Build: thành công, 0 warning, 0 error.
- Self-test toán học/feature: 8/8 đạt.
- Smoke test: model nạp thành công, ảnh trống trả NO_FACE.
- Pipeline test native: 9/9 đạt, YuNet detection score ảnh mẫu 0.9089792; SFace trả 128 giá trị hữu hạn, L2 norm bằng 1 trong sai số 1e-5.

| Kiểm tra | Kết quả |
| --- | --- |
| Bytes không phải ảnh | INVALID_IMAGE |
| Ảnh trống | NO_FACE, dừng trước căn chỉnh/trích xuất |
| Một mặt hợp lệ | Trích xuất 128 float hữu hạn |
| Chuẩn hóa | Vector có L2 norm xấp xỉ 1 |
| Serialize embedding | 512 byte, float32 little-endian |
| Ảnh mẫu ở độ phân giải gốc | YuNet phát hiện đúng một mặt |
| Ghép hai vùng mặt rõ | MULTIPLE_FACES, dừng trước SFace |
| Ảnh xoay 15°, scale 0.85 | Hoàn tất pipeline, 128 chiều |
| Căn chỉnh hình học | Khôi phục phép xoay, scale và tịnh tiến đã biết; sai số < 1e-8 |

Ảnh mẫu tải từ [OpenCV samples/data/lena.jpg](https://github.com/opencv/opencv/blob/master/samples/data/lena.jpg), đặt riêng trong `.tools/test-data/`, không phải ảnh người dùng. Ảnh ghép, ảnh xoay và ảnh đã căn chỉnh chỉ tồn tại trong RAM.

## Thực hiện

`FaceEngine.Extract(byte[])` decode trong RAM; YuNet phát hiện trên canvas 640×640, giữ tỷ lệ ảnh; yêu cầu đúng một detection vượt ngưỡng 0,9. `SFaceExtractor` dùng năm landmark để tính similarity transform, warp về 112×112, sau đó chạy SFace ONNX qua OpenCV DNN. Không có thao tác ghi ảnh vào disk/database trong thư viện.

Đã sửa lỗi build do FaceRecognizerSF không tồn tại trong bản NuGet đã phát hành. Phần SFace sử dụng DNN trực tiếp theo [tiền xử lý tham chiếu OpenCV](https://github.com/opencv/opencv/blob/4.x/modules/objdetect/src/face_recognize.cpp). Analyzer đi kèm package cần Roslyn mới hơn .NET 8 được loại riêng; các analyzer mặc định vẫn hoạt động.

## Giới hạn bằng chứng

Hai ảnh mẫu nguyên kích thước ghép ngang rồi thu nhỏ có mặt nhỏ không đạt ngưỡng 0,9 và trả NO_FACE. Test nhiều mặt đạt khi ghép hai vùng mặt rõ. Quy tắc một mặt áp dụng trên các detection hợp lệ; không bảo đảm phát hiện mọi mặt ngoài thực tế.

Ảnh xoay là biến thể của cùng ảnh mẫu, không phải ảnh chụp độc lập. Chưa đánh giá FAR/FRR, nhận diện nhiều người, liveness, độ mờ/che khuất hoặc hiệu năng tải. Cần ảnh City Gym thực tế để kiểm chứng tiếp.

## Chạy lại

```powershell
./.tools/dotnet/dotnet.exe ai/src/CityGym.AI.Cli/bin/Debug/net8.0/CityGym.AI.Cli.dll self-test
./.tools/dotnet/dotnet.exe ai/src/CityGym.AI.Cli/bin/Debug/net8.0/CityGym.AI.Cli.dll smoke-test ai/models
./.tools/dotnet/dotnet.exe ai/src/CityGym.AI.Cli/bin/Debug/net8.0/CityGym.AI.Cli.dll pipeline-test ai/models .tools/test-data/opencv-lena.jpg
```
