# Hoàn thiện frontend Management — 01/10/2026

## Đã thực hiện

- Login/logout demo và API Manager; restore session, CSRF trong RAM và xử lý 401.
- Dashboard/member CRUD/search/filter/local backup; HTTP workspace adapter cho API mode.
- Service status: ready, workers, active, pending, enrolledFaces; refresh/loading/error.
- Upload/preview ảnh, giới hạn format, 10 MB và 24 megapixels.
- Enroll, extract, identify image, identify feature, delete embedding có xác nhận.
- Feature ở RAM, hiển thị metadata; clear khi đổi ảnh/terminal/logout/hết phiên; thu hồi object URL.
- FaceInfo list/search/detail theo terminal; gallery metadata, empty state và refresh sau thay đổi.
- Demo recognition có nhãn rõ và kịch bản giả lập, không phân tích ảnh; reset recognition data sau reload/login.
- HTTP adapter không fallback sang demo; feature giả lập bị chặn trong API mode.

## Kiểm thử

- 14/14 tests auth/storage/recognition/API adapter đạt.
- Chrome headless: member CRUD; đủ 5 thao tác recognition; NO_FACE, MULTIPLE_FACES, EMPTY_GALLERY, FORBIDDEN; scope gallery, clear feature, desktop/mobile, logout.
- API-mode browser test dùng mock HTTP: login, CSRF, metadata, extract/identify feature, 401 và xóa ảnh/feature khi hết phiên.
- Chưa kiểm thử BE thật/browser → .NET AI end-to-end vì BE chưa được xây dựng.

```powershell
node --test fe/tests/core.test.mjs fe/tests/recognition.test.mjs
# Cần server và Chrome profile thử với remote-debugging-port=9223:
node fe/tests/browser-smoke.mjs
```

Ảnh giao diện kiểm tra: `artifacts/recognition-desktop.png`, `artifacts/recognition-mobile.png` (không commit).

## Bước tiếp theo

BE triển khai theo `management-api-contract.md`, kết nối SQL Server và AI. Có thể đổi contract workspace snapshot thành CRUD endpoints bằng cách thay HttpManagementClient. Locker và màn hình CRUD user/role chưa thuộc phạm vi PoC recognition cho một Manager.

`fe-readiness-review.md` là kết quả trước khi bổ sung; tài liệu này ghi nhận trạng thái mới.
