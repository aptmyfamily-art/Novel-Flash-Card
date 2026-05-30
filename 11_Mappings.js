/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        11_Mappings.gs — Homeroom Teacher Mappings
 *  Version:     1.0.0
 *  Last Update: 2026-05-26
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * List all mappings with optional filtering
 */
function Mappings_list(user, p) {
  Auth_requireCap(user, 'setting.read');
  let rows = DB_readAll(SHEETS.TEACHER_MAPPINGS);
  
  const year = String((p && p.academic_year) || '').trim();
  if (year) {
    rows = rows.filter(function(r) { return r.academic_year === year; });
  }

  const level = String((p && p.class_level) || '').trim();
  if (level) {
    rows = rows.filter(function(r) { return r.class_level === level; });
  }

  // Sort by year desc, then level, then room
  rows.sort(function(a, b) {
    if (a.academic_year !== b.academic_year) return b.academic_year.localeCompare(a.academic_year);
    if (a.class_level !== b.class_level) return a.class_level.localeCompare(b.class_level);
    return a.room.localeCompare(b.room);
  });

  return { items: rows, total: rows.length };
}

/**
 * Upsert a mapping
 */
function Mappings_upsert(user, p) {
  Auth_requireCap(user, 'setting.manage');
  const data = p || {};
  
  const required = ['academic_year', 'class_level', 'room', 'teacher1_name'];
  required.forEach(function(k) { 
    if (!String(data[k] || '').trim()) throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน: ' + k); 
  });

  if (data.id) {
    const existing = DB_findById(SHEETS.TEACHER_MAPPINGS, data.id);
    if (!existing) throw new Error('ไม่พบข้อมูลที่ต้องการแก้ไข');
    
    // Check for duplicate room in same year (excluding self)
    const dup = DB_findOne(SHEETS.TEACHER_MAPPINGS, function(r) {
      return r.academic_year === data.academic_year && 
             r.class_level === data.class_level && 
             r.room === data.room && 
             r.id !== data.id;
    });
    if (dup) throw new Error('มีการกำหนดครูประจำชั้นสำหรับห้องนี้ในปีการศึกษานี้ไปแล้ว');

    const res = DB_update(SHEETS.TEACHER_MAPPINGS, data.id, data);
    Audit_log_(user, 'mapping.update', 'mapping', data.id, { 
      year: data.academic_year, 
      class: data.class_level + '/' + data.room 
    });
    return res;
  } else {
    // Check for duplicate room in same year
    const dup = DB_findOne(SHEETS.TEACHER_MAPPINGS, function(r) {
      return r.academic_year === data.academic_year && 
             r.class_level === data.class_level && 
             r.room === data.room;
    });
    if (dup) throw new Error('มีการกำหนดครูประจำชั้นสำหรับห้องนี้ในปีการศึกษานี้ไปแล้ว');

    const res = DB_insert(SHEETS.TEACHER_MAPPINGS, data);
    Audit_log_(user, 'mapping.create', 'mapping', res.id, { 
      year: data.academic_year, 
      class: data.class_level + '/' + data.room 
    });
    return res;
  }
}

/**
 * Delete a mapping
 */
function Mappings_delete(user, id) {
  Auth_requireCap(user, 'setting.manage');
  if (!id) throw new Error('ไม่พบ ID');
  const existing = DB_findById(SHEETS.TEACHER_MAPPINGS, id);
  if (!existing) throw new Error('ไม่พบข้อมูล');
  
  const ok = DB_delete(SHEETS.TEACHER_MAPPINGS, id);
  Audit_log_(user, 'mapping.delete', 'mapping', id, { 
    year: existing.academic_year, 
    class: existing.class_level + '/' + existing.room 
  });
  return { ok: ok };
}

/**
 * Get mapping for a specific student
 */
function Mappings_getForStudent(user, p) {
  Auth_requireCap(user, 'visit.view_own|visit.view_all');
  const studentId = (p && p.student_id);
  if (!studentId) throw new Error('ไม่พบ Student ID');
  const s = DB_findById(SHEETS.STUDENTS, studentId);
  if (!s) throw new Error('ไม่พบนักเรียน');
  return Mappings_getByContext_(s.academic_year, s.class_level, s.room);
}

/**
 * Helper: Find teachers for a specific student's context
 */
function Mappings_getByContext_(academicYear, classLevel, room) {
  return DB_findOne(SHEETS.TEACHER_MAPPINGS, function(r) {
    return r.academic_year === String(academicYear) && 
           r.class_level === String(classLevel) && 
           r.room === String(room);
  });
}
