/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        Code.gs — Web App entry + API router (single endpoint)
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function doGet(e) {
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  const t = HtmlService.createTemplateFromFile('Index');
  return t.evaluate()
    .setTitle(APP.TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function _ok(data) { return { ok: true, data: data }; }
function _err(msg) { return { ok: false, error: String(msg) }; }

function api(req) {
  try {
    req = req || {};
    const action = String(req.action || '');
    const token = String(req.token || '');
    const payload = req.payload || {};

    // ── Public endpoints ──
    switch (action) {
      case 'app.bootstrap': return _ok(Auth_bootstrap(token));
      case 'app.ping': return _ok({ time: cfg_now_(), version: APP.VERSION });
      case 'auth.login': return _ok(Auth_login(payload));
      case 'auth.logout': return _ok(Auth_logout(token));
    }

    // ── Authenticated endpoints ──
    const user = Auth_verify_(token);

    switch (action) {
      case 'auth.change_password': return _ok(Auth_changePassword(user, payload));
      case 'profile.update': return _ok(Auth_updateProfile(user, payload));

      // Students
      case 'student.list': return _ok(Students_list(user, payload));
      case 'student.get': return _ok(Students_get(user, payload.id));
      case 'student.upsert': return _ok(Students_upsert(user, payload));
      case 'student.delete': return _ok(Students_delete(user, payload.id));
      case 'student.classes': return _ok(Students_class_list(user, payload));
      case 'student.template': return _ok(Students_template(user));
      case 'student.import_sheet': return _ok(Students_import_from_google_sheet(user, payload));
      case 'student.bulk_import': return _ok(Students_bulk_import(user, payload));

      // Visits
      case 'visit.list': return _ok(Visits_list(user, payload));
      case 'visit.get': return _ok(Visits_get(user, payload.id));
      case 'visit.save': return _ok(Visits_save(user, payload));
      case 'visit.delete': return _ok(Visits_delete(user, payload.id));
      case 'visit.approve': return _ok(Visits_approve(user, payload.id));
      case 'visit.print': return _ok(Visits_print(user, payload.id));
      case 'visit.check_duplicate': return _ok(Visits_check_duplicate(user, payload));

      // Users
      case 'user.list': return _ok(Users_list(user, payload));
      case 'user.upsert': return _ok(Users_upsert(user, payload));
      case 'user.toggle': return _ok(Users_toggleActive(user, payload.id));
      case 'user.reset_password': return _ok(Users_resetPassword(user, payload));

      // Reports
      case 'report.dashboard': return _ok(Reports_dashboard(user, payload));
      case 'report.audit': return _ok(Reports_audit(user, payload));

      // Settings
      case 'setting.get': return _ok(Settings_get(user));
      case 'setting.update': return _ok(Settings_update(user, payload));

      // Mappings
      case 'mapping.list': return _ok(Mappings_list(user, payload));
      case 'mapping.upsert': return _ok(Mappings_upsert(user, payload));
      case 'mapping.delete': return _ok(Mappings_delete(user, payload.id));
      case 'mapping.get_for_student': return _ok(Mappings_getForStudent(user, payload));

      // Files
      case 'file.upload': return _ok(Files_upload(user, payload));

      default: return _err('ไม่พบ action: ' + action);
    }
  } catch (e) {
    return _err(e && e.message ? e.message : String(e));
  }
}
