/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน (Student Home Visit Recording)
 *  File:        00_Config.gs — ค่าคงที่ + Schemas + RBAC + helpers
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

const APP = Object.freeze({
  NAME: 'ระบบบันทึกการเยี่ยมบ้านนักเรียน',
  SHORT: 'SHVR',
  TITLE: 'SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน',
  VERSION: '1.0.0',
  LAST_UPDATED: '2026-05-12',
  ORG: 'โรงเรียนตัวอย่าง',
  DESCRIPTION: 'ระบบบันทึกการเยี่ยมบ้านนักเรียน + คัดกรองนักเรียนยากจน · ครบทุกมิติตามแบบฟอร์มราชการ · พิมพ์เอกสาร PDF ได้',
  TIMEZONE: 'Asia/Bangkok',
  LOGO_ICON: 'house-heart-fill',
  DEV: Object.freeze({
    NAME: 'ครูวิรัตน์ หาดคำ',
    URL: 'https://www.kruwirat.com',
    LOGO: 'https://mts-ssk3.com/uploads/team/team_1771053860_6990232440dc8.png'
  })
});

const SHEETS = Object.freeze({
  USERS: 'Users',
  SESSIONS: 'Sessions',
  STUDENTS: 'Students',
  VISITS: 'Visits',
  VISIT_MEMBERS: 'VisitMembers',
  SETTINGS: 'Settings',
  AUDIT: 'Audit',
  TEACHER_MAPPINGS: 'TeacherMappings'
});

const SCHEMAS = Object.freeze({
  Users: ['id', 'username', 'password_hash', 'salt', 'full_name', 'email', 'phone', 'role', 'position', 'photo_url', 'is_active', 'last_login', 'created_at', 'updated_at'],
  Sessions: ['token', 'user_id', 'username', 'created_at', 'expires_at', 'user_agent'],
  Students: ['id', 'student_code', 'citizen_id', 'prefix', 'first_name', 'last_name', 'nickname', 'gender', 'birth_date', 'class_level', 'room', 'academic_year', 'photo_url', 'address', 'phone', 'is_active', 'notes', 'created_at', 'updated_at', 'created_by'],
  Visits: ['id', 'visit_code', 'student_id', 'school_name', 'education_area', 'visit_date', 'academic_year', 'status',
    'has_guardian', 'guardian_first_name', 'guardian_last_name', 'guardian_phone', 'guardian_relation', 'guardian_occupation', 'guardian_education', 'guardian_citizen_id', 'guardian_no_id', 'guardian_welfare_registered',
    'household_count', 'total_income', 'avg_income_per_person',
    'status_dependency', 'housing_type', 'housing_condition', 'vehicle_car', 'vehicle_pickup', 'vehicle_tractor', 'farmer_land',
    'family_hours_together', 'family_relations',
    'guardian_absent_with', 'guardian_absent_other',
    'student_income_from', 'student_work_occupation', 'student_daily_income', 'student_school_allowance',
    'help_needed', 'help_needed_other', 'help_received', 'help_received_other', 'guardian_concerns',
    'health', 'safety', 'distance_km', 'travel_time_hr', 'travel_time_min', 'travel_mode', 'travel_other',
    'responsibilities', 'responsibilities_other', 'hobbies', 'hobbies_other',
    'substance_behavior', 'violence_behavior', 'sex_behavior',
    'game_addiction', 'game_addiction_other', 'internet_access', 'electronics_use',
    'informant', 'guardian_signature_name',
    'photo_student', 'photo_house_type', 'photo_house_outside', 'photo_house_inside',
    'teacher_id', 'teacher_signature_name', 'teacher_position', 'date_signed',
    'created_at', 'updated_at', 'created_by', 'updated_by',
    'guardian_signature_image', 'teacher_signature_image', 'student_report_categories', 'student_risk_categories'],
  VisitMembers: ['id', 'visit_id', 'seq', 'relation', 'age', 'disability', 'income_wage', 'income_agri', 'income_business', 'income_welfare', 'income_other', 'total', 'created_at'],
  Settings: ['key', 'value', 'updated_at'],
  Audit: ['id', 'ts', 'user_id', 'username', 'action', 'entity', 'entity_id', 'meta'],
  TeacherMappings: ['id', 'academic_year', 'class_level', 'room', 'teacher1_name', 'teacher1_id', 'teacher2_name', 'teacher2_id', 'updated_at']
});

const ROLES = Object.freeze(['admin', 'director', 'academic', 'teacher']);
const ROLE_LABEL = Object.freeze({
  admin: 'ผู้ดูแลระบบ',
  director: 'ผู้อำนวยการ',
  academic: 'วิชาการ',
  teacher: 'ครูประจำชั้น'
});

const CAPS = Object.freeze({
  admin: [
    'visit.manage', 'student.manage', 'user.manage',
    'report.view_all', 'audit.view_all',
    'setting.read', 'setting.manage',
    'file.upload', 'file.manage'
  ],
  director: [
    'visit.view_all', 'visit.approve',
    'student.view_all',
    'report.view_all', 'audit.view_all',
    'setting.read',
    'file.upload'
  ],
  academic: [
    'visit.view_all', 'visit.create', 'visit.edit', 'visit.approve',
    'student.view_all', 'student.create', 'student.edit',
    'report.view_all',
    'setting.read',
    'file.upload'
  ],
  teacher: [
    'visit.view_own', 'visit.create', 'visit.edit_own',
    'student.view_all', 'student.create', 'student.edit',
    'report.view_own',
    'setting.read',
    'file.upload'
  ]
});

const STATUS = Object.freeze({
  VISIT: Object.freeze({
    DRAFT: 'draft',
    COMPLETED: 'completed',
    APPROVED: 'approved'
  })
});
const STATUS_LABEL = Object.freeze({
  draft: 'ฉบับร่าง',
  completed: 'บันทึกเรียบร้อย',
  approved: 'อนุมัติ'
});

const SETTINGS_DEFAULTS = Object.freeze({
  org_name: 'โรงเรียนตัวอย่าง',
  org_address: '123 ถ.การศึกษา ต.ใจกลาง อ.เมือง จ.กรุงเทพฯ 10100',
  org_phone: '02-000-0000',
  org_email: 'school@example.ac.th',
  education_area: 'สพป.กรุงเทพมหานคร',
  director_name: 'นายผู้อำนวยการ ตัวอย่าง',
  director_position: 'ผู้อำนวยการโรงเรียน',
  show_demo_users: 'yes',
  current_academic_year: '2569',
  current_semester: '1',
  org_logo_url: '',
  drive_root_id: ''
});

const SETTINGS_SENSITIVE = Object.freeze([]);

const TEXT_COLUMNS = Object.freeze([
  'value', 'phone', 'citizen_id', 'guardian_citizen_id', 'student_code',
  'visit_code', 'guardian_phone', 'class_level', 'room', 'academic_year', 'current_academic_year'
]);

function cfg_now_() { return Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy-MM-dd\'T\'HH:mm:ssXXX'); }
function cfg_today_() { return Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy-MM-dd'); }
function cfg_iso_(d) { return Utilities.formatDate(d instanceof Date ? d : new Date(d), APP.TIMEZONE, 'yyyy-MM-dd\'T\'HH:mm:ssXXX'); }
function cfg_dateOnly_(d) { return Utilities.formatDate(d instanceof Date ? d : new Date(d), APP.TIMEZONE, 'yyyy-MM-dd'); }
function cfg_uuid_() { return Utilities.getUuid(); }
function cfg_salt_() {
  const raw = Utilities.getUuid() + ':' + Date.now();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).substring(0, 16);
}
function cfg_hash_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + ':' + String(password), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}
function cfg_token_() {
  const raw = Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + Date.now();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function _yes_(v) {
  if (v === true || v === 1) return true;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === '1' || s === 'y';
}

function _esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _gen_code_(prefix, n) {
  const dt = new Date();
  const y = String((dt.getFullYear() + 543) % 100).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  return prefix + y + m + String(n).padStart(4, '0');
}

function hasCap_(role, cap) {
  const arr = CAPS[role];
  if (!Array.isArray(arr) || !cap) return false;
  if (arr.indexOf(cap) >= 0) return true;
  if (/\.(view_own|edit_own|view_self|edit_self)$/.test(cap)) return false;
  const dot = cap.indexOf('.');
  if (dot > 0) {
    const prefix = cap.substring(0, dot);
    if (arr.indexOf(prefix + '.manage') >= 0) return true;
  }
  return false;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
