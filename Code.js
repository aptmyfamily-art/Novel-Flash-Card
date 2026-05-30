/**
 * ═══════════════════════════════════════════════════════════════
 *  NOVEL · ระบบคลังคำศัพท์นิยาย
 *  File:        Code.gs — Web App entry + API router (single endpoint)
 *  Version:     1.0.0
 *  Last Update: 2025-03-05
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function doGet(e) {
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
      case 'app.bootstrap': return _ok(APP.USE_MOCK_DATA ? Mock_bootstrap_() : Auth_bootstrap(token));
      case 'app.ping': return _ok({ time: cfg_now_(), version: APP.VERSION });
      case 'auth.login': return _ok(APP.USE_MOCK_DATA ? Mock_login_(payload) : Auth_login(payload));
      case 'auth.logout': return _ok(APP.USE_MOCK_DATA ? Mock_logout_() : Auth_logout(token));
    }

    // ── Authenticated endpoints ──
    if (APP.USE_MOCK_DATA) {
      switch (action) {
        case 'file.create_doc': return _ok(Files_createDoc(Mock_user_(), payload));
        case 'file.upload': return _ok(Files_upload(Mock_user_(), payload));
        default: return _err('Preview mode ยังไม่เปิดใช้งานฟังก์ชันนี้');
      }
    }
    const user = Auth_verify_(token);

    switch (action) {
      case 'auth.change_password': return _ok(Auth_changePassword(user, payload));
      case 'profile.update': return _ok(Auth_updateProfile(user, payload));

      // Users
      case 'user.list': return _ok(Users_list(user, payload));
      case 'user.upsert': return _ok(Users_upsert(user, payload));
      case 'user.toggle': return _ok(Users_toggleActive(user, payload.id));
      case 'user.reset_password': return _ok(Users_resetPassword(user, payload));

      // Settings
      case 'setting.get': return _ok(Settings_get(user));
      case 'setting.update': return _ok(Settings_update(user, payload));

      // Files
      case 'file.upload': return _ok(Files_upload(user, payload));
      case 'file.create_doc': return _ok(Files_createDoc(user, payload));

      default: return _err('ไม่พบ action: ' + action);
    }
  } catch (e) {
    return _err(e && e.message ? e.message : String(e));
  }
}
