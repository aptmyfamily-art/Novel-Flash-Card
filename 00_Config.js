const APP = Object.freeze({
  NAME: 'Novel Flashcard Core',
  SHORT: 'NVFS',
  TITLE: 'NVFS · Novel Flashcard Core',
  VERSION: '1.0.0-probe-817094d',
  LAST_UPDATED: '2026-05-30 20:10',
  ORG: 'Novel Flashcard Workspace',
  DESCRIPTION: 'Core app shell for auth, settings, users, audit, and dictionary import.',
  TIMEZONE: 'Asia/Bangkok',
  LOGO_ICON: 'journal-richtext',
  DEV: Object.freeze({
    NAME: 'ครูวิรัตน์ หาดคำ',
    URL: 'https://www.kruwirat.com',
    LOGO: 'https://mts-ssk3.com/uploads/team/team_1771053860_6990232440dc8.png'
  })
});

const SHEETS = Object.freeze({
  USERS: 'Users',
  SESSIONS: 'Sessions',
  SETTINGS: 'Settings',
  AUDIT: 'Audit',
  DICTIONARY_ENTRIES: 'DictionaryEntries'
});

const SCHEMAS = Object.freeze({
  Users: ['id', 'username', 'password_hash', 'salt', 'full_name', 'email', 'phone', 'role', 'position', 'photo_url', 'is_active', 'last_login', 'created_at', 'updated_at'],
  Sessions: ['token', 'user_id', 'username', 'created_at', 'expires_at', 'user_agent'],
  Settings: ['key', 'value', 'updated_at'],
  Audit: ['id', 'ts', 'user_id', 'username', 'action', 'entity', 'entity_id', 'meta'],
  DictionaryEntries: ['id', 'batch_id', 'source_title', 'source_file', 'term', 'reading', 'glossary', 'glossary_json', 'definition_tags', 'rules', 'score', 'sequence', 'term_tags', 'source_index', 'raw_json', 'created_at']
});

const ROLES = Object.freeze(['admin', 'director', 'academic', 'teacher']);
const ROLE_LABEL = Object.freeze({
  admin: 'ผู้ดูแลระบบ',
  director: 'ผู้กำกับดูแล',
  academic: 'ผู้จัดการข้อมูล',
  teacher: 'ผู้ใช้งาน'
});

const CAPS = Object.freeze({
  admin: [
    'user.manage',
    'audit.view_all',
    'setting.read', 'setting.manage',
    'file.upload', 'file.manage'
  ],
  director: [
    'setting.read',
    'file.upload', 'file.manage'
  ],
  academic: [
    'setting.read',
    'file.upload', 'file.manage'
  ],
  teacher: [
    'setting.read',
    'file.upload'
  ]
});

const STATUS = Object.freeze({});
const STATUS_LABEL = Object.freeze({});

const SETTINGS_DEFAULTS = Object.freeze({
  org_name: 'Novel Flashcard Workspace',
  org_address: 'Core workspace for dictionary import and content tooling',
  org_phone: '',
  org_email: '',
  show_demo_users: 'yes',
  drive_root_id: ''
});

const SETTINGS_SENSITIVE = Object.freeze([]);

const TEXT_COLUMNS = Object.freeze([
  'value',
  'phone'
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
