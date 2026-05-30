/**
 * ═══════════════════════════════════════════════════════════════
 *  NOVEL · ระบบคลังคำศัพท์นิยาย
 *  File:        09_Seed.js — Demo data seeding
 *  Version:     1.1.0
 *  Last Update: 2026-05-15
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

const DEMO_USERS = Object.freeze([
  { username: 'admin', role: 'admin', full_name: 'นายผู้ดูแล ระบบ', position: 'ผู้ดูแลระบบ', email: 'admin@example.ac.th', phone: '0812345678' },
  { username: 'director', role: 'director', full_name: 'นางสาวผู้อำนวยการ ตัวอย่าง', position: 'ผู้อำนวยการ', email: 'director@example.ac.th', phone: '0812345679' },
  { username: 'academic', role: 'academic', full_name: 'นายวิชาการ โรงเรียน', position: 'หัวหน้าฝ่ายวิชาการ', email: 'academic@example.ac.th', phone: '0812345680' },
  { username: 'teacher', role: 'teacher', full_name: 'นางสาวครูประจำชั้น สอนดี', position: 'ครูประจำชั้น ม.1/1', email: 'teacher@example.ac.th', phone: '0812345681' }
]);
const DEMO_PASSWORD = '123456';

function Seed_ensureUsers_() {
  let created = 0;
  DEMO_USERS.forEach(function (u) {
    const exists = DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === u.username; });
    if (exists) return;
    const salt = cfg_salt_();
    DB_insert(SHEETS.USERS, {
      username: u.username,
      password_hash: cfg_hash_(DEMO_PASSWORD, salt),
      salt: salt,
      full_name: u.full_name,
      email: u.email, phone: u.phone,
      role: u.role, position: u.position,
      is_active: 'yes'
    });
    created++;
  });
  return created;
}

function Seed_resetDemoPasswords_() {
  let reset = 0;
  DEMO_USERS.forEach(function (du) {
    const u = DB_findOne(SHEETS.USERS, function (x) { return String(x.username).toLowerCase() === du.username; });
    if (!u) return;
    const salt = cfg_salt_();
    DB_update(SHEETS.USERS, u.id, {
      salt: salt, password_hash: cfg_hash_(DEMO_PASSWORD, salt), is_active: 'yes'
    });
    reset++;
  });
  return reset;
}

function Seed_demoData() {
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  Seed_ensureUsers_();
  return { ok: true, message: 'เพิ่มข้อมูลตัวอย่างเรียบร้อย' };
}
