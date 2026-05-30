/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        02_Auth.gs — Authentication + Session + Bootstrap
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

const SESSION_HOURS = 8;

function Auth_ensureSeedUsers_() {
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  Seed_ensureUsers_();
}

function Auth_login(p) {
  Auth_ensureSeedUsers_();
  const username = String((p && p.username) || '').trim().toLowerCase();
  const password = String((p && p.password) || '');
  if (!username || !password) throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  const user = DB_findOne(SHEETS.USERS, function (u) { return String(u.username).toLowerCase() === username; });
  if (!user) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  if (!_yes_(user.is_active)) throw new Error('บัญชีผู้ใช้นี้ถูกปิดใช้งาน');
  const hash = cfg_hash_(password, user.salt);
  if (hash !== user.password_hash) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');

  // Create session
  const token = cfg_token_();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_HOURS * 3600 * 1000);
  DB_insert(SHEETS.SESSIONS, {
    token: token,
    user_id: user.id,
    username: user.username,
    created_at: cfg_iso_(now),
    expires_at: cfg_iso_(expires),
    user_agent: (p && p.user_agent) || ''
  });
  DB_update(SHEETS.USERS, user.id, { last_login: cfg_now_() });
  Audit_log_(user, 'auth.login', 'user', user.id, {});
  return { token: token, user: Auth_publicUser_(user), caps: CAPS[user.role] || [] };
}

function Auth_logout(token) {
  if (!token) return { ok: true };
  try {
    const sess = DB_findById(SHEETS.SESSIONS, token);
    if (sess) {
      DB_delete(SHEETS.SESSIONS, token);
      Audit_log_({ id: sess.user_id, username: sess.username, role: '' }, 'auth.logout', 'user', sess.user_id, {});
    }
  } catch (e) {}
  return { ok: true };
}

function Auth_verify_(token) {
  if (!token) throw new Error('ต้องเข้าสู่ระบบก่อน');
  const sess = DB_findById(SHEETS.SESSIONS, token);
  if (!sess) throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
  if (sess.expires_at && new Date(sess.expires_at) < new Date()) {
    DB_delete(SHEETS.SESSIONS, token);
    throw new Error('เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่');
  }
  const user = DB_findById(SHEETS.USERS, sess.user_id);
  if (!user) throw new Error('ไม่พบบัญชีผู้ใช้');
  if (!_yes_(user.is_active)) throw new Error('บัญชีผู้ใช้ถูกปิด');
  return user;
}

function Auth_requireCap(user, cap) {
  if (!user || !user.role) throw new Error('ต้องเข้าสู่ระบบก่อน');
  if (!hasCap_(user.role, cap)) throw new Error('คุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้ (' + cap + ')');
  return true;
}

function Auth_publicUser_(u) {
  if (!u) return null;
  return {
    id: u.id, username: u.username, full_name: u.full_name,
    email: u.email, phone: u.phone, role: u.role, position: u.position,
    photo_url: u.photo_url, is_active: _yes_(u.is_active)
  };
}

function Auth_bootstrap(token) {
  Auth_ensureSeedUsers_();
  let me = null, caps = [];
  if (token) {
    try {
      const u = Auth_verify_(token);
      me = Auth_publicUser_(u);
      caps = CAPS[u.role] || [];
    } catch (e) {}
  }
  const hasUsers = DB_readAll(SHEETS.USERS).length > 0;
  const settings = Settings_get_public_();
  return {
    me: me, caps: caps,
    app: {
      name: APP.NAME, short: APP.SHORT, title: APP.TITLE,
      version: APP.VERSION, last_updated: APP.LAST_UPDATED,
      description: APP.DESCRIPTION, org: APP.ORG, logo_icon: APP.LOGO_ICON
    },
    dev: APP.DEV,
    has_users: hasUsers,
    settings: settings,
    roles: ROLE_LABEL,
    statuses: STATUS_LABEL
  };
}

function Auth_changePassword(user, p) {
  const cur = String((p && p.current) || '');
  const next = String((p && p.next) || '');
  if (!cur || !next) throw new Error('กรุณากรอกรหัสผ่านให้ครบ');
  if (next.length < 6) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
  const u = DB_findById(SHEETS.USERS, user.id);
  if (!u) throw new Error('ไม่พบบัญชี');
  if (cfg_hash_(cur, u.salt) !== u.password_hash) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
  const salt = cfg_salt_();
  DB_update(SHEETS.USERS, user.id, { salt: salt, password_hash: cfg_hash_(next, salt) });
  Audit_log_(user, 'auth.change_password', 'user', user.id, {});
  return { ok: true };
}

function Auth_updateProfile(user, p) {
  const allow = ['full_name', 'email', 'phone', 'position', 'photo_url'];
  const patch = {};
  allow.forEach(function (k) { if (k in (p || {})) patch[k] = p[k]; });
  if (Object.keys(patch).length === 0) return Auth_publicUser_(DB_findById(SHEETS.USERS, user.id));
  const u = DB_update(SHEETS.USERS, user.id, patch);
  Audit_log_(user, 'profile.update', 'user', user.id, { fields: Object.keys(patch) });
  return Auth_publicUser_(u);
}

// ── Public/Internal pattern — ห้าม Settings_get_public_ เรียก Settings_get ของ public ──
function Settings_map_() {
  const rows = DB_readAll(SHEETS.SETTINGS);
  const m = {};
  rows.forEach(function (r) { if (r.key) m[r.key] = r.value; });
  return m;
}

function Settings_get_public_() {
  Settings_ensureDefaults_();
  const all = Settings_map_();
  const out = {};
  Object.keys(all).forEach(function (k) {
    if (SETTINGS_SENSITIVE.indexOf(k) < 0) out[k] = all[k];
  });
  return out;
}

function Settings_ensureDefaults_() {
  const sh = DB_ensureSchema_(SHEETS.SETTINGS);
  const map = Settings_map_();
  Object.keys(SETTINGS_DEFAULTS).forEach(function (k) {
    if (!(k in map)) Settings_setRaw_(k, SETTINGS_DEFAULTS[k]);
  });
}

function Settings_setRaw_(key, value) {
  if (!key) return;
  const sh = DB_ensureSchema_(SHEETS.SETTINGS);
  const last = sh.getLastRow();
  if (last >= 2) {
    const range = sh.getRange(2, 1, last - 1, 3);
    const vals = range.getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) === String(key)) {
        const r = sh.getRange(i + 2, 1, 1, 3);
        r.setNumberFormat('@');
        r.setValues([[key, String(value == null ? '' : value), cfg_now_()]]);
        _bumpVer_('sheet:' + SHEETS.SETTINGS);
        return;
      }
    }
  }
  const newRow = sh.getLastRow() + 1;
  const r = sh.getRange(newRow, 1, 1, 3);
  r.setNumberFormat('@');
  r.setValues([[key, String(value == null ? '' : value), cfg_now_()]]);
  _bumpVer_('sheet:' + SHEETS.SETTINGS);
}

function Settings_get(user) {
  Auth_requireCap(user, 'setting.read');
  return Settings_map_();
}

function Settings_update(user, p) {
  Auth_requireCap(user, 'setting.manage');
  const changes = (p && p.values) || {};
  const keys = Object.keys(changes);
  if (!keys.length) return { ok: true, updated: 0 };
  keys.forEach(function (k) { Settings_setRaw_(k, changes[k]); });
  Audit_log_(user, 'setting.update', 'setting', '', { keys: keys });
  return { ok: true, updated: keys.length };
}
