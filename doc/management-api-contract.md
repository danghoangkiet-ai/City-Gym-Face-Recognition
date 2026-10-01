# API contract cho frontend Management

Contract đề xuất đã được FE sử dụng; backend thật chưa được xây dựng. Prefix `/api`, cùng origin, JSON camelCase, ngày ISO 8601 UTC, ID dạng string. API mode không fallback sang demo khi lỗi.

## Auth Manager

| Method | Route | Input | Response |
| --- | --- | --- | --- |
| GET | `/auth/csrf` | Không | `{csrfToken}` |
| POST | `/auth/login` | JSON `{email,password}` | Session + cookie HttpOnly |
| GET | `/auth/session` | Cookie | Session hiện hành |
| POST | `/auth/logout` | Cookie + CSRF | 204, hủy session/cookie |

Session: `{name, role: "Manager", expiresAt: "2026-10-01T18:00:00Z", csrfToken}`. Token CSRF chỉ giữ trong RAM, gửi qua `X-CSRF-Token` với request thay đổi dữ liệu. FE dùng credentials same-origin. SessionStorage chỉ giữ name/mode/expiry; BE phải xác thực và kiểm tra quyền mọi request. Khi reload FE gọi `/auth/session`. Cookie dùng HttpOnly, SameSite và Secure khi HTTPS.

Manager API dùng phiên Manager và kiểm tra quyền terminal. Device Key/Admin Key trong guide dành cho service/kiosk; không nhúng các key đặc quyền vào frontend. Hai cơ chế có thể dùng chung application service nhưng cần policy riêng.

## Metadata

| Method | Route | Response |
| --- | --- | --- |
| GET | `/terminals` | Array terminal được Manager truy cập |
| GET | `/face-infos?terminalId={id}` | Array FaceInfo được assign cho terminal |
| GET | `/terminals/{id}/gallery` | Array embedding active kèm metadata FaceInfo |
| GET | `/face-recognition/status?terminalId={id}` | Service status theo terminal |

Kiểu dữ liệu từng phần tử (không có envelope):

```json
{
  "terminal": {"id":"uuid","name":"Sảnh chính","status":"active"},
  "faceInfo": {"id":"uuid","memberId":null,"fullName":"Nguyễn An","memberCode":"CG-01","status":"active"},
  "galleryEntry": {
    "id":"face-info-uuid","fullName":"Nguyễn An","memberCode":"CG-01","status":"active",
    "model":"opencv-sface-2021dec","pipeline":"yunet2023mar-similarity5-sface128-v1","dimension":128
  },
  "status": {"ready":true,"workerCount":2,"active":0,"pending":0,"enrolledFaces":1}
}
```

Gallery không trả vector thô. `id` của gallery entry là FaceInfo ID, với một embedding active cho FaceInfo + pipeline. Lists hiện chưa phân trang; nếu thêm pagination phải cập nhật adapter/UI.

## Recognition

| Method | Route | Input | Response |
| --- | --- | --- | --- |
| POST | `/face-recognition/enroll/image` | Multipart: terminalId, faceInfoId, file | `{faceInfoId,model,pipeline,dimension}` |
| POST | `/face-recognition/extract/feature` | Multipart: terminalId, file | Feature |
| POST | `/face-recognition/identify/image` | Multipart: terminalId, file | Match result |
| POST | `/face-recognition/identify/feature` | JSON: `{terminalId,feature}` | Match result |
| DELETE | `/face-recognition/embeddings/{faceInfoId}?terminalId={id}&pipeline={pipeline}` | Không body | 204 |

Feature gồm `model: "opencv-sface-2021dec"`, `pipeline: "yunet2023mar-similarity5-sface128-v1"`, `dimension: 128`, `vector: float[128]`, tùy chọn `detectionScore`. Vector phải đủ 128 số hữu hạn và norm khác 0. BE chuyển FaceFeature của thư viện AI sang DTO và bổ sung dimension. HTTP adapter từ chối feature có `demo: true`.

Match result: `{found:true,faceInfoId,fullName,memberCode,score}` hoặc `{found:false,score}` với HTTP 200. Không trả identity dưới threshold. Identify image không nhận FaceInfo ID đích. Threshold do BE cấu hình.

BE kiểm tra đúng một mặt, scope terminal, FaceInfo active/được assign, feature tương thích và giới hạn upload. Xóa embedding không xóa member/FaceInfo. FE refresh status/FaceInfo/gallery sau enroll/delete.

## Workspace quản trị

Adapter hiện dùng snapshot để tách UI khỏi SQL schema; có thể đổi adapter sang CRUD từng member khi chốt schema:

- `GET /management/workspace` → `{revision: "opaque-server-version", data: Workspace}`.
- `PUT /management/workspace` nhận `{expectedRevision, data: Workspace}`, trả snapshot và revision mới.
- BE validate, kiểm tra quyền, áp dụng transaction và trả 409 khi revision xung đột.
- Workspace: `{version:1,members:[{id,name,code,status,createdAt}],settings:{gymName,location}}`; status member là active/paused.
- Member CRUD độc lập với FaceInfo; snapshot không tự enroll/xóa embedding. Không tự đồng bộ dữ liệu demo sang BE.
- Nhập/xuất backup local chỉ có trong demo mode.

## Errors

Lỗi JSON: `{code:"NO_FACE",message:"Không phát hiện khuôn mặt hợp lệ."}`.

- 400/413/415: input, kích thước, format không hợp lệ.
- 401: hết phiên; FE về login và xóa ảnh/feature.
- 403: không đủ quyền Manager/terminal/tác vụ.
- 404: tài nguyên không tồn tại trong phạm vi được phép.
- 409: revision xung đột hoặc mâu thuẫn trạng thái.
- 422: NO_FACE, MULTIPLE_FACES, EMPTY_GALLERY, INCOMPATIBLE_FEATURE, INVALID_LANDMARKS.
- 503: SERVICE_NOT_READY hoặc hàng đợi quá tải.

FE không đổi lỗi thành found=false. Timeout 30 giây, abort khi logout/hết phiên. BE quản lý cancellation/transaction độc lập; abort HTTP không đảm bảo tác vụ server chưa commit.

## Hosting

Demo: `node fe/server.mjs`, http://127.0.0.1:5173. Node static server không proxy API. API mode cần BE phục vụ FE cùng origin hoặc reverse proxy `/api` cùng origin. Sau khi dựng .NET, map các file FE vào web root; không cần CORS rộng.
