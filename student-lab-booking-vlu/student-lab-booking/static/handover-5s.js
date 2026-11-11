/* =========================================================
   PHIẾU BÀN GIAO THEO SOP LAB 1 – 5S (bản 2.0)
   - Bảng kiểm cuối ca theo khu (SOP-02 trang 2): chọn khu đã dùng -> hiện đúng các mục,
     mỗi mục gắn S1 – S5; mục không tích -> mã lỗi <khu>-<S> (vd B-S2).
   - Tình trạng sau bàn giao tự suy ra (sinh viên không tự chọn):
       có sự cố -> "Có sự cố cần xử lý"; còn mục chưa đạt -> "Đã vệ sinh, cần kiểm tra thêm";
       đạt hết -> "Sạch và gọn gàng".
   - Sự cố có cấu trúc (SOP-04): mã máy / vị trí, loại sự cố, xác nhận đã dừng máy.
   - Nhắc trả món BÁO KTV đang mượn (SOP-03) và báo hộp / rổ sắp hết.
   Nội dung bảng kiểm, loại sự cố lấy từ máy chủ (window.HANDOVER_CONFIG) – 1 nguồn duy nhất.
========================================================= */

(function () {
  const config = window.HANDOVER_CONFIG || {};
  const checklist = config.checklist || [];
  const form = document.getElementById("handoverForm");
  const zonesBox = document.getElementById("check5sZones");
  const listBox = document.getElementById("check5sList");
  const resultBox = document.getElementById("check5sResult");
  const conditionSelect = document.getElementById("handoverCondition");
  const derivedBox = document.getElementById("derivedCondition");
  const incidentDetail = document.getElementById("incidentDetail");
  const incidentTarget = document.getElementById("incidentTarget");
  const incidentType = document.getElementById("incidentType");
  const incidentSafety = document.getElementById("incidentSafety");
  const noteLabel = document.getElementById("areaNoteLabel");
  const noteInput = document.getElementById("handoverAreaNote");
  const loansBox = document.getElementById("openLoansBox");
  const lowStockPick = document.getElementById("lowStockPick");

  if (!form || !zonesBox || !listBox || !checklist.length) return;

  const esc = value => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const [COND_OK, COND_CHECK, COND_PROBLEM] = config.conditions || [
    "Sạch và gọn gàng", "Đã vệ sinh, cần kiểm tra thêm", "Có sự cố cần xử lý"
  ];

  // app.js mở khóa bằng lớp "is-unlocked" sau khi xác minh
  const isLocked = () => {
    const card = document.getElementById("handoverDetailCard");
    return !card || !card.classList.contains("is-unlocked");
  };

  /* ---------- Chọn khu ---------- */

  function renderZones(selected) {
    const picked = new Set(selected || []);
    zonesBox.innerHTML = checklist.map(zone => zone.always
      ? `<span class="zone-chip is-always" title="Luôn kiểm tra"><b>${esc(zone.zone)}</b> ${esc(zone.name)} <em>luôn kiểm</em></span>`
      : `<label class="zone-chip">
           <input type="checkbox" name="zones" value="${esc(zone.zone)}" ${picked.has(zone.zone) ? "checked" : ""} ${isLocked() ? "disabled" : ""}>
           <span><b>${esc(zone.zone)}</b> ${esc(zone.name)}</span>
         </label>`
    ).join("");
  }

  function selectedZones() {
    return [...zonesBox.querySelectorAll('input[name="zones"]:checked')].map(box => box.value);
  }

  /* ---------- Bảng kiểm ---------- */

  function renderList() {
    const zones = new Set(selectedZones());
    const keep = new Set([...listBox.querySelectorAll('input[name="checklist"]:checked')].map(box => box.value));
    const locked = isLocked();

    listBox.innerHTML = checklist
      .filter(zone => zone.always || zones.has(zone.zone))
      .map(zone => `
        <fieldset class="check5s-zone zone-${esc(zone.zone.toLowerCase())}">
          <legend><b>${esc(zone.zone)}</b> ${esc(zone.name)}</legend>
          ${zone.items.map((item, index) => {
            const id = `${zone.zone}${index + 1}`;
            return `
              <label class="check5s-item">
                <input type="checkbox" name="checklist" value="${id}" ${keep.has(id) ? "checked" : ""} ${locked ? "disabled" : ""}>
                <span class="check5s-text">${esc(item.text)}</span>
                <span class="s-tag s-${esc(item.s.toLowerCase())}">${esc(item.s)}</span>
              </label>`;
          }).join("")}
        </fieldset>`).join("");

    update();
  }

  function evaluate() {
    const zones = new Set(selectedZones());
    let total = 0;
    let passed = 0;
    const codes = [];

    checklist.forEach(zone => {
      if (!zone.always && !zones.has(zone.zone)) return;
      zone.items.forEach((item, index) => {
        const box = listBox.querySelector(`input[value="${zone.zone}${index + 1}"]`);
        total += 1;
        if (box && box.checked) {
          passed += 1;
        } else {
          const code = `${zone.zone}-${item.s}`;
          if (!codes.includes(code)) codes.push(code);
        }
      });
    });

    return { total, passed, codes };
  }

  function hasIncident() {
    const picked = form.querySelector('input[name="has_incident"]:checked');
    return Boolean(picked && picked.value === "1");
  }

  function update() {
    const result = evaluate();
    const incident = hasIncident();

    resultBox.innerHTML = result.total
      ? `Đạt <b>${result.passed}/${result.total}</b> mục${result.codes.length
          ? ` · Mã lỗi: ${result.codes.map(code => `<span class="err-code">${esc(code)}</span>`).join(" ")}`
          : ""}`
      : "";

    const condition = incident ? COND_PROBLEM : result.codes.length ? COND_CHECK : COND_OK;
    if (conditionSelect) conditionSelect.value = condition;

    const tone = incident ? "problem" : result.codes.length ? "check" : "ok";
    const why = incident
      ? "vì đã báo sự cố (SOP-04)"
      : result.codes.length
        ? "vì còn mục chưa đạt – ghi lý do ở ô Ghi chú"
        : "vì đạt tất cả mục của bảng kiểm";
    if (derivedBox) {
      derivedBox.className = `derived-condition tone-${tone}`;
      derivedBox.innerHTML = `<span>Tình trạng sau bàn giao (tự xác định)</span><b>${esc(condition)}</b><small>${esc(why)}</small>`;
    }

    if (incidentDetail) incidentDetail.hidden = !incident;
    if (noteLabel) noteLabel.innerHTML = incident ? "Mô tả sự cố <b>*</b>" : "Ghi chú khu vực";
    if (noteInput) {
      noteInput.placeholder = incident
        ? "Hiện tượng, lúc nào, ảnh hưởng gì (máy rung, tiếng ồn lạ, thiếu dụng cụ…)"
        : "Mục chưa đạt vì sao, thiết bị, bàn ghế, dụng cụ cần lưu ý...";
    }
  }

  /* ---------- Sự cố ---------- */

  function fillIncidentOptions() {
    if (incidentTarget) {
      incidentTarget.innerHTML = `<option value="">-- Chọn mã --</option>` +
        (config.incident_targets || []).map(code => `<option value="${esc(code)}">${esc(code)}</option>`).join("");
    }
    if (incidentType) {
      incidentType.innerHTML = `<option value="">-- Chọn loại --</option>` +
        (config.incident_types || []).map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join("");
    }
  }

  /* ---------- Nhắc trả món đang mượn ---------- */

  function renderLoans(loans) {
    if (!loansBox) return;
    if (!loans || !loans.length) {
      loansBox.hidden = true;
      loansBox.innerHTML = "";
      return;
    }
    loansBox.hidden = false;
    loansBox.innerHTML = `
      <strong>Lượt này còn ${loans.length} món BÁO KTV chưa trả</strong>
      <ul>${loans.map(loan => `<li><b>${esc(loan.item)}</b> × ${esc(loan.qty || 1)}${loan.name ? ` <small>· ${esc(loan.name)}</small>` : ""}</li>`).join("")}</ul>
      <p>Trả cho KTV trước khi gửi phiếu bàn giao (SOP-03). KTV kiểm tra và bấm Đã trả trên hệ thống.</p>`;
  }

  /* ---------- Báo hộp / rổ sắp hết ---------- */

  function renderLowStock(locations) {
    if (!lowStockPick) return;
    const locked = isLocked();

    if (locations && locations.length) {
      lowStockPick.innerHTML = `
        <input type="search" class="lowstock-search" placeholder="Tìm mã vị trí hoặc tên vật tư" ${locked ? "disabled" : ""}>
        <div class="lowstock-options">${locations.map(item => `
          <label class="lowstock-chip" data-search="${esc(`${item.location} ${item.name}`.toLowerCase())}">
            <input type="checkbox" name="low_stock" value="${esc(item.location)}" ${locked ? "disabled" : ""}>
            <span><b>${esc(item.location)}</b> ${esc(item.name)}</span>
          </label>`).join("")}</div>`;
      const search = lowStockPick.querySelector(".lowstock-search");
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        lowStockPick.querySelectorAll(".lowstock-chip").forEach(chip => {
          chip.hidden = q && !chip.dataset.search.includes(q) && !chip.querySelector("input").checked;
        });
      });
    } else {
      // Danh mục chưa có trên hệ thống: nhập mã vị trí ghi trên nhãn hộp
      lowStockPick.innerHTML = `
        <input type="text" class="input lowstock-text" name="low_stock" maxlength="20" placeholder="Mã trên nhãn hộp, ví dụ T1-N2-04" ${locked ? "disabled" : ""}>`;
    }
  }

  /* ---------- Sự kiện ---------- */

  zonesBox.addEventListener("change", renderList);
  listBox.addEventListener("change", update);
  form.addEventListener("change", event => {
    if (event.target && event.target.name === "has_incident") update();
  });

  document.addEventListener("handover:verified", event => {
    const data = event.detail || {};
    const areaInput = document.getElementById("handoverArea");
    if (areaInput && !areaInput.value) areaInput.value = data.area || "";

    // unlockHandoverForm chạy ngay sau sự kiện -> vẽ lại ở lượt kế tiếp để ô được mở khóa
    setTimeout(() => {
      renderZones(data.zones && data.zones.length ? data.zones : []);
      renderList();
      renderLowStock(data.supply_locations || []);
      renderLoans(data.open_loans || []);
    }, 0);
  });

  document.addEventListener("handover:cleared", () => {
    renderLoans([]);
    setTimeout(() => {
      renderZones([]);
      renderList();
      renderLowStock([]);
    }, 0);
  });

  form.addEventListener("reset", () => setTimeout(() => {
    renderZones(selectedZones());
    renderList();
  }, 0));

  // Kiểm tra trước phần gửi gốc trong app.js (bắt ở pha capture)
  document.addEventListener("submit", event => {
    if (event.target !== form) return;
    update();

    const errors = [];
    if (hasIncident()) {
      if (!incidentTarget || !incidentTarget.value) errors.push("Chọn mã máy hoặc vị trí có sự cố.");
      if (!incidentType || !incidentType.value) errors.push("Chọn loại sự cố.");
      if (!incidentSafety || !incidentSafety.checked) errors.push("Xác nhận đã dừng máy, ngắt điện (nếu an toàn) và báo KTV.");
      if (!noteInput || !noteInput.value.trim()) errors.push("Mô tả sự cố trong ô Mô tả sự cố.");
    }

    if (errors.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof showHandoverMessage === "function") showHandoverMessage(errors.join("\n"), "error");
    }
  }, true);

  fillIncidentOptions();
  renderZones([]);
  renderList();
  renderLowStock([]);
})();
