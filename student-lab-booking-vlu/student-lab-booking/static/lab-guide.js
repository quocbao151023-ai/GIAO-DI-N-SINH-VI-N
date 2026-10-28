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
      description: "Phòng được chia thành 5 khu chức năng (A – E). Khi đăng ký, ghi mã bàn / máy theo sơ đồ ở ô “Khu vực sử dụng”, ví dụ B1, B2 hoặc C3.",
      areas: ["B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "C5"],
      zones: [
        { code: "A", name: "Khu giảng viên & quản lý Lab", detail: "Bàn giáo viên, máy tính quản lý Lab", color: "#c8102e", student: false },
        { code: "B", name: "Khu làm việc sinh viên", detail: "4 bàn làm việc B1 – B4, ghế bố trí ở hai đầu bàn", color: "#16803d", student: true },
        { code: "C", name: "Khu máy & thiết bị thực hành", detail: "Máy 1 – Máy 5 (mã C1 – C5) và khu vật liệu đầu dãy máy", color: "#0063b1", student: true },
        { code: "D", name: "Khu lưu trữ vật tư", detail: "D1 kệ lưu trữ dọc tường · D2 Tủ vật tư 2 · D3 khu để ghế xếp và Tủ vật tư 1", color: "#b07018", student: false },
        { code: "E", name: "Khu điều khiển máy", detail: "Thiết bị gắn tường và bàn để Lab điều khiển máy", color: "#6d28d9", student: false }
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
