# Hợp đồng tích hợp sau giai đoạn AI + FE

## AI độc lập

Backend tham chiếu `ai/src/CityGym.AI/CityGym.AI.csproj` và quản lý vòng đời `FaceEngine`. Gọi `Extract(byte[])` để nhận `FaceFeature` gồm Model, Pipeline, Vector (128 float), DetectionScore. Engine tuần tự hóa truy cập model native; nếu cần throughput cao, mỗi worker có một engine riêng và hàng đợi giới hạn.

`FeatureMath.Identify(probe, authorizedGallery, threshold)` tìm cosine cao nhất. Backend phải lọc terminal, identity active, mapping và embedding active trước khi cung cấp gallery. Thư viện AI không tự xác thực hoặc truy vấn database.

`Serialize` / `Deserialize` dùng float32 little-endian 512 byte, chuẩn hóa L2; metadata model/pipeline phải lưu riêng trong SQL Server. Không trộn vector từ model khác dù cùng 128 chiều.

Lỗi input: INVALID_IMAGE, IMAGE_TOO_LARGE, NO_FACE, MULTIPLE_FACES, INVALID_LANDMARKS, INVALID_FEATURE, INCOMPATIBLE_FEATURE, EMPTY_GALLERY. Chưa có liveness hoặc chống ảnh giả.

Ảnh giới hạn 10 MB và 24 megapixels sau decode, thu nhỏ giữ tỷ lệ về cạnh dài tối đa 640 và đệm đen thành 640×640 cho YuNet. Ngưỡng detection 0,9; khuôn mặt nhỏ/mờ có thể không vượt ngưỡng. Khi public API cần chặn ảnh kích thước bất thường trước native decode và giới hạn tài nguyên worker; đây chưa phải lớp tiếp nhận upload công khai.

NuGet OpenCvSharp được pin ở 4.13.0.20260627 có FaceDetectorYN nhưng chưa có FaceRecognizerSF. SFace chạy trực tiếp qua OpenCV DNN, căn chỉnh similarity 5 điểm về 112×112; RGB, scale 1, không trừ mean theo OpenCV. Pipeline ID hiện tại: `yunet2023mar-similarity5-sface128-v1`. Không coi embedding của pipeline khác là tương thích tự động.

## Frontend quản trị

FE đã có LocalManagementClient/HttpManagementClient và DemoRecognitionClient/HttpRecognitionClient. Login có chế độ demo hoặc API Manager. Xem `management-api-contract.md` để triển khai BE tương ứng. Không xem trạng thái đăng nhập local là quyền truy cập backend.

Thông tin cần cung cấp ở bước tiếp theo:

- Base URL, định dạng response/error và API contract.
- Auth: cookie/token, login/logout/session, role management, CSRF/CORS nếu cần.
- CRUD hội viên, mapping FaceInfo ID và terminal.
- API enroll/identify/delete embedding và giới hạn upload.
- Quy tắc lưu ảnh, retention, quyền truy cập, SQL schema hiện hữu.

FE đã có đủ thao tác recognition và trạng thái service. Demo hiển thị nhãn mô phỏng, dùng fixture riêng và không phân tích ảnh. API mode gửi request thật, không fallback về demo khi lỗi. Không tự động đẩy dữ liệu local lên BE; cần mapping ID và chiến lược import rõ ràng.

## Kiểm chứng cần tiếp tục

Kiểm tra cùng người ở hai ảnh khác nhau, nhiều người chưa đăng ký, ảnh không mặt/nhiều mặt, FAR/FRR, độ trễ và tải đồng thời. Self-test toán học và smoke-test model không chứng minh độ chính xác ngoài thực tế.
