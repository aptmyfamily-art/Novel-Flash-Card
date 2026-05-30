/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        03_Students.gs — Student management CRUD
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Students_list(user, p) {
  Auth_requireCap(user, 'student.view_all');
  p = p || {};
  const settings = Settings_map_();
  const academicYear = String(p.academic_year || settings.current_academic_year || '').trim();

  let rows = DB_filter(SHEETS.STUDENTS, function (s) {
    return _yes_(s.is_active) && (!academicYear || String(s.academic_year) === academicYear);
  });

  // ── Build visit info per student (single scan O(n)) ──
  const visits = DB_readAll(SHEETS.VISITS);

  const visitMap = {};
  visits.forEach(function (v) {
    const sid = String(v.student_id || '');
    if (!sid) return;
    if (!visitMap[sid]) visitMap[sid] = { count: 0, count_year: 0, last_date: '', last_status: '', last_id: '' };
    visitMap[sid].count++;
    const inYear = academicYear && String(v.academic_year) === academicYear;
    if (inYear) visitMap[sid].count_year++;
    if (!visitMap[sid].last_date || String(v.visit_date) > visitMap[sid].last_date) {
      visitMap[sid].last_date = v.visit_date || '';
      visitMap[sid].last_status = v.status || '';
      visitMap[sid].last_id = v.id || '';
    }
  });

  // Attach visit info to each student
  rows = rows.map(function (s) {
    const vi = visitMap[String(s.id)] || { count: 0, count_year: 0, last_date: '', last_status: '', last_id: '' };
    return Object.assign({}, s, {
      _visit: {
        count: vi.count, count_year: vi.count_year,
        last_date: vi.last_date, last_status: vi.last_status, last_id: vi.last_id,
        visited_this_year: vi.count_year > 0,
        ever_visited: vi.count > 0
      }
    });
  });

  // Search
  const q = String(p.q || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(function (s) {
      return String(s.first_name).toLowerCase().indexOf(q) >= 0
        || String(s.last_name).toLowerCase().indexOf(q) >= 0
        || String(s.student_code).toLowerCase().indexOf(q) >= 0
        || String(s.nickname).toLowerCase().indexOf(q) >= 0
        || String(s.citizen_id).indexOf(q) >= 0;
    });
  }
  if (p.class_level) rows = rows.filter(function (s) { return String(s.class_level) === String(p.class_level); });
  if (p.room) rows = rows.filter(function (s) { return String(s.room) === String(p.room); });

  // Filter by visit status
  if (p.visit_status === 'visited') {
    rows = rows.filter(function (s) { return s._visit.visited_this_year; });
  } else if (p.visit_status === 'not_visited') {
    rows = rows.filter(function (s) { return !s._visit.visited_this_year; });
  } else if (p.visit_status === 'ever_visited') {
    rows = rows.filter(function (s) { return s._visit.ever_visited; });
  } else if (p.visit_status === 'never_visited') {
    rows = rows.filter(function (s) { return !s._visit.ever_visited; });
  }

  // Stats (for KPI on hero) — calculated BEFORE pagination
  const stats = {
    total: rows.length,
    visited_this_year: rows.filter(function (s) { return s._visit.visited_this_year; }).length,
    ever_visited: rows.filter(function (s) { return s._visit.ever_visited; }).length
  };
  stats.not_visited = stats.total - stats.visited_this_year;

  rows.sort(function (a, b) {
    const ca = String(a.class_level || ''), cb = String(b.class_level || '');
    if (ca !== cb) return ca < cb ? -1 : 1;
    const na = String(a.first_name || ''), nb = String(b.first_name || '');
    return na < nb ? -1 : na > nb ? 1 : 0;
  });

  // Pagination
  const page = Math.max(1, Number(p.page || 1));
  const per = Math.min(200, Math.max(10, Number(p.per_page || 50)));
  const total = rows.length;
  const start = (page - 1) * per;
  return {
    items: rows.slice(start, start + per),
    total: total,
    page: page,
    per_page: per,
    total_pages: Math.ceil(total / per) || 1,
    stats: stats,
    academic_year: academicYear
  };
}

function Students_get(user, id) {
  Auth_requireCap(user, 'student.view_all');
  return DB_findById(SHEETS.STUDENTS, id);
}

function Students_upsert(user, p) {
  Auth_requireCap(user, 'student.create');
  const data = p || {};
  const settings = Settings_map_();
  const required = ['first_name', 'last_name', 'class_level'];
  for (const r of required) if (!String(data[r] || '').trim()) throw new Error('กรุณากรอก: ' + r);
  // Default academic year
  if (!data.academic_year) {
    data.academic_year = settings.current_academic_year;
  }
  // generate code if missing
  if (!data.student_code) {
    const list = DB_readAll(SHEETS.STUDENTS);
    data.student_code = _gen_code_('S', list.length + 1);
  }
  if (data.is_active == null || data.is_active === '') data.is_active = 'yes';
  if (data.id) {
    Auth_requireCap(user, 'student.edit');
    const out = DB_update(SHEETS.STUDENTS, data.id, data);
    Audit_log_(user, 'student.update', 'student', data.id, { code: out && out.student_code });
    return out;
  } else {
    data.created_by = user.id;
    const out = DB_insert(SHEETS.STUDENTS, data);
    Audit_log_(user, 'student.create', 'student', out.id, { code: out.student_code });
    return out;
  }
}

function Students_delete(user, id) {
  Auth_requireCap(user, 'student.manage');
  // Soft delete
  const out = DB_update(SHEETS.STUDENTS, id, { is_active: 'no' });
  Audit_log_(user, 'student.delete', 'student', id, {});
  return { ok: true };
}

// ── Bulk Import (Excel/CSV/Google Sheet) ──
const STUDENT_IMPORT_HEADERS = Object.freeze([
  { key: 'student_code', label: 'รหัสนักเรียน', required: false, example: '12345', hint: 'ถ้ามี ระบบจะใช้ตรวจซ้ำ' },
  { key: 'prefix', label: 'คำนำหน้า', required: false, example: 'เด็กชาย', hint: 'เด็กชาย/เด็กหญิง/นาย/นางสาว' },
  { key: 'first_name', label: 'ชื่อ', required: true, example: 'สมชาย', hint: 'จำเป็น' },
  { key: 'last_name', label: 'นามสกุล', required: true, example: 'ใจดี', hint: 'จำเป็น' },
  { key: 'nickname', label: 'ชื่อเล่น', required: false, example: 'ชาย' },
  { key: 'gender', label: 'เพศ', required: false, example: 'ชาย', hint: 'ชาย/หญิง' },
  { key: 'citizen_id', label: 'เลขบัตรประชาชน', required: false, example: '1100000000001', hint: '13 หลัก (กันซ้ำ)' },
  { key: 'birth_date', label: 'วันเกิด', required: false, example: '2554-03-15', hint: 'YYYY-MM-DD' },
  { key: 'class_level', label: 'ชั้นเรียน', required: true, example: 'ม.1', hint: 'จำเป็น เช่น ม.1, ป.6' },
  { key: 'room', label: 'ห้อง', required: false, example: '1' },
  { key: 'phone', label: 'โทรศัพท์', required: false, example: '0812345678' },
  { key: 'address', label: 'ที่อยู่', required: false, example: '123 ม.5 ต.ตัวอย่าง' },
  { key: 'academic_year', label: 'ปีการศึกษา', required: false, example: '2569' },
  { key: 'notes', label: 'หมายเหตุ', required: false, example: '' }
]);

function Students_template(user) {
  Auth_requireCap(user, 'student.create');
  const headers = STUDENT_IMPORT_HEADERS.map(function (h) { return h.label; });
  const examples = [
    ['12345', 'เด็กชาย', 'สมชาย', 'ใจดี', 'ชาย', 'ชาย', '1100000000001', '2554-03-15', 'ม.1', '1', '0812345678', '123 ม.5 ต.ตัวอย่าง', '2569', ''],
    ['12346', 'เด็กหญิง', 'สมหญิง', 'น่ารัก', 'หญิง', 'หญิง', '1100000000002', '2554-05-20', 'ม.1', '2', '0823456789', '456 ม.6 ต.ทดสอบ', '2569', 'แพ้นม']
  ];
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    // Escape quotes; wrap in quotes if contains comma/quote/newline
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function csvRow(arr) { return arr.map(csvCell).join(','); }
  // BOM for Thai Excel compatibility
  var csv = '﻿' + csvRow(headers) + '\n'
    + examples.map(csvRow).join('\n') + '\n';
  return {
    csv: csv,
    filename: 'แม่แบบ-นักเรียน.csv',
    headers: STUDENT_IMPORT_HEADERS
  };
}

function Students_import_header_key_(s) {
  return String(s == null ? '' : s).trim().toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[()\[\]{}]/g, '')
    .replace(/[\s._:：/\\|]+/g, '')
    .replace(/[–—]/g, '-');
}

function Students_import_alias_map_() {
  const aliasMap = {};
  STUDENT_IMPORT_HEADERS.forEach(function (h) {
    aliasMap[Students_import_header_key_(h.label)] = h.key;
    aliasMap[Students_import_header_key_(h.key)] = h.key;
  });
  Object.assign(aliasMap, {
    'studentcode': 'student_code', 'studentid': 'student_code', 'student_id': 'student_code', 'code': 'student_code',
    'รหัส': 'student_code', 'รหัสนักเรียน': 'student_code', 'เลขประจำตัว': 'student_code', 'เลขประจำตัวนักเรียน': 'student_code',
    'เลขที่': 'notes', 'no': 'notes', 'number': 'notes',
    'prefix': 'prefix', 'title': 'prefix', 'คำนำหน้า': 'prefix', 'คำนำนหน้า': 'prefix', 'คำนำหน้านาม': 'prefix',
    'first_name': 'first_name', 'firstname': 'first_name', 'name': 'first_name', 'ชื่อ': 'first_name',
    'last_name': 'last_name', 'lastname': 'last_name', 'surname': 'last_name', 'สกุล': 'last_name', 'นามสกุล': 'last_name',
    'fullname': '_full_name', 'full_name': '_full_name', 'nameandsurname': '_full_name',
    'ชื่อสกุล': '_full_name', 'ชื่อ-สกุล': '_full_name', 'ชื่อ - สกุล': '_full_name', 'ชื่อ-นามสกุล': '_full_name', 'ชื่อ - นามสกุล': '_full_name', 'ชื่อและนามสกุล': '_full_name', 'ชื่อนามสกุล': '_full_name',
    'nickname': 'nickname', 'nick': 'nickname', 'ชื่อเล่น': 'nickname',
    'gender': 'gender', 'sex': 'gender', 'เพศ': 'gender',
    'citizen_id': 'citizen_id', 'citizenid': 'citizen_id', 'national_id': 'citizen_id', 'id_card': 'citizen_id',
    'เลขบัตร13หลัก': 'citizen_id', 'เลขบัตร': 'citizen_id', 'เลขบัตรประชาชน': 'citizen_id', 'เลขประจำตัวประชาชน': 'citizen_id',
    'birth_date': 'birth_date', 'birthdate': 'birth_date', 'dob': 'birth_date', 'วันเกิด': 'birth_date', 'วันเดือนปีเกิด': 'birth_date',
    'class_level': 'class_level', 'class': 'class_level', 'level': 'class_level', 'grade': 'class_level', 'ชั้น': 'class_level', 'ระดับชั้น': 'class_level', 'ชั้นเรียน': 'class_level',
    'room': 'room', 'ห้อง': 'room', 'ห้องเรียน': 'room',
    'classroom': '_class_room', 'class_room': '_class_room', 'ชั้นห้อง': '_class_room', 'ชั้น/ห้อง': '_class_room', 'ระดับชั้น/ห้อง': '_class_room',
    'phone': 'phone', 'tel': 'phone', 'telephone': 'phone', 'mobile': 'phone', 'โทรศัพท์': 'phone', 'เบอร์โทร': 'phone', 'เบอร์โทรศัพท์': 'phone',
    'address': 'address', 'ที่อยู่': 'address', 'บ้านเลขที่': 'address',
    'academic_year': 'academic_year', 'year': 'academic_year', 'ปีการศึกษา': 'academic_year',
    'notes': 'notes', 'note': 'notes', 'remark': 'notes', 'หมายเหตุ': 'notes'
  });
  Object.keys(aliasMap).forEach(function (k) {
    aliasMap[Students_import_header_key_(k)] = aliasMap[k];
  });
  return aliasMap;
}

function Students_import_is_blank_row_(row) {
  return !row || row.every(function (c) { return String(c == null ? '' : c).trim() === ''; });
}

function Students_import_split_full_name_(value) {
  var s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!s) return {};
  var prefixes = ['เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว', 'น.ส.', 'นส.', 'นาง', 'ด.ช.', 'ด.ญ.'];
  var out = {};
  prefixes.some(function (p) {
    if (s.indexOf(p) === 0) {
      out.prefix = p;
      s = s.substring(p.length).trim();
      return true;
    }
    return false;
  });
  var parts = s.split(' ');
  out.first_name = parts.shift() || '';
  out.last_name = parts.join(' ');
  return out;
}

function Students_import_split_class_room_(value) {
  var s = String(value || '').replace(/\s+/g, '').trim();
  if (!s) return {};
  var m = s.match(/^(.+?)[\/\-](.+)$/);
  if (m) return { class_level: m[1], room: m[2] };
  return { class_level: s };
}

function Students_import_infer_class_room_(text) {
  var s = String(text || '').replace(/\s+/g, '').trim();
  if (!s) return {};
  var exactClassRoom = s.match(/^((?:เธ|เธก)\.?\d+)[\/\-](\d+)$/);
  if (exactClassRoom) return { class_level: exactClassRoom[1].replace(/^([เธเธก])(\d+)/, '$1.$2'), room: exactClassRoom[2] || '' };
  var m = s.match(/((?:ป|ม)\.?\d+)[\/\-]?(\d+)?/);
  if (m) return { class_level: m[1].replace(/^([ปม])(\d+)/, '$1.$2'), room: m[2] || '' };
  m = s.match(/(?:ชั้น|ห้อง)(\d+)[\/\-](\d+)/);
  if (m) return { class_level: m[1], room: m[2] };
  return {};
}

function Students_import_is_standard_classroom_sheet_(text) {
  var s = String(text || '').replace(/\s+/g, '').trim();
  return /^([^\d]*\.?\d+)[\/\-](\d+)$/.test(s);
}

function Students_import_expand_field_map_(rawRows, headerIndex, fieldMap) {
  var expanded = (fieldMap || []).slice();
  var sampleRows = rawRows.slice(headerIndex + 1, Math.min(rawRows.length, headerIndex + 8));
  function cell(row, idx) {
    return String(row && row[idx] == null ? '' : row[idx]).trim();
  }
  for (var i = 0; i < expanded.length; i++) {
    if (expanded[i] !== '_full_name') continue;
    var blankCount = 0;
    while (i + blankCount + 1 < expanded.length && !expanded[i + blankCount + 1] && blankCount < 2) blankCount++;
    if (!blankCount) continue;
    var tripleHits = 0;
    var doubleHits = 0;
    sampleRows.forEach(function (row) {
      var a = cell(row, i);
      var b = cell(row, i + 1);
      var c = cell(row, i + 2);
      if (blankCount >= 2 && a && b && c) tripleHits++;
      if (a && b) doubleHits++;
    });
    if (blankCount >= 2 && tripleHits > 0) {
      expanded[i] = 'prefix';
      expanded[i + 1] = 'first_name';
      expanded[i + 2] = 'last_name';
      continue;
    }
    if (blankCount >= 1 && doubleHits > 0) {
      expanded[i] = 'first_name';
      expanded[i + 1] = 'last_name';
    }
  }
  return expanded;
}

function Students_import_should_skip_incomplete_row_(row, obj) {
  var cells = (row || []).map(function (v) { return String(v == null ? '' : v).trim(); });
  var joined = cells.join(' ');
  if (/^#REF!?$/i.test(cells[0] || '')) return true;
  if (/ครูที่ปรึกษา|แผนการเรียน/.test(joined)) return true;
  var filled = cells.filter(function (v) { return v !== ''; });
  if (filled.length <= 1) return true;
  if (filled.length <= 2 && !obj.first_name && !obj.last_name) return true;
  if (/^\d+(\.\d+)?$/.test(cells[0] || '') && filled.length <= 2) return true;
  if (!obj.first_name && !obj.last_name && !obj.class_level) {
    if (filled.length <= 3) return true;
    if (!obj.student_code && !obj.prefix && !obj.citizen_id) return true;
  }
  return false;
}

function Students_import_normalize_rows_(rows, options) {
  options = options || {};
  const rawRows = (rows || []).filter(function (r) { return Array.isArray(r); });
  if (!rawRows.length) throw new Error('ไม่มีข้อมูลให้นำเข้า');
  const aliasMap = Students_import_alias_map_();
  var best = { idx: -1, score: -1, fieldMap: [] };
  const scanLimit = Math.min(rawRows.length, 20);
  for (var r = 0; r < scanLimit; r++) {
    var row = rawRows[r] || [];
    var fieldMap = row.map(function (h) { return aliasMap[Students_import_header_key_(h)] || null; });
    var seen = {};
    var score = 0;
    fieldMap.forEach(function (f) {
      if (!f || seen[f]) return;
      seen[f] = true;
      score += (f === 'first_name' || f === 'last_name' || f === '_full_name' || f === 'student_code' || f === 'class_level' || f === '_class_room') ? 2 : 1;
    });
    if (score > best.score) best = { idx: r, score: score, fieldMap: fieldMap };
  }
  if (best.idx < 0 || best.score < 2) throw new Error('ไม่พบแถวหัวตารางที่ระบบรู้จัก');

  best.fieldMap = Students_import_expand_field_map_(rawRows, best.idx, best.fieldMap);
  const dataRows = rawRows.slice(best.idx + 1);
  const missingRequired = STUDENT_IMPORT_HEADERS.filter(function (h) {
    if (!h.required) return false;
    if (best.fieldMap.indexOf(h.key) >= 0) return false;
    if ((h.key === 'first_name' || h.key === 'last_name') && best.fieldMap.indexOf('_full_name') >= 0) return false;
    if (h.key === 'class_level' && best.fieldMap.indexOf('_class_room') >= 0) return false;
    if (h.key === 'class_level' && options.default_class_level) return false;
    return true;
  });
  if (missingRequired.length) throw new Error('ขาดคอลัมน์จำเป็น: ' + missingRequired.map(function (h) { return h.label; }).join(', '));
  return { dataRows: dataRows, fieldMap: best.fieldMap, headerIndex: best.idx };
}

function Students_import_read_sheet_rows_(sh, rangeText) {
  const range = rangeText ? sh.getRange(rangeText) : sh.getDataRange();
  const rows = range.getDisplayValues();
  while (rows.length && Students_import_is_blank_row_(rows[rows.length - 1])) rows.pop();
  return rows;
}

function Students_import_sheet_payload_(spreadsheetId, sh, rangeText) {
  const rows = Students_import_read_sheet_rows_(sh, rangeText);
  if (!rows.length) return null;
  return {
    rows: rows,
    spreadsheet_id: spreadsheetId,
    sheet_name: sh.getName(),
    inferred: Students_import_infer_class_room_(sh.getName()),
    total_rows: Math.max(0, rows.length - 1)
  };
}

function Students_import_from_google_sheet(user, p) {
  Auth_requireCap(user, 'student.create');
  p = p || {};
  const source = String(p.url || p.spreadsheet_id || '').trim();
  if (!source) throw new Error('กรุณาระบุ Google Sheet URL หรือ Spreadsheet ID');
  const idMatch = source.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) || source.match(/^([a-zA-Z0-9-_]{20,})$/);
  if (!idMatch) throw new Error('รูปแบบ Google Sheet URL/ID ไม่ถูกต้อง');
  const spreadsheetId = idMatch[1];
  const gidMatch = source.match(/[?&#]gid=(\d+)/);
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const rangeText = String(p.range || '').trim();
  let sh = null;
  if (p.sheet_name) sh = ss.getSheetByName(String(p.sheet_name).trim());
  if (!sh && gidMatch) {
    const gid = Number(gidMatch[1]);
    ss.getSheets().some(function (s) {
      if (s.getSheetId() === gid) { sh = s; return true; }
      return false;
    });
  }
  if (sh) {
    const single = Students_import_sheet_payload_(spreadsheetId, sh, rangeText);
    if (!single) throw new Error('Google Sheet เนเธกเนเธกเธตเธเนเธญเธกเธนเธฅ');
    return single;
  }
  const sheets = ss.getSheets();
  const classSheets = sheets.map(function (sheet) {
    if (sheet.isSheetHidden && sheet.isSheetHidden()) return null;
    if (!Students_import_is_standard_classroom_sheet_(sheet.getName())) return null;
    const payload = Students_import_sheet_payload_(spreadsheetId, sheet, rangeText);
    if (!payload) return null;
    if (!payload.inferred || !payload.inferred.class_level) return null;
    return payload;
  }).filter(Boolean);
  if (classSheets.length > 1) {
    return {
      spreadsheet_id: spreadsheetId,
      is_multi_sheet: true,
      imports: classSheets,
      total_rows: classSheets.reduce(function (sum, item) { return sum + (item.total_rows || 0); }, 0)
    };
  }
  if (classSheets.length === 1) return classSheets[0];
  sh = sheets[0];
  if (!sh) throw new Error('ไม่พบชีตในไฟล์ Google Sheet');
  const fallback = Students_import_sheet_payload_(spreadsheetId, sh, rangeText);
  if (!fallback) throw new Error('Google Sheet เนเธกเนเธกเธตเธเนเธญเธกเธนเธฅ');
  return fallback;
  const range = rangeText ? sh.getRange(rangeText) : sh.getDataRange();
  const rows = range.getDisplayValues();
  while (rows.length && Students_import_is_blank_row_(rows[rows.length - 1])) rows.pop();
  if (!rows.length) throw new Error('Google Sheet ไม่มีข้อมูล');
  return {
    rows: rows,
    spreadsheet_id: spreadsheetId,
    sheet_name: sh.getName(),
    inferred: Students_import_infer_class_room_(sh.getName()),
    total_rows: Math.max(0, rows.length - 1)
  };
}

function Students_bulk_import(user, p) {
  Auth_requireCap(user, 'student.create');
  if (!p || !Array.isArray(p.rows)) throw new Error('ไม่พบข้อมูลที่จะนำเข้า');
  const rows = p.rows;
  if (!rows.length) throw new Error('ไม่มีข้อมูลให้นำเข้า');

  const inferred = Students_import_infer_class_room_(p.source || '');
  const importDefaults = {
    default_class_level: String(p.default_class_level || inferred.class_level || '').trim(),
    default_room: String(p.default_room || inferred.room || '').trim()
  };
  const normalized = Students_import_normalize_rows_(rows, importDefaults);
  const dataRows = normalized.dataRows;
  const fieldMap = normalized.fieldMap;
  const sourceLineOffset = normalized.headerIndex + 2;

  // Build existing index for duplicate check
  const existing = DB_readAll(SHEETS.STUDENTS);
  const settings = Settings_map_();
  const byCitizen = {};
  const byCode = {};
  existing.forEach(function (s) {
    if (s.citizen_id) byCitizen[String(s.citizen_id).trim()] = s;
    if (s.student_code) byCode[String(s.student_code).trim()] = s;
  });
  let nextSeq = existing.length + 1;

  const results = {
    total: dataRows.length,
    inserted: 0,
    duplicated: 0,
    failed: 0,
    errors: [],
    inserted_codes: [],
    source: p.source || ''
  };

  dataRows.forEach(function (row, idx) {
    try {
      // Skip blank rows
      if (Students_import_is_blank_row_(row)) return;

      const obj = {};
      fieldMap.forEach(function (field, i) {
        if (!field) return;
        var value = String(row[i] == null ? '' : row[i]).trim();
        if (field === '_full_name') {
          var name = Students_import_split_full_name_(value);
          if (name.prefix && !obj.prefix) obj.prefix = name.prefix;
          if (name.first_name && !obj.first_name) obj.first_name = name.first_name;
          if (name.last_name && !obj.last_name) obj.last_name = name.last_name;
        } else if (field === '_class_room') {
          var cr = Students_import_split_class_room_(value);
          if (cr.class_level && !obj.class_level) obj.class_level = cr.class_level;
          if (cr.room && !obj.room) obj.room = cr.room;
        } else if (field === 'notes' && obj.notes) {
          obj.notes += ' | ' + value;
        } else {
          obj[field] = value;
        }
      });
      if (!obj.last_name && obj.first_name && /\s/.test(obj.first_name)) {
        var fallbackName = Students_import_split_full_name_(obj.first_name);
        if (fallbackName.prefix && !obj.prefix) obj.prefix = fallbackName.prefix;
        if (fallbackName.first_name) obj.first_name = fallbackName.first_name;
        if (fallbackName.last_name) obj.last_name = fallbackName.last_name;
      }
      if (obj.class_level && !obj.room && /[\/\-]/.test(obj.class_level)) {
        var fallbackClass = Students_import_split_class_room_(obj.class_level);
        obj.class_level = fallbackClass.class_level || obj.class_level;
        obj.room = fallbackClass.room || obj.room;
      }
      if (!obj.class_level && importDefaults.default_class_level) obj.class_level = importDefaults.default_class_level;
      if (!obj.room && importDefaults.default_room) obj.room = importDefaults.default_room;
      if (!obj.gender && obj.prefix) {
        if (/^นาย$|ชาย|ด\.ช\./.test(obj.prefix)) obj.gender = 'ชาย';
        else if (/หญิง|นาง/.test(obj.prefix)) obj.gender = 'หญิง';
      }
      if (obj.citizen_id) obj.citizen_id = String(obj.citizen_id).replace(/\D/g, '');
      if (obj.phone) obj.phone = String(obj.phone).replace(/[^\d+]/g, '');

      // Required
      if (!obj.first_name || !obj.last_name || !obj.class_level) {
        if (Students_import_should_skip_incomplete_row_(row, obj)) return;
        results.failed++;
        results.errors.push('แถว ' + (idx + sourceLineOffset) + ': ขาดข้อมูลจำเป็น (ชื่อ/นามสกุล/ชั้น)');
        return;
      }

      // Duplicate by citizen_id
      if (obj.citizen_id && byCitizen[obj.citizen_id]) {
        results.duplicated++;
        return;
      }
      if (obj.student_code && byCode[obj.student_code]) {
        results.duplicated++;
        return;
      }

      // Default academic year
      if (!obj.academic_year) obj.academic_year = settings.current_academic_year;

      // Generate code if missing
      if (!obj.student_code) {
        let code;
        do {
          code = _gen_code_('S', nextSeq);
          nextSeq++;
        } while (byCode[code]);
        obj.student_code = code;
      }
      obj.is_active = 'yes';
      obj.created_by = user.id;

      const ins = DB_insert(SHEETS.STUDENTS, obj);
      if (obj.citizen_id) byCitizen[obj.citizen_id] = ins;
      byCode[obj.student_code] = ins;
      results.inserted++;
      results.inserted_codes.push(obj.student_code);
    } catch (e) {
      results.failed++;
      results.errors.push('แถว ' + (idx + sourceLineOffset) + ': ' + (e.message || e));
    }
  });

  Audit_log_(user, 'student.bulk_import', 'student', '',
    { total: results.total, inserted: results.inserted, duplicated: results.duplicated, failed: results.failed });
  return results;
}

function Students_class_list(user, p) {
  Auth_requireCap(user, 'student.view_all');
  p = p || {};
  const settings = Settings_map_();
  const academicYear = String(p.academic_year || settings.current_academic_year || '').trim();

  const list = DB_filter(SHEETS.STUDENTS, function (s) {
    return _yes_(s.is_active) && (!academicYear || String(s.academic_year) === academicYear);
  });
  const set = {};
  list.forEach(function (s) {
    const k = s.class_level;
    if (k) {
      if (!set[k]) set[k] = { class_level: k, count: 0, rooms: {} };
      set[k].count++;
      if (s.room) set[k].rooms[s.room] = (set[k].rooms[s.room] || 0) + 1;
    }
  });
  const arr = Object.keys(set).map(function (k) {
    return { class_level: k, count: set[k].count, rooms: Object.keys(set[k].rooms).sort() };
  });
  arr.sort(function (a, b) { return String(a.class_level) < String(b.class_level) ? -1 : 1; });
  return arr;
}
