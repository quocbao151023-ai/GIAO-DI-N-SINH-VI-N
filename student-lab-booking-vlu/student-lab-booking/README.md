# CỔNG SINH VIÊN - ĐĂNG KÝ & BÀN GIAO PHÒNG LAB (giao diện VLU)

Giao diện đồng bộ với Hệ thống quản lý phòng Lab: font IBM Plex Sans, đỏ VLU,
header trắng + menu ngang (Lịch phòng Lab / Đăng ký sử dụng / Bàn giao phòng),
banner campus, footer tối, hộp thoại thông báo dạng bảng.

## Những gì thay đổi
- templates/index.html : giao diện mới (giữ nguyên mọi ID mà app.js dùng)
- static/theme.css     : bộ giao diện chung (copy từ Hệ thống quản lý)
- static/style.css     : phần riêng của cổng sinh viên (thay file cũ)
- static/app.js        : giữ nguyên logic; chỉ thêm
    + đánh dấu ngày hôm nay trên lịch
    + hộp thoại "Đăng ký thành công" / "Bàn giao thành công" có bảng thông tin
- static/lab-guide.js  : NỘI DUNG PHÒNG LAB cho trang Hướng dẫn (kỹ thuật viên tự cập nhật:
                         ảnh sơ đồ, mô tả, khu chức năng). Lab 1 đã có sơ đồ phân khu A–E;
                         Lab 2, Lab 3: thêm ảnh vào static/images/ rồi điền "map", "zones"... tương tự Lab 1.
- static/guide.js      : hiển thị trang Hướng dẫn (sơ đồ phòng, quy trình đăng ký, bàn giao,
                         nội quy & quy định an toàn, hỏi đáp)
- static/images        : background.jpg, logo-vlu.png, logo-footer.png, lab-sketch.jpg,
                         so-do-lab-1.jpg (sơ đồ trên web), so-do-lab-1-chu-thich.jpg (bản có chú thích),
                         noi-quy-phong-lab.jpg, quy-dinh-an-toan.jpg (bản gốc nội quy để mở / in)
- app.py               : sửa lỗi "Hệ thống chưa thể xác minh thông tin bàn giao":
                         vẫn kiểm tra sheet LAB_MEMBERS như cũ; nếu chưa có sheet này hoặc là
                         lượt đăng ký cũ (Google Form) thì đối chiếu người đại diện và danh sách
                         thành viên ghi trên chính lượt đăng ký.

## Chạy
1. Đặt `credentials.json` cạnh `app.py` (giữ file của bạn, gói này không kèm).
2. `py -m pip install -r requirements.txt`
3. `py app.py`  ->  http://127.0.0.1:5001/
4. Nhấn `Ctrl + F5` để xóa cache trình duyệt.

CẬP NHẬT – QUY ĐỊNH BÀN GIAO & BẮT BUỘC ĐỌC HƯỚNG DẪN
- Phiếu đăng ký có khối "Lưu ý quy định bàn giao phòng".
- Đánh dấu ô cam kết -> chuyển sang trang Hướng dẫn; phải kéo xuống hết trang mới bấm được
  "Xác nhận & quay lại đăng ký" (thông tin đã nhập được giữ nguyên). Đã đọc trong phiên làm việc
  thì lần đăng ký sau không phải đọc lại.
- app.py khi nhận đăng ký sẽ đếm lượt "chưa bàn giao" trong THÁNG HIỆN TẠI của từng MSSV:
  lượt đăng ký qua cổng (SOURCE = STUDENT_PORTAL), còn hiệu lực, ngày sử dụng đã qua,
  không có phiếu nào trong LAB_HANDOVER cùng ID_KEY. Lượt nhóm tính cho mọi thành viên.
    + Người đăng ký đủ 3 lượt -> từ chối đăng ký (cá nhân hoặc nhóm) đến hết tháng.
    + Thành viên có lượt chưa bàn giao -> vẫn ghi nhận, cột NOTE của LAB_MEMBERS ghi
      "CHƯA BÀN GIAO n LẦN TRONG THÁNG mm/yyyy - KTV XEM XÉT ĐIỂM DANH".
  Đổi ngưỡng: thêm dòng KEY = MAX_MISSED_HANDOVERS_PER_MONTH, VALUE = số lượt vào sheet CONFIG
  (0 = tắt quy định).
- Xem ảnh sơ đồ / bản gốc nội quy trong khung xem ảnh có nút Đóng (Esc hoặc bấm nền cũng đóng).

CẬP NHẬT – NHIỀU CA, HÌNH THỨC BÀN GIAO, MỞ TRANG HƯỚNG DẪN TRƯỚC
- Vào cổng là thấy trang Hướng dẫn trước (menu: Hướng dẫn · Lịch · Đăng ký · Bàn giao).
- Ô "Ca sử dụng" chọn được nhiều ca (cùng phòng, cùng ngày). Gửi 1 lần -> mỗi ca 1 dòng
  LAB_BOOKING (1 mã ID_KEY, tính sức chứa riêng). Nếu có 1 ca không hợp lệ (đủ nhóm, trùng...)
  thì không ghi ca nào. Các ca gửi cùng lúc có chung cột MA_DANG_KY_CHUNG và chỉ cần bàn giao 1 lần.
- Đăng ký nhóm phải chọn hình thức bàn giao, lưu ở cột HINH_THUC_BAN_GIAO:
    ĐẠI DIỆN        -> chỉ người đại diện được bàn giao; quên thì cả nhóm bị tính.
    TỪNG THÀNH VIÊN -> mỗi thành viên tự bàn giao bằng MSSV của mình; ai quên người đó bị tính.
  (Đăng ký cá nhân ghi CÁ NHÂN.)
- 2 cột MA_DANG_KY_CHUNG, HINH_THUC_BAN_GIAO được TỰ THÊM vào cuối sheet LAB_BOOKING ở lần đăng ký
  đầu tiên, không cần sửa sheet bằng tay.

CẬP NHẬT – CHUYỂN SANG FILE GOOGLE SHEET CỦA KỸ THUẬT VIÊN
- app.py giờ ghi vào file Booking của kỹ thuật viên:
      SPREADSHEET_ID = "16eguXNHfCzbTq6olAQaMQBAylkqNR3gjVMmtnAkSBpE"
  ở 3 sheet riêng (tự tạo ở lần dùng đầu tiên, không đụng sheet của Google Form):
      WEB_BOOKING · WEB_MEMBERS · WEB_HANDOVER   (tuỳ chọn: WEB_CONFIG với cột KEY / VALUE)
- BẮT BUỘC 1 lần: kỹ thuật viên mở file Booking -> Chia sẻ -> thêm email
      lab-booking@propane-landing-497210-f8.iam.gserviceaccount.com   (quyền NGƯỜI CHỈNH SỬA)
  (đây là email trong credentials.json của cổng sinh viên).
- Email xác nhận cho sinh viên: dùng script apps-script/apps-script-sheet.gs trong gói Hệ thống quản lý.

CẬP NHẬT – MSSV ĐÚNG 13 CHỮ SỐ
- Ô MSSV (người đại diện, thành viên, bàn giao) chỉ nhận số, tối đa 13 ký tự; chưa đủ 13 số thì viền đỏ.
- Khi gửi đăng ký / xác minh / gửi bàn giao, cả trình duyệt và app.py đều kiểm tra đúng 13 chữ số
  (MSSV_LENGTH trong app.py).

CẬP NHẬT – ĐĂNG KÝ TRÙNG LỊCH
- Người đăng ký đăng ký lại cùng ngày, cùng ca (phòng nào cũng vậy): hệ thống GIỮ lượt mới, HỦY lượt trước
  (BOOKING_STATUS = "ĐÃ HỦY - TRÙNG LỊCH", cột THAY_THE_BOI = mã mới, EMAIL_STATUS = CHƯA GỬI)
  -> Apps Script gửi email báo đã hủy lượt trước. Hai cột THAY_THE_BOI, GHI_CHU_HE_THONG tự thêm vào WEB_BOOKING.

KIỂM TRA DỮ LIỆU LỊCH
- Mở http://127.0.0.1:5001/api/kiem-tra-du-lieu : cho biết cổng đang đọc file nào, có những sheet nào,
  số lượt trên web (WEB_BOOKING) và số lượt cũ của Google Form (LAB_BOOKING) đọc được, kèm lỗi nếu có.
- Lượt cũ của Google Form đọc theo từ khóa tiêu đề cột (chịu được cột trùng tên, thiếu SLOT_KEY).

## Cập nhật: lịch đọc cả lượt cũ + chống lỗi giới hạn đọc Google

- Lịch phòng Lab đọc **2 nguồn trong file của KTV**: sheet `WEB_BOOKING` (đăng ký trên cổng) và sheet `LAB_BOOKING` (đăng ký cũ qua Google Form).
- Lượt đăng ký từng làm trên file Sheet cá nhân trước đây **không tự có** trong file KTV — muốn hiện thì chép các sheet đó sang file KTV (đổi tên thành `WEB_BOOKING`, `WEB_MEMBERS`, `WEB_HANDOVER`).
- Hai hệ thống dùng chung `key.json` nên chung hạn mức đọc của Google (~60 lần/phút). Cổng giờ lưu tạm dữ liệu (lịch 15 giây, form cũ 5 phút, cấu hình 2 phút); nếu Google báo vượt hạn mức thì vẫn hiện lịch gần nhất thay vì báo lỗi.
- Nếu lịch vẫn lỗi: màn hình sẽ ghi "Chi tiết: …"; mở `http://127.0.0.1:5001/api/kiem-tra-du-lieu` để xem cổng đang đọc file nào, mỗi nguồn bao nhiêu lượt.

## Cập nhật: 1 lần đăng ký nhiều ca = 1 mã ID_KEY

- Mã ghi đủ các ca đã chọn: `L1C2C3C429102026-02` = Lab 1, Ca 2 + Ca 3 + Ca 4, ngày 29/10/2026, số thứ tự 02. Đăng ký 1 ca giữ đúng mẫu cũ `L1C229102026-01`.
- Sheet `WEB_BOOKING` vẫn ghi mỗi ca 1 dòng (cùng ID_KEY, khác SLOT_KEY) để lịch hiện mã ở đúng từng ca và tính đủ 9 nhóm/ca riêng. `WEB_MEMBERS` ghi thành viên 1 lần cho cả mã.
- Số thứ tự tăng dần theo phòng + ngày cho các mã có chung ít nhất 1 ca, nên trong 1 ca không có 2 mã cùng số.
- Đăng ký trùng: chỉ hủy đúng ca bị trùng của mã cũ; các ca còn lại của mã cũ vẫn giữ (email báo rõ).
- Bàn giao: nhập mã chung + MSSV, bàn giao 1 lần sau ca cuối. Màn hình xác minh hiện "Ca 2, Ca 3, Ca 4".

## Cập nhật: sơ đồ Lab 2, Lab 3 + giao diện điện thoại

- Trang Hướng dẫn có sơ đồ phân khu **Lab 2** (B1 – B8, đánh số từ cửa ra vào) và **Lab 3** (B1 – B6, đánh số từ bàn giáo viên).
  Ảnh: `static/images/so-do-lab-2.jpg`, `so-do-lab-3.jpg`; nội dung khu chức năng sửa trong `static/lab-guide.js`.
- Ô "Khu vực sử dụng" có nút chọn nhanh mã bàn / máy theo phòng đã chọn (danh sách `areas` trong `lab-guide.js`);
  vẫn gõ tay được. Liên kết "Xem sơ đồ" mở đúng sơ đồ phòng đang chọn.
- Trên điện thoại (màn hình ≤ 640px):
  - 4 chức năng chuyển thành thanh tab cố định ở đáy màn hình; header chỉ còn logo.
  - Lịch xem theo từng ngày: thanh chọn Thứ 2 – Thứ 7 (số nhỏ = số khung giờ đã có đăng ký), không phải kéo ngang.
  - Ô nhập chữ 16px (iPhone không tự phóng to khi gõ), ô cao hơn dễ chạm.
  - Bàn giao: nút "Kiểm tra thông tin" nằm sau ô nhập mã và MSSV.
  - Thanh "đọc hết hướng dẫn" gọn lại và nằm trên thanh tab.
  - Máy tính / màn hình rộng giữ nguyên giao diện cũ.

## Cập nhật: điện thoại bản gọn + lịch đọc sheet "dễ tính"

- `static/mobile.js` (chỉ tác dụng trên điện thoại ≤ 640px, không bỏ nội dung):
  - Trang Hướng dẫn: Quy trình đăng ký, Quy trình bàn giao, Nội quy & an toàn, Hỏi đáp gập thành 1 dòng
    (bấm để mở; mục lục / liên kết "nội quy" tự mở đúng mục). Khi sinh viên phải đọc hết hướng dẫn
    trước khi gửi đăng ký, tất cả các mục tự mở ra.
  - "Lưu ý quy định bàn giao" trên phiếu đăng ký gập lại, có nút "Xem chi tiết".
  - Lịch: thống kê tuần gọn thành 1 dòng.
- Bỏ thanh liên hệ trên cùng (đã có ở chân trang), banner thấp lại, thẻ / bước gọn hơn trên điện thoại.
- Lịch công khai không còn báo lỗi chỉ vì sheet WEB_BOOKING trùng tên cột / thiếu cột phụ / chưa có sheet.

## Sheet WEB_CONFIG (tuỳ chọn – không bắt buộc)

Không có sheet này hệ thống dùng mặc định: 9 nhóm/ca, 108 người/ca, 12 người/lượt, khóa đăng ký khi 3 lượt chưa bàn giao/tháng.
Chỉ tạo khi muốn đổi các giới hạn trên: sheet `WEB_CONFIG`, dòng 1 là `KEY | VALUE`, mỗi dòng sau 1 giới hạn, ví dụ
`MAX_GROUPS_PER_SLOT | 9`, `MAX_PEOPLE_PER_SLOT | 108`, `MAX_MEMBERS_PER_BOOKING | 12`, `MAX_MISSED_HANDOVERS_PER_MONTH | 3` (0 = tắt khóa).

## Cập nhật: bàn giao theo phiếu cũ + lưu ảnh Google Drive

- Phiếu bàn giao ghi vào sheet `WEB_HANDOVER` của **file bàn giao** (cùng file LAB_HANDOVER), thêm cột:
  VAI_TRO, SDT, PHAT_SINH_BAT_THUONG, SLOT_KEY, DRIVE_FOLDER_LINK, SLOT_FOLDER_LINK, ANH_TRUOC, ANH_SAU,
  ALERT_STATUS, PROCESS_STATUS, ERROR_MESSAGE.
- Ảnh được thu nhỏ (≤ 1600px) rồi gửi cho Apps Script của file bàn giao để lưu Drive:
  `<thư mục gốc>/<SLOT_KEY>/<ID_KEY>/Ảnh trước | Ảnh sau`. Có bất thường -> email cảnh báo quản lý.
- Biến môi trường trên Render: `HANDOVER_UPLOAD_URL` (URL web app …/exec), `HANDOVER_UPLOAD_TOKEN` (giống TOKEN trong script).

## Triển khai trên Render

- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app` (hoặc `python app.py` – tự nhận cổng PORT của Render)
- Khóa Google (key.json) – chọn 1 cách, KHÔNG đưa key.json lên GitHub:
  - Secret File tên `key.json` (Render -> Environment -> Secret Files), hoặc
  - biến môi trường `GOOGLE_CREDENTIALS_JSON` = toàn bộ nội dung key.json.
- Lưu ảnh bàn giao: biến `HANDOVER_UPLOAD_URL` và `HANDOVER_UPLOAD_TOKEN` (xem mục bàn giao ở trên).
