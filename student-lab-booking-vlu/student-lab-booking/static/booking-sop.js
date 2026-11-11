/* =========================================================
   PHIẾU ĐĂNG KÝ – AN TOÀN MÁY C (SOP Lab 1 – 5S)
   Khu vực có mã máy C1 – C7 -> hỏi đã được KTV hướng dẫn vận hành chưa.
   "Chưa" -> tự bật "Hỗ trợ kỹ thuật: Có" và khóa ô này (chỉ người đã được
   hướng dẫn mới vận hành máy). Máy chủ kiểm tra lại cùng quy tắc.
========================================================= */

(function () {
  const areaInput = document.getElementById("area");
  const box = document.getElementById("machineSafety");
  const codesEl = document.getElementById("machineSafetyCodes");
  const support = document.getElementById("techSupport");
  const supportNote = document.getElementById("techSupportNote");
  const form = document.getElementById("bookingForm");

  if (!areaInput || !box || !support || !form) return;

  const machineCodes = () =>
    [...new Set((areaInput.value.toUpperCase().match(/\bC[1-7]\b/g) || []))].sort();

  const picked = () => {
    const radio = box.querySelector('input[name="machineTrained"]:checked');
    return radio ? radio.value : "";
  };

  window.machineTrainedValue = () => (machineCodes().length ? picked() : "");

  function sync() {
    const codes = machineCodes();
    box.hidden = !codes.length;
    if (codesEl) codesEl.textContent = codes.length ? `máy ${codes.join(", ")}` : "máy này";

    if (!codes.length) {
      box.querySelectorAll('input[name="machineTrained"]').forEach(radio => { radio.checked = false; });
    }

    const notTrained = codes.length && picked() === "CHƯA";
    if (notTrained) support.value = "Có";
    support.disabled = Boolean(notTrained);
    if (supportNote) {
      supportNote.hidden = !notTrained;
      supportNote.textContent = notTrained ? "Đã tự bật vì chưa được hướng dẫn vận hành máy C." : "";
    }
  }

  areaInput.addEventListener("input", sync);
  areaInput.addEventListener("change", sync);
  box.addEventListener("change", sync);
  form.addEventListener("reset", () => setTimeout(sync, 0));

  // Chặn gửi khi khu vực có máy C mà chưa trả lời (bắt trước phần gửi gốc)
  document.addEventListener("submit", event => {
    if (event.target !== form) return;
    sync();
    if (machineCodes().length && !picked()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof showMessage === "function") {
        showMessage("Khu vực có máy C: cho biết bạn / nhóm đã được KTV hướng dẫn vận hành máy chưa.", "error");
      }
    }
  }, true);

  sync();
})();
