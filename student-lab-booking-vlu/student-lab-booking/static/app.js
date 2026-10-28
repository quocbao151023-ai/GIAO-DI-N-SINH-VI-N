// =========================================================
// CẤU HÌNH CHUNG
// =========================================================

const MAX_GROUPS = 9;
const MAX_PEOPLE = 108;
const MAX_MEMBERS = 12;

const LABS = [
  "Lab 1",
  "Lab 2",
  "Lab 3"
];

const SHIFTS = [
  {
    name: "Ca 1",
    time: "07:00 - 09:30"
  },
  {
    name: "Ca 2",
    time: "09:30 - 12:00"
  },
  {
    name: "Ca 3",
    time: "13:00 - 15:30"
  },
  {
    name: "Ca 4",
    time: "15:30 - 18:00"
  }
];

const DAY_NAMES = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7"
];

const DAYS_PER_WEEK = 6;

const MAX_PER_LAB_PER_WEEK =
  DAYS_PER_WEEK *
  SHIFTS.length *
  MAX_GROUPS;


// =========================================================
// BIẾN CHUNG
// =========================================================

let publicSchedule = [];

let currentWeekStart =
  getMonday(
    new Date()
  );


// =========================================================
// BOOKING ELEMENTS
// =========================================================

const form =
  document.getElementById(
    "bookingForm"
  );

const membersList =
  document.getElementById(
    "membersList"
  );

const memberCounter =
  document.getElementById(
    "memberCounter"
  );

const formMessage =
  document.getElementById(
    "formMessage"
  );

const submitButton =
  document.getElementById(
    "submitButton"
  );

const registerType =
  document.getElementById(
    "registerType"
  );

const bookingDateInput =
  document.getElementById(
    "bookingDate"
  );


// =========================================================
// TAB
// =========================================================

document
  .querySelectorAll(
    "[data-tab-target]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const target =
          button.dataset.tabTarget;

        if (!target) {
          return;
        }

        openPanel(target);

      }
    );

  });


function openPanel(panelId) {

  // Hiện đúng panel
  document
    .querySelectorAll(
      ".content-panel"
    )
    .forEach(panel => {

      panel.classList.toggle(
        "active",
        panel.id === panelId
      );

    });


  // Reset nút Hero
  document
    .querySelectorAll(
      ".hero-tab"
    )
    .forEach(button => {

      button.classList.remove(
        "active"
      );

    });


  // Active nút Hero đúng panel
  const activeButton =
    document.querySelector(
      `.hero-tab[data-tab-target="${panelId}"]`
    );

  if (activeButton) {

    activeButton.classList.add(
      "active"
    );

  }


  // Cuộn xuống nội dung
  const pageContainer =
    document.querySelector(
      ".page-container"
    );

  if (pageContainer) {

    pageContainer.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }
}


// =========================================================
// HÀM NGÀY THÁNG
// =========================================================

function getMonday(value) {

  const date =
    new Date(value);

  const day =
    date.getDay();

  date.setDate(
    date.getDate()
    - day
    + (
      day === 0
        ? -6
        : 1
    )
  );

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
}


function dateKey(date) {

  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    )

  ].join("-");

}


function dateShort(date) {

  return (
    `${String(
      date.getDate()
    ).padStart(2, "0")}/` +

    `${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`
  );

}


function weekDays() {

  return Array.from(
    {
      length: DAYS_PER_WEEK
    },
    (_, index) => {

      const value =
        new Date(
          currentWeekStart
        );

      value.setDate(
        value.getDate()
        + index
      );

      return value;
    }
  );

}


// =========================================================
// GIỚI HẠN NGÀY BOOKING
// =========================================================

if (bookingDateInput) {

  bookingDateInput.min =
    dateKey(
      new Date()
    );

}


// =========================================================
// LỊCH
// =========================================================

const previousWeekButton =
  document.getElementById(
    "previousWeek"
  );

const nextWeekButton =
  document.getElementById(
    "nextWeek"
  );

const labFilter =
  document.getElementById(
    "labFilter"
  );

const shiftFilter =
  document.getElementById(
    "shiftFilter"
  );

const refreshScheduleButton =
  document.getElementById(
    "refreshSchedule"
  );


if (previousWeekButton) {

  previousWeekButton.addEventListener(
    "click",
    () => {

      currentWeekStart.setDate(
        currentWeekStart.getDate()
        - 7
      );

      renderAll();

    }
  );

}


if (nextWeekButton) {

  nextWeekButton.addEventListener(
    "click",
    () => {

      currentWeekStart.setDate(
        currentWeekStart.getDate()
        + 7
      );

      renderAll();

    }
  );

}


if (labFilter) {

  labFilter.addEventListener(
    "change",
    renderAll
  );

}


if (shiftFilter) {

  shiftFilter.addEventListener(
    "change",
    renderAll
  );

}


if (refreshScheduleButton) {

  refreshScheduleButton.addEventListener(
    "click",
    loadSchedule
  );

}


// =========================================================
// LOAD SCHEDULE
// =========================================================

async function loadSchedule() {

  const grid =
    document.getElementById(
      "calendarGrid"
    );

  if (!grid) {
    return;
  }

  grid.innerHTML =
    '<div class="calendar-state">Đang tải dữ liệu lịch...</div>';

  try {

    const response =
      await fetch(
        "/api/public-schedule",
        {
          cache: "no-store"
        }
      );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    if (
      !contentType.includes(
        "application/json"
      )
    ) {

      const text =
        await response.text();

      console.error(
        "API lịch trả về không phải JSON:",
        text
      );

      throw new Error(
        `API lịch lỗi HTTP ${response.status}.`
      );

    }


    const result =
      await response.json();


    if (
      !response.ok ||
      !result.success
    ) {

      throw new Error(
        [
          result.message || "Không tải được lịch.",
          result.error ? `Chi tiết: ${result.error}` : ""
        ].filter(Boolean).join(" ")
      );

    }


    publicSchedule =
      Array.isArray(
        result.data
      )
        ? result.data
        : [];


    renderAll();

  } catch (error) {

    grid.innerHTML = `
      <div class="calendar-state">
        Không thể tải lịch phòng.
        <br>
        <small>
          ${escapeHtml(error.message)}
        </small>
      </div>
    `;

  }
}


// =========================================================
// RENDER
// =========================================================

function renderAll() {

  renderCalendar();
  renderStats();

}


function normalizeSlot(
  dateText,
  shiftName,
  lab
) {

  return publicSchedule.find(
    item =>
      item.date === dateText &&
      item.shift === shiftName &&
      item.lab === lab
  );

}


function labCss(lab) {

  if (
    lab === "Lab 1"
  ) {
    return "lab-1";
  }

  if (
    lab === "Lab 2"
  ) {
    return "lab-2";
  }

  return "lab-3";

}


// =========================================================
// RENDER CALENDAR
// =========================================================

function renderCalendar() {

  const grid =
    document.getElementById(
      "calendarGrid"
    );

  if (!grid) {
    return;
  }


  const selectedLab =
    labFilter
      ? labFilter.value
      : "all";


  const selectedShift =
    shiftFilter
      ? shiftFilter.value
      : "all";


  const days =
    weekDays();


  const weekTitle =
    document.getElementById(
      "weekTitle"
    );


  if (weekTitle) {

    weekTitle.textContent =
      `Tuần ${dateShort(days[0])} - ` +
      `${dateShort(days[5])}/` +
      `${days[5].getFullYear()}`;

  }


  let html =
    '<div class="calendar-corner"></div>';


  // Header ngày
  days.forEach(
    (day, index) => {

      html += `
        <div class="calendar-day${dateKey(day) === dateKey(new Date()) ? " is-today" : ""}">

          ${DAY_NAMES[index]}

          <span>
            ${dateShort(day)}
          </span>

        </div>
      `;

    }
  );


  // Ca
  SHIFTS.forEach(
    shift => {

      html += `
        <div class="calendar-shift">

          ${shift.name}

          <span>
            ${shift.time}
          </span>

        </div>
      `;


      days.forEach(
        day => {

          const dateText =
            dateKey(day);


          html +=
            '<div class="calendar-cell">';


          if (
            selectedShift === "all" ||
            selectedShift === shift.name
          ) {

            LABS.forEach(
              lab => {

                if (
                  selectedLab !== "all" &&
                  selectedLab !== lab
                ) {
                  return;
                }


                const slot =
                  normalizeSlot(
                    dateText,
                    shift.name,
                    lab
                  );


                // Không có booking thì để trống
                if (!slot) {
                  return;
                }


                const groups =
                  Number(
                    slot.registered_groups || 0
                  );


                const people =
                  Number(
                    slot.registered_people || 0
                  );


                const maxGroups =
                  Number(
                    slot.max_groups ||
                    MAX_GROUPS
                  );


                const maxPeople =
                  Number(
                    slot.max_people ||
                    MAX_PEOPLE
                  );


                const remaining =
                  Number(
                    slot.remaining_people
                    ?? maxPeople
                  );


                const isFull =
                  Boolean(
                    slot.is_full
                  ) ||
                  groups >= maxGroups ||
                  people >= maxPeople;


                html += `
                  <button
                    type="button"

                    class="lab-slot ${
                      isFull
                        ? "full"
                        : labCss(lab)
                    }"

                    ${
                      isFull
                        ? "disabled"
                        : ""
                    }

                    data-room="${escapeHtml(lab)}"
                    data-date="${dateText}"
                    data-shift="${escapeHtml(shift.name)}"
                    data-remaining="${remaining}"
                  >

                    <strong>
                      ${escapeHtml(lab)}
                    </strong>

                    <span class="slot-count">
                      ${groups}/${maxGroups}
                    </span>

                  </button>
                `;

              }
            );

          }


          html +=
            "</div>";

        }
      );

    }
  );


  grid.innerHTML =
    html;


  grid
    .querySelectorAll(
      ".lab-slot:not(:disabled)"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectSlot(
              button.dataset.room,
              button.dataset.date,
              button.dataset.shift,
              button.dataset.remaining
            );

          }
        );

      }
    );

}


// =========================================================
// THỐNG KÊ
// =========================================================

function renderStats() {

  const selectedLab =
    labFilter
      ? labFilter.value
      : "all";


  const selectedShift =
    shiftFilter
      ? shiftFilter.value
      : "all";


  const dates =
    weekDays().map(
      dateKey
    );


  const filtered =
    publicSchedule.filter(
      item =>
        dates.includes(
          item.date
        ) &&
        (
          selectedLab === "all" ||
          item.lab === selectedLab
        ) &&
        (
          selectedShift === "all" ||
          item.shift === selectedShift
        )
    );


  const total =
    filtered.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.registered_groups || 0
        ),
      0
    );


  const totalBookings =
    document.getElementById(
      "totalBookings"
    );


  if (totalBookings) {

    totalBookings.textContent =
      total;

  }


  LABS.forEach(
    (lab, index) => {

      const labGroups =
        publicSchedule
          .filter(
            item =>
              dates.includes(
                item.date
              ) &&
              item.lab === lab &&
              (
                selectedShift === "all" ||
                item.shift === selectedShift
              )
          )
          .reduce(
            (
              sum,
              item
            ) =>
              sum +
              Number(
                item.registered_groups || 0
              ),
            0
          );


      const denominator =
        selectedShift === "all"
          ? MAX_PER_LAB_PER_WEEK
          : DAYS_PER_WEEK *
            MAX_GROUPS;


      const percent =
        Math.min(
          Math.round(
            (
              labGroups /
              denominator
            ) * 100
          ),
          100
        );


      const usageText =
        document.getElementById(
          `lab${index + 1}Usage`
        );


      const usageBar =
        document.getElementById(
          `lab${index + 1}Bar`
        );


      if (usageText) {

        usageText.textContent =
          `${percent}%`;

      }


      if (usageBar) {

        usageBar.style.width =
          `${percent}%`;

      }

    }
  );

}


// =========================================================
// CHỌN SLOT
// =========================================================

function selectSlot(
  room,
  dateText,
  shift,
  remaining
) {

  const roomInput =
    document.getElementById(
      "room"
    );

  const bookingDate =
    document.getElementById(
      "bookingDate"
    );

  const shiftInput =
    document.getElementById(
      "shift"
    );


  if (roomInput) {
    roomInput.value =
      room;
  }

  if (bookingDate) {
    bookingDate.value =
      dateText;
  }

  if (shiftInput) {
    shiftInput.value =
      shift;
  }

  pickShiftFromSlot(
    room,
    dateText,
    shift
  );


  const selectedSlot =
    document.getElementById(
      "selectedSlot"
    );


  if (selectedSlot) {

    selectedSlot.classList.add(
      "show"
    );

    selectedSlot.innerHTML = `
      <b>
        Đã chọn:
      </b>

      ${escapeHtml(room)}
      ·
      ${escapeHtml(shift)}
      ·
      ${dateText
        .split("-")
        .reverse()
        .join("/")}

      · Còn
      ${escapeHtml(remaining)}
      chỗ
    `;

  }


  openPanel(
    "bookingPanel"
  );

}


// =========================================================
// MEMBER CARD
// =========================================================

function createMemberCard(
  index,
  isLeader = false
) {

  const card =
    document.createElement(
      "div"
    );

  card.className =
    "member-card";


  card.innerHTML = `

    <div class="member-head">

      <strong>
        ${
          isLeader
            ? "Người đại diện"
            : `Thành viên ${index + 1}`
        }
      </strong>

      ${
        isLeader
          ? ""
          : `
            <button
              type="button"
              class="remove-member"
            >
              Xóa
            </button>
          `
      }

    </div>


    <div class="form-grid">


      <label class="field">

        <span>
          Họ và tên
          <b>*</b>
        </span>

        <input
          class="member-name"
          type="text"
          maxlength="120"
          ${
            isLeader
              ? "readonly"
              : ""
          }
          required
        >

      </label>


      <label class="field">

        <span>
          MSSV
          <b>*</b>
        </span>

        <input
          class="member-id"
          type="text"
          inputmode="numeric"
          ${
            isLeader
              ? "readonly"
              : ""
          }
          required
        >

      </label>


      <label class="field full">

        <span>
          Email
        </span>

        <input
          class="member-email"
          type="email"
          maxlength="254"
          ${
            isLeader
              ? "readonly"
              : ""
          }
        >

      </label>


    </div>
  `;


  if (!isLeader) {

    const removeButton =
      card.querySelector(
        ".remove-member"
      );


    if (removeButton) {

      removeButton.addEventListener(
        "click",
        () => {

          card.remove();

          refreshMemberLabels();

        }
      );

    }

  }


  return card;

}


// =========================================================
// MEMBER FUNCTIONS
// =========================================================

function initializeMembers() {

  if (
    !membersList
  ) {
    return;
  }


  membersList.innerHTML =
    "";


  membersList.appendChild(
    createMemberCard(
      0,
      true
    )
  );


  syncRepresentative();
  refreshMemberLabels();

}


function syncRepresentative() {

  if (
    !membersList
  ) {
    return;
  }


  const first =
    membersList.querySelector(
      ".member-card"
    );


  if (!first) {
    return;
  }


  const nameInput =
    first.querySelector(
      ".member-name"
    );

  const idInput =
    first.querySelector(
      ".member-id"
    );

  const emailInput =
    first.querySelector(
      ".member-email"
    );


  const repName =
    document.getElementById(
      "repName"
    );

  const repId =
    document.getElementById(
      "repId"
    );

  const schoolEmail =
    document.getElementById(
      "schoolEmail"
    );


  if (
    nameInput &&
    repName
  ) {

    nameInput.value =
      repName.value.trim();

  }


  if (
    idInput &&
    repId
  ) {

    idInput.value =
      repId.value.trim();

  }


  if (
    emailInput &&
    schoolEmail
  ) {

    emailInput.value =
      schoolEmail.value.trim();

  }

}


[
  "repName",
  "repId",
  "schoolEmail"
].forEach(
  id => {

    const element =
      document.getElementById(
        id
      );


    if (element) {

      element.addEventListener(
        "input",
        syncRepresentative
      );

    }

  }
);


function refreshMemberLabels() {

  if (
    !membersList
  ) {
    return;
  }


  [
    ...membersList.children
  ].forEach(
    (
      card,
      index
    ) => {

      const title =
        card.querySelector(
          ".member-head strong"
        );


      if (title) {

        title.textContent =
          index === 0
            ? "Người đại diện"
            : `Thành viên ${index + 1}`;

      }

    }
  );


  if (memberCounter) {

    memberCounter.textContent =
      `${membersList.children.length}/${MAX_MEMBERS} người`;

  }

}


// =========================================================
// THÊM THÀNH VIÊN
// =========================================================

const addMemberButton =
  document.getElementById(
    "addMember"
  );


if (
  addMemberButton &&
  registerType &&
  membersList
) {

  addMemberButton.addEventListener(
    "click",
    () => {

      clearMessage();


      if (
        registerType.value !== "Nhóm"
      ) {

        showMessage(
          "Vui lòng chọn hình thức Nhóm trước khi thêm thành viên.",
          "error"
        );

        return;
      }


      if (
        membersList.children.length >=
        MAX_MEMBERS
      ) {

        showMessage(
          `Mỗi lượt đăng ký tối đa ${MAX_MEMBERS} người.`,
          "error"
        );

        return;
      }


      membersList.appendChild(
        createMemberCard(
          membersList.children.length
        )
      );


      refreshMemberLabels();

    }
  );

}


// =========================================================
// LOẠI ĐĂNG KÝ
// =========================================================

if (
  registerType &&
  membersList
) {

  registerType.addEventListener(
    "change",
    () => {

      if (
        registerType.value ===
        "Cá nhân"
      ) {

        [
          ...membersList.children
        ]
          .slice(1)
          .forEach(
            card => {
              card.remove();
            }
          );


        refreshMemberLabels();

      }

    }
  );

}


// =========================================================
// COLLECT MEMBERS
// =========================================================

function collectMembers() {

  if (
    !membersList
  ) {
    return [];
  }


  return [
    ...membersList.querySelectorAll(
      ".member-card"
    )
  ].map(
    card => ({

      name:
        card
          .querySelector(
            ".member-name"
          )
          .value
          .trim(),

      student_id:
        card
          .querySelector(
            ".member-id"
          )
          .value
          .trim(),

      email:
        card
          .querySelector(
            ".member-email"
          )
          .value
          .trim()

    })
  );

}


// =========================================================
// VALIDATE BOOKING CLIENT
// =========================================================

function validateClient(payload) {

  const errors =
    [];

  const seen =
    new Set();


  if (
    !payload.representative.name
  ) {

    errors.push(
      "Thiếu họ tên người đại diện."
    );

  }


  if (
    !payload.representative.student_id
  ) {

    errors.push(
      "Thiếu MSSV người đại diện."
    );

  }


  if (
    !payload.representative.school_email
  ) {

    errors.push(
      "Thiếu email trường."
    );

  }


  if (
    !payload.representative.phone
  ) {

    errors.push(
      "Thiếu số điện thoại."
    );

  }


  if (
    !payload.booking.register_type
  ) {

    errors.push(
      "Chưa chọn hình thức đăng ký."
    );

  }


  if (
    !payload.booking.purpose
  ) {

    errors.push(
      "Thiếu mục đích sử dụng."
    );

  }


  if (
    !payload.booking.room
  ) {

    errors.push(
      "Chưa chọn phòng Lab."
    );

  }


  if (
    !payload.booking.area
  ) {

    errors.push(
      "Thiếu khu vực sử dụng."
    );

  }


  if (
    !payload.booking.date
  ) {

    errors.push(
      "Chưa chọn ngày sử dụng."
    );

  }


  if (
    !payload.booking.shift
  ) {

    errors.push(
      "Chưa chọn ca sử dụng."
    );

  }


  const badMssv = [
    payload.representative.student_id,
    ...payload.members.map(member => member.student_id)
  ].filter(id => id && !isValidMssv(id));

  if (badMssv.length) {

    errors.push(
      `${MSSV_RULE_TEXT} Kiểm tra lại: ${[...new Set(badMssv)].join(", ")}.`
    );

  }


  if (
    payload.booking.register_type === "Nhóm" &&
    !payload.booking.handover_mode
  ) {

    errors.push(
      "Chưa chọn hình thức bàn giao của nhóm."
    );

  }


  if (
    !payload.booking.commitment
  ) {

    errors.push(
      "Bạn chưa xác nhận cam kết."
    );

  }


  payload.members.forEach(
    (
      member,
      index
    ) => {

      if (
        !member.name
      ) {

        errors.push(
          `Thành viên ${index + 1} thiếu họ tên.`
        );

      }


      if (
        !member.student_id
      ) {

        errors.push(
          `Thành viên ${index + 1} thiếu MSSV.`
        );

      }


      if (
        member.student_id &&
        seen.has(
          member.student_id
        )
      ) {

        errors.push(
          `MSSV ${member.student_id} bị trùng.`
        );

      }


      if (
        member.student_id
      ) {

        seen.add(
          member.student_id
        );

      }

    }
  );


  if (
    payload.booking.register_type ===
      "Cá nhân" &&
    payload.members.length !==
      1
  ) {

    errors.push(
      "Đăng ký cá nhân chỉ được có một người."
    );

  }


  if (
    payload.booking.register_type ===
      "Nhóm" &&
    payload.members.length <
      2
  ) {

    errors.push(
      "Đăng ký nhóm phải có ít nhất hai người."
    );

  }


  return errors;

}


// =========================================================
// SUBMIT BOOKING
// =========================================================

if (
  form
) {

  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      clearMessage();
      syncRepresentative();


      const payload = {

        representative: {

          name:
            document
              .getElementById(
                "repName"
              )
              .value
              .trim(),

          student_id:
            document
              .getElementById(
                "repId"
              )
              .value
              .trim(),

          school_email:
            document
              .getElementById(
                "schoolEmail"
              )
              .value
              .trim(),

          personal_email:
            document
              .getElementById(
                "personalEmail"
              )
              .value
              .trim(),

          phone:
            document
              .getElementById(
                "phone"
              )
              .value
              .trim()

        },


        booking: {

          register_type:
            registerType.value,

          purpose:
            document
              .getElementById(
                "purpose"
              )
              .value
              .trim(),

          room:
            document
              .getElementById(
                "room"
              )
              .value,

          area:
            document
              .getElementById(
                "area"
              )
              .value
              .trim(),

          date:
            document
              .getElementById(
                "bookingDate"
              )
              .value,

          shift:
            document
              .getElementById(
                "shift"
              )
              .value,

          shifts:
            selectedShifts(),

          handover_mode:
            selectedHandoverMode(),

          tech_support:
            document
              .getElementById(
                "techSupport"
              )
              .value,

          commitment:
            document
              .getElementById(
                "commitment"
              )
              .checked

        },


        members:
          collectMembers()

      };


      const errors =
        validateClient(
          payload
        );


      if (
        errors.length
      ) {

        showMessage(
          errors.join("\n"),
          "error"
        );

        return;
      }


      if (
        submitButton
      ) {

        submitButton.disabled =
          true;

        submitButton.textContent =
          "Đang xử lý...";

      }


      try {

        const response =
          await fetch(
            "/api/register-booking",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          );


        const contentType =
          response.headers.get(
            "content-type"
          ) || "";


        if (
          !contentType.includes(
            "application/json"
          )
        ) {

          const text =
            await response.text();

          console.error(
            "API đăng ký trả về không phải JSON:",
            text
          );

          throw new Error(
            `API đăng ký lỗi HTTP ${response.status}.`
          );

        }


        const result =
          await response.json();


        if (
          !response.ok ||
          !result.success
        ) {

          if (result.code === "HANDOVER_LOCKED") {
            showHandoverLocked(result);
          }

          showMessage(
            [
              result.message,
              ...(
                result.errors ||
                []
              )
            ]
              .filter(Boolean)
              .join("\n"),
            "error"
          );

          return;

        }


        showBookingSuccess(
          result,
          payload
        );


        form.reset();


        const selectedSlot =
          document.getElementById(
            "selectedSlot"
          );


        if (selectedSlot) {

          selectedSlot.classList.remove(
            "show"
          );

        }


        initializeMembers();

        await loadSchedule();

      } catch (error) {

        showMessage(
          error.message ||
          "Không thể kết nối hệ thống. Vui lòng thử lại.",
          "error"
        );

      } finally {

        if (
          submitButton
        ) {

          submitButton.disabled =
            false;

          submitButton.textContent =
            "Gửi đăng ký";

        }

      }

    }
  );


  form.addEventListener(
    "reset",
    () => {

      setTimeout(
        () => {

          initializeMembers();
          clearMessage();


          const selectedSlot =
            document.getElementById(
              "selectedSlot"
            );


          if (selectedSlot) {

            selectedSlot.classList.remove(
              "show"
            );

          }

        },
        0
      );

    }
  );

}


// =========================================================
// BOOKING MESSAGE
// =========================================================

function showMessage(
  text,
  type
) {

  if (
    !formMessage
  ) {
    return;
  }


  formMessage.className =
    `form-message ${type}`;


  formMessage.textContent =
    text;


  formMessage.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

}


function clearMessage() {

  if (
    !formMessage
  ) {
    return;
  }


  formMessage.className =
    "form-message";


  formMessage.textContent =
    "";

}


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(value) {

  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


// =========================================================
// BÀN GIAO PHÒNG LAB
// =========================================================

const MAX_HANDOVER_IMAGES =
  5;


const handoverForm =
  document.getElementById(
    "handoverForm"
  );


const verifyHandoverButton =
  document.getElementById(
    "verifyHandoverButton"
  );


const handoverVerifyMessage =
  document.getElementById(
    "handoverVerifyMessage"
  );


const handoverBookingInfo =
  document.getElementById(
    "handoverBookingInfo"
  );


const handoverVerifyInputs =
  document.getElementById(
    "handoverVerifyInputs"
  );


const handoverVerifiedAction =
  document.getElementById(
    "handoverVerifiedAction"
  );


const handoverCheckActions =
  handoverVerifyInputs
    ? handoverVerifyInputs.querySelector(
        ".handover-check-actions"
      )
    : null;


const handoverDetailCard =
  document.getElementById(
    "handoverDetailCard"
  );


const handoverImageCard =
  document.getElementById(
    "handoverImageCard"
  );


const handoverConfirmCard =
  document.getElementById(
    "handoverConfirmCard"
  );


const beforeImages =
  document.getElementById(
    "beforeImages"
  );


const afterImages =
  document.getElementById(
    "afterImages"
  );


const beforePreview =
  document.getElementById(
    "beforePreview"
  );


const afterPreview =
  document.getElementById(
    "afterPreview"
  );


const beforeImageCounter =
  document.getElementById(
    "beforeImageCounter"
  );


const afterImageCounter =
  document.getElementById(
    "afterImageCounter"
  );


const handoverSubmitButton =
  document.getElementById(
    "handoverSubmitButton"
  );


const handoverMessage =
  document.getElementById(
    "handoverMessage"
  );


let handoverVerified =
  false;


// =========================================================
// EVENT BÀN GIAO
// =========================================================

if (
  handoverForm &&
  verifyHandoverButton
) {

  verifyHandoverButton.addEventListener(
    "click",
    verifyHandoverBooking
  );


  if (
    beforeImages
  ) {

    beforeImages.addEventListener(
      "change",
      () => {

        renderHandoverPreview(
          beforeImages,
          beforePreview,
          beforeImageCounter
        );

      }
    );

  }


  if (
    afterImages
  ) {

    afterImages.addEventListener(
      "change",
      () => {

        renderHandoverPreview(
          afterImages,
          afterPreview,
          afterImageCounter
        );

      }
    );

  }


  handoverForm.addEventListener(
    "submit",
    submitHandoverForm
  );


  handoverForm.addEventListener(
    "reset",
    () => {

      setTimeout(
        resetHandoverInterface,
        0
      );

    }
  );


  const idInput =
    document.getElementById(
      "handoverIdKey"
    );


  const studentInput =
    document.getElementById(
      "handoverStudentId"
    );


  if (
    idInput
  ) {

    idInput.addEventListener(
      "input",
      invalidateHandoverVerification
    );

  }


  if (
    studentInput
  ) {

    studentInput.addEventListener(
      "input",
      invalidateHandoverVerification
    );

  }

}


// =========================================================
// XÁC MINH BOOKING
// =========================================================

async function verifyHandoverBooking() {

  clearHandoverVerifyMessage();
  clearHandoverMessage();


  const idKey =
    document
      .getElementById(
        "handoverIdKey"
      )
      .value
      .trim();


  const studentId =
    document
      .getElementById(
        "handoverStudentId"
      )
      .value
      .trim();


  if (!idKey) {

    showHandoverVerifyMessage(
      "Vui lòng nhập ID đăng ký.",
      "error"
    );

    return;

  }


  if (!studentId) {

    showHandoverVerifyMessage(
      "Vui lòng nhập MSSV.",
      "error"
    );

    return;

  }


  if (!isValidMssv(studentId)) {

    showHandoverVerifyMessage(
      MSSV_RULE_TEXT,
      "error"
    );

    return;

  }


  verifyHandoverButton.disabled =
    true;


  verifyHandoverButton.textContent =
    "Đang kiểm tra...";


  try {

    const response =
      await fetch(
        "/api/verify-handover",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              id_key: idKey,
              student_id: studentId
            })
        }
      );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    if (
      !contentType.includes(
        "application/json"
      )
    ) {

      const serverText =
        await response.text();


      console.error(
        "API xác minh trả về không phải JSON:",
        serverText
      );


      throw new Error(
        `API xác minh lỗi HTTP ${response.status}.`
      );

    }


    const result =
      await response.json();


    if (
      !response.ok ||
      !result.success
    ) {

      throw new Error(
        [
          result.message || "Không thể xác minh thông tin.",
          result.error && response.status >= 500
            ? `Chi tiết: ${result.error}`
            : ""
        ]
          .filter(Boolean)
          .join("\n")
      );

    }


    const data =
      result.data || {};


    // Điền thông tin readonly
    fillVerifiedHandoverInfo(
      data
    );


    handoverVerified =
      true;


    // Mở các bước 02, 03, 04
    unlockHandoverForm();


    // Ẩn 2 ô nhập ID + MSSV
    if (
      handoverVerifyInputs
    ) {

      handoverVerifyInputs.classList.add(
        "is-hidden"
      );

    }


    // Chuyển nút Kiểm tra sang góc phải
    if (
      handoverVerifiedAction &&
      verifyHandoverButton
    ) {

      handoverVerifiedAction.appendChild(
        verifyHandoverButton
      );

    }


    // Không hiện dòng thông báo dư thừa
    clearHandoverVerifyMessage();

  } catch (error) {

    invalidateHandoverVerification();


    showHandoverVerifyMessage(
      error.message ||
      "Không thể xác minh thông tin.",
      "error"
    );

  } finally {

    verifyHandoverButton.disabled =
      false;


    verifyHandoverButton.textContent =
      "Kiểm tra thông tin";

  }

}


// =========================================================
// ĐIỀN THÔNG TIN READONLY
// =========================================================

function fillVerifiedHandoverInfo(
  data
) {

  setInputValue(
    "verifiedIdKey",
    data.id_key || ""
  );


  setInputValue(
    "verifiedStudentName",
    data.student_name || ""
  );


  setInputValue(
    "verifiedStudentEmail",
    data.student_email || ""
  );


  setInputValue(
    "verifiedRoom",
    data.room || ""
  );


  setInputValue(
    "verifiedShift",
    data.shift || ""
  );


  setInputValue(
    "verifiedDate",
    formatDisplayDate(
      data.date || ""
    )
  );


  setInputValue(
    "verifiedArea",
    data.area || ""
  );

  showVerifiedHandoverMode(
    data.handover_mode || ""
  );


  if (
    handoverBookingInfo
  ) {

    handoverBookingInfo.classList.add(
      "show"
    );

  }

}


function setInputValue(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (
    element
  ) {

    element.value =
      value;

  }

}


// =========================================================
// MỞ KHÓA BÀN GIAO
// =========================================================

function unlockHandoverForm() {

  [
    handoverDetailCard,
    handoverImageCard,
    handoverConfirmCard
  ]
    .filter(Boolean)
    .forEach(
      card => {

        card.classList.add(
          "is-unlocked"
        );

      }
    );


  if (
    !handoverForm
  ) {
    return;
  }


  handoverForm
    .querySelectorAll(
      `
        #handoverDetailCard input,
        #handoverDetailCard select,
        #handoverDetailCard textarea,

        #handoverImageCard input,
        #handoverImageCard textarea,

        #handoverConfirmCard input,
        #handoverConfirmCard button
      `
    )
    .forEach(
      element => {

        element.disabled =
          false;

      }
    );

}


// =========================================================
// HỦY TRẠNG THÁI XÁC MINH
// =========================================================

function invalidateHandoverVerification() {

  handoverVerified =
    false;


  // Hiện lại khối nhập ID + MSSV
  if (
    handoverVerifyInputs
  ) {

    handoverVerifyInputs.classList.remove(
      "is-hidden"
    );

  }


  // Chuyển nút về vị trí ban đầu
  if (
    handoverCheckActions &&
    verifyHandoverButton
  ) {

    handoverCheckActions.appendChild(
      verifyHandoverButton
    );

  }


  // Ẩn thông tin readonly
  if (
    handoverBookingInfo
  ) {

    handoverBookingInfo.classList.remove(
      "show"
    );

  }


  // Xóa dữ liệu readonly cũ
  clearVerifiedHandoverInfo();


  // Khóa bước 02, 03, 04
  [
    handoverDetailCard,
    handoverImageCard,
    handoverConfirmCard
  ]
    .filter(Boolean)
    .forEach(
      card => {

        card.classList.remove(
          "is-unlocked"
        );

      }
    );


  if (
    handoverForm
  ) {

    handoverForm
      .querySelectorAll(
        `
          #handoverDetailCard input,
          #handoverDetailCard select,
          #handoverDetailCard textarea,

          #handoverImageCard input,
          #handoverImageCard textarea,

          #handoverConfirmCard input,
          #handoverConfirmCard button
        `
      )
      .forEach(
        element => {

          element.disabled =
            true;

        }
      );

  }


  // Xóa ảnh
  if (
    beforeImages
  ) {

    beforeImages.value =
      "";

  }


  if (
    afterImages
  ) {

    afterImages.value =
      "";

  }


  if (
    beforePreview
  ) {

    beforePreview.innerHTML =
      "";

  }


  if (
    afterPreview
  ) {

    afterPreview.innerHTML =
      "";

  }


  updateImageCounter(
    beforeImages,
    beforeImageCounter
  );


  updateImageCounter(
    afterImages,
    afterImageCounter
  );

}


// =========================================================
// XÓA DỮ LIỆU READONLY
// =========================================================

function clearVerifiedHandoverInfo() {

  [
    "verifiedIdKey",
    "verifiedStudentName",
    "verifiedStudentEmail",
    "verifiedRoom",
    "verifiedShift",
    "verifiedDate",
    "verifiedArea"
  ].forEach(
    id => {

      const element =
        document.getElementById(
          id
        );


      if (
        element
      ) {

        element.value =
          "";

      }

    }
  );

}


// =========================================================
// PREVIEW ẢNH
// =========================================================

function renderHandoverPreview(
  input,
  preview,
  counter
) {

  if (
    !input ||
    !preview ||
    !counter
  ) {
    return;
  }


  clearHandoverMessage();


  const files =
    [
      ...input.files
    ];


  if (
    files.length >
    MAX_HANDOVER_IMAGES
  ) {

    input.value =
      "";


    preview.innerHTML =
      "";


    updateImageCounter(
      input,
      counter
    );


    showHandoverMessage(
      `Chỉ được chọn tối đa ${MAX_HANDOVER_IMAGES} ảnh cho mỗi phần.`,
      "error"
    );


    return;

  }


  const invalidFile =
    files.find(
      file =>
        !file.type.startsWith(
          "image/"
        )
    );


  if (
    invalidFile
  ) {

    input.value =
      "";


    preview.innerHTML =
      "";


    updateImageCounter(
      input,
      counter
    );


    showHandoverMessage(
      "Tệp tải lên phải là hình ảnh.",
      "error"
    );


    return;

  }


  preview.innerHTML =
    "";


  files.forEach(
    file => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "handover-preview-item";


      const image =
        document.createElement(
          "img"
        );


      const objectUrl =
        URL.createObjectURL(
          file
        );


      image.src =
        objectUrl;


      image.alt =
        file.name;


      image.addEventListener(
        "load",
        () => {

          URL.revokeObjectURL(
            objectUrl
          );

        }
      );


      const filename =
        document.createElement(
          "span"
        );


      filename.textContent =
        file.name;


      item.appendChild(
        image
      );


      item.appendChild(
        filename
      );


      preview.appendChild(
        item
      );

    }
  );


  updateImageCounter(
    input,
    counter
  );

}


// =========================================================
// COUNTER ẢNH
// =========================================================

function updateImageCounter(
  input,
  counter
) {

  if (
    !counter
  ) {
    return;
  }


  const count =
    input &&
    input.files
      ? input.files.length
      : 0;


  counter.textContent =
    `${count}/${MAX_HANDOVER_IMAGES} ảnh`;

}


// =========================================================
// SUBMIT BÀN GIAO
// =========================================================

async function submitHandoverForm(
  event
) {

  event.preventDefault();


  clearHandoverMessage();


  if (
    !handoverVerified
  ) {

    showHandoverMessage(
      "Vui lòng xác minh ID đăng ký và MSSV trước.",
      "error"
    );


    return;

  }


  const responsibleArea =
    document
      .getElementById(
        "handoverArea"
      )
      .value
      .trim();


  const condition =
    document
      .getElementById(
        "handoverCondition"
      )
      .value;


  const beforeFiles =
    beforeImages
      ? [
          ...beforeImages.files
        ]
      : [];


  const afterFiles =
    afterImages
      ? [
          ...afterImages.files
        ]
      : [];


  const commitment =
    document
      .getElementById(
        "handoverCommitment"
      )
      .checked;


  const errors =
    [];


  if (
    !responsibleArea
  ) {

    errors.push(
      "Thiếu khu vực phụ trách."
    );

  }


  if (
    !condition
  ) {

    errors.push(
      "Chưa chọn tình trạng sau bàn giao."
    );

  }


  if (
    beforeFiles.length <
    1
  ) {

    errors.push(
      "Cần tải ít nhất một ảnh trước khi sử dụng."
    );

  }


  if (
    afterFiles.length <
    1
  ) {

    errors.push(
      "Cần tải ít nhất một ảnh sau khi sử dụng."
    );

  }


  if (
    beforeFiles.length >
    MAX_HANDOVER_IMAGES
  ) {

    errors.push(
      `Ảnh trước tối đa ${MAX_HANDOVER_IMAGES} ảnh.`
    );

  }


  if (
    afterFiles.length >
    MAX_HANDOVER_IMAGES
  ) {

    errors.push(
      `Ảnh sau tối đa ${MAX_HANDOVER_IMAGES} ảnh.`
    );

  }


  if (
    !commitment
  ) {

    errors.push(
      "Bạn chưa xác nhận nội dung bàn giao."
    );

  }


  if (
    errors.length
  ) {

    showHandoverMessage(
      errors.join("\n"),
      "error"
    );


    return;

  }


  const formData =
    new FormData(
      handoverForm
    );


  if (
    handoverSubmitButton
  ) {

    handoverSubmitButton.disabled =
      true;


    handoverSubmitButton.textContent =
      "Đang tải ảnh...";

  }


  try {

    const response =
      await fetch(
        "/api/submit-handover",
        {
          method: "POST",
          body: formData
        }
      );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    if (
      !contentType.includes(
        "application/json"
      )
    ) {

      const serverText =
        await response.text();


      console.error(
        "API bàn giao trả về không phải JSON:",
        serverText
      );


      throw new Error(
        `API bàn giao lỗi HTTP ${response.status}.`
      );

    }


    const result =
      await response.json();


    if (
      !response.ok ||
      !result.success
    ) {

      showHandoverMessage(
        [
          result.message,
          ...(
            result.errors ||
            []
          )
        ]
          .filter(Boolean)
          .join("\n"),
        "error"
      );


      return;

    }


    showHandoverSuccess(
      result,
      {
        id_key: document.getElementById("verifiedIdKey").value,
        student: document.getElementById("verifiedStudentName").value,
        room: document.getElementById("verifiedRoom").value,
        shift: document.getElementById("verifiedShift").value,
        date: document.getElementById("verifiedDate").value,
        area: responsibleArea,
        condition: condition,
        before: beforeFiles.length,
        after: afterFiles.length
      }
    );


    handoverForm.reset();

  } catch (error) {

    showHandoverMessage(
      error.message ||
      "Không thể kết nối hệ thống. Vui lòng thử lại.",
      "error"
    );

  } finally {

    if (
      handoverSubmitButton
    ) {

      handoverSubmitButton.disabled =
        false;


      handoverSubmitButton.textContent =
        "Gửi bàn giao";

    }

  }

}


// =========================================================
// RESET BÀN GIAO
// =========================================================

function resetHandoverInterface() {

  handoverVerified =
    false;


  // Hiện lại input ID + MSSV
  if (
    handoverVerifyInputs
  ) {

    handoverVerifyInputs.classList.remove(
      "is-hidden"
    );

  }


  // Chuyển nút về vị trí ban đầu
  if (
    handoverCheckActions &&
    verifyHandoverButton
  ) {

    handoverCheckActions.appendChild(
      verifyHandoverButton
    );

  }


  // Ẩn khối readonly
  if (
    handoverBookingInfo
  ) {

    handoverBookingInfo.classList.remove(
      "show"
    );

  }


  clearVerifiedHandoverInfo();


  clearHandoverVerifyMessage();
  clearHandoverMessage();


  if (
    beforePreview
  ) {

    beforePreview.innerHTML =
      "";

  }


  if (
    afterPreview
  ) {

    afterPreview.innerHTML =
      "";

  }


  [
    handoverDetailCard,
    handoverImageCard,
    handoverConfirmCard
  ]
    .filter(Boolean)
    .forEach(
      card => {

        card.classList.remove(
          "is-unlocked"
        );

      }
    );


  if (
    handoverForm
  ) {

    handoverForm
      .querySelectorAll(
        `
          #handoverDetailCard input,
          #handoverDetailCard select,
          #handoverDetailCard textarea,

          #handoverImageCard input,
          #handoverImageCard textarea,

          #handoverConfirmCard input,
          #handoverConfirmCard button
        `
      )
      .forEach(
        element => {

          element.disabled =
            true;

        }
      );

  }


  updateImageCounter(
    beforeImages,
    beforeImageCounter
  );


  updateImageCounter(
    afterImages,
    afterImageCounter
  );

}


// =========================================================
// MESSAGE BÀN GIAO
// =========================================================

function showHandoverVerifyMessage(
  text,
  type
) {

  if (
    !handoverVerifyMessage
  ) {
    return;
  }


  handoverVerifyMessage.className =
    `handover-verify-message ${type}`;


  handoverVerifyMessage.textContent =
    text;

}


function clearHandoverVerifyMessage() {

  if (
    !handoverVerifyMessage
  ) {
    return;
  }


  handoverVerifyMessage.className =
    "handover-verify-message";


  handoverVerifyMessage.textContent =
    "";

}


function showHandoverMessage(
  text,
  type
) {

  if (
    !handoverMessage
  ) {
    return;
  }


  handoverMessage.className =
    `form-message ${type}`;


  handoverMessage.textContent =
    text;


  handoverMessage.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

}


function clearHandoverMessage() {

  if (
    !handoverMessage
  ) {
    return;
  }


  handoverMessage.className =
    "form-message";


  handoverMessage.textContent =
    "";

}


// =========================================================
// FORMAT NGÀY HIỂN THỊ
// =========================================================

function formatDisplayDate(
  dateText
) {

  if (
    !dateText
  ) {

    return "—";

  }


  const parts =
    dateText.split(
      "-"
    );


  if (
    parts.length !==
    3
  ) {

    return dateText;

  }


  return [
    parts[2],
    parts[1],
    parts[0]
  ].join("/");

}


// =========================================================
// KHỞI TẠO
// =========================================================

initializeMembers();
loadSchedule();

// =========================================================
// HÌNH THỨC ĐĂNG KÝ: chỉ hiện "Danh sách thành viên" khi chọn Nhóm
// (Cá nhân: người đại diện vẫn có trong danh sách, chỉ ẩn khối nhập)
// =========================================================

function syncRegisterTypeView() {
  const card = document.getElementById("membersCard");
  const step = document.getElementById("commitStep");
  const hint = document.getElementById("registerTypeHint");
  const isGroup = Boolean(registerType && registerType.value === "Nhóm");

  if (card) card.hidden = !isGroup;
  if (step) step.textContent = isGroup ? "04" : "03";
  if (hint) hint.hidden = isGroup || Boolean(registerType && registerType.value === "Cá nhân");
}

if (registerType) {
  registerType.addEventListener("change", syncRegisterTypeView);
}

if (form) {
  form.addEventListener("reset", () => setTimeout(syncRegisterTypeView, 0));
}

syncRegisterTypeView();


// =========================================================
// HỘP THOẠI KẾT QUẢ (cùng mẫu với Hệ thống quản lý phòng Lab)
// =========================================================

const SHIFT_TIME_TEXT = {
  "Ca 1": "07:00 – 09:30",
  "Ca 2": "09:30 – 12:00",
  "Ca 3": "13:00 – 15:30",
  "Ca 4": "15:30 – 18:00"
};

function showBookingSuccess(result, payload) {
  clearMessage();

  const booking = payload.booking || {};
  const results = Array.isArray(result.results) && result.results.length
    ? result.results
    : [{ shift: booking.shift, id_key: result.id_key, remaining_groups: result.remaining_groups }];
  const many = results.length > 1;
  const shiftLabel = shift => SHIFT_TIME_TEXT[shift] ? `${shift} (${SHIFT_TIME_TEXT[shift]})` : shift;
  const modeText = {
    "ĐẠI DIỆN": "Người đại diện bàn giao cho cả nhóm",
    "TỪNG THÀNH VIÊN": "Từng thành viên tự bàn giao"
  }[result.handover_mode] || "";

  vluDialog({
    title: "Đăng ký thành công",
    subtitle: "Cổng đăng ký phòng Lab",
    intro: many
      ? `Hệ thống đã ghi nhận ${results.length} ca sử dụng của bạn như sau:`
      : "Hệ thống đã ghi nhận lượt đăng ký của bạn như sau:",
    rows: [
      ["Mã đăng ký", many ? `${results[0].id_key} (dùng chung cho ${results.length} ca)` : results[0].id_key],
      ["Người đại diện", `${payload.representative.name} · ${payload.representative.student_id}`],
      ["Phòng Lab", booking.room],
      ["Ngày sử dụng", formatDisplayDate(booking.date)],
      ["Ca sử dụng", many
        ? results.map(item => shiftLabel(item.shift)).join(", ")
        : shiftLabel(results[0].shift)],
      ["Khu vực", booking.area],
      ["Số thành viên", `${payload.members.length} người`],
      ["Hình thức bàn giao", modeText],
      ["Khung giờ còn", many ? "" : (results[0].remaining_groups !== undefined ? `${results[0].remaining_groups} nhóm` : "")],
      ["Đã hủy lượt trùng lịch", (result.replaced || []).length
        ? [...new Set(result.replaced.map(item => `${item.old_id} (${item.shift})`))].join(", ")
        : ""],
      ["Lưu ý bàn giao", result.flagged_members
        ? `${result.flagged_members} thành viên đã có lượt chưa bàn giao trong tháng – kỹ thuật viên sẽ xem xét khi điểm danh`
        : ""]
    ],
    note: ((result.replaced || []).length
      ? "Bạn đã có đăng ký cùng ngày, cùng ca trước đó: hệ thống đã hủy lượt trước và gửi email thông báo. "
      : "") + (many
      ? `Vui lòng lưu lại MÃ ĐĂNG KÝ. Mã này dùng chung cho ${results.length} ca; sau ca cuối cùng chỉ cần bàn giao 1 lần bằng mã này cùng MSSV ở mục “Bàn giao phòng”.`
      : "Vui lòng lưu lại MÃ ĐĂNG KÝ. Sau khi sử dụng, dùng mã này cùng MSSV để bàn giao phòng ở mục “Bàn giao phòng”."),
    tone: "success",
    okText: "Đã hiểu"
  });
}

function showHandoverLocked(result) {
  vluDialog({
    title: "Tạm khóa đăng ký",
    subtitle: "Quy định bàn giao phòng Lab",
    intro: "Hệ thống chưa thể ghi nhận lượt đăng ký này vì người đăng ký chưa thực hiện bàn giao đúng quy định:",
    rows: [
      ["MSSV", result.student_id],
      ["Tháng", result.month],
      ["Lượt chưa bàn giao", `${result.missed} lượt (giới hạn ${result.limit} lượt/tháng)`],
      ["Mở lại đăng ký", `Từ ngày ${result.reopen_date}`]
    ],
    note: "Nếu bạn đã bàn giao nhưng hệ thống chưa ghi nhận, vui lòng liên hệ kỹ thuật viên phòng Lab để được kiểm tra.",
    tone: "danger",
    okText: "Đã hiểu"
  });
}

function showHandoverSuccess(result, info) {
  clearHandoverMessage();

  vluDialog({
    title: "Bàn giao thành công",
    subtitle: "Cổng đăng ký phòng Lab",
    intro: "Hệ thống đã ghi nhận phiếu bàn giao như sau:",
    rows: [
      ["Mã bàn giao", result.handover_id],
      ["Mã đăng ký", info.id_key],
      ["Người bàn giao", info.student],
      ["Phòng · Ca · Ngày", [info.room, info.shift, info.date].filter(Boolean).join(" · ")],
      ["Khu vực phụ trách", info.area],
      ["Tình trạng", info.condition],
      ["Hình ảnh", `${result.before_image_count || info.before} ảnh trước · ${result.after_image_count || info.after} ảnh sau`]
    ],
    note: "Kỹ thuật viên sẽ kiểm tra phiếu bàn giao. Cảm ơn bạn đã giữ gìn phòng Lab sạch sẽ.",
    tone: "success",
    okText: "Hoàn tất"
  });
}


// =========================================================
// CHỌN NHIỀU CA TRONG 1 LẦN ĐĂNG KÝ
// - Ô chọn ca gốc (#shift) được ẩn và luôn bằng ca đầu tiên đã chọn,
//   nên phần kiểm tra gốc trong app.js vẫn chạy như cũ.
// - Ca đã đủ nhóm trong ngày/phòng đang chọn sẽ bị khóa.
// =========================================================

const shiftPicker = document.getElementById("shiftPicker");
const SHIFT_ORDER = ["Ca 1", "Ca 2", "Ca 3", "Ca 4"];
let lastSlotContext = "";

function shiftCheckboxes() {
  return shiftPicker
    ? Array.from(shiftPicker.querySelectorAll('input[type="checkbox"]'))
    : [];
}

function selectedShifts() {
  return shiftCheckboxes()
    .filter(box => box.checked && !box.disabled)
    .map(box => box.value)
    .sort((a, b) => SHIFT_ORDER.indexOf(a) - SHIFT_ORDER.indexOf(b));
}

function selectedHandoverMode() {
  if (!registerType || registerType.value !== "Nhóm") return "";
  const picked = document.querySelector('input[name="handoverMode"]:checked');
  return picked ? picked.value : "";
}

function slotInfo(dateText, shift, room) {
  if (!dateText || !room || typeof normalizeSlot !== "function") return null;
  const slot = normalizeSlot(dateText, shift, room);
  const maxGroups = Number((slot && slot.max_groups) || MAX_GROUPS);
  const groups = Number((slot && slot.registered_groups) || 0);
  const maxPeople = Number((slot && slot.max_people) || MAX_PEOPLE);
  const people = Number((slot && slot.registered_people) || 0);
  const full = Boolean(slot && slot.is_full) || groups >= maxGroups || people >= maxPeople;
  return { full, remainingGroups: Math.max(maxGroups - groups, 0) };
}

function syncShiftSelect() {
  const select = document.getElementById("shift");
  const shifts = selectedShifts();
  if (select) select.value = shifts[0] || "";
  renderShiftSummary();
}

function refreshShiftAvailability() {
  const room = document.getElementById("room")?.value || "";
  const dateText = document.getElementById("bookingDate")?.value || "";

  shiftCheckboxes().forEach(box => {
    const info = slotInfo(dateText, box.value, room);
    const chip = box.closest(".shift-chip");
    const note = chip ? chip.querySelector("em") : null;

    box.disabled = Boolean(info && info.full);
    if (box.disabled) box.checked = false;
    if (chip) chip.classList.toggle("is-full", box.disabled);
    if (note) {
      note.textContent = !info ? "" : info.full ? "Đã đủ nhóm" : `Còn ${info.remainingGroups} nhóm`;
    }
  });

  syncShiftSelect();
}

function renderShiftSummary() {
  const box = document.getElementById("selectedSlot");
  if (!box) return;

  const room = document.getElementById("room")?.value || "";
  const dateText = document.getElementById("bookingDate")?.value || "";
  const shifts = selectedShifts();

  if (!shifts.length || !room || !dateText) {
    box.classList.remove("show");
    box.innerHTML = "";
    return;
  }

  box.classList.add("show");
  box.innerHTML = `
    <b>Đã chọn:</b>
    ${escapeHtml(room)} · ${dateText.split("-").reverse().join("/")} ·
    ${shifts.map(escapeHtml).join(", ")}
    ${shifts.length > 1 ? `<span class="slot-multi">${shifts.length} ca – dùng chung 1 mã đăng ký</span>` : ""}
  `;
}

function pickShiftFromSlot(room, dateText, shift) {
  const context = `${room}|${dateText}`;

  // Đổi phòng / ngày thì bỏ các ca đã chọn trước đó
  if (context !== lastSlotContext) {
    shiftCheckboxes().forEach(box => { box.checked = false; });
  }
  lastSlotContext = context;

  const box = shiftCheckboxes().find(item => item.value === shift);
  if (box) box.checked = true;

  // Chạy sau khi app.js gốc cập nhật khung "Đã chọn"
  setTimeout(refreshShiftAvailability, 0);
}

function showVerifiedHandoverMode(mode) {
  const box = document.getElementById("verifiedMode");
  if (!box) return;

  const text = {
    "ĐẠI DIỆN": "Nhóm chọn: người đại diện bàn giao cho cả nhóm.",
    "TỪNG THÀNH VIÊN": "Nhóm chọn: từng thành viên tự bàn giao – bạn chỉ cần bàn giao phần của mình."
  }[mode] || "";

  box.hidden = !text;
  box.textContent = text;
}

if (shiftPicker) {
  shiftPicker.addEventListener("change", syncShiftSelect);

  ["room", "bookingDate"].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("change", () => {
        lastSlotContext = `${document.getElementById("room")?.value || ""}|${document.getElementById("bookingDate")?.value || ""}`;
        refreshShiftAvailability();
      });
    }
  });

  if (form) {
    form.addEventListener("reset", () => setTimeout(() => {
      lastSlotContext = "";
      refreshShiftAvailability();
    }, 0));
  }
}


// =========================================================
// MSSV: đúng 13 chữ số
// - Ô nhập MSSV chỉ nhận số, tối đa 13 ký tự.
// - Kiểm tra lại khi gửi đăng ký / xác minh bàn giao (máy chủ cũng kiểm tra).
// =========================================================

const MSSV_LENGTH = 13;
const MSSV_RULE_TEXT = `MSSV phải gồm đúng ${MSSV_LENGTH} chữ số.`;

function isValidMssv(value) {
  return new RegExp(`^\\d{${MSSV_LENGTH}}$`).test(String(value || "").trim());
}

function isMssvInput(el) {
  return el && el.matches && el.matches("#repId, #handoverStudentId, .member-id");
}

function prepareMssvInput(el) {
  el.setAttribute("maxlength", String(MSSV_LENGTH));
  el.setAttribute("inputmode", "numeric");
  el.setAttribute("pattern", `\\d{${MSSV_LENGTH}}`);
  el.setAttribute("title", MSSV_RULE_TEXT);
}

document.querySelectorAll("#repId, #handoverStudentId, .member-id").forEach(prepareMssvInput);

document.addEventListener("input", event => {
  const el = event.target;
  if (!isMssvInput(el)) return;

  if (!el.hasAttribute("maxlength")) prepareMssvInput(el);

  const digits = el.value.replace(/\D/g, "").slice(0, MSSV_LENGTH);
  if (digits !== el.value) el.value = digits;

  el.classList.toggle("is-invalid", digits.length > 0 && digits.length !== MSSV_LENGTH);
});

document.addEventListener("focusin", event => {
  if (isMssvInput(event.target) && !event.target.hasAttribute("maxlength")) {
    prepareMssvInput(event.target);
  }
});


/* =========================================================
   KHU VỰC SỬ DỤNG: chọn nhanh mã bàn / máy theo sơ đồ phòng đã chọn
   (danh sách mã lấy từ static/lab-guide.js -> areas)
========================================================= */
function areaCodesFor(room) {
  const labs = (window.LAB_GUIDE && window.LAB_GUIDE.labs) || [];
  const lab = labs.find(item => item.name === room);
  return (lab && lab.areas) || [];
}

function typedAreas() {
  const input = document.getElementById("area");
  return String(input?.value || "")
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function renderAreaPicker() {
  const picker = document.getElementById("areaPicker");
  const input = document.getElementById("area");
  if (!picker || !input) return;

  const room = document.getElementById("room")?.value || "";
  const codes = areaCodesFor(room);

  if (!codes.length) {
    picker.hidden = true;
    picker.innerHTML = "";
    return;
  }

  const chosen = typedAreas().map(item => item.toUpperCase());
  picker.hidden = false;
  picker.innerHTML =
    `<small class="area-picker-hint">Chọn nhanh theo sơ đồ ${escapeHtml(room)}:</small>` +
    codes.map(code => {
      const on = chosen.includes(code.toUpperCase());
      return `<button type="button" class="area-chip${on ? " is-on" : ""}" data-area="${escapeHtml(code)}" aria-pressed="${on}">${escapeHtml(code)}</button>`;
    }).join("");
}

document.addEventListener("click", event => {
  const chip = event.target.closest(".area-chip[data-area]");
  if (!chip) return;

  const input = document.getElementById("area");
  const code = chip.dataset.area;
  const room = document.getElementById("room")?.value || "";
  const order = areaCodesFor(room).map(item => item.toUpperCase());
  let list = typedAreas();
  const has = list.some(item => item.toUpperCase() === code.toUpperCase());

  list = has
    ? list.filter(item => item.toUpperCase() !== code.toUpperCase())
    : list.concat(code);

  list.sort((a, b) => {
    const ia = order.indexOf(a.toUpperCase());
    const ib = order.indexOf(b.toUpperCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  input.value = list.join(", ");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  renderAreaPicker();
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("room")?.addEventListener("change", renderAreaPicker);
  document.getElementById("area")?.addEventListener("input", renderAreaPicker);
  renderAreaPicker();
});


/* =========================================================
   ĐIỆN THOẠI: lịch xem theo từng ngày
   - Màn hình hẹp (≤ 640px): thanh chọn ngày T2 … T7, lưới chỉ hiện cột ngày đang chọn
     (ô ca to, bấm dễ; không phải kéo ngang).
   - Màn hình rộng: giữ nguyên lưới cả tuần.
========================================================= */
const MOBILE_QUERY = window.matchMedia ? window.matchMedia("(max-width: 640px)") : { matches: false, addEventListener() {} };
let mobileDayIndex = null;

function calendarDayIndexDefault() {
  const days = typeof weekDays === "function" ? weekDays() : [];
  const today = typeof dateKey === "function" ? dateKey(new Date()) : "";
  const i = days.findIndex(day => dateKey(day) === today);
  return i >= 0 ? i : 0;
}

function renderDaySwitcher() {
  const grid = document.getElementById("calendarGrid");
  if (!grid || typeof weekDays !== "function") return;

  let bar = document.getElementById("daySwitcher");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "daySwitcher";
    bar.className = "day-switcher";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Chọn ngày");
    const scroll = grid.closest(".calendar-scroll") || grid;
    scroll.parentNode.insertBefore(bar, scroll);
    bar.addEventListener("click", event => {
      const button = event.target.closest("button[data-day]");
      if (!button) return;
      mobileDayIndex = Number(button.dataset.day);
      applyMobileDay();
    });
  }

  const days = weekDays();
  if (mobileDayIndex === null || mobileDayIndex >= days.length) mobileDayIndex = calendarDayIndexDefault();
  const today = dateKey(new Date());
  const labFilterValue = document.getElementById("labFilter")?.value || "all";

  bar.innerHTML = days.map((day, i) => {
    const key = dateKey(day);
    // số khung giờ đã có đăng ký trong ngày (theo bộ lọc phòng)
    const count = (typeof LABS !== "undefined" ? LABS : []).reduce((sum, lab) => {
      if (labFilterValue !== "all" && labFilterValue !== lab) return sum;
      return sum + SHIFTS.filter(shift => {
        const slot = normalizeSlot(key, shift.name, lab);
        return slot && Number(slot.registered_groups || 0) > 0;
      }).length;
    }, 0);
    return `<button type="button" role="tab" data-day="${i}"
              class="${i === mobileDayIndex ? "active" : ""} ${key === today ? "is-today" : ""}"
              aria-selected="${i === mobileDayIndex}">
              <b>${escapeHtml(DAY_NAMES[i])}</b><span>${escapeHtml(dateShort(day))}</span>
              ${count ? `<em>${count}</em>` : ""}
            </button>`;
  }).join("");

  applyMobileDay();
}

function applyMobileDay() {
  const grid = document.getElementById("calendarGrid");
  const bar = document.getElementById("daySwitcher");
  if (!grid) return;

  for (let i = 0; i < 6; i++) grid.classList.remove(`show-day-${i}`);
  grid.classList.toggle("is-day-view", MOBILE_QUERY.matches);
  if (MOBILE_QUERY.matches) grid.classList.add(`show-day-${mobileDayIndex ?? 0}`);

  bar?.querySelectorAll("button[data-day]").forEach(button => {
    const on = Number(button.dataset.day) === mobileDayIndex;
    button.classList.toggle("active", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
  });
}

if (typeof renderCalendar === "function") {
  const renderCalendarWeek = renderCalendar;
  renderCalendar = function () {
    renderCalendarWeek.apply(this, arguments);
    // thanh chọn ngày (điện thoại) lỗi cũng không được làm hỏng lịch
    try { renderDaySwitcher(); } catch (error) { console.error("Thanh chọn ngày:", error); }
  };
}

MOBILE_QUERY.addEventListener?.("change", applyMobileDay);

// Đổi tuần -> về ngày đầu tuần (hoặc hôm nay nếu trong tuần)
document.addEventListener("click", event => {
  if (event.target.closest("#prevWeek, #nextWeek, [data-week-nav]")) mobileDayIndex = null;
}, true);


/* =========================================================
   ĐIỆN THOẠI: chuyển tab thì cuộn lên đầu nội dung (thanh tab nằm dưới màn hình)
========================================================= */
document.addEventListener("click", event => {
  const tab = event.target.closest(".portal-nav .hero-tab");
  if (!tab || !MOBILE_QUERY.matches) return;
  setTimeout(() => {
    const panel = document.getElementById(tab.dataset.tabTarget);
    const header = document.querySelector(".site-header");
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - (header ? header.offsetHeight : 0) - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, 30);
});
