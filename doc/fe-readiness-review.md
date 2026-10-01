# Đối chiếu frontend với Technical Guide — 01/10/2026

## Kết luận

FE hiện đủ làm bản demo quản lý hồ sơ local; chưa đủ cho các luồng Face Recognition trong tài liệu. Việc thư viện AI chạy được không đồng nghĩa FE đã tích hợp AI. Thư mục `be/` hiện trống, chưa có API thực để xác minh end-to-end.

Nguồn đối chiếu: `City_Gym_Face_Recognition_Technical_Guide.docx.md`, `fe/index.html`, `fe/js/app.js`, `fe/js/auth.js`, `fe/js/storage.js`, `fe/js/management-client.js` và bộ kiểm thử FE.

## Ma trận chức năng

| Chức năng | Technical Guide | FE thực tế | Việc cần chuẩn bị trước/khi nối BE |
| --- | --- | --- | --- |
| Login / Authentication | Mục 7, 13, 16: Terminal ID + Device Key; tác vụ admin cần thêm Admin Key. Chưa đặc tả login Manager bằng email/mật khẩu | Có form login/logout, thông tin demo cố định, phiên SessionStorage 8 giờ | Contract login/logout/current-session; BE xác thực Manager, phân quyền và ánh xạ quyền terminal. Không coi role hiển thị trên FE là quyền thật |
| Recognition Service status | Mục 12–13: health, ready, workerCount, active, pending, enrolledFaces | Chỉ nhãn tĩnh “Chưa kết nối”; recognitionStatus() là stub và chưa được UI gọi | Nút refresh/trạng thái tải/lỗi; hiển thị các field thật theo terminal; phân biệt health và số lượng gallery |
| Enroll khuôn mặt | Mục 3, 16, 24.4 | Chưa có | Chọn FaceInfo + terminal, chọn/xem trước ảnh, multipart upload, xử lý lỗi và refresh embedding/gallery sau thành công |
| Extract face feature | Mục 9, 16.5 | Chưa có | Gửi ảnh, nhận vector + model/version/pipeline/dimension; giữ trong RAM và có nút clear |
| Identify bằng ảnh | Mục 8, 16.3–16.4 | Chưa có | Gửi ảnh theo terminal, hiển thị found/không match, identity và score; không yêu cầu FaceInfo ID đầu vào |
| Identify bằng feature | Mục 9, 16.6 | Chưa có | Gửi feature tương thích đã extract, không gửi lại ảnh; disable khi chưa có feature; clear khi đổi ảnh/terminal/logout |
| Xóa embedding | Mục 17 | Chưa có | Chọn embedding/FaceInfo và pipeline theo API contract; xác nhận, xử lý lỗi, refresh status/gallery; không xóa hồ sơ hội viên |
| Xem FaceInfo | Mục 5 và 24.2: metadata và truy vấn SQL | Chưa có màn hình FaceInfo; members local không có faceInfoId hoặc embedding metadata | Danh sách/chi tiết FaceInfo, trạng thái và metadata embedding; hợp đồng mapping memberId ↔ faceInfoId |
| Xem Terminal / gallery | Mục 6 và 24.3: mapping, SQL và giới hạn phạm vi | Chưa có | Danh sách terminal được phép truy cập, chọn terminal, xem gallery và số embedding active; cần endpoint đọc danh sách |
| Member CRUD | Chưa đặc tả trong guide | Có create/read/update/delete, tìm kiếm, lọc local | Chốt nghiệp vụ member và API riêng; chưa thể coi CRUD local là CRUD FaceInfo |
| Locker | Chưa đặc tả; mục 20 nói chưa chứng minh mở locker thật | Chưa có | Ngoài phạm vi hiện tại, cần nghiệp vụ/API thiết bị trước khi bổ sung |
| Dashboard/statistics | Chưa đặc tả dashboard nghiệp vụ; có runtime status | Có tổng member, member active, danh sách gần đây từ localStorage | Nếu dùng dashboard BE cần chốt chỉ số và nguồn dữ liệu; không coi số member là enrolledFaces |
| User/role management | Chưa đặc tả | Chưa có CRUD user/role; nhãn Management là tĩnh | Có thể không cần màn hình quản lý user/role nếu chỉ một Manager; BE vẫn cần tài khoản và kiểm tra quyền |

## Khoảng trống kỹ thuật khi tích hợp

- `LocalManagementClient` chỉ đọc/ghi localStorage và có status stub; chưa có HTTP client cho recognition hoặc auth server.
- FE chưa có chọn ảnh, preview, quản lý feature trong RAM, chọn FaceInfo/terminal hay vùng kết quả nhận diện.
- Chưa có xử lý response recognition: NO_FACE, MULTIPLE_FACES, EMPTY_GALLERY, feature không tương thích, found=false/true. Chưa có xử lý 401/403, service chưa ready, timeout hoặc request recognition đang chạy.
- Session và storage hiện phục vụ demo. Không lưu embedding, ảnh, Device Key hoặc Admin Key vào localStorage khi bổ sung tính năng.
- Server FE hiện là Node static server localhost:5173. Khi tích hợp .NET cần phục vụ static files cùng origin hoặc cấu hình origin/CORS/CSP rõ ràng; CSP hiện chỉ cho kết nối cùng origin.
- Tài liệu nêu rõ đường dẫn status/enroll/identify image/identify feature; extract/delete và API danh sách FaceInfo/terminal cần chốt contract đầy đủ, không suy ra API đã tồn tại chỉ vì có SQL hoặc nút được mô tả.
- Pipeline thực hiện hiện dùng `yunet2023mar-similarity5-sface128-v1`; guide mô tả pipeline cũ `yunet2023mar-align-sface128-v1`. FE/BE phải dùng metadata từ service và kiểm tra tương thích, không hard-code pipeline cũ.

## Thứ tự bổ sung đề xuất

1. Chốt auth Manager và hợp đồng HTTP/error. Xác định cách BE quản lý Device/Admin credentials và phạm vi terminal.
2. Màn hình trạng thái service, FaceInfo và terminal/gallery dạng đọc.
3. Màn hình quản trị Recognition: enroll, extract, identify image, identify feature, delete embedding; có loading/error/empty state và xác nhận xóa.
4. Nối HTTP adapter, kiểm thử end-to-end theo quy trình mục 16–17 của guide.
5. Chốt member CRUD/dashboard riêng theo yêu cầu nghiệp vụ. Locker và user management chưa phải điều kiện hoàn tất PoC recognition.

## Tiêu chí nghiệm thu FE recognition

- Không thao tác được tác vụ admin khi BE từ chối quyền; hết phiên được đưa về login.
- Chọn terminal đúng phạm vi; gallery và kết quả được lấy từ BE.
- Không biến NO_FACE hoặc EMPTY_GALLERY thành found=false; hiển thị đúng kết quả/lỗi.
- Identify image không yêu cầu chọn identity đích.
- Identify feature dùng vector hiện hành, không dùng nhầm feature cũ sau đổi ảnh/terminal/logout.
- Enroll và delete refresh dữ liệu từ BE. Delete embedding không gọi delete member.
- Ảnh và feature không bị ghi vào localStorage hoặc bản sao hồ sơ JSON.
- Không hiển thị kết quả nhận diện giả khi BE chưa kết nối.

## Kiểm thử đã thực hiện trong lần rà soát

- 8/8 tests auth/storage đạt: roundtrip, trùng mã, loại trường ngoài schema, import lỗi không ghi đè, dữ liệu hỏng, lỗi quota, auth demo, hết phiên.
- Kiểm tra cú pháp `app.js`: đạt.
- Browser smoke trên Chrome headless đạt: login, tạo/sửa, lưu qua reload, tìm kiếm, xóa, không tràn ngang mobile, logout.
- Sửa lỗi phạm vi biến `const f` trong browser-smoke test để bài kiểm tra chạy hết; không bổ sung tính năng recognition trong lần rà soát này.
- Chưa kiểm thử API/backend vì chưa có implementation và contract kết nối.
