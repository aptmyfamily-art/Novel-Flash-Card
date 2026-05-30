function doGet() {
  DB_initAllSchemas();
  Settings_ensureDefaults_();
  Seed_ensureUsers_();
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

    switch (action) {
      case 'app.bootstrap': return _ok(Auth_bootstrap(token));
      case 'app.ping': return _ok({ time: cfg_now_(), version: APP.VERSION });
      case 'auth.login': return _ok(Auth_login(payload));
      case 'auth.logout': return _ok(Auth_logout(token));
    }

    const user = Auth_verify_(token);

    switch (action) {
      case 'auth.change_password': return _ok(Auth_changePassword(user, payload));
      case 'profile.update': return _ok(Auth_updateProfile(user, payload));

      case 'user.list': return _ok(Users_list(user, payload));
      case 'user.upsert': return _ok(Users_upsert(user, payload));
      case 'user.toggle': return _ok(Users_toggleActive(user, payload.id));
      case 'user.reset_password': return _ok(Users_resetPassword(user, payload));

      case 'setting.get': return _ok(Settings_get(user));
      case 'setting.update': return _ok(Settings_update(user, payload));

      case 'report.audit': return _ok(Reports_audit(user, payload));

      case 'file.upload': return _ok(Files_upload(user, payload));

      case 'dictionary.summary': return _ok(Dictionary_summary(user, payload));
      case 'dictionary.import_progress': return _ok(Dictionary_import_progress(user, payload));
      case 'dictionary.import_yomitan': return _ok(Dictionary_import_yomitan(user, payload));

      default: return _err('ไม่พบ action: ' + action);
    }
  } catch (e) {
    return _err(e && e.message ? e.message : String(e));
  }
}
