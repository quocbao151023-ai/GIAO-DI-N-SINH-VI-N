from __future__ import annotations

import os
import re
import threading
from datetime import date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import gspread
from flask import Flask, jsonify, render_template, request
from google.oauth2.service_account import Credentials
from gspread.exceptions import WorksheetNotFound
from gspread.utils import rowcol_to_a1


# =========================================================
# CẤU HÌNH CHUNG
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

app = Flask(__name__)

# File Google Sheet của kỹ thuật viên (cùng file Booking mà Hệ thống quản lý đang đọc).
# Dữ liệu cổng sinh viên nằm ở các sheet riêng WEB_..., không đụng tới sheet
# LAB_BOOKING / LAB_HANDOVER của Google Form.
SPREADSHEET_ID = "16eguXNHfCzbTq6olAQaMQBAylkqNR3gjVMmtnAkSBpE"

CREDENTIALS_FILE = Path(
    os.getenv(
        "GOOGLE_CREDENTIALS_FILE",
        str(BASE_DIR / "credentials.json"),
    )
)

BOOKING_SHEET = "WEB_BOOKING"      # mỗi ca đăng ký 1 dòng
MEMBER_SHEET = "WEB_MEMBERS"       # từng thành viên của lượt đăng ký
HANDOVER_SHEET = "WEB_HANDOVER"    # phiếu bàn giao
CONFIG_SHEET = "WEB_CONFIG"        # (tuỳ chọn) KEY / VALUE để đổi giới hạn
LOOKUP_SHEET = "WEB_LOOKUP"
FORM_BOOKING_SHEET = "LAB_BOOKING"   # sheet câu trả lời của Google Form (cùng file)

HEADER_ROW = 1

DEFAULT_MAX_GROUPS_PER_SLOT = 9
DEFAULT_MAX_PEOPLE_PER_SLOT = 108
DEFAULT_MAX_MEMBERS_PER_BOOKING = 12
# Số lượt chưa bàn giao trong 1 tháng thì người đăng ký bị tạm khóa đăng ký
# (đổi bằng KEY "MAX_MISSED_HANDOVERS_PER_MONTH" trong sheet CONFIG; 0 = tắt)
DEFAULT_MAX_MISSED_HANDOVERS = 3

# MSSV Văn Lang: đúng 13 chữ số
MSSV_LENGTH = 13
MSSV_RULE_TEXT = f"MSSV phải gồm đúng {MSSV_LENGTH} chữ số."

# Hình thức bàn giao (cột HINH_THUC_BAN_GIAO của WEB_BOOKING)
HANDOVER_MODE_REP = "ĐẠI DIỆN"            # nhóm: chỉ người đại diện bàn giao cho cả nhóm
HANDOVER_MODE_EACH = "TỪNG THÀNH VIÊN"    # nhóm: mỗi thành viên tự bàn giao
HANDOVER_MODE_SINGLE = "CÁ NHÂN"          # đăng ký cá nhân

# Cột bổ sung, tự thêm vào cuối sheet WEB_BOOKING nếu chưa có
OPTIONAL_BOOKING_HEADERS = ["MA_DANG_KY_CHUNG", "HINH_THUC_BAN_GIAO", "THAY_THE_BOI", "GHI_CHU_HE_THONG"]

# Lượt cũ bị thay khi sinh viên đăng ký trùng lịch (cùng ngày, cùng ca)
CANCELLED_DUPLICATE_STATUS = "ĐÃ HỦY - TRÙNG LỊCH"

CONFIRMED_STATUS = "ĐÃ XÁC NHẬN"
SOURCE_WEB = "STUDENT_PORTAL"

LABS = ("Lab 1", "Lab 2", "Lab 3")
SHIFTS = ("Ca 1", "Ca 2", "Ca 3", "Ca 4")


# =========================================================
# HEADER GOOGLE SHEET
# =========================================================

BOOKING_HEADERS = [
    "CREATED_AT",
    "ID_KEY",
    "SLOT_KEY",
    "TEN_DAI_DIEN",
    "MSSV_DAI_DIEN",
    "EMAIL_TRUONG",
    "EMAIL_CA_NHAN",
    "EMAIL_NHAN_XAC_NHAN",
    "SDT_DAI_DIEN",
    "HINH_THUC",
    "MUC_DICH",
    "PHONG",
    "KHU_VUC",
    "NGAY_SU_DUNG",
    "CA_SU_DUNG",
    "HO_TRO_KY_THUAT",
    "CAM_KET",
    "MEMBER_COUNT",
    "BOOKING_STATUS",
    "EMAIL_STATUS",
    "EMAIL_SENT_AT",
    "EMAIL_ERROR",
    "SOURCE",
    "UPDATED_AT",
]

MEMBER_HEADERS = [
    "CREATED_AT",
    "ID_KEY",
    "SLOT_KEY",
    "MEMBER_NAME",
    "MEMBER_MSSV",
    "MEMBER_EMAIL",
    "ROLE",
    "ATTENDANCE_STATUS",
    "CHECK_IN_AT",
    "CHECK_OUT_AT",
    "TECHNICIAN",
    "NOTE",
    "UPDATED_AT",
]

_booking_lock = threading.Lock()


# =========================================================
# KẾT NỐI GOOGLE SHEET
# =========================================================

def get_google_client() -> gspread.Client:
    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"Không tìm thấy credentials.json tại: {CREDENTIALS_FILE}"
        )

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]

    credentials = Credentials.from_service_account_file(
        str(CREDENTIALS_FILE),
        scopes=scopes,
    )

    return gspread.authorize(credentials)


# ---------------------------------------------------------
# BỘ NHỚ TẠM KHI ĐỌC GOOGLE SHEET
# - Mở file / lấy sheet: giữ 10 phút (mỗi lần mở tốn 1 lượt đọc)
# - Sheet không tồn tại (vd WEB_CONFIG): nhớ 2 phút
# ---------------------------------------------------------
import time as _time

_SS_CACHE: dict[str, Any] = {"obj": None, "at": 0.0}
_SS_TTL = 600


class _CachedSpreadsheet:
    def __init__(self, spreadsheet):
        self._ss = spreadsheet
        self._ws: dict[str, Any] = {}
        self._missing: dict[str, float] = {}

    def worksheet(self, title):
        if title in self._ws:
            return self._ws[title]
        if _time.time() - self._missing.get(title, 0) < 120:
            raise WorksheetNotFound(title)
        try:
            ws = self._ss.worksheet(title)
        except WorksheetNotFound:
            self._missing[title] = _time.time()
            raise
        self._ws[title] = ws
        return ws

    def add_worksheet(self, *args, **kwargs):
        ws = self._ss.add_worksheet(*args, **kwargs)
        self._ws[ws.title] = ws
        self._missing.pop(ws.title, None)
        return ws

    def worksheets(self):
        return self._ss.worksheets()

    def __getattr__(self, name):
        return getattr(self._ss, name)


def get_spreadsheet():
    if _SS_CACHE["obj"] is None or _time.time() - _SS_CACHE["at"] > _SS_TTL:
        _SS_CACHE["obj"] = _CachedSpreadsheet(get_google_client().open_by_key(SPREADSHEET_ID))
        _SS_CACHE["at"] = _time.time()
    return _SS_CACHE["obj"]


def get_existing_worksheet(title: str):
    spreadsheet = get_spreadsheet()

    try:
        return spreadsheet.worksheet(title)

    except WorksheetNotFound as error:
        raise ValueError(
            f"Không tìm thấy sheet {title}."
        ) from error


def get_existing_headers(
    worksheet,
    required_headers: list[str],
) -> list[str]:

    current_headers = [
        str(value).strip()
        for value in worksheet.row_values(HEADER_ROW)
    ]

    while current_headers and not current_headers[-1]:
        current_headers.pop()

    if not current_headers:
        raise ValueError(
            f"Sheet {worksheet.title} không có header tại dòng {HEADER_ROW}."
        )

    missing_headers = [
        header
        for header in required_headers
        if header not in current_headers
    ]

    if missing_headers:
        raise ValueError(
            f"Sheet {worksheet.title} đang thiếu cột: "
            f"{', '.join(missing_headers)}"
        )

    return current_headers


def get_or_create_worksheet(
    title: str,
    required_headers: list[str],
):
    spreadsheet = get_spreadsheet()

    try:
        worksheet = spreadsheet.worksheet(title)

        get_existing_headers(
            worksheet,
            required_headers,
        )

        return worksheet

    except WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(
            title=title,
            rows=2000,
            cols=max(
                len(required_headers),
                30,
            ),
        )

        worksheet.update(
            range_name=f"A{HEADER_ROW}",
            values=[required_headers],
        )

        return worksheet


def ordered_row(
    headers: list[str],
    values: dict[str, Any],
) -> list[Any]:
    return [
        values.get(header, "")
        for header in headers
    ]


def read_sheet_records_safe(
    worksheet,
    header_row: int = HEADER_ROW,
) -> list[dict[str, Any]]:

    all_values = worksheet.get_all_values()

    if len(all_values) < header_row:
        raise ValueError(
            f"Sheet {worksheet.title} không có dòng header {header_row}."
        )

    headers = [
        str(value).strip()
        for value in all_values[header_row - 1]
    ]

    while headers and not headers[-1]:
        headers.pop()

    if not headers:
        raise ValueError(
            f"Sheet {worksheet.title} không có tên cột tại dòng {header_row}."
        )

    duplicate_headers = {
        header
        for header in headers
        if header and headers.count(header) > 1
    }

    if duplicate_headers:
        raise ValueError(
            f"Sheet {worksheet.title} có tên cột bị trùng: "
            f"{', '.join(sorted(duplicate_headers))}"
        )

    records: list[dict[str, Any]] = []

    for raw_row in all_values[header_row:]:

        row_values = list(
            raw_row[:len(headers)]
        )

        if len(row_values) < len(headers):
            row_values.extend(
                [""] * (
                    len(headers)
                    - len(row_values)
                )
            )

        if not any(
            str(value).strip()
            for value in row_values
        ):
            continue

        record = {
            header: row_values[index]
            for index, header in enumerate(headers)
            if header
        }

        if str(
            record.get("CREATED_AT", "")
        ).strip() == "CREATED_AT":
            continue

        if str(
            record.get("ID_KEY", "")
        ).strip() == "ID_KEY":
            continue

        records.append(record)

    return records


# =========================================================
# ĐỌC CONFIG
# =========================================================

_CONFIG_CACHE: dict[str, Any] = {"data": None, "at": 0.0}


def load_system_config() -> dict[str, Any]:
    if _CONFIG_CACHE["data"] is not None and _time.time() - _CONFIG_CACHE["at"] < 120:
        return dict(_CONFIG_CACHE["data"])
    data = _load_system_config_uncached()
    _CONFIG_CACHE.update(data=dict(data), at=_time.time())
    return data


def _load_system_config_uncached() -> dict[str, Any]:
    config: dict[str, Any] = {
        "MAX_GROUPS_PER_SLOT": DEFAULT_MAX_GROUPS_PER_SLOT,
        "MAX_PEOPLE_PER_SLOT": DEFAULT_MAX_PEOPLE_PER_SLOT,
        "MAX_MEMBERS_PER_BOOKING": DEFAULT_MAX_MEMBERS_PER_BOOKING,
        "MAX_MISSED_HANDOVERS_PER_MONTH": DEFAULT_MAX_MISSED_HANDOVERS,
    }

    try:
        worksheet = get_existing_worksheet(
            CONFIG_SHEET
        )

        rows = read_sheet_records_safe(
            worksheet,
            HEADER_ROW,
        )

        for row in rows:
            key = str(
                row.get("KEY", "")
            ).strip()

            value = row.get("VALUE")

            if not key:
                continue

            config[key] = value

    except Exception:
        app.logger.exception(
            "Không đọc được CONFIG. Hệ thống dùng cấu hình mặc định."
        )

    return config


def int_config(
    config: dict[str, Any],
    key: str,
    fallback: int,
) -> int:
    try:
        return int(
            float(
                str(
                    config.get(
                        key,
                        fallback,
                    )
                ).strip()
            )
        )

    except (TypeError, ValueError):
        return fallback


# =========================================================
# LÀM SẠCH VÀ KIỂM TRA DỮ LIỆU
# =========================================================

def clean_text(
    value: Any,
    max_length: int = 500,
) -> str:
    text = str(value or "").strip()

    text = re.sub(
        r"[<>]",
        "",
        text,
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text[:max_length]


def normalize_email(value: Any) -> str:
    return clean_text(
        value,
        254,
    ).lower()


def valid_email(value: str) -> bool:
    return bool(
        re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+",
            value,
        )
    )


def parse_date(value: Any) -> date:
    return datetime.strptime(
        str(value).strip(),
        "%Y-%m-%d",
    ).date()


def parse_any_sheet_date(
    value: Any,
) -> date:

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, date):
        return value

    text = str(value or "").strip()

    formats = (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    )

    for date_format in formats:
        try:
            return datetime.strptime(
                text,
                date_format,
            ).date()

        except ValueError:
            continue

    raise ValueError(
        "Ngày không hợp lệ"
    )


def normalize_room(value: Any) -> str:
    text = clean_text(
        value,
        50,
    ).lower()

    if "lab 1" in text or text == "lab1":
        return "Lab 1"

    if "lab 2" in text or text == "lab2":
        return "Lab 2"

    if "lab 3" in text or text == "lab3":
        return "Lab 3"

    return clean_text(
        value,
        50,
    )


def normalize_shift(value: Any) -> str:
    text = clean_text(
        value,
        30,
    ).lower()

    if "ca 1" in text or text == "ca1":
        return "Ca 1"

    if "ca 2" in text or text == "ca2":
        return "Ca 2"

    if "ca 3" in text or text == "ca3":
        return "Ca 3"

    if "ca 4" in text or text == "ca4":
        return "Ca 4"

    return clean_text(
        value,
        30,
    )


def build_slot_key(
    booking_date: date,
    room: str,
    shift: str,
) -> str:
    return (
        f"{booking_date.isoformat()} | "
        f"{room} | "
        f"{shift}"
    )


def lab_code(room: str) -> str:
    mapping = {
        "Lab 1": "L1",
        "Lab 2": "L2",
        "Lab 3": "L3",
    }

    return mapping.get(
        room,
        "LX",
    )


def shift_code(shift: str) -> str:
    mapping = {
        "Ca 1": "C1",
        "Ca 2": "C2",
        "Ca 3": "C3",
        "Ca 4": "C4",
    }

    return mapping.get(
        shift,
        "CX",
    )


def value_from_aliases(
    row: dict[str, Any],
    aliases: list[str],
) -> str:

    for alias in aliases:
        value = row.get(alias)

        if str(value or "").strip():
            return str(value).strip()

    return ""


def row_status(
    row: dict[str, Any],
) -> str:

    return value_from_aliases(
        row,
        [
            "BOOKING_STATUS",
            "TRẠNG THÁI",
            "TRANG THAI",
        ],
    )


def is_active_booking(
    row: dict[str, Any],
) -> bool:

    return (
        row_status(row)
        .strip()
        .casefold()
        ==
        CONFIRMED_STATUS
        .strip()
        .casefold()
    )


def row_slot_key(
    row: dict[str, Any],
) -> str:

    existing_slot_key = value_from_aliases(
        row,
        ["SLOT_KEY"],
    )

    if existing_slot_key:
        parts = [
            part.strip()
            for part in existing_slot_key.split("|")
        ]

        if len(parts) == 3:
            raw_date, raw_room, raw_shift = parts

            try:
                booking_date = parse_any_sheet_date(
                    raw_date
                )

            except ValueError:
                return ""

            room = normalize_room(
                raw_room
            )

            shift = normalize_shift(
                raw_shift
            )

            if (
                room in LABS
                and shift in SHIFTS
            ):
                return build_slot_key(
                    booking_date,
                    room,
                    shift,
                )

    raw_date = value_from_aliases(
        row,
        [
            "NGAY_SU_DUNG",
            "Ngày sử dụng",
        ],
    )

    room = normalize_room(
        value_from_aliases(
            row,
            [
                "PHONG",
                "Phòng Lab",
                "Lab",
            ],
        )
    )

    shift = normalize_shift(
        value_from_aliases(
            row,
            [
                "CA_SU_DUNG",
                "Ca",
            ],
        )
    )

    try:
        booking_date = parse_any_sheet_date(
            raw_date
        )

    except ValueError:
        return ""

    if room not in LABS or shift not in SHIFTS:
        return ""

    return build_slot_key(
        booking_date,
        room,
        shift,
    )


def member_count_from_row(
    row: dict[str, Any],
) -> int:

    try:
        count = int(
            float(
                str(
                    row.get(
                        "MEMBER_COUNT",
                        "",
                    )
                ).strip()
            )
        )

        return count if count > 0 else 1

    except (ValueError, TypeError):
        return 1


# =========================================================
# SINH MÃ ĐĂNG KÝ
# =========================================================

def next_id_key(
    booking_rows: list[dict[str, Any]],
    room: str,
    shift: str,
    booking_date: date,
) -> str:

    prefix = (
        f"{lab_code(room)}"
        f"{shift_code(shift)}"
        f"{booking_date.strftime('%d%m%Y')}"
    )

    expected_start = f"{prefix}-"

    maximum = 0

    for row in booking_rows:

        existing_id = str(
            row.get(
                "ID_KEY",
                "",
            )
        ).strip()

        if not existing_id.startswith(
            expected_start
        ):
            continue

        sequence_text = existing_id[
            len(expected_start):
        ]

        if sequence_text.isdigit():
            maximum = max(
                maximum,
                int(sequence_text),
            )

    return (
        f"{prefix}-"
        f"{maximum + 1:02d}"
    )


# =========================================================
# KIỂM TRA PAYLOAD
# =========================================================

# =========================================================
# CỘT BỔ SUNG CHO WEB_BOOKING (tự thêm, không làm lỗi sheet cũ)
# =========================================================

FORM_SOURCE_STATE = {"rows": 0, "error": ""}
_FORM_CACHE: dict[str, Any] = {"rows": None, "at": 0.0}


WEB_SOURCE_STATE = {"rows": 0, "error": ""}


def read_rows_tolerant(worksheet) -> list[dict[str, Any]]:
    """Đọc sheet theo dòng tiêu đề; cột trùng tên lấy cột đầu tiên, cột trống bỏ qua.
    Chỉ dùng để HIỂN THỊ lịch (ghi dữ liệu vẫn kiểm tra chặt như cũ)."""
    values = worksheet.get_all_values()
    if len(values) < HEADER_ROW:
        return []

    headers = [str(value).strip() for value in values[HEADER_ROW - 1]]
    index: dict[str, int] = {}
    for i, header in enumerate(headers):
        if header and header not in index:
            index[header] = i

    records = []
    for raw in values[HEADER_ROW:]:
        if not any(str(cell).strip() for cell in raw):
            continue
        record = {header: (raw[i] if i < len(raw) else "") for header, i in index.items()}
        if str(record.get("ID_KEY", "")).strip() == "ID_KEY":
            continue
        records.append(record)
    return records


def web_booking_rows_tolerant() -> list[dict[str, Any]]:
    """Lượt đăng ký trên cổng (WEB_BOOKING) cho lịch công khai. Chưa có sheet -> [] (không báo lỗi)."""
    try:
        worksheet = get_spreadsheet().worksheet(BOOKING_SHEET)
    except WorksheetNotFound:
        WEB_SOURCE_STATE.update(rows=0, error="")
        return []

    rows = read_rows_tolerant(worksheet)
    WEB_SOURCE_STATE.update(rows=len(rows), error="")
    return rows


def form_booking_rows() -> list[dict[str, Any]]:
    if _FORM_CACHE["rows"] is not None and _time.time() - _FORM_CACHE["at"] < 300:
        return [dict(row) for row in _FORM_CACHE["rows"]]
    rows = _form_booking_rows_uncached()
    _FORM_CACHE.update(rows=rows, at=_time.time())
    return [dict(row) for row in rows]


def _form_booking_rows_uncached() -> list[dict[str, Any]]:
    """Lượt đăng ký cũ qua Google Form (sheet LAB_BOOKING cùng file), đổi về tên cột của cổng.
    Dùng để hiện trên lịch, tính chung sức chứa và không cấp trùng mã.
    Đọc theo từ khóa tiêu đề (không phân biệt hoa thường, khoảng trắng, cột trùng tên)."""
    import unicodedata

    def norm(text: Any) -> str:
        return re.sub(r"\s+", " ", unicodedata.normalize("NFC", str(text or "")).strip().lower())

    try:
        values = get_existing_worksheet(FORM_BOOKING_SHEET).get_all_values()
    except Exception as error:
        FORM_SOURCE_STATE.update(rows=0, error=str(error))
        return []

    if not values:
        FORM_SOURCE_STATE.update(rows=0, error="Sheet trống")
        return []

    headers = [norm(h) for h in values[0]]

    def col(*keywords: str) -> int:
        for keyword in keywords:
            key = norm(keyword)
            for index, header in enumerate(headers):
                if header == key:
                    return index
        for keyword in keywords:
            key = norm(keyword)
            for index, header in enumerate(headers):
                if key in header:
                    return index
        return -1

    c_status = col("trạng thái", "trang thai")
    c_slot = col("slot_key")
    c_id = col("id_key")
    c_date = col("ngày bạn đăng ký sử dụng phòng")
    c_room = col("phòng lab được lựa chọn")
    c_shift = col("ca bạn đăng ký sử dụng")
    c_type = col("đăng ký với tư cách")
    c_size = col("số lượng thành viên")
    c_mssv = col("mã số sinh viên")
    c_email = col("địa chỉ email", "email trường")

    def cell(row: list[Any], index: int) -> str:
        return str(row[index]).strip() if 0 <= index < len(row) else ""

    result = []

    for row in values[1:]:
        status = cell(row, c_status)
        if not status:
            continue

        slot_key = cell(row, c_slot)
        if not slot_key:
            # Lượt cũ chưa có SLOT_KEY: ghép từ ngày / phòng / ca
            try:
                slot_key = build_slot_key(
                    parse_any_sheet_date(cell(row, c_date)),
                    normalize_room(cell(row, c_room)),
                    normalize_shift(cell(row, c_shift)),
                )
            except ValueError:
                slot_key = ""

        is_group = "nh" in cell(row, c_type).lower()
        size_text = re.sub(r"\D", "", cell(row, c_size))

        result.append(
            {
                "ID_KEY": cell(row, c_id),
                "SLOT_KEY": slot_key,
                "BOOKING_STATUS": CONFIRMED_STATUS if status.replace(" ", "_").upper() == "ĐÃ_XÁC_NHẬN" else status,
                "MSSV_DAI_DIEN": normalize_mssv(cell(row, c_mssv)),
                "EMAIL_NHAN_XAC_NHAN": normalize_email(cell(row, c_email)),
                "MEMBER_COUNT": (size_text or "1") if is_group else "1",
                "SOURCE": "GOOGLE_FORM",
            }
        )

    FORM_SOURCE_STATE.update(
        rows=len(result),
        error="" if c_status >= 0 else "Không thấy cột TRẠNG THÁI trong sheet " + FORM_BOOKING_SHEET,
    )
    return result


def normalize_mssv(value: Any) -> str:
    """Bỏ khoảng trắng / dấu chấm, chỉ giữ chữ số đã nhập."""
    return re.sub(r"[\s.]", "", clean_text(value, 50))


def is_valid_mssv(value: Any) -> bool:
    return bool(re.fullmatch(rf"\d{{{MSSV_LENGTH}}}", str(value or "")))


def ensure_optional_headers(worksheet, headers: list[str]) -> None:
    current = [str(value).strip() for value in worksheet.row_values(HEADER_ROW)]

    while current and not current[-1]:
        current.pop()

    missing = [header for header in headers if header not in current]

    if not missing:
        return

    needed = len(current) + len(missing)
    col_count = getattr(worksheet, "col_count", needed)

    if col_count < needed:
        worksheet.add_cols(needed - col_count)

    worksheet.update(
        range_name=rowcol_to_a1(HEADER_ROW, len(current) + 1),
        values=[missing],
    )


def booking_handover_mode(row: dict[str, Any]) -> str:
    return clean_text(row.get("HINH_THUC_BAN_GIAO"), 30).upper()


def booking_batch_code(row: dict[str, Any]) -> str:
    return (
        clean_text(row.get("MA_DANG_KY_CHUNG"), 50)
        or clean_text(row.get("ID_KEY"), 50)
    )


def pick_booking_row(
    booking_rows: list[dict[str, Any]],
    id_key: str,
) -> dict[str, Any] | None:
    """Dòng đăng ký của mã (ưu tiên ca còn hiệu lực). 1 mã có thể có nhiều ca
    (mỗi ca 1 dòng) -> gom danh sách ca vào khóa _SHIFTS."""
    same = [
        row for row in booking_rows
        if clean_text(row.get("ID_KEY"), 50) == id_key
    ]

    if not same:
        return None

    active = [row for row in same if is_active_booking(row)]
    chosen = dict((active or same)[0])
    shifts = {
        normalize_shift(value_from_aliases(row, SHIFT_ALIASES))
        for row in (active or same[:1])
    }
    chosen["_SHIFTS"] = [shift for shift in SHIFTS if shift in shifts] or sorted(shifts)
    return chosen


def booking_shift_text(booking_row: dict[str, Any]) -> str:
    shifts = booking_row.get("_SHIFTS") or []

    if len(shifts) > 1:
        return ", ".join(shifts)

    return normalize_shift(value_from_aliases(booking_row, SHIFT_ALIASES))


def handover_mode_error(
    booking_row: dict[str, Any],
    student_id: str,
) -> str:
    """Nhóm chọn bàn giao qua người đại diện -> thành viên khác không được bàn giao."""

    if booking_handover_mode(booking_row) != HANDOVER_MODE_REP:
        return ""

    rep_mssv = clean_text(booking_row.get("MSSV_DAI_DIEN"), 50)

    if not rep_mssv or rep_mssv == student_id:
        return ""

    rep_name = clean_text(booking_row.get("TEN_DAI_DIEN"), 120)

    return (
        "Nhóm này chọn hình thức bàn giao qua NGƯỜI ĐẠI DIỆN"
        f"{f' ({rep_name})' if rep_name else ''}. "
        "Chỉ người đại diện được bàn giao phòng cho cả nhóm."
    )


# =========================================================
# LƯỢT CHƯA BÀN GIAO TRONG THÁNG (theo từng MSSV)
# Một lượt bị tính "chưa bàn giao" khi:
#   - đăng ký qua cổng sinh viên (SOURCE = STUDENT_PORTAL) và còn hiệu lực,
#   - ngày sử dụng thuộc tháng hiện tại và đã qua (trước hôm nay),
#   - chưa có phiếu bàn giao trong WEB_HANDOVER:
#       + nhóm bàn giao qua đại diện / cá nhân: 1 phiếu bất kỳ của lượt là đủ;
#       + nhóm bàn giao từng thành viên: mỗi thành viên cần phiếu của chính mình.
# Đăng ký nhiều ca cùng lúc (cùng MA_DANG_KY_CHUNG) chỉ cần bàn giao 1 lần
# và nếu quên thì cũng chỉ tính 1 lần.
# =========================================================

def handover_records() -> tuple[set[str], set[tuple[str, str]]]:
    try:
        worksheet = get_existing_worksheet(HANDOVER_SHEET)
    except ValueError:
        # Chưa có sheet WEB_HANDOVER -> chưa có phiếu bàn giao nào
        return set(), set()

    ids: set[str] = set()
    pairs: set[tuple[str, str]] = set()

    for row in read_sheet_records_safe(worksheet, HEADER_ROW):
        id_key = clean_text(row.get("ID_KEY"), 50)

        if not id_key:
            continue

        ids.add(id_key)
        pairs.add((id_key, clean_text(row.get("MSSV"), 50)))

    return ids, pairs


def count_missed_handovers(
    booking_rows: list[dict[str, Any]],
    member_rows: list[dict[str, Any]],
    today: date | None = None,
) -> dict[str, int]:

    today = today or datetime.now(VIETNAM_TZ).date()
    handed_ids, handed_pairs = handover_records()

    batch_of = {
        clean_text(row.get("ID_KEY"), 50): booking_batch_code(row)
        for row in booking_rows
        if clean_text(row.get("ID_KEY"), 50)
    }

    handed_batches = {batch_of.get(id_key, id_key) for id_key in handed_ids}
    handed_batch_students = {
        (batch_of.get(id_key, id_key), mssv) for id_key, mssv in handed_pairs
    }

    students_by_id: dict[str, set[str]] = {}

    for member in member_rows:
        id_key = clean_text(member.get("ID_KEY"), 50)
        mssv = clean_text(member.get("MEMBER_MSSV"), 50)

        if id_key and mssv:
            students_by_id.setdefault(id_key, set()).add(mssv)

    missed_batches: dict[str, set[str]] = {}

    for row in booking_rows:
        if not is_active_booking(row):
            continue

        if str(row.get("SOURCE", "")).strip() != SOURCE_WEB:
            continue

        id_key = clean_text(row.get("ID_KEY"), 50)

        if not id_key:
            continue

        try:
            used_on = parse_any_sheet_date(row.get("NGAY_SU_DUNG"))
        except ValueError:
            continue

        if (
            used_on >= today
            or used_on.year != today.year
            or used_on.month != today.month
        ):
            continue

        batch = batch_of.get(id_key, id_key)
        students = set(students_by_id.get(id_key, set()))
        rep_mssv = clean_text(row.get("MSSV_DAI_DIEN"), 50)

        if rep_mssv:
            students.add(rep_mssv)

        if booking_handover_mode(row) == HANDOVER_MODE_EACH:
            missed = {
                mssv for mssv in students
                if (batch, mssv) not in handed_batch_students
            }
        elif batch in handed_batches:
            missed = set()
        else:
            missed = students

        for mssv in missed:
            missed_batches.setdefault(mssv, set()).add(batch)

    return {mssv: len(batches) for mssv, batches in missed_batches.items()}


def first_day_next_month(today: date) -> date:
    if today.month == 12:
        return date(today.year + 1, 1, 1)
    return date(today.year, today.month + 1, 1)


def validate_payload(
    payload: dict[str, Any],
    max_members: int,
) -> tuple[dict[str, Any], list[str]]:

    errors: list[str] = []

    representative_raw = (
        payload.get("representative")
        or {}
    )

    booking_raw = (
        payload.get("booking")
        or {}
    )

    members_raw = (
        payload.get("members")
        or []
    )

    representative = {
        "name": clean_text(
            representative_raw.get("name"),
            120,
        ),
        "student_id": clean_text(
            representative_raw.get(
                "student_id"
            ),
            50,
        ),
        "school_email": normalize_email(
            representative_raw.get(
                "school_email"
            )
        ),
        "personal_email": normalize_email(
            representative_raw.get(
                "personal_email"
            )
        ),
        "phone": clean_text(
            representative_raw.get("phone"),
            30,
        ),
    }

    representative["email"] = (
        representative["school_email"]
        or representative["personal_email"]
    )

    booking = {
        "register_type": clean_text(
            booking_raw.get(
                "register_type"
            ),
            30,
        ),
        "purpose": clean_text(
            booking_raw.get("purpose"),
            1000,
        ),
        "room": normalize_room(
            booking_raw.get("room")
        ),
        "area": clean_text(
            booking_raw.get("area"),
            200,
        ),
        "date_text": clean_text(
            booking_raw.get("date"),
            20,
        ),
        "shift": normalize_shift(
            booking_raw.get("shift")
        ),
        "tech_support": clean_text(
            booking_raw.get(
                "tech_support"
            ),
            50,
        ),
        "commitment": bool(
            booking_raw.get("commitment")
        ),
    }

    if not representative["name"]:
        errors.append(
            "Thiếu họ tên người đại diện."
        )

    if not representative["student_id"]:
        errors.append(
            "Thiếu MSSV người đại diện."
        )

    if not valid_email(
        representative["email"]
    ):
        errors.append(
            "Email người đại diện không hợp lệ."
        )

    if (
        representative["school_email"]
        and not valid_email(
            representative["school_email"]
        )
    ):
        errors.append(
            "Email trường không hợp lệ."
        )

    if (
        representative["personal_email"]
        and not valid_email(
            representative["personal_email"]
        )
    ):
        errors.append(
            "Email cá nhân không hợp lệ."
        )

    if not representative["phone"]:
        errors.append(
            "Thiếu số điện thoại."
        )

    register_type_normalized = (
        booking["register_type"]
        .strip()
        .lower()
    )

    if register_type_normalized in (
        "cá nhân",
        "ca nhan",
    ):
        booking["register_type"] = "CÁ NHÂN"

    elif register_type_normalized in (
        "nhóm",
        "nhom",
    ):
        booking["register_type"] = "NHÓM"

    else:
        errors.append(
            "Hình thức đăng ký không hợp lệ."
        )

    if not booking["purpose"]:
        errors.append(
            "Thiếu mục đích sử dụng."
        )

    if booking["room"] not in LABS:
        errors.append(
            "Phòng Lab không hợp lệ."
        )

    if not booking["area"]:
        errors.append(
            "Thiếu khu vực sử dụng."
        )

    if booking["shift"] not in SHIFTS:
        errors.append(
            "Ca sử dụng không hợp lệ."
        )

    if not booking["commitment"]:
        errors.append(
            "Bạn cần xác nhận cam kết."
        )

    try:
        booking_date = parse_date(
            booking["date_text"]
        )

        booking["date"] = booking_date

        today = datetime.now(
            VIETNAM_TZ
        ).date()

        if booking_date < today:
            errors.append(
                "Ngày sử dụng không được ở quá khứ."
            )

    except ValueError:
        booking["date"] = None

        errors.append(
            "Ngày sử dụng không hợp lệ."
        )

    if not isinstance(
        members_raw,
        list,
    ):
        members_raw = []

    members: list[dict[str, str]] = []

    for item in members_raw:

        if not isinstance(item, dict):
            continue

        members.append(
            {
                "name": clean_text(
                    item.get("name"),
                    120,
                ),
                "student_id": clean_text(
                    item.get("student_id"),
                    50,
                ),
                "email": normalize_email(
                    item.get("email")
                ),
            }
        )

    if not members:
        errors.append(
            "Danh sách thành viên đang trống."
        )

    if len(members) > max_members:
        errors.append(
            f"Mỗi lượt đăng ký tối đa "
            f"{max_members} người."
        )

    if (
        booking["register_type"] == "CÁ NHÂN"
        and len(members) != 1
    ):
        errors.append(
            "Đăng ký cá nhân chỉ được có một người."
        )

    if (
        booking["register_type"] == "NHÓM"
        and len(members) < 2
    ):
        errors.append(
            "Đăng ký nhóm phải có ít nhất hai người."
        )

    seen_student_ids: set[str] = set()
    representative_occurrences = 0

    for index, member in enumerate(
        members,
        start=1,
    ):

        if not member["name"]:
            errors.append(
                f"Thành viên {index} thiếu họ tên."
            )

        if not member["student_id"]:
            errors.append(
                f"Thành viên {index} thiếu MSSV."
            )

        if (
            member["email"]
            and not valid_email(
                member["email"]
            )
        ):
            errors.append(
                f"Email thành viên {index} không hợp lệ."
            )

        if (
            member["student_id"]
            in seen_student_ids
        ):
            errors.append(
                f"MSSV {member['student_id']} bị trùng."
            )

        seen_student_ids.add(
            member["student_id"]
        )

        if (
            member["student_id"]
            == representative["student_id"]
        ):
            representative_occurrences += 1

    if representative_occurrences != 1:
        errors.append(
            "Người đại diện phải xuất hiện đúng một lần trong danh sách."
        )

    normalized = {
        "representative": representative,
        "booking": booking,
        "members": members,
    }

    return normalized, errors


# =========================================================
# ROUTE GIAO DIỆN
# =========================================================

@app.get("/")
def index():
    return render_template(
        "index.html"
    )


@app.get("/health")
def health():
    return jsonify(
        {
            "success": True,
            "service": "student-lab-booking",
        }
    )


# =========================================================
# API LỊCH CÔNG KHAI
# =========================================================

@app.get("/api/kiem-tra-du-lieu")
def kiem_tra_du_lieu():
    """Cho biết cổng đang đọc file nào, mỗi nguồn có bao nhiêu lượt (để kiểm tra lịch)."""
    info: dict[str, Any] = {"spreadsheet_id": SPREADSHEET_ID}

    try:
        spreadsheet = get_spreadsheet()
        info["spreadsheet_title"] = spreadsheet.title
        info["sheets"] = [ws.title for ws in spreadsheet.worksheets()]
    except Exception as error:
        info["loi_mo_file"] = str(error)
        return jsonify(info), 500

    try:
        web_rows = read_sheet_records_safe(get_existing_worksheet(BOOKING_SHEET), HEADER_ROW)
        info["web_booking"] = {
            "tong": len(web_rows),
            "dang_hieu_luc": sum(1 for row in web_rows if is_active_booking(row)),
        }
    except Exception as error:
        info["web_booking"] = {"loi": str(error)}

    form_rows = form_booking_rows()
    info["google_form_cu"] = {
        "sheet": FORM_BOOKING_SHEET,
        "tong": len(form_rows),
        "dang_hieu_luc": sum(1 for row in form_rows if is_active_booking(row)),
        "co_slot_key": sum(1 for row in form_rows if row_slot_key(row)),
        "loi": FORM_SOURCE_STATE["error"],
        "vi_du": [row["SLOT_KEY"] for row in form_rows if is_active_booking(row)][:5],
    }

    return jsonify(info)


_SCHEDULE_CACHE: dict[str, Any] = {"body": None, "at": 0.0}


def invalidate_schedule_cache() -> None:
    _SCHEDULE_CACHE.update(body=None, at=0.0)


@app.get("/api/public-schedule")
def public_schedule():
    if _SCHEDULE_CACHE["body"] is not None and _time.time() - _SCHEDULE_CACHE["at"] < 15:
        return jsonify(_SCHEDULE_CACHE["body"])

    response = _public_schedule_uncached()
    resp, status = (response if isinstance(response, tuple) else (response, 200))
    body = resp.get_json(silent=True) or {}

    if status == 200 and body.get("success"):
        _SCHEDULE_CACHE.update(body=body, at=_time.time())
        return resp

    # Google báo quá hạn mức đọc -> dùng tạm lịch đã có
    if _SCHEDULE_CACHE["body"] is not None and "429" in str(body.get("error", "")):
        return jsonify(_SCHEDULE_CACHE["body"])

    return resp, status


def _public_schedule_uncached():
    try:
        config = load_system_config()

        max_groups = int_config(
            config,
            "MAX_GROUPS_PER_SLOT",
            DEFAULT_MAX_GROUPS_PER_SLOT,
        )

        max_people = int_config(
            config,
            "MAX_PEOPLE_PER_SLOT",
            DEFAULT_MAX_PEOPLE_PER_SLOT,
        )

        rows = web_booking_rows_tolerant() + form_booking_rows()

        slots: dict[
            str,
            dict[str, Any],
        ] = {}

        for row in rows:

            if not is_active_booking(row):
                continue

            slot_key = row_slot_key(row)

            if not slot_key:
                continue

            parts = [
                part.strip()
                for part in slot_key.split("|")
            ]

            if len(parts) != 3:
                continue

            raw_date, room, shift = parts

            try:
                booking_date = parse_any_sheet_date(
                    raw_date
                )

            except ValueError:
                continue

            room = normalize_room(room)
            shift = normalize_shift(shift)

            if room not in LABS:
                continue

            if shift not in SHIFTS:
                continue

            normalized_slot_key = build_slot_key(
                booking_date,
                room,
                shift,
            )

            if normalized_slot_key not in slots:
                slots[normalized_slot_key] = {
                    "slot_key": normalized_slot_key,
                    "date": booking_date.isoformat(),
                    "lab": room,
                    "shift": shift,
                    "registered_groups": 0,
                    "registered_people": 0,
                }

            slots[
                normalized_slot_key
            ]["registered_groups"] += 1

            slots[
                normalized_slot_key
            ]["registered_people"] += (
                member_count_from_row(row)
            )

        result: list[
            dict[str, Any]
        ] = []

        for slot in slots.values():

            registered_groups = int(
                slot["registered_groups"]
            )

            registered_people = int(
                slot["registered_people"]
            )

            remaining_groups = max(
                max_groups
                - registered_groups,
                0,
            )

            remaining_people = max(
                max_people
                - registered_people,
                0,
            )

            is_full = (
                registered_groups >= max_groups
                or registered_people >= max_people
            )

            result.append(
                {
                    **slot,
                    "remaining_groups": remaining_groups,
                    "remaining_people": remaining_people,
                    "max_groups": max_groups,
                    "max_people": max_people,
                    "is_full": is_full,
                    "status": (
                        "Hết chỗ"
                        if is_full
                        else "Còn chỗ"
                    ),
                }
            )

        result.sort(
            key=lambda item: (
                item["date"],
                item["shift"],
                item["lab"],
            )
        )

        return jsonify(
            {
                "success": True,
                "data": result,
                "config": {
                    "max_groups": max_groups,
                    "max_people": max_people,
                },
            }
        )

    except Exception as error:
        app.logger.exception(
            "Không tải được lịch công khai"
        )

        return (
            jsonify(
                {
                    "success": False,
                    "data": [],
                    "message": "Không thể tải lịch phòng.",
                    "error": str(error),
                }
            ),
            500,
        )


# =========================================================
# API ĐĂNG KÝ PHÒNG LAB
# =========================================================

# =========================================================
# API ĐĂNG KÝ PHÒNG LAB
# - Nhận 1 hoặc nhiều ca (booking.shifts) cùng phòng, cùng ngày.
# - 1 lần đăng ký = 1 mã ID_KEY dùng chung cho mọi ca đã chọn.
#   Mỗi ca vẫn ghi 1 dòng trong WEB_BOOKING (cùng ID_KEY, khác SLOT_KEY) để
#   lịch hiện mã ở đúng từng ca và tính sức chứa riêng từng ca.
#   Mã ghi đủ các ca: L<phòng><C+số ca cho từng ca><ngày ddmmyyyy>-<số thứ tự>
#     1 ca : L1C229102026-01          (giữ đúng mẫu cũ)
#     3 ca : L1C2C3C429102026-02      (Lab 1, Ca 2 + Ca 3 + Ca 4, ngày 29/10/2026)
#   Số thứ tự tăng dần trong cùng phòng + ngày cho các mã có chung ít nhất 1 ca,
#   nên trong mỗi ca không có 2 mã trùng số. Thành viên ghi 1 lần cho cả mã.
# - Kiểm tra giống bản gốc cho từng ca; chỉ ghi khi TẤT CẢ các ca hợp lệ.
# =========================================================

def requested_shifts(
    payload: dict[str, Any],
    fallback_shift: str,
) -> list[str]:

    raw = (payload.get("booking") or {}).get("shifts")
    picked: set[str] = set()

    if isinstance(raw, list):
        for value in raw:
            shift = normalize_shift(value)
            if shift in SHIFTS:
                picked.add(shift)

    if not picked and fallback_shift in SHIFTS:
        picked.add(fallback_shift)

    return [shift for shift in SHIFTS if shift in picked]


def requested_handover_mode(
    payload: dict[str, Any],
    register_type: str,
) -> str:

    if register_type != "NHÓM":
        return HANDOVER_MODE_SINGLE

    raw = clean_text(
        (payload.get("booking") or {}).get("handover_mode"),
        30,
    ).upper()

    if raw in (HANDOVER_MODE_REP, HANDOVER_MODE_EACH):
        return raw

    return ""


def same_date_shift(row: dict[str, Any], booking_date: date, shift: str) -> bool:
    parts = [part.strip() for part in row_slot_key(row).split("|")]
    return len(parts) == 3 and parts[0] == booking_date.isoformat() and parts[2] == shift


def is_same_registrant(row: dict[str, Any], representative: dict[str, Any]) -> bool:
    existing_email = normalize_email(
        value_from_aliases(row, ["EMAIL_NHAN_XAC_NHAN", "EMAIL_TRUONG", "EMAIL_CA_NHAN"])
    )
    existing_mssv = normalize_mssv(value_from_aliases(row, ["MSSV_DAI_DIEN"]))

    return bool(
        (existing_email and existing_email == representative["email"])
        or (existing_mssv and existing_mssv == representative["student_id"])
    )


def cancel_booking_rows(
    worksheet,
    headers: list[str],
    replace_map: dict[tuple[str, str], str],
    now_text: str,
) -> None:
    """Đánh dấu ca cũ bị trùng là ĐÃ HỦY - TRÙNG LỊCH và đặt EMAIL_STATUS = CHƯA GỬI
    để Apps Script gửi email báo cho sinh viên.
    replace_map: (ID_KEY cũ, SLOT_KEY cũ) -> ID_KEY mới. Chỉ hủy đúng ca bị trùng;
    các ca khác của mã cũ (nếu có) vẫn giữ."""
    col = {header: index + 1 for index, header in enumerate(headers)}
    ids = worksheet.col_values(col["ID_KEY"])
    slots = worksheet.col_values(col["SLOT_KEY"]) if "SLOT_KEY" in col else []
    updates = []

    def slot_at(index: int) -> str:
        return row_slot_key({"SLOT_KEY": slots[index]}) if index < len(slots) else ""

    for (old_id, old_slot), new_id in replace_map.items():
        matches = [
            index for index, value in enumerate(ids)
            if index >= HEADER_ROW and str(value).strip() == old_id
        ]
        exact = [index for index in matches if slot_at(index) == old_slot]

        for index in (exact or matches[:1]):
            replace_one(updates, col, index + 1, new_id, now_text)

    if updates:
        worksheet.batch_update(updates, value_input_option="RAW")


def replace_one(updates: list, col: dict[str, int], row_number: int, new_id: str, now_text: str) -> None:
    values = {
        "BOOKING_STATUS": CANCELLED_DUPLICATE_STATUS,
        "EMAIL_STATUS": "CHƯA GỬI",
        "EMAIL_ERROR": "",
        "THAY_THE_BOI": new_id,
        "GHI_CHU_HE_THONG": f"Đăng ký trùng lịch – hệ thống hủy lượt này, thay bằng {new_id}",
        "UPDATED_AT": now_text,
    }

    for header, value in values.items():
        if header in col:
            updates.append({"range": rowcol_to_a1(row_number, col[header]), "values": [[value]]})


ID_KEY_PATTERN = re.compile(r"^L([1-3])-?((?:C[1-4]-?)+)(\d{8})-(\d+)$")


def parse_id_key(id_key: Any) -> tuple[str, set[str], str, int] | None:
    """L1C2C3C429102026-02 -> ("L1", {"Ca 2","Ca 3","Ca 4"}, "29102026", 2).
    Đọc được cả mã cũ 1 ca (L1C229102026-01, L1-C2-29102026-01)."""
    match = ID_KEY_PATTERN.match(str(id_key or "").strip().upper())

    if not match:
        return None

    shifts = {f"Ca {number}" for number in re.findall(r"C([1-4])", match.group(2))}
    return f"L{match.group(1)}", shifts, match.group(3), int(match.group(4))


def make_id_key(
    rows: list[dict[str, Any]],
    room: str,
    shifts: list[str],
    booking_date: date,
) -> str:
    """Mã đăng ký cho 1 lần đăng ký (1 hoặc nhiều ca)."""
    lab = lab_code(room)
    day = booking_date.strftime("%d%m%Y")
    chosen = set(shifts)
    maximum = 0

    for row in rows:
        parsed = parse_id_key(row.get("ID_KEY"))

        if parsed and parsed[0] == lab and parsed[2] == day and parsed[1] & chosen:
            maximum = max(maximum, parsed[3])

    codes = "".join(shift_code(shift) for shift in SHIFTS if shift in chosen)
    return f"{lab}{codes}{day}-{maximum + 1:02d}"


def booking_error(message: str, status: int, **extra: Any):
    body = {"success": False, "message": message, "errors": []}
    body.update(extra)
    return jsonify(body), status


@app.post("/api/register-booking")
def register_booking():
    config = load_system_config()

    max_groups = int_config(config, "MAX_GROUPS_PER_SLOT", DEFAULT_MAX_GROUPS_PER_SLOT)
    max_people = int_config(config, "MAX_PEOPLE_PER_SLOT", DEFAULT_MAX_PEOPLE_PER_SLOT)
    max_members = int_config(config, "MAX_MEMBERS_PER_BOOKING", DEFAULT_MAX_MEMBERS_PER_BOOKING)
    missed_limit = int_config(
        config,
        "MAX_MISSED_HANDOVERS_PER_MONTH",
        DEFAULT_MAX_MISSED_HANDOVERS,
    )

    payload = request.get_json(silent=True) or {}

    normalized, errors = validate_payload(payload, max_members)

    # MSSV: bỏ khoảng trắng rồi kiểm tra đúng 13 chữ số (người đại diện + thành viên)
    if normalized:
        rep_info = normalized["representative"]
        rep_info["student_id"] = normalize_mssv(rep_info.get("student_id"))
        for member in normalized["members"]:
            member["student_id"] = normalize_mssv(member.get("student_id"))

        bad_ids = sorted({
            sid
            for sid in [rep_info["student_id"]] + [m["student_id"] for m in normalized["members"]]
            if sid and not is_valid_mssv(sid)
        })

        if bad_ids:
            errors = list(errors) + [f"{MSSV_RULE_TEXT} Kiểm tra lại: {', '.join(bad_ids)}."]

    shifts = requested_shifts(
        payload,
        normalized["booking"].get("shift", "") if normalized else "",
    )

    handover_mode = requested_handover_mode(
        payload,
        normalized["booking"].get("register_type", "") if normalized else "",
    )

    if normalized and normalized["booking"].get("register_type") == "NHÓM" and not handover_mode:
        errors = list(errors) + [
            "Chưa chọn hình thức bàn giao của nhóm (người đại diện hoặc từng thành viên)."
        ]

    if errors:
        return (
            jsonify(
                {
                    "success": False,
                    "message": "Dữ liệu chưa hợp lệ.",
                    "errors": errors,
                }
            ),
            400,
        )

    representative = normalized["representative"]
    booking = normalized["booking"]
    members = normalized["members"]

    with _booking_lock:

        try:
            booking_ws = get_or_create_worksheet(BOOKING_SHEET, BOOKING_HEADERS)
            members_ws = get_or_create_worksheet(MEMBER_SHEET, MEMBER_HEADERS)

            booking_rows = read_sheet_records_safe(booking_ws, HEADER_ROW)
            member_rows = read_sheet_records_safe(members_ws, HEADER_ROW)

            # Lượt đăng ký qua Google Form (cùng file): tính chung sức chứa và mã ID_KEY
            slot_rows = booking_rows + form_booking_rows()

            # -------------------------------------------------
            # QUY ĐỊNH BÀN GIAO
            # - Người đăng ký (đại diện) đủ số lượt chưa bàn giao trong tháng
            #   -> tạm khóa đăng ký (cá nhân hoặc nhóm) đến hết tháng.
            # - Thành viên nhóm có lượt chưa bàn giao -> vẫn ghi nhận,
            #   kèm ghi chú (NOTE) để kỹ thuật viên xem xét điểm danh.
            # -------------------------------------------------
            today_vn = datetime.now(VIETNAM_TZ).date()
            month_text = today_vn.strftime("%m/%Y")

            missed_counts = (
                count_missed_handovers(booking_rows, member_rows, today_vn)
                if missed_limit > 0
                else {}
            )

            rep_missed = missed_counts.get(representative["student_id"], 0)

            if missed_limit > 0 and rep_missed >= missed_limit:
                reopen = first_day_next_month(today_vn)

                return booking_error(
                    (
                        f"MSSV {representative['student_id']} có {rep_missed} "
                        f"lượt sử dụng chưa bàn giao trong tháng {month_text} "
                        "nên tạm thời không thể đăng ký (cá nhân hoặc nhóm). "
                        f"Quyền đăng ký mở lại từ ngày {reopen.strftime('%d/%m/%Y')}."
                    ),
                    403,
                    code="HANDOVER_LOCKED",
                    student_id=representative["student_id"],
                    missed=rep_missed,
                    limit=missed_limit,
                    month=month_text,
                    reopen_date=reopen.strftime("%d/%m/%Y"),
                )

            # -------------------------------------------------
            # KIỂM TRA TỪNG CA (giống bản gốc)
            # -------------------------------------------------
            many = len(shifts) > 1
            plans = []

            for shift in shifts:
                label = f"{shift}: " if many else ""

                slot_key = build_slot_key(booking["date"], booking["room"], shift)

                # ---------------------------------------------
                # ĐĂNG KÝ TRÙNG LỊCH: cùng người đăng ký, cùng ngày, cùng ca
                # (phòng nào cũng vậy) -> HỦY lượt trước, giữ lượt mới.
                # Apps Script gửi email báo đã hủy lượt trước cho sinh viên.
                # ---------------------------------------------
                duplicate_rows = [
                    row
                    for row in slot_rows
                    if is_active_booking(row)
                    and same_date_shift(row, booking["date"], shift)
                    and is_same_registrant(row, representative)
                ]

                if any(row.get("SOURCE") != SOURCE_WEB for row in duplicate_rows):
                    return booking_error(
                        f"{label}Người đại diện đã có đăng ký cùng ngày và ca (đăng ký cũ qua Google Form).",
                        409,
                    )

                replace_ids = {
                    clean_text(row.get("ID_KEY"), 50) for row in duplicate_rows
                }
                replace_pairs = sorted({
                    (clean_text(row.get("ID_KEY"), 50), row_slot_key(row))
                    for row in duplicate_rows
                })

                active_same_slot = [
                    row
                    for row in slot_rows
                    if is_active_booking(row)
                    and row_slot_key(row) == slot_key
                    and clean_text(row.get("ID_KEY"), 50) not in replace_ids
                ]

                current_groups = len(active_same_slot)
                current_people = sum(member_count_from_row(row) for row in active_same_slot)

                if current_groups >= max_groups:
                    return booking_error(
                        f"{label}Khung giờ này đã đủ {max_groups} nhóm.",
                        409,
                    )

                if current_people + len(members) > max_people:
                    remaining_people = max(max_people - current_people, 0)
                    return booking_error(
                        f"{label}Số thành viên vượt sức chứa. "
                        f"Khung giờ chỉ còn {remaining_people} chỗ.",
                        409,
                    )

                active_booking_ids = {
                    str(row.get("ID_KEY", "")).strip()
                    for row in active_same_slot
                    if str(row.get("ID_KEY", "")).strip()
                }

                # Thành viên của các mã đang có trong ca này (1 mã có thể dùng cho nhiều ca,
                # thành viên chỉ ghi 1 lần nên xét theo ID_KEY, không theo SLOT_KEY của thành viên)
                active_member_ids = {
                    clean_text(row.get("MEMBER_MSSV"), 50)
                    for row in member_rows
                    if str(row.get("ID_KEY", "")).strip() in active_booking_ids
                }

                conflicts = sorted(
                    member["student_id"]
                    for member in members
                    if member["student_id"] in active_member_ids
                )

                if conflicts:
                    return booking_error(
                        f"{label}MSSV {', '.join(conflicts)} đã thuộc nhóm khác trong cùng khung giờ.",
                        409,
                    )

                plans.append(
                    {
                        "replace_pairs": replace_pairs,
                        "shift": shift,
                        "slot_key": slot_key,
                        "current_groups": current_groups,
                        "current_people": current_people,
                    }
                )

            # -------------------------------------------------
            # GHI DỮ LIỆU (tất cả các ca đã hợp lệ)
            # -------------------------------------------------
            created_at = datetime.now(VIETNAM_TZ).strftime("%Y-%m-%d %H:%M:%S")

            ensure_optional_headers(booking_ws, OPTIONAL_BOOKING_HEADERS)
            booking_headers = get_existing_headers(booking_ws, BOOKING_HEADERS)
            member_headers = get_existing_headers(members_ws, MEMBER_HEADERS)

            def handover_note(mssv: str) -> str:
                count = missed_counts.get(mssv, 0)

                if not count:
                    return ""

                return (
                    f"CHƯA BÀN GIAO {count} LẦN TRONG THÁNG {month_text}"
                    " - KTV XEM XÉT ĐIỂM DANH"
                )

            known_rows = list(slot_rows)
            booking_values_list: list[list[Any]] = []
            member_values: list[list[Any]] = []
            results = []

            # 1 mã cho cả lần đăng ký, ghi đủ các ca đã chọn, dùng cho mọi ca
            id_key = make_id_key(
                known_rows,
                booking["room"],
                [plan["shift"] for plan in plans],
                booking["date"],
            )

            for plan in plans:
                plan["id_key"] = id_key

            batch_code = id_key if many else ""

            for plan in plans:
                booking_values = {
                    "CREATED_AT": created_at,
                    "ID_KEY": plan["id_key"],
                    "SLOT_KEY": plan["slot_key"],
                    "TEN_DAI_DIEN": representative["name"],
                    "MSSV_DAI_DIEN": representative["student_id"],
                    "EMAIL_TRUONG": representative["school_email"],
                    "EMAIL_CA_NHAN": representative["personal_email"],
                    "EMAIL_NHAN_XAC_NHAN": representative["email"],
                    "SDT_DAI_DIEN": representative["phone"],
                    "HINH_THUC": booking["register_type"],
                    "MUC_DICH": booking["purpose"],
                    "PHONG": booking["room"],
                    "KHU_VUC": booking["area"],
                    "NGAY_SU_DUNG": booking["date"].isoformat(),
                    "CA_SU_DUNG": plan["shift"],
                    "HO_TRO_KY_THUAT": booking["tech_support"],
                    "CAM_KET": "ĐỒNG Ý",
                    "MEMBER_COUNT": len(members),
                    "BOOKING_STATUS": CONFIRMED_STATUS,
                    "EMAIL_STATUS": "CHƯA GỬI",
                    "EMAIL_SENT_AT": "",
                    "EMAIL_ERROR": "",
                    "SOURCE": SOURCE_WEB,
                    "UPDATED_AT": created_at,
                    "MA_DANG_KY_CHUNG": batch_code,
                    "HINH_THUC_BAN_GIAO": handover_mode,
                }
                booking_values_list.append(ordered_row(booking_headers, booking_values))

                results.append(
                    {
                        "shift": plan["shift"],
                        "id_key": plan["id_key"],
                        "slot_key": plan["slot_key"],
                        "remaining_groups": max(max_groups - plan["current_groups"] - 1, 0),
                        "remaining_people": max(
                            max_people - plan["current_people"] - len(members),
                            0,
                        ),
                    }
                )

            # Thành viên: ghi 1 lần cho cả mã (SLOT_KEY = ca đầu tiên)
            plan = plans[0]

            for member in members:
                role = (
                    "ĐẠI DIỆN"
                    if member["student_id"] == representative["student_id"]
                    else "THÀNH VIÊN"
                )

                member_values.append(
                    ordered_row(
                        member_headers,
                        {
                            "CREATED_AT": created_at,
                            "ID_KEY": plan["id_key"],
                            "SLOT_KEY": plan["slot_key"],
                            "MEMBER_NAME": member["name"],
                            "MEMBER_MSSV": member["student_id"],
                            "MEMBER_EMAIL": member["email"],
                            "ROLE": role,
                            "ATTENDANCE_STATUS": "CHƯA ĐIỂM DANH",
                            "CHECK_IN_AT": "",
                            "CHECK_OUT_AT": "",
                            "TECHNICIAN": "",
                            "NOTE": handover_note(member["student_id"]),
                            "UPDATED_AT": created_at,
                        },
                    )
                )

            # Hủy các lượt trùng lịch trước đó (đánh dấu để Apps Script gửi email báo hủy)
            replaced = []
            cancel_updates = {}
            for plan in plans:
                for old_id, old_slot in plan["replace_pairs"]:
                    cancel_updates[(old_id, old_slot)] = plan["id_key"]
                    replaced.append({"old_id": old_id, "new_id": plan["id_key"], "shift": plan["shift"]})

            if cancel_updates:
                cancel_booking_rows(booking_ws, booking_headers, cancel_updates, created_at)

            booking_ws.append_rows(booking_values_list, value_input_option="USER_ENTERED")
            members_ws.append_rows(member_values, value_input_option="USER_ENTERED")

            flagged_members = sum(
                1 for member in members if missed_counts.get(member["student_id"], 0)
            )

            first = plans[0]
            invalidate_schedule_cache()

            return jsonify(
                {
                    "success": True,
                    "message": "Đăng ký thành công.",
                    "id_key": first["id_key"],
                    "slot_key": first["slot_key"],
                    "registered_groups": first["current_groups"] + 1,
                    "registered_people": first["current_people"] + len(members),
                    "remaining_groups": results[0]["remaining_groups"],
                    "remaining_people": results[0]["remaining_people"],
                    "results": results,
                    "batch_code": batch_code,
                    "shifts": [plan["shift"] for plan in plans],
                    "handover_mode": handover_mode,
                    "flagged_members": flagged_members,
                    "replaced": replaced,
                }
            )

        except Exception as error:
            app.logger.exception("Không ghi được booking")

            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Hệ thống chưa thể lưu đăng ký. Vui lòng thử lại.",
                        "errors": [str(error)],
                    }
                ),
                500,
            )


# =========================================================
# TÌM THÀNH VIÊN CỦA LƯỢT ĐĂNG KÝ (dùng cho bàn giao)
# 1) Cách gốc: sheet LAB_MEMBERS.
# 2) Dự phòng cho lượt đăng ký cũ (Google Form) hoặc khi chưa có sheet LAB_MEMBERS:
#    - người đại diện ghi trên chính lượt đăng ký
#    - danh sách thành viên dạng chữ "Họ tên - MSSV; ..." của form cũ
# =========================================================

ROOM_ALIASES = [
    "PHONG",
    "6. Phòng lab được lựa chọn là:",
    "6. Phòng Lab được lựa chọn là:",
    "Phòng Lab",
    "Lab",
]

SHIFT_ALIASES = [
    "CA_SU_DUNG",
    "9. Ca bạn đăng ký sử dụng là: ",
    "9. Ca bạn đăng ký sử dụng là:",
    "Ca",
]

AREA_ALIASES = [
    "KHU_VUC",
    "7. Khu vực sử dụng là:",
    "Khu vực sử dụng",
]

PURPOSE_ALIASES = [
    "MUC_DICH",
    "6. Mục đích đăng ký sử dụng phòng Lab là:",
    "Mục đích sử dụng",
]

DATE_ALIASES = [
    "NGAY_SU_DUNG",
    "Ngày sử dụng",
    "8. Ngày bạn đăng ký sử dụng phòng là:",
]


def find_booking_member(
    id_key: str,
    student_id: str,
    booking_row: dict[str, Any],
) -> dict[str, Any] | None:

    try:
        member_rows = read_sheet_records_safe(
            get_existing_worksheet(MEMBER_SHEET),
            HEADER_ROW,
        )

    except ValueError as error:
        # Chỉ bỏ qua trường hợp chưa có sheet; lỗi khác (trùng cột...) vẫn báo
        if "Không tìm thấy sheet" not in str(error):
            raise

        member_rows = []

    for row in member_rows:
        if (
            clean_text(row.get("ID_KEY"), 50) == id_key
            and clean_text(row.get("MEMBER_MSSV"), 50) == student_id
        ):
            return row

    representative_id = clean_text(
        value_from_aliases(
            booking_row,
            [
                "MSSV_DAI_DIEN",
                "2. Mã số sinh viên của bạn là:",
                "Mã số sinh viên của bạn là:",
                "MSSV",
            ],
        ),
        50,
    )

    if representative_id and representative_id == student_id:
        return {
            "MEMBER_NAME": value_from_aliases(
                booking_row,
                [
                    "TEN_DAI_DIEN",
                    "1. Họ và tên của bạn là: ",
                    "1. Họ và tên của bạn là:",
                    "Họ và tên",
                ],
            ),
            "MEMBER_MSSV": student_id,
            "MEMBER_EMAIL": value_from_aliases(
                booking_row,
                [
                    "EMAIL_NHAN_XAC_NHAN",
                    "EMAIL_TRUONG",
                    "EMAIL_CA_NHAN",
                    "Địa chỉ email",
                    "Email",
                ],
            ),
        }

    member_text = value_from_aliases(
        booking_row,
        [
            "5.2. Danh sách thành viên nhóm là: (Họ tên 1 - MSSV 1; Họ tên 2 - MSSV 2; ...) ",
            "5.2. Danh sách thành viên nhóm là: (Họ tên 1 - MSSV 1; Họ tên 2 - MSSV 2; ...)",
            "5.2. Danh sách thành viên nhóm là:",
            "Danh sách thành viên nhóm là:",
        ],
    )

    for part in re.split(r"[;\n]", member_text):
        if student_id and re.search(rf"(?<!\d){re.escape(student_id)}(?!\d)", part):
            name = re.split(r"\s+[-–]\s+|\s*[-–]\s*(?=\d)", part.strip())[0]
            name = re.sub(r"^\d+\.\s*", "", name).strip()

            return {
                "MEMBER_NAME": clean_text(name, 120),
                "MEMBER_MSSV": student_id,
                "MEMBER_EMAIL": "",
            }

    return None


# =========================================================
# API XÁC MINH BÀN GIAO PHÒNG LAB
# =========================================================

@app.post("/api/verify-handover")
def verify_handover():
    try:
        payload = request.get_json(
            silent=True
        ) or {}

        id_key = clean_text(
            payload.get("id_key"),
            50,
        )

        student_id = clean_text(
            payload.get("student_id"),
            50,
        )

        if not id_key:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Vui lòng nhập ID đăng ký.",
                    }
                ),
                400,
            )

        # MSSV: bắt buộc và phải đúng 13 chữ số
        student_id = normalize_mssv(student_id)

        if not student_id:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Vui lòng nhập MSSV.",
                    }
                ),
                400,
            )

        if not is_valid_mssv(student_id):
            return (
                jsonify({"success": False, "message": MSSV_RULE_TEXT}),
                400,
            )

        booking_ws = get_existing_worksheet(
            BOOKING_SHEET
        )

        booking_rows = read_sheet_records_safe(
            booking_ws,
            HEADER_ROW,
        )

        booking_row = None

        for row in booking_rows:

            current_id = clean_text(
                row.get("ID_KEY"),
                50,
            )

            if current_id == id_key:
                booking_row = row
                break

        # 1 mã có thể gồm nhiều ca: lấy ca còn hiệu lực, gom tên các ca
        booking_row = pick_booking_row(booking_rows, id_key)

        if not booking_row:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": (
                            "Không tìm thấy lượt đăng ký "
                            "với ID này."
                        ),
                    }
                ),
                404,
            )

        if not is_active_booking(
            booking_row
        ):
            return (
                jsonify(
                    {
                        "success": False,
                        "message": (
                            "Lượt đăng ký này không ở trạng thái "
                            "ĐÃ XÁC NHẬN."
                        ),
                    }
                ),
                409,
            )

        member_row = find_booking_member(
            id_key,
            student_id,
            booking_row,
        )

        if not member_row:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": (
                            "MSSV này không thuộc danh sách "
                            "thành viên của lượt đăng ký."
                        ),
                    }
                ),
                403,
            )

        mode_error = handover_mode_error(booking_row, student_id)

        if mode_error:
            return (
                jsonify({"success": False, "message": mode_error}),
                403,
            )

        raw_date = value_from_aliases(
            booking_row,
            DATE_ALIASES,
        )

        try:
            booking_date = parse_any_sheet_date(
                raw_date
            ).isoformat()

        except ValueError:
            booking_date = str(
                raw_date or ""
            ).strip()

        data = {
            "id_key": id_key,
            "student_id": student_id,

            "student_name": clean_text(
                member_row.get(
                    "MEMBER_NAME"
                ),
                120,
            ),

            "student_email": normalize_email(
                member_row.get(
                    "MEMBER_EMAIL"
                )
            ),

            "room": normalize_room(
                value_from_aliases(booking_row, ROOM_ALIASES)
            ),

            "shift": booking_shift_text(booking_row),

            "date": booking_date,

            "area": clean_text(
                value_from_aliases(booking_row, AREA_ALIASES),
                200,
            ),

            "purpose": clean_text(
                value_from_aliases(booking_row, PURPOSE_ALIASES),
                1000,
            ),
            "handover_mode": booking_handover_mode(booking_row),
        }

        return jsonify(
            {
                "success": True,
                "message": "Xác minh thành công.",
                "data": data,
            }
        )

    except Exception as error:
        app.logger.exception(
            "Lỗi xác minh bàn giao"
        )

        return (
            jsonify(
                {
                    "success": False,
                    "message": (
                        "Hệ thống chưa thể xác minh "
                        "thông tin bàn giao."
                    ),
                    "error": str(error),
                }
            ),
            500,
        )

# =========================================================
# API GỬI BÀN GIAO PHÒNG LAB
# =========================================================

@app.post("/api/submit-handover")
def submit_handover():
    try:
        # -------------------------------------------------
        # LẤY DỮ LIỆU FORM
        # -------------------------------------------------

        id_key = clean_text(
            request.form.get("id_key"),
            50,
        )

        student_id = clean_text(
            request.form.get("student_id"),
            50,
        )

        responsible_area = clean_text(
            request.form.get("responsible_area"),
            300,
        )

        area_condition = clean_text(
            request.form.get("area_condition"),
            200,
        )

        area_note = clean_text(
            request.form.get("area_note"),
            1000,
        )

        before_description = clean_text(
            request.form.get("before_description"),
            1200,
        )

        after_description = clean_text(
            request.form.get("after_description"),
            1200,
        )

        commitment = clean_text(
            request.form.get("commitment"),
            50,
        )


        # -------------------------------------------------
        # KIỂM TRA DỮ LIỆU
        # -------------------------------------------------

        errors = []

        if not id_key:
            errors.append(
                "Thiếu ID đăng ký."
            )

        student_id = normalize_mssv(student_id)

        if not student_id:
            errors.append(
                "Thiếu MSSV người bàn giao."
            )
        elif not is_valid_mssv(student_id):
            errors.append(MSSV_RULE_TEXT)

        if not responsible_area:
            errors.append(
                "Thiếu khu vực phụ trách."
            )

        if not area_condition:
            errors.append(
                "Chưa chọn tình trạng sau bàn giao."
            )

        if not commitment:
            errors.append(
                "Bạn chưa xác nhận nội dung bàn giao."
            )


        # -------------------------------------------------
        # LẤY ẢNH
        # -------------------------------------------------

        before_images = [
            file
            for file in request.files.getlist(
                "before_images"
            )
            if file and file.filename
        ]

        after_images = [
            file
            for file in request.files.getlist(
                "after_images"
            )
            if file and file.filename
        ]


        if len(before_images) < 1:
            errors.append(
                "Cần ít nhất một ảnh trước khi sử dụng."
            )

        if len(after_images) < 1:
            errors.append(
                "Cần ít nhất một ảnh sau khi sử dụng."
            )

        if len(before_images) > 5:
            errors.append(
                "Ảnh trước tối đa 5 ảnh."
            )

        if len(after_images) > 5:
            errors.append(
                "Ảnh sau tối đa 5 ảnh."
            )


        if errors:
            return (
                jsonify({
                    "success": False,
                    "message": "Dữ liệu bàn giao chưa hợp lệ.",
                    "errors": errors,
                }),
                400,
            )


        # -------------------------------------------------
        # XÁC MINH BOOKING
        # -------------------------------------------------

        booking_ws = get_existing_worksheet(
            BOOKING_SHEET
        )

        booking_rows = read_sheet_records_safe(
            booking_ws,
            HEADER_ROW,
        )

        booking_row = None

        for row in booking_rows:
            current_id = clean_text(
                row.get("ID_KEY"),
                50,
            )

            if current_id == id_key:
                booking_row = row
                break

        # 1 mã có thể gồm nhiều ca: lấy ca còn hiệu lực, gom tên các ca
        booking_row = pick_booking_row(booking_rows, id_key)


        if not booking_row:
            return (
                jsonify({
                    "success": False,
                    "message": (
                        "Không tìm thấy lượt đăng ký."
                    ),
                    "errors": [],
                }),
                404,
            )


        if not is_active_booking(
            booking_row
        ):
            return (
                jsonify({
                    "success": False,
                    "message": (
                        "Lượt đăng ký không ở trạng thái ĐÃ XÁC NHẬN."
                    ),
                    "errors": [],
                }),
                409,
            )


        # -------------------------------------------------
        # KIỂM TRA MSSV THUỘC BOOKING
        # -------------------------------------------------

        member_row = find_booking_member(
            id_key,
            student_id,
            booking_row,
        )


        if not member_row:
            return (
                jsonify({
                    "success": False,
                    "message": (
                        "MSSV không thuộc lượt đăng ký này."
                    ),
                    "errors": [],
                }),
                403,
            )

        mode_error = handover_mode_error(booking_row, student_id)

        if mode_error:
            return (
                jsonify({"success": False, "message": mode_error, "errors": []}),
                403,
            )


        # -------------------------------------------------
        # TẠO MÃ BÀN GIAO
        # -------------------------------------------------

        created_at = datetime.now(
            VIETNAM_TZ
        ).strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        handover_id = (
            "HG-"
            + datetime.now(
                VIETNAM_TZ
            ).strftime(
                "%Y%m%d%H%M%S"
            )
        )


        # -------------------------------------------------
        # LẤY HOẶC TẠO SHEET LAB_HANDOVER
        # -------------------------------------------------

        HANDOVER_HEADERS = [
            "CREATED_AT",
            "HANDOVER_ID",
            "ID_KEY",
            "MSSV",
            "TEN_SINH_VIEN",
            "EMAIL",
            "PHONG",
            "NGAY_SU_DUNG",
            "CA_SU_DUNG",
            "KHU_VUC_DANG_KY",
            "KHU_VUC_PHU_TRACH",
            "TINH_TRANG",
            "GHI_CHU",
            "MO_TA_TRUOC",
            "MO_TA_SAU",
            "SO_ANH_TRUOC",
            "SO_ANH_SAU",
            "CAM_KET",
            "UPDATED_AT",
        ]


        handover_ws = get_or_create_worksheet(
            HANDOVER_SHEET,
            HANDOVER_HEADERS,
        )

        handover_headers = get_existing_headers(
            handover_ws,
            HANDOVER_HEADERS,
        )


        # -------------------------------------------------
        # CHUẨN HÓA NGÀY
        # -------------------------------------------------

        raw_date = value_from_aliases(
            booking_row,
            DATE_ALIASES,
        )

        try:
            booking_date = (
                parse_any_sheet_date(
                    raw_date
                ).isoformat()
            )
        except ValueError:
            booking_date = str(
                raw_date or ""
            ).strip()


        # -------------------------------------------------
        # GHI GOOGLE SHEET
        # -------------------------------------------------

        handover_values = {
            "CREATED_AT": created_at,
            "HANDOVER_ID": handover_id,
            "ID_KEY": id_key,
            "MSSV": student_id,

            "TEN_SINH_VIEN": clean_text(
                member_row.get("MEMBER_NAME"),
                120,
            ),

            "EMAIL": normalize_email(
                member_row.get("MEMBER_EMAIL")
            ),

            "PHONG": normalize_room(
                value_from_aliases(booking_row, ROOM_ALIASES)
            ),

            "NGAY_SU_DUNG": booking_date,

            "CA_SU_DUNG": booking_shift_text(booking_row),

            "KHU_VUC_DANG_KY": clean_text(
                value_from_aliases(booking_row, AREA_ALIASES),
                300,
            ),

            "KHU_VUC_PHU_TRACH": responsible_area,

            "TINH_TRANG": area_condition,

            "GHI_CHU": area_note,

            "MO_TA_TRUOC": before_description,

            "MO_TA_SAU": after_description,

            "SO_ANH_TRUOC": len(
                before_images
            ),

            "SO_ANH_SAU": len(
                after_images
            ),

            "CAM_KET": "ĐỒNG Ý",

            "UPDATED_AT": created_at,
        }


        handover_ws.append_row(
            ordered_row(
                handover_headers,
                handover_values,
            ),
            value_input_option="USER_ENTERED",
        )


        # -------------------------------------------------
        # TRẢ KẾT QUẢ
        # -------------------------------------------------

        return jsonify({
            "success": True,
            "message": "Bàn giao thành công.",
            "handover_id": handover_id,
            "before_image_count": len(
                before_images
            ),
            "after_image_count": len(
                after_images
            ),
        })


    except Exception as error:
        app.logger.exception(
            "Lỗi gửi bàn giao"
        )

        return (
            jsonify({
                "success": False,
                "message": (
                    "Hệ thống chưa thể lưu bàn giao."
                ),
                "errors": [
                    str(error)
                ],
            }),
            500,
        )


# =========================================================
# CHẠY ỨNG DỤNG
# =========================================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True,
    )