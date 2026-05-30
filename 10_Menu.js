/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        10_Menu.gs — Sheet menu UI + Setup helpers
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏠 ' + APP.SHORT)
      .addItem('🚀 เริ่มใช้งานระบบ', 'menu_initSystem')
      .addItem('🔐 ขออนุญาตสิทธิ์ระบบ', 'menu_grantPermissions')
      .addItem('🔍 ตรวจสถานะสิทธิ์', 'menu_authorize')
      .addSeparator()
      .addItem('🔄 อัปเดต Schema (เพิ่ม field ใหม่)', 'menu_updateSchema')
      .addSeparator()
      .addItem('🌱 เพิ่มข้อมูลตัวอย่าง', 'menu_seedDemo')
      .addItem('🧹 ล้างข้อมูลตัวอย่าง', 'menu_clearDemo')
      .addItem('🔁 รีเซ็ตรหัสผ่าน Demo', 'menu_resetDemoPasswords')
      .addSeparator()
      .addItem('🔥 ติดตั้ง Warm Trigger', 'menu_installWarm')
      .addItem('❄️ ถอด Warm Trigger', 'menu_uninstallWarm')
      .addSeparator()
      .addItem('🔗 เปิด Web App URL', 'menu_openWebApp')
      .addItem('📋 คัดลอก Web App URL', 'menu_copyWebAppUrl')
      .addSeparator()
      .addItem('ℹ️ เกี่ยวกับระบบ (About)', 'menu_about')
      .addToUi();
  } catch (e) {}
}

function menu_initSystem() {
  const ui = SpreadsheetApp.getUi();
  try {
    DB_initAllSchemas();
    Settings_ensureDefaults_();
    Seed_ensureUsers_();
    const admin = DB_findOne(SHEETS.USERS, function (u) { return u.username === 'admin'; });
    Seed_ensureStudents_(admin ? admin.id : '');
    ui.alert('✅ เริ่มใช้งานระบบสำเร็จ',
      'สร้าง schema + seed บัญชี + ข้อมูลตัวอย่างเรียบร้อย\n\n'
      + 'บัญชีทดลอง:\n'
      + '• admin / 123456\n'
      + '• director / 123456\n'
      + '• academic / 123456\n'
      + '• teacher / 123456', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('❌ ผิดพลาด', String(e), ui.ButtonSet.OK);
  }
}

function menu_updateSchema() {
  const ui = SpreadsheetApp.getUi();
  try {
    const before = {};
    Object.keys(SCHEMAS).forEach(function (name) {
      const sh = DB_sheet_(name);
      before[name] = sh.getLastColumn();
    });
    DB_initAllSchemas();
    const report = Object.keys(SCHEMAS).map(function (name) {
      const cur = SCHEMAS[name].length;
      const prev = before[name] || 0;
      const diff = cur - prev;
      return '• ' + name + ': ' + cur + ' columns' + (diff > 0 ? ' (+' + diff + ' ใหม่)' : '');
    }).join('\n');
    ui.alert('✅ อัปเดต Schema เรียบร้อย',
      'ข้อมูลเก่าไม่กระทบ — field ใหม่จะปรากฏท้ายตาราง\n\n' + report,
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('❌ ผิดพลาด', String(e), ui.ButtonSet.OK);
  }
}

function menu_grantPermissions() {
  // ห้ามมี try/catch — ปล่อยให้ GAS แสดง consent dialog
  SpreadsheetApp.getActive().getName();
  DriveApp.getRootFolder().getName();
  Session.getActiveUser().getEmail();
  ScriptApp.getService().getUrl();
  UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
  SpreadsheetApp.getUi().alert('✅ พร้อมใช้งาน',
    'ระบบได้รับสิทธิ์ครบทุกตัว — ใช้งานได้แล้ว',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function menu_authorize() {
  const ui = SpreadsheetApp.getUi();
  const results = [];
  function tryScope(label, fn) {
    try { fn(); results.push('✓ ' + label); }
    catch (e) { results.push('✗ ' + label + ': ' + e.message); }
  }
  tryScope('Spreadsheets', function () { SpreadsheetApp.getActive().getName(); });
  tryScope('Drive', function () { DriveApp.getRootFolder().getName(); });
  tryScope('User Info', function () { Session.getActiveUser().getEmail(); });
  tryScope('Script App', function () { ScriptApp.getService().getUrl(); });
  tryScope('External Request', function () { UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true }); });
  ui.alert('สถานะสิทธิ์', results.join('\n') + '\n\nหากมี ✗ ให้กด "ขออนุญาตสิทธิ์ระบบ"', ui.ButtonSet.OK);
}

function menu_seedDemo() {
  const ui = SpreadsheetApp.getUi();
  try { Seed_demoData(); ui.alert('✅ สำเร็จ', 'เพิ่มข้อมูลตัวอย่างเรียบร้อย', ui.ButtonSet.OK); }
  catch (e) { ui.alert('❌ ผิดพลาด', String(e), ui.ButtonSet.OK); }
}

function menu_clearDemo() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('ล้างข้อมูลตัวอย่าง', 'ลบนักเรียนตัวอย่าง (รหัส S67xxx) ทั้งหมด?', ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;
  Seed_clearDemo();
  ui.alert('✅ สำเร็จ', 'ลบข้อมูลตัวอย่างเรียบร้อย', ui.ButtonSet.OK);
}

function menu_resetDemoPasswords() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.alert('รีเซ็ตรหัสผ่าน Demo', 'รีเซ็ต admin/director/academic/teacher เป็น 123456?', ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;
  const n = Seed_resetDemoPasswords_();
  ui.alert(n + ' บัญชีถูกรีเซ็ตเรียบร้อย', SpreadsheetApp.getUi().ButtonSet.OK);
}

function _warm_() {
  try {
    DB_readAll(SHEETS.SETTINGS);
    DB_readAll(SHEETS.USERS);
    DB_readAll(SHEETS.STUDENTS);
  } catch (e) {}
  return new Date().toISOString();
}
function menu_installWarm() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '_warm_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('_warm_').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert('✅ ติดตั้ง Warm Trigger สำเร็จ');
}
function menu_uninstallWarm() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === '_warm_') ScriptApp.deleteTrigger(t);
  });
  SpreadsheetApp.getUi().alert('✅ ถอด Warm Trigger เรียบร้อย');
}

function menu_openWebApp() {
  const url = ScriptApp.getService().getUrl();
  if (!url) { SpreadsheetApp.getUi().alert('ยังไม่ได้ Deploy เป็น Web App'); return; }
  const html = '<html><body><p>เปิดลิงก์: <a href="' + url + '" target="_blank">' + url + '</a></p>'
    + '<script>window.open("' + url + '","_blank");google.script.host.close();</scr' + 'ipt></body></html>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(120), 'Web App URL');
}
function menu_copyWebAppUrl() {
  const url = ScriptApp.getService().getUrl();
  if (!url) { SpreadsheetApp.getUi().alert('ยังไม่ได้ Deploy เป็น Web App'); return; }
  const html = '<div style="font-family:Kanit,sans-serif;padding:16px">'
    + '<p style="margin:0 0 10px">คัดลอก URL ด้านล่าง:</p>'
    + '<input type="text" value="' + url + '" readonly style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px" onclick="this.select()">'
    + '<p style="margin:12px 0 0;color:#64748b;font-size:12px">กดที่ช่องแล้ว Ctrl+C เพื่อคัดลอก</p>'
    + '</div>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(480).setHeight(180), 'Web App URL');
}

function menu_about() {
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;700;800&family=Sarabun:wght@400;500;600&display=swap" rel="stylesheet">'
    + '<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">'
    + '<style>'
    + 'body{margin:0;font-family:Kanit,Sarabun,system-ui,sans-serif;color:#1e293b;background:#fff}'
    + '.about{padding:24px}'
    + '.ab-head{display:flex;align-items:center;gap:14px;padding-bottom:16px;border-bottom:1px solid #e2e8f0;margin-bottom:16px}'
    + '.ab-logo{width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7);display:flex;align-items:center;justify-content:center;color:#fff;font-size:30px;box-shadow:0 8px 24px rgba(99,102,241,.35)}'
    + '.ab-title{font-size:20px;font-weight:800}'
    + '.ab-version{display:inline-block;padding:2px 10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:99px;font-size:11px;font-weight:700;margin-top:4px}'
    + '.ab-desc{font-size:13px;line-height:1.6;color:#475569;margin-bottom:14px}'
    + '.ab-meta{font-size:12px;color:#64748b;margin-bottom:14px;line-height:1.8}'
    + '.ab-dev{display:flex;align-items:center;gap:14px;padding:14px;background:linear-gradient(135deg,#f1f5f9,#fff);border:1px solid #e2e8f0;border-radius:14px;text-decoration:none;color:inherit;transition:all .2s;margin-bottom:14px}'
    + '.ab-dev:hover{border-color:#a5b4fc;box-shadow:0 8px 20px rgba(99,102,241,.15);transform:translateY(-1px)}'
    + '.ab-dev-photo{width:60px;height:60px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(99,102,241,.3);object-fit:cover;flex-shrink:0}'
    + '.ab-dev-info{flex:1;min-width:0}'
    + '.ab-dev-label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}'
    + '.ab-dev-name{font-size:15px;font-weight:700;color:#1e293b;margin-top:2px}'
    + '.ab-dev-link{font-size:12px;color:#6366f1;font-weight:600;margin-top:4px;display:flex;align-items:center;gap:4px}'
    + '.ab-tech{font-size:11px;color:#64748b;background:#f8fafc;padding:10px 12px;border-radius:10px;border-left:3px solid #6366f1}'
    + '.ab-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}'
    + '.ab-btn{padding:8px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:0;font-family:inherit}'
    + '.ab-btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 6px 14px rgba(99,102,241,.3)}'
    + '</style></head><body>'
    + '<div class="about">'
    + '  <div class="ab-head">'
    + '    <div class="ab-logo"><i class="bi bi-' + APP.LOGO_ICON + '"></i></div>'
    + '    <div><div class="ab-title">' + APP.NAME + '</div>'
    + '         <span class="ab-version">v' + APP.VERSION + '</span></div>'
    + '  </div>'
    + '  <div class="ab-desc">' + APP.DESCRIPTION + '</div>'
    + '  <div class="ab-meta">'
    + '    📅 <strong>อัปเดตล่าสุด:</strong> ' + APP.LAST_UPDATED + '<br>'
    + '    🏢 <strong>องค์กร:</strong> ' + APP.ORG
    + '  </div>'
    + '  <a class="ab-dev" href="' + APP.DEV.URL + '" target="_blank" rel="noopener noreferrer">'
    + '    <img class="ab-dev-photo" src="' + APP.DEV.LOGO + '" alt="" referrerpolicy="no-referrer">'
    + '    <div class="ab-dev-info">'
    + '      <div class="ab-dev-label">ผู้พัฒนาระบบ</div>'
    + '      <div class="ab-dev-name">' + APP.DEV.NAME + '</div>'
    + '      <div class="ab-dev-link"><i class="bi bi-globe"></i> ' + APP.DEV.URL.replace(/^https?:\/\//, '').replace(/\/$/, '') + '</div>'
    + '    </div>'
    + '    <i class="bi bi-arrow-up-right" style="color:#6366f1;font-size:18px"></i>'
    + '  </a>'
    + '  <div class="ab-tech">🔧 Tech: Google Apps Script · V8 · Sheets-as-DB · HTML/CSS/JS SPA</div>'
    + '  <div class="ab-actions">'
    + '    <button class="ab-btn ab-btn-primary" onclick="google.script.host.close()">ปิด</button>'
    + '  </div>'
    + '</div></body></html>';
  var ui = HtmlService.createHtmlOutput(html).setWidth(440).setHeight(580);
  SpreadsheetApp.getUi().showModalDialog(ui, 'เกี่ยวกับ ' + APP.SHORT);
}
