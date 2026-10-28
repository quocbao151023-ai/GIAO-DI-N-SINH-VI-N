/* =========================================================
   GỌN GIAO DIỆN TRÊN ĐIỆN THOẠI (≤ 640px)
   Không bỏ nội dung nào: các mục dài được gập lại thành 1 dòng
   (bấm để mở). Máy tính / màn hình rộng không bị ảnh hưởng.
   Khi sinh viên phải "đọc hết hướng dẫn" (trước khi gửi đăng ký)
   thì mọi mục tự mở ra để đọc đầy đủ.
========================================================= */
(function () {
  const mq = window.matchMedia("(max-width: 640px)");
  const chevron = '<svg class="m-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- 1. Gập các mục của trang Hướng dẫn ---------- */
  const folds = [
    { id: "guideBooking", summary: sec => `${sec.querySelectorAll(".guide-steps > li").length} bước` },
    { id: "guideHandover", summary: sec => `${sec.querySelectorAll(".guide-steps > li").length} bước` },
    { id: "guideRules", summary: () => "Nội quy · An toàn" },
    { id: "guideFaq", summary: sec => `${sec.querySelectorAll("details").length || ""} câu hỏi`.trim() }
  ];

  function makeFold(section, summaryText) {
    if (!section || section.classList.contains("m-fold")) return;
    const head = section.querySelector(":scope > .guide-card-head") || section.querySelector(":scope > .section-title");
    if (!head) return;

    section.classList.add("m-fold");
    head.classList.add("m-fold-head");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "m-fold-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span class="m-fold-sum">${summaryText}</span>${chevron}`;
    head.appendChild(toggle);

    head.addEventListener("click", event => {
      if (!mq.matches) return;
      if (event.target.closest("a, .btn:not(.m-fold-toggle), [data-tab-target]")) return;
      setOpen(section, !section.classList.contains("is-open"));
    });
  }

  function setOpen(section, open) {
    section.classList.toggle("is-open", open);
    section.querySelector(".m-fold-toggle")?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function openFold(id) {
    const section = document.getElementById(id);
    if (section && section.classList.contains("m-fold")) setOpen(section, true);
  }

  function initGuideFolds() {
    folds.forEach(item => {
      const section = document.getElementById(item.id);
      if (section) makeFold(section, item.summary(section));
    });
  }

  /* ---------- 2. Gập ghi chú "Lưu ý quy định bàn giao" trên phiếu đăng ký ---------- */
  function initNoteFold() {
    document.querySelectorAll(".handover-rule-note").forEach(note => {
      if (note.classList.contains("m-note")) return;
      note.classList.add("m-note");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "m-note-toggle";
      button.innerHTML = `<span>Xem chi tiết</span>${chevron}`;
      (note.querySelector("strong")?.parentElement || note).appendChild(button);
      button.addEventListener("click", () => {
        const open = !note.classList.contains("is-open");
        note.classList.toggle("is-open", open);
        button.querySelector("span").textContent = open ? "Thu gọn" : "Xem chi tiết";
      });
    });
  }

  /* ---------- 3. Mở đúng mục khi bấm mục lục / liên kết "Xem nội quy", "Xem sơ đồ" ---------- */
  document.addEventListener("click", event => {
    const link = event.target.closest(".guide-jump a, [data-open-guide]");
    if (!link) return;
    const id = (link.getAttribute("href") || "").replace("#", "");
    if (id) openFold(id);
  }, true);

  /* ---------- 4. Chế độ "đọc hết hướng dẫn": mở tất cả để đọc đầy đủ ---------- */
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains("is-reading-guide")) {
      document.querySelectorAll(".m-fold").forEach(section => setOpen(section, true));
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  /* ---------- 5. Lịch: tóm tắt thống kê tuần thành 1 dòng ---------- */
  function initScheduleSummary() {
    const row = document.querySelector(".lab-summary-row");
    if (!row || row.querySelector(".m-sum-line")) return;
    const line = document.createElement("div");
    line.className = "m-sum-line";
    row.prepend(line);

    const update = () => {
      const total = document.getElementById("totalBookings")?.textContent.trim() || "0";
      const parts = ["lab1", "lab2", "lab3"].map((key, i) =>
        `<span class="m-sum-lab ${key}"><i></i>Lab ${i + 1} <b>${document.getElementById(key + "Usage")?.textContent.trim() || "0%"}</b></span>`);
      line.innerHTML = `<span class="m-sum-total"><b>${total}</b> lượt trong tuần</span>${parts.join("")}`;
    };
    update();
    ["totalBookings", "lab1Usage", "lab2Usage", "lab3Usage"].forEach(id => {
      const el = document.getElementById(id);
      if (el) new MutationObserver(update).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function init() {
    initGuideFolds();
    initNoteFold();
    initScheduleSummary();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
