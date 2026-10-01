**CITY GYM**

**FACE RECOGNITION SERVICE**

Tài liệu kỹ thuật, kiểm thử và hướng dẫn demo

| Mục tiêu tài liệuMô tả chính xác cách PoC Face Recognition hiện tại hoạt động từ Browser Lab → API → AI Engine → SQL Server; giải thích cách enroll, identify, feature search, authentication, dữ liệu lưu trữ, kết quả kiểm thử và phạm vi những gì PoC đã/chưa chứng minh. |
| :---- |

Phiên bản tài liệu: 1.0  
Ngày: 29/09/2026  
Trạng thái: Local PoC / Demo Ready

# **Mục lục**

1\. Tổng quan kiến trúc và nguyên tắc lưu dữ liệu

2\. Các thành phần hệ thống hiện tại

3\. Quy trình Enroll Image

4\. Cấu trúc embedding và dữ liệu SQL

5\. FaceInfo ID và quan hệ dữ liệu

6\. Terminal ID và gallery theo terminal

7\. Device Key và Admin Key

8\. Quy trình Identify Image 1:N

9\. Quy trình Extract Feature và Identify Feature

10\. Ý nghĩa các trạng thái và lỗi

11\. Ba ảnh test hiện tại

12\. Các tầng kiểm thử đã thực hiện

13\. Service runtime và authentication

14\. Kết quả runtime thực tế

15\. Ý nghĩa và giới hạn của found=true

16\. Hướng dẫn test bằng Lab từ A đến Z

17\. Reset và test lại toàn bộ dữ liệu

18\. Vai trò của scripts/local.http

19\. PoC đã chứng minh được gì

20\. PoC chưa chứng minh được gì

21\. Bước tiếp theo để demo mạnh hơn

22\. Checklist demo với lead

23\. Câu trả lời ngắn khi lead hỏi

24\. Phụ lục SQL và request mẫu

# **1\. Tổng quan kiến trúc và nguyên tắc lưu dữ liệu**

Điểm quan trọng nhất: hệ thống không insert trực tiếp file JPG vào SQL Server. Ảnh chỉ là dữ liệu đầu vào tạm thời cho Face Recognition API. Sau khi xử lý, server lưu vector đặc trưng của khuôn mặt (face embedding) vào database.

| Không phải:Ảnh JPG   ↓SQL ServerMà là:Ảnh JPG   ↓Face Recognition API   ↓Phát hiện khuôn mặt (YuNet)   ↓Căn chỉnh khuôn mặt   ↓Trích xuất đặc trưng (SFace)   ↓Vector khuôn mặt 128 chiều   ↓SQL Server |
| :---- |

| Kết luậnDatabase lưu đặc trưng toán học của khuôn mặt, không phải lưu trực tiếp file ảnh dùng để nhận diện. |
| :---- |

# **2\. Các thành phần hệ thống hiện tại**

| Browser Labhttp://localhost:5088/lab/index.html          │          │ HTTP Request \+ Image / Feature          ▼Face Recognition API (.NET)          │          ├── YuNet: Face Detection          ├── Align: Face Alignment          ├── SFace: 128-D Feature Extraction          │          ▼SQL ServerDatabase: CityGymFaceLocal          │          ├── FaceInfos          ├── Terminal\_FaceInfos          ├── FaceServiceDevices          └── FaceEmbeddings |
| :---- |

| Thành phần | Vai trò |
| ----- | ----- |
| **Lab UI** | Giao diện test; nhận credentials, FaceInfo ID, ảnh; gọi API và hiển thị response. |
| **.NET Face Recognition API** | Điều phối authentication, detection, feature extraction, gallery search và persistence. |
| **YuNet** | Phát hiện khuôn mặt trong ảnh; kiểm tra có đúng số lượng khuôn mặt yêu cầu hay không. |
| **SFace** | Biến khuôn mặt đã căn chỉnh thành vector embedding 128 chiều. |
| **SQL Server / CityGymFaceLocal** | Lưu metadata, mapping terminal, device credentials hash và face embeddings. |
| **Recognition workers** | Thực hiện xử lý recognition đồng thời theo cấu hình worker/queue. |

Trạng thái local hiện tại: SQL Server hoạt động, Face Recognition API chạy tại port 5088, model YuNet/SFace load thành công, service ready và gallery test đang có 1 embedding active.

# **3\. Quy trình Enroll Image**

Enroll là quá trình đăng ký khuôn mặt vào hệ thống. Trong PoC hiện tại, người test chọn FaceInfo ID đã tồn tại và gửi một ảnh chứa đúng một khuôn mặt.

| me\_probe.jpg      ↓POST /api/face-recognition/enroll/image      ↓Authentication: Terminal \+ Device \+ Admin      ↓YuNet detect face      ↓Kiểm tra số lượng face      ↓Crop \+ Align      ↓SFace extract feature      ↓128 float32 values      ↓Normalize      ↓Serialize binary      ↓INSERT / UPDATE dbo.FaceEmbeddings |
| :---- |

Nếu YuNet không phát hiện được khuôn mặt, pipeline dừng trước bước SFace và không có embedding mới được ghi xuống database.

Nếu FaceInfo đã có embedding, implementation có thể thực hiện update/replace record tương ứng; vì vậy việc enroll lại bằng cùng FaceInfo ID không tạo thêm một identity mới nếu logic đang thiết kế một embedding active cho mỗi FaceInfo/model/pipeline.

# **4\. Cấu trúc embedding và dữ liệu SQL**

SFace trong pipeline hiện tại tạo vector 128 chiều. Mỗi phần tử là float32, tức 4 byte.

| 128 phần tử × 4 byte \= 512 byte |
| :---- |

| Trường | Giá trị hiện tại | Ý nghĩa |
| ----- | ----- | ----- |
| **model\_name** | opencv-sface | Model dùng để tạo embedding. |
| **model\_version** | 2021dec | Version model SFace. |
| **pipeline\_version** | yunet2023mar-align-sface128-v1 | Version toàn bộ pipeline detect → align → extract. |
| **dimension** | 128 | Số chiều của vector. |
| **embedding** | 512 bytes | Dữ liệu binary của 128 float32. |
| **detection\_score** | Theo ảnh | Confidence detector tại thời điểm enroll. |
| **is\_deleted** | false / 0 | Record còn hiệu lực để dùng trong gallery. |

Bản ghi test hiện tại được gắn với FaceInfo ID: 30000000-0000-0000-0000-000000000001.

| USE CityGymFaceLocal;SELECT    face\_info\_id,    model\_name,    model\_version,    pipeline\_version,    dimension,    DATALENGTH(embedding) AS EmbeddingBytes,    detection\_score,    is\_deleted,    created\_time,    updated\_timeFROM dbo.FaceEmbeddings; |
| :---- |

| Không cần SELECT embedding để đọc bằng mắtEmbedding là binary của vector float, không phải dữ liệu có thể đánh giá bằng cách nhìn trực tiếp trong SQL Server Management Studio. |
| :---- |

# **5\. FaceInfo ID và quan hệ dữ liệu**

FaceInfo ID là ID của hồ sơ khuôn mặt/identity trong domain recognition. Nó không phải ID của file JPG và cũng không mặc định bằng Users.id.

| FaceInfos.id   │   ├── full\_name   ├── member\_code   └── ...   │   └──── FaceEmbeddings.face\_info\_id             └── vector 128 chiều |
| :---- |

| SELECT    id,    full\_name,    member\_code,    status,    is\_deletedFROM dbo.FaceInfosWHERE id \= '30000000-0000-0000-0000-000000000001'; |
| :---- |

FaceInfo test đang sử dụng có fullName \= TEST PERSON 1 và memberCode \= TEST-1.

| Ý nghĩa của Enroll“Lấy khuôn mặt trong ảnh này, tạo embedding và gắn embedding đó với FaceInfo có ID này.” |
| :---- |

# **6\. Terminal ID và gallery theo terminal**

Terminal test hiện tại: 20000000-0000-0000-0000-000000000001. Terminal không được phép search tùy ý toàn bộ FaceInfo trong hệ thống. Gallery được lọc theo mapping terminal.

| Terminal ID      ↓dbo.Terminal\_FaceInfos      ↓Danh sách FaceInfo được assign      ↓Lấy FaceEmbeddings tương ứng      ↓Bỏ inactive / deleted records      ↓Tạo gallery      ↓1:N comparison |
| :---- |

| SELECT    terminalid,    face\_infoid,    is\_deletedFROM dbo.Terminal\_FaceInfosWHERE terminalid \= '20000000-0000-0000-0000-000000000001'; |
| :---- |

Cách này cho phép giới hạn phạm vi nhận diện của từng terminal/kiosk và tránh việc một terminal truy cập toàn bộ identity không liên quan.

# **7\. Device Key và Admin Key**

| Credential | Dùng cho | Ví dụ thao tác |
| ----- | ----- | ----- |
| **Device Key** | Xác thực terminal/client runtime | Service Status, Identify Image, Identify Feature |
| **Admin Key** | Thao tác quản trị nhạy cảm | Enroll Image, Extract Feature, Delete Embedding |

| Kiosk / Android├── Terminal ID└── Device KeyAdmin Tool / Lab├── Terminal ID├── Device Key└── Admin Key |
| :---- |

Mục tiêu tách quyền là để kiosk chỉ thực hiện nhận diện bình thường, không thể tự ý enroll, xóa hoặc trích xuất dữ liệu nhận diện nếu không có quyền admin.

Database không lưu Device Key dạng plaintext; credential được lưu dưới dạng SHA-256 hash trong dbo.FaceServiceDevices.

| Bảo mật khi demoKhông copy Device Key/Admin Key thật vào tài liệu, source code, screenshot hoặc chat. Lấy chúng trực tiếp từ .local/client.json trên máy demo. |
| :---- |

# **8\. Quy trình Identify Image 1:N**

Identify Image là luồng Android/kiosk sẽ gần với thực tế nhất khi client gửi ảnh lên server. Server tạo feature từ ảnh rồi tìm kiếm 1:N trong gallery của terminal.

| Probe image   ↓Authentication   ↓YuNet detect exactly one face   ↓Align   ↓SFace extract 128-D vector   ↓Load/Search terminal gallery   ↓Cosine similarity với N embeddings   ↓Best score \>= threshold ?   ├── YES → found=true \+ FaceInfo   └── NO  → found=false |
| :---- |

Điểm quan trọng: Identify không yêu cầu người gọi chọn một FaceInfo ID cụ thể để so sánh. FaceInfo ID là kết quả nhận diện nếu gallery có candidate đạt threshold. Đây chính là search 1:N.

# **9\. Quy trình Extract Feature và Identify Feature**

Hệ thống cũng hỗ trợ trường hợp client đã có face feature tương thích và muốn gửi feature thay vì gửi ảnh.

| Image  ↓Extract compatible feature  ↓128-D feature giữ trong browser memory  ↓POST identify/feature  ↓Search terminal gallery  ↓found / not found |
| :---- |

Khi bấm “Identify extracted feature”, browser không upload lại ảnh đang chọn. Nó gửi feature đã extract trước đó. Vì vậy cần chú ý feature cũ có thể vẫn còn trong memory nếu chưa clear/reset.

# **10\. Ý nghĩa các trạng thái và lỗi**

| Kết quả | Điều gì đã xảy ra | Có search gallery? |
| ----- | ----- | ----- |
| **NO\_FACE** | YuNet không phát hiện được khuôn mặt hợp lệ trong ảnh. | Không |
| **found=false** | Có mặt, feature extract thành công, nhưng không candidate nào đạt threshold. | Có |
| **found=true** | Có candidate đạt threshold; API trả identity phù hợp. | Có |
| **EMPTY\_GALLERY** | Terminal hiện không có embedding active để search. | Không thể search có ý nghĩa |
| **ready=false** | Một hoặc nhiều dependency/model/worker/database chưa sẵn sàng. | Không nên chạy recognition |

| Phân biệt quan trọngNO\_FACE ≠ found=false. NO\_FACE dừng ở detector. found=false là detector \+ feature extraction \+ gallery search đều đã chạy. |
| :---- |

# **11\. Ba ảnh test hiện tại**

| Ảnh | Vai trò | Trạng thái |
| ----- | ----- | ----- |
| **me\_probe.jpg** | Ảnh hợp lệ để enroll và positive test. | YuNet detect thành công; đã tạo embedding. |
| **unknown.jpg** | Negative test: người chưa enroll. | Detect được face; identify trả found=false; không lưu DB. |
| **me\_enroll.jpg** | Test ảnh khó/không detect. | YuNet trả NO\_FACE; không qua SFace; không ghi embedding. |

Với me\_enroll.jpg, đã thử giảm detection threshold nhưng ảnh vẫn không ổn định. Cấu hình được giữ/trả về mặc định thay vì hạ threshold quá thấp chỉ để làm demo pass, vì điều đó có thể tăng false detection.

# **12\. Các tầng kiểm thử đã thực hiện**

## **12.1. Database**

| Hạng mục | Kết quả |
| ----- | ----- |
| **Tables** | 40 tables |
| **Active terminals** | 2 |
| **Active device credentials** | 2 |
| **FaceInfo test records** | 3 |
| **Active FaceEmbedding** | 1 |

Tầng này chứng minh schema, metadata, mapping và recognition tables đã có dữ liệu đủ để chạy PoC.

## **12.2. Build và automated tests**

| Build succeeded0 warnings0 errors28 / 28 automated tests passed |
| :---- |

Kết quả này chứng minh source backend compile và các automated test hiện có pass. Nó không đồng nghĩa với việc độ chính xác AI ngoài thực tế đã được chứng minh.

## **12.3. Runtime endpoints**

| Endpoint | Kỳ vọng / Kết quả |
| ----- | ----- |
| **GET /health/live** | alive \- process đang sống |
| **GET /health/ready** | ready \- model/worker/SQL sẵn sàng |
| **GET /swagger** | HTTP 200 |
| **GET /lab/** | HTTP 200 |

/health/live chỉ xác nhận process còn chạy. /health/ready có ý nghĩa mạnh hơn: model load được, recognition worker tạo được, SQL truy cập được và các bảng cần thiết tồn tại.

# **13\. Service runtime và authentication**

Endpoint status được gọi bằng Terminal ID \+ Device Key:

| GET /api/face-recognition/status |
| :---- |

| {  "ready": true,  "workerCount": 2,  "active": 0,  "pending": 0,  "enrolledFaces": 1} |
| :---- |

| Field | Ý nghĩa |
| ----- | ----- |
| **ready=true** | Recognition service sẵn sàng. |
| **workerCount=2** | Có 2 recognition workers. |
| **active=0** | Không có job đang xử lý tại thời điểm query. |
| **pending=0** | Không có job đang chờ. |
| **enrolledFaces=1** | Gallery của terminal hiện có 1 face active có thể search. |

# **14\. Kết quả runtime thực tế**

| Test | Input | Kết quả |
| ----- | ----- | ----- |
| **Enroll Image** | me\_probe.jpg | HTTP 200 |
| **Identify Image \- positive** | me\_probe.jpg | found=true |
| **Identify Image \- negative** | unknown.jpg | found=false |
| **Extract Feature** | me\_probe.jpg | dimension=128 |
| **Identify Feature** | feature từ me\_probe.jpg | found=true |

Các kết quả trên là runtime test thực tế của PoC local, không phải response hard-code trong tài liệu.

# **15\. Ý nghĩa và giới hạn của found=true**

Test hiện tại enroll me\_probe.jpg rồi identify lại chính me\_probe.jpg cho found=true. Điều này chứng minh end-to-end pipeline hoạt động: upload → detect → extract → database/gallery → similarity search → response.

| Nhưng đây mới là sanity testDùng lại đúng ảnh enroll không đủ để chứng minh khả năng nhận diện cùng một người ở ảnh khác, ánh sáng khác hoặc góc mặt khác. |
| :---- |

| Sanity test hiện tại:me\_probe.jpg → Enrollme\_probe.jpg → Identify → found=trueTest mạnh hơn cần có:me\_probe.jpg   → Enrollme\_probe\_2.jpg → Identify → found=true |
| :---- |

# **16\. Hướng dẫn test bằng Lab từ A đến Z**

Mở trình duyệt tại: http://localhost:5088/lab/index.html

## **16.1. Nhập Credentials**

* Terminal ID: 20000000-0000-0000-0000-000000000001  
* Device Key: lấy trực tiếp từ .local/client.json  
* Admin Key: lấy trực tiếp từ .local/client.json  
* FaceInfo ID: 30000000-0000-0000-0000-000000000001

## **16.2. Kiểm tra Service Status**

1. Bấm “Service status”.  
2. Xác nhận ready=true.  
3. Xác nhận enrolledFaces=1 nếu embedding đang tồn tại.

| {  "ready": true,  "enrolledFaces": 1} |
| :---- |

## **16.3. Positive Identify Image**

4. Chọn me\_probe.jpg.  
5. Bấm “Identify image”.  
6. Kỳ vọng found=true và FaceInfo ID test được trả về.

| {  "found": true,  "faceInfoId": "30000000-0000-0000-0000-000000000001"} |
| :---- |

## **16.4. Negative Identify Image**

7. Chọn unknown.jpg.  
8. Bấm “Identify image”.  
9. Kỳ vọng found=false.

| {  "found": false} |
| :---- |

Nếu kết quả là found=false, nghĩa là face detection và feature extraction đã thành công, nhưng không có embedding nào trong gallery vượt threshold.

## **16.5. Test Extract Feature**

10. Chọn me\_probe.jpg.  
11. Bấm “Extract compatible feature”.  
12. Kỳ vọng dimension=128.  
13. Không reload trang; feature sẽ được giữ trong memory của browser.

| {  "dimension": 128} |
| :---- |

## **16.6. Test Identify Feature**

14. Sau khi extract thành công, bấm “Identify extracted feature”.  
15. Browser gửi feature đang giữ; không upload lại ảnh.  
16. Kỳ vọng found=true cho feature được tạo từ me\_probe.jpg.

| {  "found": true,  "faceInfoId": "30000000-0000-0000-0000-000000000001",  "fullName": "TEST PERSON 1",  "memberCode": "TEST-1",  "score": 1} |
| :---- |

# **17\. Reset và test lại toàn bộ dữ liệu**

Để chứng minh thao tác không hard-code, có thể xóa embedding rồi enroll lại ngay trên Lab.

17. Bấm “Delete this embedding”. Việc này chỉ xóa embedding của recognition service mới; không xóa FaceInfos, Users hoặc dữ liệu FacePass cũ.  
18. Kiểm tra status/enrolledFaces. Khi gallery không còn face active, identify có thể trả EMPTY\_GALLERY.  
19. Chọn me\_probe.jpg và bấm “Enroll image”.  
20. Kiểm tra lại status; enrolledFaces phải tăng trở lại.  
21. Identify me\_probe.jpg; kỳ vọng found=true.

| Delete embedding      ↓Gallery \= empty      ↓Identify → EMPTY\_GALLERY      ↓Enroll me\_probe.jpg      ↓Gallery \= 1      ↓Identify → found=true |
| :---- |

# **18\. Vai trò của scripts/local.http**

scripts/local.http là bộ request mẫu dành cho developer để test nhanh health/status/headers/authentication. Nó không phải công cụ chính để demo upload ảnh.

| GET /health/readyGET /api/face-recognition/status |
| :---- |

Image enrollment và image recognition cần multipart/form-data, vì vậy dùng /lab/index.html hoặc smoke\_test.py tiện hơn. Khi demo với lead, Lab là lựa chọn trực quan nhất.

# **19\. PoC đã chứng minh được gì**

|  | Nội dung |
| ----- | ----- |
| **✓** | Face Recognition API chạy thật. |
| **✓** | API nhận được image input. |
| **✓** | YuNet thực hiện face detection. |
| **✓** | SFace thực hiện feature extraction. |
| **✓** | Feature dimension \= 128\. |
| **✓** | Embedding 512 byte được lưu trong SQL. |
| **✓** | Gallery search 1:N hoạt động. |
| **✓** | Registered face → found=true. |
| **✓** | Unknown face → found=false. |
| **✓** | API nhận feature input. |
| **✓** | Delete / Enroll thay đổi dữ liệu thật. |
| **✓** | Authentication tách Device Key và Admin Key. |
| **✓** | Service có health/live, health/ready và status endpoint. |

| Kết luận PoCKết quả hiện tại đủ để chứng minh kiến trúc centralized recognition hoạt động về mặt kỹ thuật: client gửi image/feature lên server, server thực hiện 1:N matching và trả kết quả. |
| :---- |

# **20\. PoC chưa chứng minh được gì**

|  | Nội dung |
| ----- | ----- |
| **✗** | Hai ảnh khác nhau của cùng một người vẫn match ổn định. |
| **✗** | Accuracy thực tế trên tập người dùng City Gym. |
| **✗** | False Acceptance Rate (FAR). |
| **✗** | False Rejection Rate (FRR). |
| **✗** | Liveness phía server. |
| **✗** | Khả năng chống ảnh/video giả mạo phía server. |
| **✗** | Android camera → API end-to-end. |
| **✗** | Recognition → locker thực sự mở. |
| **✗** | Tải thực tế với nhiều kiosk đồng thời. |
| **✗** | Production deployment / HA / monitoring production. |
| **✗** | Vendor FaceX/FacePass Server SDK tương thích và licensing production. |

Các nội dung này là giai đoạn tiếp theo; không nên trình bày chúng như những kết quả đã hoàn thành của PoC hiện tại.

# **21\. Bước tiếp theo để demo mạnh hơn**

Ưu tiên số 1 là tạo một ảnh thứ hai của cùng người, ví dụ me\_probe\_2.jpg, để kiểm tra cross-image recognition.

| Tiêu chí ảnh | Khuyến nghị |
| ----- | ----- |
| **Identity** | Cùng người đã enroll bằng me\_probe.jpg. |
| **Góc mặt** | Tương đối chính diện; tránh nghiêng quá nhiều. |
| **Khung hình** | Mặt chiếm khoảng 30–60% khung hình. |
| **Chất lượng** | Không rung, không blur. |
| **Ánh sáng** | Đủ sáng, tránh ngược sáng mạnh. |
| **Khuôn mặt** | Nhìn rõ trán, mắt, mũi và cằm. |

| me\_probe.jpg→ Enrollme\_probe\_2.jpg→ Identify Image→ expected: found=true |
| :---- |

Nếu test này pass, bằng chứng mạnh hơn sẽ là: different image \+ same person → same identity. Đây là bước quan trọng trước khi đánh giá accuracy trên dataset lớn hơn.

## **21.1. Sau cross-image test**

* Tạo tập test gồm nhiều người đã enroll và nhiều người chưa enroll.  
* Ghi lại score, threshold, false accept và false reject.  
* Test nhiều request đồng thời để đo throughput/latency theo số worker.  
* Nối Android/kiosk với API thật thay vì Lab.  
* Xác minh FaceX/FacePass Server SDK và license nếu yêu cầu cuối cùng bắt buộc dùng vendor engine.

# **22\. Checklist demo với lead**

| \# | Thao tác | Thông điệp cần chứng minh |
| ----- | ----- | ----- |
| **1** | Mở /health/ready | Cho thấy service/model/SQL ready. |
| **2** | Mở Lab | Cho thấy client test độc lập với Swagger. |
| **3** | Service Status | ready=true, workerCount, enrolledFaces. |
| **4** | Identify me\_probe.jpg | Positive path: found=true. |
| **5** | Identify unknown.jpg | Negative path: found=false. |
| **6** | Extract feature | Chứng minh feature input 128-D. |
| **7** | Identify extracted feature | Chứng minh API không bắt buộc input là image. |
| **8** | Query SQL | Cho thấy embedding 512 bytes thực sự được lưu. |
| **9** | Delete embedding | Chứng minh dữ liệu thay đổi thật. |
| **10** | Identify khi gallery empty | Cho thấy EMPTY\_GALLERY. |
| **11** | Enroll lại | Chứng minh API tạo embedding thật. |
| **12** | Identify lại | Kết thúc demo với found=true. |

| Khi demoKhông cần mở local.http. Không hiển thị Device Key/Admin Key trong slide hoặc screenshot. Nếu lead hỏi accuracy, nói rõ PoC mới chứng minh pipeline kỹ thuật; accuracy cần cross-image/dataset benchmark. |
| :---- |

# **23\. Câu trả lời ngắn khi lead hỏi**

| Nếu lead hỏi: “Hiện tại em đã làm được gì?”Em đã dựng Face Recognition thành API service chạy tập trung trên server. Hiện service nhận được cả image và feature input. Với image, server dùng YuNet detect face, SFace tạo embedding 128 chiều rồi search 1:N trong gallery và trả found/not found. Embedding được lưu trong SQL chứ không lưu trực tiếp ảnh. PoC local đã enroll thành công, registered face trả found, unknown face trả not found và feature input cũng search được. Bước tiếp theo em sẽ test bằng ảnh khác của cùng một người, sau đó nối Android/kiosk và benchmark concurrent request. |
| :---- |

Cách trả lời này bám đúng những gì đã chứng minh, đồng thời tránh nói quá rằng FaceX/FacePass đã chạy trên server hoặc hệ thống đã production-ready.

# **24\. Phụ lục SQL và request mẫu**

## **24.1. Kiểm tra FaceEmbeddings**

| USE CityGymFaceLocal;SELECT    face\_info\_id,    model\_name,    model\_version,    pipeline\_version,    dimension,    DATALENGTH(embedding) AS EmbeddingBytes,    detection\_score,    is\_deleted,    created\_time,    updated\_timeFROM dbo.FaceEmbeddings; |
| :---- |

## **24.2. Kiểm tra FaceInfo**

| SELECT    id,    full\_name,    member\_code,    status,    is\_deletedFROM dbo.FaceInfosWHERE id \= '30000000-0000-0000-0000-000000000001'; |
| :---- |

## **24.3. Kiểm tra mapping Terminal ↔ FaceInfo**

| SELECT    terminalid,    face\_infoid,    is\_deletedFROM dbo.Terminal\_FaceInfosWHERE terminalid \= '20000000-0000-0000-0000-000000000001'; |
| :---- |

## **24.4. Request Enroll Image \- mô tả logic**

| POST /api/face-recognition/enroll/imageHeaders:X-Terminal-Id: \<Terminal ID\>X-Device-Key: \<Device Key\>X-Admin-Key: \<Admin Key\>Body: multipart/form-datafaceInfoId \= 30000000-0000-0000-0000-000000000001file       \= me\_probe.jpg |
| :---- |

## **24.5. Luồng dữ liệu tổng hợp**

| ENROLLImage → Detect → Align → Extract → Normalize → Serialize → SQLIDENTIFY IMAGEImage → Detect → Align → Extract → Gallery 1:N → Threshold → ResultIDENTIFY FEATUREFeature → Validate compatibility → Gallery 1:N → Threshold → Result |
| :---- |

# **25\. Thuật ngữ nhanh**

| Thuật ngữ | Ý nghĩa |
| ----- | ----- |
| **Face Detection** | Tìm vị trí khuôn mặt trong ảnh. |
| **Face Alignment** | Căn chỉnh khuôn mặt về hình học chuẩn trước khi extract. |
| **Embedding / Feature** | Vector số đại diện đặc trưng khuôn mặt. |
| **Gallery** | Tập embeddings được phép search đối với terminal. |
| **Probe** | Ảnh/feature đầu vào cần nhận diện. |
| **1:N Matching** | So sánh một probe với nhiều identity trong gallery. |
| **Cosine Similarity** | Độ tương đồng giữa hai vector; dùng để xếp hạng candidate. |
| **Threshold** | Ngưỡng quyết định candidate có đủ giống để trả found=true hay không. |
| **FAR** | Tỷ lệ nhận nhầm người lạ thành người đã đăng ký. |
| **FRR** | Tỷ lệ từ chối nhầm người đã đăng ký. |

