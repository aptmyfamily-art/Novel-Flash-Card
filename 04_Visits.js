/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        04_Visits.gs — Visit CRUD + Household Members
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Visits_list(user, p) {
  p = p || {};
  const settings = Settings_map_();
  const academicYear = String(p.academic_year || settings.current_academic_year || '').trim();

  let rows;
  if (hasCap_(user.role, 'visit.view_all')) {
    rows = DB_readAll(SHEETS.VISITS);
  } else {
    Auth_requireCap(user, 'visit.view_own');
    rows = DB_filter(SHEETS.VISITS, function (v) { return String(v.teacher_id) === String(user.id); });
  }

  // Filter by academic year
  if (academicYear) {
    rows = rows.filter(function (v) { return String(v.academic_year) === academicYear; });
  }

  // Calculate Stats (before further filtering like search query)
  const stats = {
    total_visits: rows.length,
    total_students: DB_readAll(SHEETS.STUDENTS).filter(function (s) {
      return _yes_(s.is_active) && (!academicYear || String(s.academic_year) === academicYear);
    }).length,
    completed: rows.filter(function (v) { return v.status === 'completed'; }).length,
    draft: rows.filter(function (v) { return v.status === 'draft'; }).length,
    approved: rows.filter(function (v) { return v.status === 'approved'; }).length
  };

  // Join student data for display
  const students = DB_buildIndex(SHEETS.STUDENTS);
  const users = DB_buildIndex(SHEETS.USERS);
  rows = rows.map(function (v) {
    const s = students[v.student_id] || {};
    const t = users[v.teacher_id] || {};
    return Object.assign({}, v, {
      _student: { id: s.id, code: s.student_code, name: ((s.prefix || '') + (s.first_name || '') + ' ' + (s.last_name || '')).trim(), class_level: s.class_level, room: s.room, photo_url: s.photo_url },
      _teacher: { id: t.id, name: t.full_name, role: t.role }
    });
  });
  // Filters
  const q = String(p.q || '').trim().toLowerCase();
  if (q) rows = rows.filter(function (v) {
    return String(v._student.name).toLowerCase().indexOf(q) >= 0
      || String(v.visit_code).toLowerCase().indexOf(q) >= 0
      || String(v._student.code).toLowerCase().indexOf(q) >= 0;
  });
  if (p.status) rows = rows.filter(function (v) { return String(v.status) === String(p.status); });
  if (p.class_level) rows = rows.filter(function (v) { return String(v._student.class_level) === String(p.class_level); });
  if (p.teacher_id) rows = rows.filter(function (v) { return String(v.teacher_id) === String(p.teacher_id); });
  rows.sort(function (a, b) { return (b.visit_date || '').localeCompare(a.visit_date || ''); });
  // Pagination
  const page = Math.max(1, Number(p.page || 1));
  const per = Math.min(200, Math.max(10, Number(p.per_page || 50)));
  const total = rows.length;
  const start = (page - 1) * per;
  return {
    items: rows.slice(start, start + per),
    stats: stats,
    total: total, page: page, per_page: per,
    total_pages: Math.ceil(total / per) || 1
  };
}

function Visits_get(user, id) {
  const v = DB_findById(SHEETS.VISITS, id);
  if (!v) throw new Error('ไม่พบรายการเยี่ยมบ้าน');
  if (!hasCap_(user.role, 'visit.view_all')) {
    if (String(v.teacher_id) !== String(user.id)) throw new Error('คุณไม่มีสิทธิ์ดูรายการนี้');
  }
  // Load members
  const members = DB_filter(SHEETS.VISIT_MEMBERS, function (m) { return String(m.visit_id) === String(id); })
    .sort(function (a, b) { return Number(a.seq) - Number(b.seq); });
  // Parse JSON blobs
  const parsed = _parseVisitJson_(v);
  const student = DB_findById(SHEETS.STUDENTS, v.student_id);
  const teacher = DB_findById(SHEETS.USERS, v.teacher_id);
  const settings = Settings_map_();

  // Find homeroom teachers for this class/year
  const mapping = Mappings_getByContext_(v.academic_year, student.class_level, student.room);

  return {
    visit: parsed, members: members,
    student: student,
    teacher: teacher ? Auth_publicUser_(teacher) : null,
    settings: settings,
    homeroom_teachers: mapping || null
  };
}

function _parseVisitJson_(v) {
  const jsonFields = ['status_dependency', 'housing_condition', 'family_relations',
    'help_needed', 'help_received', 'health', 'safety', 'responsibilities',
    'hobbies', 'substance_behavior', 'violence_behavior', 'sex_behavior',
    'game_addiction', 'electronics_use', 'photo_house_type', 'student_report_categories', 'student_risk_categories'];
  const out = Object.assign({}, v);
  jsonFields.forEach(function (k) {
    if (typeof out[k] === 'string' && out[k]) {
      try { out[k] = JSON.parse(out[k]); } catch (e) { /* keep as string */ }
    }
    if (!out[k]) out[k] = (k === 'family_relations') ? {} : [];
  });
  return out;
}

function Visits_save(user, p) {
  Auth_requireCap(user, 'visit.create');
  const data = p && p.visit ? p.visit : {};
  const members = Array.isArray(p && p.members) ? p.members : [];
  const force = !!(p && p.force);
  const settings = Settings_map_();

  if (!data.student_id) throw new Error('กรุณาเลือกนักเรียนที่ต้องการเยี่ยม');
  if (!data.visit_date) data.visit_date = cfg_today_();
  if (!data.school_name) data.school_name = settings.org_name || APP.ORG;
  if (!data.education_area) data.education_area = settings.education_area || '';

  // Assign academic year for new records if not provided
  if (!data.id && !data.academic_year) {
    data.academic_year = settings.current_academic_year;
  }

  // ── DUPLICATE GUARD (only for new records, not updates) ──
  if (!data.id && !force) {
    const dup = Visits_findDuplicate_(data.student_id, data.visit_date, data.academic_year);
    if (dup) {
      const err = new Error('DUPLICATE:พบบันทึกการเยี่ยมบ้านของนักเรียนคนนี้แล้ว (' + dup.visit_code + ' · ' + dup.visit_date + ')');
      err.duplicate = { id: dup.id, visit_code: dup.visit_code, visit_date: dup.visit_date, status: dup.status };
      throw err;
    }
  }

  // Compute total income
  let total = 0;
  members.forEach(function (m) {
    const sum = (Number(m.income_wage) || 0) + (Number(m.income_agri) || 0)
      + (Number(m.income_business) || 0) + (Number(m.income_welfare) || 0)
      + (Number(m.income_other) || 0);
    m.total = sum;
    total += sum;
  });
  data.total_income = total;
  data.household_count = Number(data.household_count) || members.length;
  data.avg_income_per_person = data.household_count > 0 ? (total / data.household_count) : 0;

  // teacher_id = current user
  if (!data.teacher_id) data.teacher_id = user.id;
  if (!data.teacher_signature_name) {
    const u = DB_findById(SHEETS.USERS, user.id);
    if (u) data.teacher_signature_name = u.full_name;
  }
  if (!data.status) data.status = STATUS.VISIT.COMPLETED;

  // Stringify JSON fields
  const jsonFields = ['status_dependency', 'housing_condition', 'family_relations',
    'help_needed', 'help_received', 'health', 'safety', 'responsibilities',
    'hobbies', 'substance_behavior', 'violence_behavior', 'sex_behavior',
    'game_addiction', 'electronics_use', 'photo_house_type', 'student_report_categories', 'student_risk_categories'];
  jsonFields.forEach(function (k) {
    if (k in data && typeof data[k] !== 'string') data[k] = JSON.stringify(data[k]);
  });

  let visitId;
  if (data.id) {
    // update
    const existing = DB_findById(SHEETS.VISITS, data.id);
    if (!existing) throw new Error('ไม่พบรายการ');
    if (!hasCap_(user.role, 'visit.view_all')) {
      if (String(existing.teacher_id) !== String(user.id)) {
        Auth_requireCap(user, 'visit.edit');
      }
    }
    data.updated_by = user.id;
    DB_update(SHEETS.VISITS, data.id, data);
    visitId = data.id;
    Audit_log_(user, 'visit.update', 'visit', visitId, { code: existing.visit_code, academic_year: data.academic_year });
  } else {
    // generate code
    const list = DB_readAll(SHEETS.VISITS);
    data.visit_code = _gen_code_('HV', list.length + 1);
    data.created_by = user.id;
    const out = DB_insert(SHEETS.VISITS, data);
    visitId = out.id;
    Audit_log_(user, 'visit.create', 'visit', visitId, { code: out.visit_code, academic_year: out.academic_year });
  }

  // Replace members atomically
  DB_deleteWhere(SHEETS.VISIT_MEMBERS, function (m) { return String(m.visit_id) === String(visitId); });
  members.forEach(function (m, idx) {
    if (!m.relation && !m.age && !m.total) return; // skip empty
    DB_insert(SHEETS.VISIT_MEMBERS, {
      visit_id: visitId, seq: idx + 1,
      relation: m.relation || '', age: m.age || '',
      disability: m.disability || '',
      income_wage: m.income_wage || 0,
      income_agri: m.income_agri || 0,
      income_business: m.income_business || 0,
      income_welfare: m.income_welfare || 0,
      income_other: m.income_other || 0,
      total: m.total || 0
    });
  });

  // Return joined data
  const result = Visits_get(user, visitId);
  return result;
}

function Visits_delete(user, id) {
  const v = DB_findById(SHEETS.VISITS, id);
  if (!v) throw new Error('ไม่พบรายการ');
  if (!hasCap_(user.role, 'visit.manage')) {
    if (String(v.teacher_id) !== String(user.id)) Auth_requireCap(user, 'visit.manage');
  }
  DB_delete(SHEETS.VISITS, id);
  DB_deleteWhere(SHEETS.VISIT_MEMBERS, function (m) { return String(m.visit_id) === String(id); });
  Audit_log_(user, 'visit.delete', 'visit', id, { code: v.visit_code });
  return { ok: true };
}

function Visits_approve(user, id) {
  Auth_requireCap(user, 'visit.approve');
  const v = DB_update(SHEETS.VISITS, id, { status: STATUS.VISIT.APPROVED });
  Audit_log_(user, 'visit.approve', 'visit', id, {});
  return v;
}

function Visits_print(user, id) {
  return Visits_get(user, id);
}

// ── Duplicate detection helpers ──
function Visits_findDuplicate_(studentId, visitDate, academicYear) {
  if (!studentId) return null;
  const settings = academicYear ? null : Settings_map_();
  const year = String(academicYear || settings.current_academic_year || '').trim();

  const visits = DB_filter(SHEETS.VISITS, function (v) {
    return String(v.student_id) === String(studentId);
  });

  // 1. Same-day exact match → always duplicate
  const sameDay = visits.filter(function (v) {
    return String(v.visit_date || '').substring(0, 10) === String(visitDate || '').substring(0, 10);
  });
  if (sameDay.length) return sameDay[0];

  // 2. Same academic year — soft duplicate
  if (year) {
    const inYear = visits.filter(function (v) {
      return String(v.academic_year) === year;
    });
    if (inYear.length) return inYear[0];
  }
  return null;
}

function Visits_check_duplicate(user, p) {
  Auth_requireCap(user, 'visit.create');
  if (!p || !p.student_id) return { duplicate: null };
  const visitDate = p.visit_date || cfg_today_();
  const academicYear = p.academic_year;
  const dup = Visits_findDuplicate_(p.student_id, visitDate, academicYear);
  if (!dup) return { duplicate: null };
  // Enrich with student + teacher info
  const student = DB_findById(SHEETS.STUDENTS, dup.student_id);
  const teacher = DB_findById(SHEETS.USERS, dup.teacher_id);
  return {
    duplicate: {
      id: dup.id, visit_code: dup.visit_code, visit_date: dup.visit_date,
      status: dup.status, teacher_id: dup.teacher_id,
      teacher_name: teacher ? teacher.full_name : '',
      student_id: dup.student_id, student_name: student ? ((student.prefix||'') + (student.first_name||'') + ' ' + (student.last_name||'')).trim() : ''
    }
  };
}
