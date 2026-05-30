/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        06_Reports.gs — Dashboard stats + Reports (O(n) scan)
 *  Version:     1.1.0
 *  Last Update: 2026-05-25
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 * ═══════════════════════════════════════════════════════════════
 */

function Reports_dashboard(user, p) {
  p = p || {};
  const year = String(p.academic_year || '').trim();
  
  const visits = DB_filter(SHEETS.VISITS, function (v) {
    if (year && String(v.academic_year) !== year) return false;
    // Teacher sees only own if not admin/director/academic
    if (!hasCap_(user.role, 'visit.view_all')) {
      return String(v.teacher_id) === String(user.id);
    }
    return true;
  });

  const students = DB_filter(SHEETS.STUDENTS, function (s) {
    if (year && String(s.academic_year) !== year) return false;
    return s.is_active === 'yes';
  });

  const users = DB_readAll(SHEETS.USERS);
  const stuById = {};
  students.forEach(function (s) { stuById[s.id] = s; });

  let totalIncome = 0, countIncome = 0;
  const byStatus = { draft: 0, completed: 0, approved: 0 };
  const byClass = {};
  const byMonth = {};
  const byTeacher = {};
  const riskHealth = { weak: 0, chronic: 0, serious: 0 };
  const riskSafety = { parents_separated: 0, community_risk: 0, no_caretaker: 0 };
  const studentCategoryLabels = {
    warm_family: 'สภาพครอบครัวนักเรียนที่มีความอบอุ่น',
    broken_family: 'สภาพครอบครัวนักเรียนที่มีความแตกแยก',
    distant_family: 'สภาพครอบครัวนักเรียนที่มีความห่างเหิน',
    lives_with_both_parents: 'สภาพนักเรียนอาศัยอยู่กับบิดาและมารดา',
    lives_with_single_parent: 'สภาพนักเรียนอาศัยอยู่กับบิดาหรือมารดา',
    not_living_with_parents: 'สภาพนักเรียนที่ไม่ได้อาศัยอยู่กับบิดาและมารดา'
  };
  const studentRiskLabels = {
    economic: 'สภาพนักเรียนที่มีความเสี่ยงด้านเศรษฐกิจ',
    safety: 'สภาพนักเรียนที่มีความเสี่ยงด้านสวัสดิภาพและความปลอดภัย เช่น การเดินทาง ที่อยู่อาศัย',
    sexual_behavior: 'สภาพนักเรียนที่มีความเสี่ยงด้านพฤติกรรมทางเพศ',
    mental_health: 'สภาพนักเรียนที่มีความเสี่ยงด้านสุขภาพจิต',
    physical_health: 'สภาพนักเรียนที่มีความเสี่ยงด้านสุขภาพ เช่น อ้วน ผอม โรคประจำตัว',
    violence: 'สภาพนักเรียนที่มีความเสี่ยงด้านความรุนแรง',
    substance: 'สภาพนักเรียนที่มีความเสี่ยงด้านสารเสพติด'
  };
  const studentCategories = {};
  const studentCategoryStudents = {};
  const studentCategorySeen = {};
  const studentRisks = {};
  const studentRiskStudents = {};
  const studentRiskSeen = {};
  Object.keys(studentCategoryLabels).forEach(function (k) {
    studentCategories[k] = 0;
    studentCategoryStudents[k] = [];
    studentCategorySeen[k] = {};
  });
  Object.keys(studentRiskLabels).forEach(function (k) {
    studentRisks[k] = 0;
    studentRiskStudents[k] = [];
    studentRiskSeen[k] = {};
  });

  visits.forEach(function (v) {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    byTeacher[v.teacher_id] = (byTeacher[v.teacher_id] || 0) + 1;
    
    if (v.avg_income_per_person) {
      totalIncome += Number(v.avg_income_per_person);
      countIncome++;
    }

    const s = stuById[v.student_id] || {};
    if (s.class_level) byClass[s.class_level] = (byClass[s.class_level] || 0) + 1;

    const date = new Date(v.visit_date);
    if (!isNaN(date)) {
      const mon = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      byMonth[mon] = (byMonth[mon] || 0) + 1;
    }

    // Risks
    try {
      const h = JSON.parse(v.health || '[]');
      if (h.indexOf('weak') >= 0) riskHealth.weak++;
      if (h.indexOf('chronic') >= 0) riskHealth.chronic++;
      if (h.indexOf('serious') >= 0) riskHealth.serious++;
      const safe = JSON.parse(v.safety || '[]');
      if (safe.indexOf('parents_separated') >= 0) riskSafety.parents_separated++;
      if (safe.indexOf('community_risk') >= 0) riskSafety.community_risk++;
      if (safe.indexOf('no_caretaker') >= 0) riskSafety.no_caretaker++;
    } catch (e) {}

    try {
      const cats = JSON.parse(v.student_report_categories || '[]');
      cats.forEach(function (cat) {
        if (!(cat in studentCategories)) return;
        const studentKey = String((s && s.id) || v.student_id || '');
        if (studentKey && studentCategorySeen[cat][studentKey]) return;
        if (studentKey) studentCategorySeen[cat][studentKey] = true;
        studentCategories[cat]++;
        studentCategoryStudents[cat].push({
          id: v.id,
          visit_code: v.visit_code,
          student_id: s.id || v.student_id,
          student_name: ((s.prefix || '') + (s.first_name || '') + ' ' + (s.last_name || '')).trim(),
          class_level: s.class_level || '',
          room: s.room || '',
          visit_date: v.visit_date || ''
        });
      });
    } catch (e) {}

    try {
      const risks = JSON.parse(v.student_risk_categories || '[]');
      risks.forEach(function (risk) {
        if (!(risk in studentRisks)) return;
        const studentKey = String((s && s.id) || v.student_id || '');
        if (studentKey && studentRiskSeen[risk][studentKey]) return;
        if (studentKey) studentRiskSeen[risk][studentKey] = true;
        studentRisks[risk]++;
        studentRiskStudents[risk].push({
          id: v.id,
          visit_code: v.visit_code,
          student_id: s.id || v.student_id,
          student_name: ((s.prefix || '') + (s.first_name || '') + ' ' + (s.last_name || '')).trim(),
          class_level: s.class_level || '',
          room: s.room || '',
          visit_date: v.visit_date || ''
        });
      });
    } catch (e) {}
  });

  // Recent 10
  const recent = [];
  const recentVisits = visits.slice().sort(function (a, b) { return String(b.visit_date).localeCompare(a.visit_date); }).slice(0, 10);
  recentVisits.forEach(function (v) {
    const s = stuById[v.student_id] || {};
    recent.push({
      id: v.id, visit_code: v.visit_code, visit_date: v.visit_date, status: v.status,
      student_name: ((s.prefix || '') + (s.first_name || '') + ' ' + (s.last_name || '')).trim(),
      class_level: s.class_level, room: s.room
    });
  });

  // Top teachers
  const topTeachers = Object.keys(byTeacher).map(function (id) {
    const u = users.filter(function (x) { return x.id === id; })[0];
    return { id: id, name: u ? u.full_name : '-', role: u ? u.role : '', count: byTeacher[id] };
  }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10);

  return {
    total_visits: visits.length,
    total_students: students.length,
    total_teachers: users.length,
    completed: byStatus.completed || 0,
    draft: byStatus.draft || 0,
    approved: byStatus.approved || 0,
    avg_income: countIncome > 0 ? Math.round(totalIncome / countIncome) : 0,
    by_status: byStatus,
    by_class: byClass,
    by_month: byMonth,
    risk_health: riskHealth,
    risk_safety: riskSafety,
    student_category_labels: studentCategoryLabels,
    student_categories: studentCategories,
    student_category_students: studentCategoryStudents,
    student_risk_labels: studentRiskLabels,
    student_risks: studentRisks,
    student_risk_students: studentRiskStudents,
    top_teachers: topTeachers,
    recent: recent
  };
}

function Reports_audit(user, p) {
  Auth_requireCap(user, 'audit.view_all');
  p = p || {};
  let rows = DB_readAll(SHEETS.AUDIT);
  if (p.action) rows = rows.filter(function (r) { return String(r.action).indexOf(p.action) >= 0; });
  if (p.user_id) rows = rows.filter(function (r) { return String(r.user_id) === String(p.user_id); });
  rows.sort(function (a, b) { return String(b.ts || '').localeCompare(String(a.ts || '')); });
  const page = Math.max(1, Number(p.page || 1));
  const per = Math.min(500, Math.max(20, Number(p.per_page || 100)));
  const start = (page - 1) * per;
  return { items: rows.slice(start, start + per), total: rows.length, page: page, per_page: per };
}

function _esc_(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
