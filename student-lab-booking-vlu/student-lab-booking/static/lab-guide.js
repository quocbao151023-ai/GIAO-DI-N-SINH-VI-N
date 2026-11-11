/* =========================================================
   THÔNG TIN PHÒNG LAB CHO TRANG "HƯỚNG DẪN"
   ---------------------------------------------------------
   Kỹ thuật viên cập nhật nội dung tại đây (không cần sửa code khác):
     - map        : ảnh sơ đồ bố trí, đặt trong static/images/
                    ví dụ "images/so-do-lab-2.jpg"
     - mapFull    : (tuỳ chọn) bản sơ đồ có chú thích để mở / tải về
     - description: mô tả ngắn về phòng
     - areas      : mã bàn / máy sinh viên chọn nhanh ở ô "Khu vực sử dụng"
     - zones      : các khu chức năng trên sơ đồ
                    { code, name, detail, color, student: true/false }
                    student = true  -> "Sinh viên sử dụng"
                    student = false -> "Do KTV / giảng viên quản lý"
   Mục nào để trống thì trang hiển thị "đang được cập nhật".
========================================================= */

window.LAB_GUIDE = {
  labs: [
    {
      name: "Lab 1",
      map: "images/so-do-lab-1.jpg",
      mapFull: "images/so-do-lab-1-chu-thich.jpg",
      description: "Sơ đồ phân khu & mã vị trí 5S (cập nhật theo hiện trạng 11/2026): 6 máy C1 – C6 dọc tường trái, 5 cụm bàn B1 – B10, máy cắt C7. Khi đăng ký, ghi mã bàn / máy theo sơ đồ ở ô “Khu vực sử dụng”, ví dụ B1, B2 hoặc C3. Mã bàn, mã máy dán ở góc phía lối đi.",
      areas: ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10", "C1", "C2", "C3", "C4", "C5", "C6", "C7"],
      zones: [
        { code: "A", name: "Giảng viên & quản lý Lab", detail: "Bàn giáo viên, khu quản lý Lab", color: "#2e8540", student: false },
        { code: "B", name: "Làm việc sinh viên", detail: "Bàn B1 – B10: 5 cụm × 2 bàn, mỗi bàn 2 ghế, mỗi bàn 1 mã", color: "#e8b400", student: true },
        { code: "C", name: "Máy C1 – C7", detail: "Máy C1 – C6 dọc tường trái · C7 máy cắt. Khu chú ý an toàn khi vận hành máy", color: "#d72134", student: true },
        { code: "D", name: "Lưu trữ", detail: "D1 tủ T1 · D2 tủ T2 · D3 dãy kệ K1 – K3 · D4 vật liệu tấm & dài", color: "#1f3a8a", student: false },
        { code: "E", name: "Khu xếp ghế", detail: "Ghế xếp cho sinh viên", color: "#d9a400", student: true },
        { code: "F", name: "Vệ sinh", detail: "F1 thùng rác, chổi, đồ hốt rác · F2 máy hút bụi cỡ lớn", color: "#c98a00", student: true }
      ]
    },
    {
      name: "Lab 2",
      map: "images/so-do-lab-2.jpg",
      description: "Phòng làm việc sinh viên gồm 4 khu (A – D) và 8 cụm bàn B1 – B8, đánh số từ cửa ra vào. Khi đăng ký, ghi mã cụm bàn ở ô “Khu vực sử dụng”, ví dụ B1 hoặc B5.",
      areas: ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"],
      zones: [
        { code: "A", name: "Khu giảng viên & quản lý Lab", detail: "Bàn giáo viên, máy tính và máy in quản lý Lab", color: "#c8102e", student: false },
        { code: "B", name: "Khu làm việc sinh viên", detail: "8 cụm bàn B1 – B8 (mỗi cụm 2 bàn quay lưng, có vách ngăn và 2 ghế). B1 – B4 dãy phải, B5 – B8 dãy trái", color: "#16803d", student: true },
        { code: "C", name: "Khu tủ vật tư & máy in", detail: "Tủ vật tư 1, Tủ vật tư 2 và máy in dọc tường trên", color: "#b07018", student: false },
        { code: "D", name: "Khu trình chiếu", detail: "Bảng trắng và màn chiếu – sinh viên được mượn", color: "#6d28d9", student: true }
      ]
    },
    {
      name: "Lab 3",
      map: "images/so-do-lab-3.jpg",
      description: "Lab tự động gồm 5 khu (A – E) và 6 bàn thực hành B1 – B6, đánh số từ bàn giáo viên. Khi đăng ký, ghi mã bàn ở ô “Khu vực sử dụng”, ví dụ B1 hoặc B4.",
      areas: ["B1", "B2", "B3", "B4", "B5", "B6"],
      zones: [
        { code: "A", name: "Khu giảng viên & quản lý Lab", detail: "Bàn giáo viên, máy tính và máy in quản lý Lab", color: "#c8102e", student: false },
        { code: "B", name: "Khu bàn thực hành", detail: "6 bàn thực hành có bảng treo dụng cụ: B1 – B3 dọc tường trái, B4 – B6 dọc tường trên", color: "#16803d", student: true },
        { code: "C", name: "Khu tủ vật tư", detail: "Tủ vật tư 1 và Tủ vật tư 2 dọc tường phải", color: "#b07018", student: false },
        { code: "D", name: "Khu bảng & màn chiếu", detail: "2 bảng trắng và màn chiếu trên tường dưới", color: "#6d28d9", student: true },
        { code: "E", name: "Khu robot & thiết bị tự động", detail: "Robot Logi 01, máy in socola, robot di động; bàn cánh tay robot kèm máy nén khí", color: "#0063b1", student: false }
      ]
    }
  ]
};
