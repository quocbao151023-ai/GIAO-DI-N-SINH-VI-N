/* =========================================================
   KẾT QUẢ KTV KIỂM TRA 5S SAU BÀN GIAO
   Gửi phiếu -> "Chờ KTV kiểm tra" (ở lại phòng)
     -> KTV xác nhận Đạt: "Đạt 5S – bạn có thể ra về"
     -> KTV ghi Chưa đạt: hiện các mục cần làm lại -> sinh viên làm lại, bấm "Đã làm lại xong"
        -> "Đã làm lại – chờ KTV kiểm tra lại" -> … cho đến khi KTV xác nhận Đạt.
   Trang tự hỏi lại máy chủ mỗi 20 giây khi đang chờ.
========================================================= */

(function () {
  const box = document.getElementById("checkResult");
  const openButton = document.getElementById("checkResultButton");
  if (!box) return;

  const STORE_KEY = "vlu_handover_check";
  const POLL_MS = 20000;
  let watch = null;      // { id_key, student_id }
  let timer = null;
  let busy = false;

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const save = value => {
    try {
      if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORE_KEY);
    } catch (error) { /* trình duyệt chặn lưu trữ: chỉ theo dõi trong phiên này */ }
  };

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (error) { return null; }
  };

  const ICON = {
    wait: `<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C6.485 22 2 17.515 2 12S6.485 2 12 2s10 4.485 10 10-4.485 10-10 10Zm0-18.5c-4.685 0-8.5 3.815-8.5 8.5 0 4.685 3.815 8.5 8.5 8.5 4.685 0 8.5-3.815 8.5-8.5 0-4.685-3.815-8.5-8.5-8.5Zm.75 3.5v4.69l3.03 3.03-1.06 1.06-3.47-3.47V7h1.5Z" fill="currentColor"/></svg>`,
    ok: `<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 12c0 5.515 4.485 10 10 10s10-4.485 10-10S17.515 2 12 2 2 6.485 2 12Zm1.5 0c0-4.685 3.815-8.5 8.5-8.5 4.685 0 8.5 3.815 8.5 8.5 0 4.685-3.815 8.5-8.5 8.5-4.685 0-8.5-3.815-8.5-8.5Zm6.115 3.175c.245.245.565.365.885.365.32 0 .64-.12.885-.365L17.28 9.28l-1.06-1.06-5.72 5.72-2.22-2.22-1.06 1.06 2.395 2.395Z" fill="currentColor"/></svg>`,
    redo: `<svg class="gi" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C6.485 22 2 17.515 2 12S6.485 2 12 2s10 4.485 10 10-4.485 10-10 10Zm0-18.5c-4.685 0-8.5 3.815-8.5 8.5 0 4.685 3.815 8.5 8.5 8.5 4.685 0 8.5-3.815 8.5-8.5 0-4.685-3.815-8.5-8.5-8.5Zm.75 10V7h-1.5v6.5h1.5ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" fill="currentColor"/></svg>`
  };

  function stopPolling() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function startPolling() {
    stopPolling();
    timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
  }

  function render(data) {
    box.hidden = false;
    const head = `
      <div class="check-meta">
        <span>Mã đăng ký <b>${esc(data.id_key)}</b></span>
        <span>Mã bàn giao <b>${esc(data.handover_id)}</b></span>
        ${data.checklist ? `<span>Bảng kiểm tự khai <b>${esc(data.checklist)}</b></span>` : ""}
      </div>`;

    const close = `<button type="button" class="check-close" data-check-close aria-label="Ẩn kết quả">Ẩn</button>`;

    if (data.state === "dat") {
      box.className = "card form-card check-result tone-ok";
      box.innerHTML = `
        ${close}
        <div class="check-status">${ICON.ok}<div><h3>Đạt 5S – bạn có thể ra về</h3>
        <p>KTV đã kiểm tra và xác nhận khu vực bàn giao đạt 5S${data.ktv_at ? ` lúc ${esc(data.ktv_at)}` : ""}. Cảm ơn bạn!</p></div></div>
        ${data.ktv_note ? `<p class="check-note"><b>Ghi chú KTV:</b> ${esc(data.ktv_note)}</p>` : ""}
        ${head}`;
      stopPolling();
      return;
    }

    if (data.state === "lam_lai") {
      box.className = "card form-card check-result tone-redo";
      box.innerHTML = `
        <div class="check-status">${ICON.redo}<div><h3>Chưa đạt – cần làm lại</h3>
        <p>KTV đã kiểm tra${data.ktv_at ? ` lúc ${esc(data.ktv_at)}` : ""}. Làm lại các mục dưới đây, xong bấm <b>Đã làm lại xong</b> để KTV kiểm tra lại. Trạng thái giữ <b>Chưa đạt</b> cho đến khi KTV xác nhận Đạt.</p></div></div>
        ${data.redo_items.length
          ? `<ul class="check-items">${data.redo_items.map(item => `<li>${esc(item)}</li>`).join("")}</ul>`
          : data.ktv_codes.length ? `<p class="check-note"><b>Mã lỗi:</b> ${esc(data.ktv_codes.join(", "))}</p>` : ""}
        ${data.ktv_note ? `<p class="check-note"><b>Ghi chú KTV:</b> ${esc(data.ktv_note)}</p>` : ""}
        <div class="check-redo">
          <input type="text" id="checkRedoNote" maxlength="300" placeholder="Đã làm gì (không bắt buộc) – ví dụ: đã kéo bàn B3 về đúng vạch">
          <button type="button" class="btn btn-red" data-check-redo>Đã làm lại xong</button>
        </div>
        <p class="check-msg" id="checkMsg"></p>
        ${head}`;
      startPolling();
      return;
    }

    const recheck = data.state === "cho_kiem_lai";
    box.className = "card form-card check-result tone-wait";
    box.innerHTML = `
      ${close}
      <div class="check-status">${ICON.wait}<div><h3>${recheck ? "Đã báo làm lại – chờ KTV kiểm tra lại" : "Chờ KTV kiểm tra 5S"}</h3>
      <p>Vui lòng <b>ở lại phòng</b>. KTV đã nhận thông báo trên hệ thống quản lý và sẽ kiểm tra khu vực bạn bàn giao. Trang tự cập nhật – không cần tải lại.</p></div></div>
      <p class="check-live"><span class="pulse"></span> Đang chờ kết quả · cập nhật mỗi 20 giây</p>
      ${head}`;
    startPolling();
  }

  async function post(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) throw new Error(json.message || `Lỗi máy chủ (HTTP ${response.status}).`);
    return json;
  }

  async function refresh() {
    if (!watch || busy) return;
    busy = true;
    try {
      const json = await post("/api/handover-result", watch);
      render(json.data);
    } catch (error) {
      if (!timer) {
        box.hidden = false;
        box.className = "card form-card check-result tone-wait";
        box.innerHTML = `<div class="check-status">${ICON.redo}<div><h3>Chưa xem được kết quả</h3><p>${esc(error.message)}</p></div></div>`;
      }
    } finally {
      busy = false;
    }
  }

  function follow(idKey, studentId) {
    watch = { id_key: String(idKey || "").trim(), student_id: String(studentId || "").trim() };
    save(watch);
    refresh();
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  box.addEventListener("click", async event => {
    if (event.target.closest("[data-check-close]")) {
      stopPolling();
      watch = null;
      save(null);
      box.hidden = true;
      return;
    }

    const redo = event.target.closest("[data-check-redo]");
    if (!redo || !watch) return;
    redo.disabled = true;
    const msg = document.getElementById("checkMsg");
    if (msg) msg.textContent = "Đang gửi...";
    try {
      const json = await post("/api/handover-redo", {
        ...watch,
        note: (document.getElementById("checkRedoNote") || {}).value || ""
      });
      render(json.data);
    } catch (error) {
      if (msg) msg.textContent = error.message;
      redo.disabled = false;
    }
  });

  document.addEventListener("handover:submitted", event => {
    const detail = event.detail || {};
    if (detail.id_key && detail.student_id) follow(detail.id_key, detail.student_id);
  });

  if (openButton) {
    openButton.addEventListener("click", () => {
      const idKey = (document.getElementById("handoverIdKey") || {}).value;
      const studentId = (document.getElementById("handoverStudentId") || {}).value;
      if (!idKey || !studentId) {
        if (typeof showHandoverMessage === "function") {
          showHandoverMessage("Nhập Mã đăng ký và MSSV đã dùng khi gửi phiếu bàn giao để xem kết quả 5S.", "error");
        }
        return;
      }
      follow(idKey, studentId);
    });
  }

  // Mở lại trang trong lúc đang chờ: tiếp tục theo dõi lượt đã gửi
  const saved = load();
  if (saved && saved.id_key && saved.student_id) {
    watch = saved;
    refresh();
  }
})();
