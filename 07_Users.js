/**
 * ═══════════════════════════════════════════════════════════════
 *  NOVEL · ระบบคลังคำศัพท์นิยาย
 *  File:        07_Users.gs — User management (admin only)
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Users_list(user, p) {
  Auth_requireCap(user, 'user.manage');
  let rows = DB_readAll(SHEETS.USERS);
  const q = String((p && p.q) || '').trim().toLowerCase();
  if (q) rows = rows.filter(function (u) {
    return String(u.username).toLowerCase().indexOf(q) >= 0
      || String(u.full_name).toLowerCase().indexOf(q) >= 0
      || String(u.email).toLowerCase().indexOf(q) >= 0;
  });
  rows = rows.map(function (u) { return Auth_publicUser_(u); });
  rows.sort(function (a, b) { return String(a.username).localeCompare(String(b.username)); });
  return { items: rows, total: rows.length };
}

function Users_upsert(user, p) {
  Auth_requireCap(user, 'user.manage');
  const data = p || {};
  const required = ['username', 'full_name', 'role'];
  required.forEach(function (k) { if (!String(data[k] || '').trim()) throw new Error('กรุณากรอก: ' + k); });
  data.username = String(data.username).toLowerCase().trim();
  if (ROLES.indexOf(data.role) < 0) throw new Error('role ไม่ถูกต้อง');
  if (data.is_active == null || data.is_active === '') data.is_active = 'yes';

  if (data.id) {
    const existing = DB_findById(SHEETS.USERS, data.id);
    if (!existing) throw new Error('ไม่พบบัญชี');
    // Check username unique
    if (data.username !== existing.username) {
      const dup = DB_findOne(SHEETS.USERS, function (u) { return String(u.username).toLowerCase() === data.username && u.id !== data.id; });
      if (dup) throw new Error('Username นี้มีอยู่แล้ว');
    }
    const patch = Object.assign({}, data);
    if (data.password) {
      const salt = cfg_salt_();
      patch.salt = salt;
      patch.password_hash = cfg_hash_(data.password, salt);
    }
    delete patch.password;
    const u = DB_update(SHEETS.USERS, data.id, patch);
    Audit_log_(user, 'user.update', 'user', data.id, { username: data.username });
    return Auth_publicUser_(u);
  } else {
    // Check duplicate
    const dup = DB_findOne(SHEETS.USERS, function (u) { return String(u.username).toLowerCase() === data.username; });
    if (dup) throw new Error('Username นี้มีอยู่แล้ว');
    if (!data.password) throw new Error('กรุณากำหนดรหัสผ่าน');
    const salt = cfg_salt_();
    const u = DB_insert(SHEETS.USERS, {
      username: data.username,
      password_hash: cfg_hash_(data.password, salt),
      salt: salt,
      full_name: data.full_name,
      email: data.email || '',
      phone: data.phone || '',
      role: data.role,
      position: data.position || '',
      photo_url: data.photo_url || '',
      is_active: data.is_active
    });
    Audit_log_(user, 'user.create', 'user', u.id, { username: data.username, role: data.role });
    return Auth_publicUser_(u);
  }
}

function Users_toggleActive(user, id) {
  Auth_requireCap(user, 'user.manage');
  const u = DB_findById(SHEETS.USERS, id);
  if (!u) throw new Error('ไม่พบบัญชี');
  const next = _yes_(u.is_active) ? 'no' : 'yes';
  DB_update(SHEETS.USERS, id, { is_active: next });
  Audit_log_(user, 'user.toggle', 'user', id, { is_active: next });
  return { ok: true, is_active: next };
}

function Users_resetPassword(user, p) {
  Auth_requireCap(user, 'user.manage');
  const id = p && p.id;
  const pwd = String((p && p.password) || '');
  if (!id || !pwd) throw new Error('กรุณาระบุข้อมูล');
  if (pwd.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  const salt = cfg_salt_();
  DB_update(SHEETS.USERS, id, { salt: salt, password_hash: cfg_hash_(pwd, salt) });
  Audit_log_(user, 'user.reset_password', 'user', id, {});
  return { ok: true };
}
