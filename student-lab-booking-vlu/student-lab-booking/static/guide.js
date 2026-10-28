/* =========================================================
   TRANG HƯỚNG DẪN SỬ DỤNG
   Số liệu (ca, sức chứa, số thành viên) lấy từ cấu hình trong app.js
   nên luôn khớp với quy tắc đăng ký của hệ thống.
========================================================= */

(function () {
  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const maxGroups = typeof MAX_GROUPS !== "undefined" ? MAX_GROUPS : 9;
  const maxPeople = typeof MAX_PEOPLE !== "undefined" ? MAX_PEOPLE : 108;
  const maxMembers = typeof MAX_MEMBERS !== "undefined" ? MAX_MEMBERS : 12;
  const shifts = typeof SHIFTS !== "undefined" ? SHIFTS : [];

  /* ---------- Thông tin chung ---------- */
  const facts = document.getElementById("guideFacts");

  if (facts) {
    facts.innerHTML = `
      <div class="card guide-fact">
        <span class="guide-fact-label">Khung giờ mỗi ngày</span>
        <ul class="guide-shifts">
          ${shifts.map(s => `<li><b>${esc(s.name)}</b><span>${esc(s.time)}</span></li>`).join("")}
        </ul>
        <small>Từ Thứ 2 đến Thứ 7</small>
      </div>

      <div class="card guide-fact">
        <span class="guide-fact-label">Sức chứa mỗi ca / phòng</span>
        <strong>${maxGroups} nhóm</strong>
        <small>Tối đa ${maxPeople} sinh viên. Khung giờ đủ chỗ sẽ hiện màu hồng.</small>
      </div>

      <div class="card guide-fact">
        <span class="guide-fact-label">Mỗi lượt đăng ký</span>
        <strong>1 – ${maxMembers} người</strong>
        <small>Cá nhân: 1 người · Nhóm: từ 2 đến ${maxMembers} người.</small>
      </div>

      <div class="card guide-fact">
        <span class="guide-fact-label">Thời gian đăng ký</span>
        <strong>Từ hôm nay</strong>
        <small>Không đăng ký cho ngày đã qua. Mỗi sinh viên chỉ thuộc 1 nhóm trong cùng khung giờ.</small>
      </div>
    `;
  }

  /* ---------- Sơ đồ & nội dung phòng Lab ---------- */
  const labs = (window.LAB_GUIDE && window.LAB_GUIDE.labs) || [];
  const tabs = document.getElementById("guideLabTabs");
  const body = document.getElementById("guideLabBody");
  const labClass = name => ({ "Lab 1": "lab-1", "Lab 2": "lab-2", "Lab 3": "lab-3" }[name] || "lab-1");

  const list = (items, empty) => items && items.length
    ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join("")}</ul>`
    : `<p class="guide-empty">${empty}</p>`;

  function showLab(index) {
    const lab = labs[index];
    if (!lab || !body) return;

    tabs.querySelectorAll("button").forEach((button, i) => {
      button.classList.toggle("active", i === index);
      button.setAttribute("aria-selected", i === index ? "true" : "false");
    });

    const zones = lab.zones || [];
    const mapFull = lab.mapFull || lab.map;

    body.innerHTML = `
      <figure class="guide-map ${lab.map ? "" : "is-empty"}">
        ${lab.map
          ? `<a href="/static/${esc(mapFull)}" data-lightbox data-title="Sơ đồ bố trí ${esc(lab.name)}" title="Xem sơ đồ kích thước đầy đủ">
               <img src="/static/${esc(lab.map)}" alt="Sơ đồ bố trí ${esc(lab.name)}" loading="lazy">
               <span class="guide-map-zoom">Phóng to sơ đồ</span>
             </a>`
          : `<div class="guide-map-empty"><b>${esc(lab.name)}</b><span>Sơ đồ bố trí đang được cập nhật</span></div>`}
      </figure>

      <div class="guide-lab-info">
        <div class="guide-lab-top">
          <div class="guide-lab-name ${labClass(lab.name)}">${esc(lab.name)}</div>
          <button type="button" class="btn btn-outline btn-sm" data-guide-calendar="${esc(lab.name)}">Xem lịch ${esc(lab.name)}</button>
        </div>
        ${lab.description
          ? `<p class="guide-lab-desc">${esc(lab.description)}</p>`
          : `<p class="guide-empty">Thông tin chi tiết về phòng đang được cập nhật.</p>`}

        <div>
          <h4>Khu chức năng</h4>
          ${zones.length
            ? `<ul class="guide-zones">${zones.map(zone => `
                <li style="--zone:${esc(zone.color || "#6b7280")}">
                  <b class="guide-zone-code">${esc(zone.code)}</b>
                  <div>
                    <strong>${esc(zone.name)}</strong>
                    <span>${esc(zone.detail)}</span>
                  </div>
                  <em class="guide-zone-tag ${zone.student ? "is-student" : ""}">${zone.student ? "Sinh viên sử dụng" : "KTV / GV quản lý"}</em>
                </li>`).join("")}
              </ul>`
            : `<p class="guide-empty">Đang cập nhật</p>`}
        </div>
      </div>
    `;
  }

  if (tabs && labs.length) {
    tabs.innerHTML = labs.map((lab, i) =>
      `<button type="button" role="tab" class="${labClass(lab.name)}" data-index="${i}">${esc(lab.name)}</button>`
    ).join("");

    tabs.addEventListener("click", event => {
      const button = event.target.closest("button[data-index]");
      if (button) showLab(Number(button.dataset.index));
    });

    showLab(0);

    // Cho phiếu đăng ký mở đúng sơ đồ của phòng đang chọn
    window.showGuideLab = name => {
      const index = labs.findIndex(lab => lab.name === name);
      if (index >= 0) showLab(index);
    };
  }

  // "Xem lịch Lab x": mở tab lịch và lọc đúng phòng
  if (body) {
    body.addEventListener("click", event => {
      const button = event.target.closest("[data-guide-calendar]");
      if (!button) return;

      const filter = document.getElementById("labFilter");
      if (filter) {
        filter.value = button.dataset.guideCalendar;
        filter.dispatchEvent(new Event("change"));
      }
      if (typeof openPanel === "function") openPanel("schedulePanel");
    });
  }

  /* ---------- Câu hỏi thường gặp ---------- */
  const faq = [
    ["Vì sao không bấm được thẻ Lab màu hồng?",
     `Khung giờ đó đã đủ ${maxGroups} nhóm (hoặc ${maxPeople} sinh viên). Vui lòng chọn ca hoặc ngày khác.`],
    ["Đăng ký cá nhân và nhóm khác nhau thế nào?",
     `Cá nhân chỉ gồm người đại diện. Nhóm gồm người đại diện và các thành viên, tổng cộng từ 2 đến ${maxMembers} người; người đại diện được tự động thêm vào danh sách.`],
    ["Một sinh viên có thể ở hai nhóm cùng khung giờ không?",
     "Không. Mỗi MSSV chỉ thuộc một nhóm trong cùng khung giờ. Nếu bạn (người đăng ký) đăng ký lại cùng ngày, cùng ca, hệ thống giữ lượt mới, hủy lượt trước và gửi email báo cho bạn."],
    ["Mã đăng ký có dạng như thế nào?",
     "Mã gồm phòng, ca, ngày và số thứ tự, ví dụ L1C201062026-01 (Lab 1 – Ca 2 – ngày 01/06/2026 – lượt 01). Mã hiện ngay sau khi gửi đăng ký thành công."],
    ["Ai được bàn giao phòng?",
     "Đăng ký cá nhân: chính bạn. Đăng ký nhóm: theo hình thức nhóm đã chọn khi đăng ký – chọn “Người đại diện” thì chỉ người đại diện bàn giao cho cả nhóm; chọn “Từng thành viên” thì mỗi người tự bàn giao bằng MSSV của mình."],
    ["Có đăng ký nhiều ca một lần được không?",
     "Được. Ở ô Ca sử dụng, đánh dấu các ca cần dùng trong cùng ngày, cùng phòng rồi gửi 1 lần. Bạn nhận 1 mã đăng ký dùng chung cho tất cả các ca đã chọn (mã hiện ở từng ca trên lịch); sau ca cuối cùng chỉ cần bàn giao 1 lần bằng mã đó. Nếu một ca đã đủ nhóm, hệ thống không ghi ca nào để bạn chọn lại."],
    ["Ảnh bàn giao cần những gì?",
     "Mỗi phần (trước và sau khi sử dụng) cần từ 1 đến 5 ảnh định dạng JPG, PNG, WEBP hoặc HEIC, thể hiện rõ khu vực phụ trách."],
    ["Nếu quên bàn giao phòng thì sao?",
     "Lần 1 – 2 chưa bàn giao trong tháng được ghi nhận vào phiếu điểm danh; kỹ thuật viên xem xét điểm danh của nhóm hoặc sinh viên liên quan. Đủ 3 lần trong tháng, người đăng ký bị tạm khóa đăng ký (cá nhân hoặc nhóm) đến hết tháng. Lượt nhóm chưa bàn giao được tính cho tất cả thành viên."],
    ["Vì sao phải đọc hết hướng dẫn mới gửi được đăng ký?",
     "Khi đánh dấu ô cam kết, bạn xác nhận đã đọc nội quy và quy định an toàn. Hệ thống chuyển sang trang Hướng dẫn và mở lại phiếu đăng ký (giữ nguyên thông tin đã nhập) sau khi bạn kéo xuống hết trang."],
    ["Cần kỹ thuật viên hỗ trợ thì làm sao?",
     "Chọn “Có” ở mục Hỗ trợ kỹ thuật khi đăng ký để kỹ thuật viên chuẩn bị trước."],
    ["Quên mã đăng ký hoặc gặp sự cố?",
     "Liên hệ Khoa Kỹ thuật và Quản lý Công nghiệp: 028.71098.256 (4340) – k.iem@vlu.edu.vn."]
  ];

  const faqList = document.getElementById("guideFaqList");
  if (faqList) {
    faqList.innerHTML = faq.map(([q, a], i) => `
      <details ${i === 0 ? "open" : ""}>
        <summary>${esc(q)}</summary>
        <p>${esc(a)}</p>
      </details>
    `).join("");
  }

  /* ---------- Nội quy & quy định an toàn: chuyển tab ---------- */
  const ruleTabs = document.getElementById("guideRuleTabs");
  if (ruleTabs) {
    ruleTabs.addEventListener("click", event => {
      const button = event.target.closest("button[data-rule]");
      if (!button) return;
      ruleTabs.querySelectorAll("button").forEach(b => {
        const on = b === button;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll("[data-rule-panel]").forEach(panel => {
        panel.hidden = panel.dataset.rulePanel !== button.dataset.rule;
      });
    });
  }

  /* ---------- Xem ảnh lớn (lightbox) có nút Đóng, Esc, bấm nền để thoát ---------- */
  const lightbox = document.getElementById("vluLightbox");
  if (lightbox) {
    const img = document.getElementById("lightboxImg");
    const stage = document.getElementById("lightboxStage");
    const zoomBtn = document.getElementById("lightboxZoom");
    const download = document.getElementById("lightboxDownload");
    let lastFocus = null;

    const setZoom = on => {
      stage.classList.toggle("is-zoomed", on);
      zoomBtn.querySelector("span").textContent = on ? "Vừa màn hình" : "Phóng to";
      if (!on) stage.scrollTo(0, 0);
    };
    const close = () => {
      lightbox.hidden = true;
      document.body.classList.remove("modal-open");
      img.removeAttribute("src");
      if (lastFocus) lastFocus.focus();
    };
    const open = (src, title) => {
      lastFocus = document.activeElement;
      document.getElementById("lightboxTitle").textContent = title || "Xem ảnh";
      img.src = src;
      img.alt = title || "";
      download.href = src;
      setZoom(false);
      lightbox.hidden = false;
      document.body.classList.add("modal-open");
      setTimeout(() => lightbox.querySelector(".lightbox-close").focus(), 30);
    };

    document.addEventListener("click", event => {
      const link = event.target.closest("[data-lightbox]");
      if (!link) return;
      event.preventDefault();
      open(link.getAttribute("href"), link.dataset.title);
    });
    zoomBtn.addEventListener("click", () => setZoom(!stage.classList.contains("is-zoomed")));
    img.addEventListener("click", () => setZoom(!stage.classList.contains("is-zoomed")));
    lightbox.querySelectorAll("[data-lightbox-close]").forEach(el => el.addEventListener("click", close));
    lightbox.addEventListener("click", event => {
      if (event.target === lightbox || event.target === stage) close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !lightbox.hidden) close();
    });
  }

  /* ---------- BẮT BUỘC ĐỌC HƯỚNG DẪN TRƯỚC KHI ĐĂNG KÝ ----------
     Bấm ô cam kết -> chuyển sang trang Hướng dẫn (hiện đủ nội quy + quy định an toàn),
     kéo xuống hết trang mới bấm được "Xác nhận đã đọc" -> quay lại phiếu, ô cam kết được đánh dấu.
     Đã đọc trong phiên làm việc này thì lần đăng ký sau không phải đọc lại. */
  const READ_KEY = "labGuideRead.v1";
  const commit = document.getElementById("commitment");
  const guidePanel = document.getElementById("guidePanel");
  const gate = document.getElementById("readGate");
  const commitGate = document.getElementById("commitGate");
  let guideRead = false;
  let reading = false;

  try { guideRead = sessionStorage.getItem(READ_KEY) === "1"; } catch (e) { guideRead = false; }

  const renderCommitGate = () => {
    if (!commitGate) return;
    commitGate.classList.toggle("is-done", guideRead);
    commitGate.querySelector("span").textContent = guideRead
      ? "Bạn đã đọc hết hướng dẫn, nội quy và quy định an toàn."
      : "Bắt buộc: bấm vào ô cam kết để đọc hết trang Hướng dẫn trước khi gửi đăng ký.";
  };

  const updateProgress = () => {
    if (!reading || !gate || !guidePanel) return;
    const gateHeight = gate.offsetHeight;
    const rect = guidePanel.getBoundingClientRect();
    const visibleBottom = window.innerHeight - gateHeight;
    const ratio = Math.max(0, Math.min(1, (visibleBottom - rect.top) / rect.height));
    const done = rect.bottom <= visibleBottom + 12;
    const pct = done ? 100 : Math.min(99, Math.round(ratio * 100));

    document.getElementById("readGateBar").style.width = pct + "%";
    document.getElementById("readGatePct").textContent = pct + "%";

    if (done && !gate.classList.contains("is-done")) {
      guideRead = true;
      try { sessionStorage.setItem(READ_KEY, "1"); } catch (e) { /* bỏ qua */ }
      gate.classList.add("is-done");
      document.getElementById("readGateTitle").textContent = "Bạn đã đọc hết hướng dẫn";
      document.getElementById("readGateSub").textContent = "Bấm xác nhận để quay lại phiếu đăng ký, thông tin bạn đã nhập vẫn được giữ nguyên.";
      const button = document.getElementById("readGateDone");
      button.disabled = false;
      button.textContent = "Xác nhận & quay lại đăng ký";
      renderCommitGate();
    }
  };

  const stopReading = () => {
    reading = false;
    if (gate) gate.hidden = true;
    if (guidePanel) guidePanel.classList.remove("is-reading");
    document.body.classList.remove("is-reading-guide");
  };

  const startReading = () => {
    if (!gate || !guidePanel) return;
    reading = true;
    gate.hidden = false;
    gate.classList.toggle("is-done", false);
    document.getElementById("readGateTitle").textContent = "Đọc hết hướng dẫn để tiếp tục đăng ký";
    document.getElementById("readGateSub").textContent = "Kéo xuống cuối trang: sơ đồ phòng Lab, quy trình, nội quy, quy định an toàn và hỏi đáp.";
    const button = document.getElementById("readGateDone");
    button.disabled = true;
    button.textContent = "Xác nhận đã đọc";
    guidePanel.classList.add("is-reading");
    document.body.classList.add("is-reading-guide");
    if (typeof openPanel === "function") openPanel("guidePanel");
    setTimeout(() => {
      window.scrollTo({ top: guidePanel.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
      updateProgress();
    }, 60);
  };

  const finishReading = () => {
    stopReading();
    if (typeof openPanel === "function") openPanel("bookingPanel");
    if (commit) {
      commit.checked = true;
      commit.dispatchEvent(new Event("change", { bubbles: true }));
      setTimeout(() => commit.closest(".card").scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    }
  };

  if (commit && gate) {
    commit.addEventListener("click", event => {
      if (guideRead || !commit.checked) return;   // bỏ đánh dấu thì không chặn
      event.preventDefault();                     // giữ ô cam kết ở trạng thái chưa đánh dấu
      startReading();
    });

    document.querySelectorAll("[data-read-guide]").forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (guideRead) {
          if (typeof openPanel === "function") openPanel("guidePanel");
          const target = document.querySelector(link.getAttribute("href"));
          if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
        } else {
          startReading();
        }
      });
    });

    document.getElementById("readGateDone").addEventListener("click", () => {
      if (guideRead) finishReading();
    });

    // Rời trang Hướng dẫn bằng menu khi chưa đọc xong -> tắt thanh tiến độ
    document.addEventListener("click", event => {
      const tab = event.target.closest("[data-tab-target]");
      if (reading && tab && tab.dataset.tabTarget !== "guidePanel") stopReading();
    }, true);

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    renderCommitGate();
  }

  /* Liên kết "Xem sơ đồ", "nội quy" trong phiếu đăng ký -> mở trang Hướng dẫn đúng mục */
  document.querySelectorAll("[data-open-guide]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof openPanel === "function") openPanel("guidePanel");
      const room = document.getElementById("room")?.value;
      if (link.getAttribute("href") === "#guideLabs" && room && window.showGuideLab) window.showGuideLab(room);
      const target = document.querySelector(link.getAttribute("href"));
      if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    });
  });

  /* Liên kết mục lục: cuộn mượt tới phần tương ứng */
  document.querySelectorAll(".guide-jump a").forEach(link => {
    link.addEventListener("click", event => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
})();
