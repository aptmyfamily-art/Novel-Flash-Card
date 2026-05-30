/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        09_Seed.gs — Demo data seeding
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
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

const DEMO_STUDENTS = Object.freeze([
  { prefix: 'เด็กชาย', first_name: 'สมชาย', last_name: 'ใจดี', nickname: 'ชาย', gender: 'ชาย', class_level: 'ม.1', room: '1', citizen_id: '1100000000001' },
  { prefix: 'เด็กหญิง', first_name: 'สมหญิง', last_name: 'น่ารัก', nickname: 'หญิง', gender: 'หญิง', class_level: 'ม.1', room: '1', citizen_id: '1100000000002' },
  { prefix: 'เด็กชาย', first_name: 'อนันต์', last_name: 'มากมี', nickname: 'อนันต์', gender: 'ชาย', class_level: 'ม.1', room: '2', citizen_id: '1100000000003' },
  { prefix: 'เด็กหญิง', first_name: 'มณีรัตน์', last_name: 'แก้วใส', nickname: 'มณี', gender: 'หญิง', class_level: 'ม.2', room: '1', citizen_id: '1100000000004' },
  { prefix: 'เด็กชาย', first_name: 'ธนวัฒน์', last_name: 'รวยทรัพย์', nickname: 'ธน', gender: 'ชาย', class_level: 'ม.2', room: '1', citizen_id: '1100000000005' },
  { prefix: 'นาย', first_name: 'ภาคิน', last_name: 'นาทอง', nickname: 'ภาค', gender: 'ชาย', class_level: 'ม.3', room: '1', citizen_id: '1100000000006' },
  { prefix: 'นางสาว', first_name: 'พิมพ์ชนก', last_name: 'งามจริง', nickname: 'พิมพ์', gender: 'หญิง', class_level: 'ม.3', room: '1', citizen_id: '1100000000007' },
  { prefix: 'นาย', first_name: 'กิตติพงษ์', last_name: 'อ่อนวงศ์', nickname: 'กิต', gender: 'ชาย', class_level: 'ม.3', room: '2', citizen_id: '1100000000008' }
]);

function Seed_ensureStudents_(adminId) {
  let created = 0;
  const settings = Settings_map_();
  const year = settings.current_academic_year || '2569';
  DEMO_STUDENTS.forEach(function (s, i) {
    const code = 'S' + String(67001 + i);
    const exists = DB_findOne(SHEETS.STUDENTS, function (x) { return String(x.student_code) === code; });
    if (exists) return;
    DB_insert(SHEETS.STUDENTS, {
      student_code: code, citizen_id: s.citizen_id,
      prefix: s.prefix, first_name: s.first_name, last_name: s.last_name,
      nickname: s.nickname, gender: s.gender,
      class_level: s.class_level, room: s.room,
      academic_year: year,
      is_active: 'yes', created_by: adminId || ''
    });
    created++;
  });
  return created;
}

function Seed_demoData() {
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  Seed_ensureUsers_();
  const admin = DB_findOne(SHEETS.USERS, function (u) { return u.username === 'admin'; });
  Seed_ensureStudents_(admin ? admin.id : '');
  return { ok: true, message: 'เพิ่มข้อมูลตัวอย่างเรียบร้อย' };
}

function Seed_clearDemo() {
  // Delete only demo students (S67xxx codes)
  DB_deleteWhere(SHEETS.STUDENTS, function (s) {
    return String(s.student_code || '').indexOf('S67') === 0;
  });
  return { ok: true };
}
