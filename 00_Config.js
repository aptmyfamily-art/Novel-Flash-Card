/**
 * ═══════════════════════════════════════════════════════════════
 *  NOVEL · ระบบคลังคำศัพท์นิยาย
 *  File:        00_Config.gs — ค่าคงที่ + Schemas + RBAC + helpers
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

const APP = Object.freeze({
  NAME: 'ระบบคำศัพท์นิยาย',
  SHORT: 'NVFS',
  TITLE: 'NVFS · ระบบคำศัพท์นิยาย',
  VERSION: '1.0.0',
  LAST_UPDATED: '2026-05-12',
  ORG: 'โรงเรียนตัวอย่าง',
  DESCRIPTION: 'ระบบคำศัพท์นิยาย (Novel Vocabulary System)',
  TIMEZONE: 'Asia/Bangkok',
  LOGO_ICON: 'card-text',
  DEV: Object.freeze({
    NAME: 'ครูวิรัตน์ หาดคำ',
    URL: 'https://www.kruwirat.com',
    LOGO: 'https://mts-ssk3.com/uploads/team/team_1771053860_6990232440dc8.png'
  }),
  USE_MOCK_DATA: true
});

const SHEETS = Object.freeze({
  USERS: 'Users',
  SESSIONS: 'Sessions',
  SETTINGS: 'Settings',
  AUDIT: 'Audit'
});

const SCHEMAS = Object.freeze({
  Users: ['id', 'username', 'password_hash', 'salt', 'full_name', 'email', 'phone', 'role', 'position', 'photo_url', 'is_active', 'last_login', 'created_at', 'updated_at'],
  Sessions: ['token', 'user_id', 'username', 'created_at', 'expires_at', 'user_agent'],
  Settings: ['key', 'value', 'updated_at'],
  Audit: ['id', 'ts', 'user_id', 'username', 'action', 'entity', 'entity_id', 'meta']
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
    'user.manage',
    'report.view_all', 'audit.view_all',
    'setting.read', 'setting.manage',
    'file.upload', 'file.manage'
  ],
  director: [
    'report.view_all', 'audit.view_all',
    'setting.read',
    'file.upload'
  ],
  academic: [
    'report.view_all',
    'setting.read',
    'file.upload'
  ],
  teacher: [
    'report.view_own',
    'setting.read',
    'file.upload'
  ]
});

const STATUS = Object.freeze({});
const STATUS_LABEL = Object.freeze({});

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
  'value', 'phone', 'citizen_id'
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
