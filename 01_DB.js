/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        01_DB.gs — Database layer (Sheet-as-DB) + Cache + Index
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function DB_ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function _bumpVer_(key) {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(String(key || 'db'), String(Date.now()), 21600);
  } catch (e) {}
  return true;
}

function DB_sheet_(name) {
  const ss = DB_ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function DB_ensureSchema_(name) {
  const sh = DB_sheet_(name);
  const cols = SCHEMAS[name];
  if (!cols) throw new Error('ไม่พบ schema: ' + name);
  const last = sh.getLastColumn();
  if (last < cols.length) {
    const range = sh.getRange(1, 1, 1, cols.length);
    range.setValues([cols]);
    range.setFontWeight('bold').setBackground('#1e293b').setFontColor('#fff').setHorizontalAlignment('center');
    sh.setFrozenRows(1);
  } else {
    const head = sh.getRange(1, 1, 1, cols.length).getValues()[0];
    let mismatched = false;
    for (let i = 0; i < cols.length; i++) if (head[i] !== cols[i]) { mismatched = true; break; }
    if (mismatched) sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  }
  // Force text format for sensitive columns
  cols.forEach(function (c, i) {
    if (TEXT_COLUMNS.indexOf(c) >= 0) {
      try { sh.getRange(2, i + 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); } catch (e) {}
    }
  });
  return sh;
}

function DB_initAllSchemas() {
  Object.keys(SCHEMAS).forEach(function (k) { DB_ensureSchema_(k); });
  return Object.keys(SCHEMAS);
}

function DB_readAll(name) {
  const sh = DB_ensureSchema_(name);
  const cols = SCHEMAS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  const result = values.map(function (row) {
    const obj = {};
    for (let i = 0; i < cols.length; i++) {
      let v = row[i];
      if (v instanceof Date) v = cfg_iso_(v);
      obj[cols[i]] = v == null ? '' : v;
    }
    return obj;
  }).filter(function (o) {
    let keyCol = cols.indexOf('id'); if (keyCol < 0) keyCol = 0;
    return String(o[cols[keyCol]] || '').trim() !== '';
  });
  return result;
}

function DB_buildIndex(name) {
  const cols = SCHEMAS[name];
  let keyIdx = cols.indexOf('id');
  if (keyIdx < 0) keyIdx = 0;
  const keyCol = cols[keyIdx];
  const rows = DB_readAll(name);
  const map = {};
  rows.forEach(function (r) {
    const k = String(r[keyCol] || '').trim();
    if (k) map[k] = r;
  });
  return map;
}

function DB_findById(name, id) {
  if (!id) return null;
  const idx = DB_buildIndex(name);
  return idx[String(id)] || null;
}

function DB_findOne(name, predicate) {
  const rows = DB_readAll(name);
  for (let i = 0; i < rows.length; i++) if (predicate(rows[i])) return rows[i];
  return null;
}

function DB_filter(name, predicate) {
  return DB_readAll(name).filter(predicate);
}

function DB_insert(name, data) {
  const sh = DB_ensureSchema_(name);
  const cols = SCHEMAS[name];
  const obj = {};
  cols.forEach(function (c) { obj[c] = (data && c in data) ? data[c] : ''; });
  let keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  if (!obj[cols[keyIdx]]) obj[cols[keyIdx]] = (cols[keyIdx] === 'id' || cols[keyIdx] === 'token') ? cfg_token_() : '';
  if ('created_at' in obj && !obj.created_at) obj.created_at = cfg_now_();
  if ('updated_at' in obj && !obj.updated_at) obj.updated_at = obj.created_at || cfg_now_();
  const row = cols.map(function (c) {
    const v = obj[c];
    if (typeof v === 'object' && v !== null) return JSON.stringify(v);
    return v == null ? '' : v;
  });
  const newRow = sh.getLastRow() + 1;
  const range = sh.getRange(newRow, 1, 1, cols.length);
  range.setNumberFormat('@');
  range.setValues([row]);
  return obj;
}

function DB_update(name, id, patch) {
  const sh = DB_ensureSchema_(name);
  const cols = SCHEMAS[name];
  let keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  const last = sh.getLastRow();
  if (last < 2) return null;
  const values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][keyIdx]) === String(id)) {
      const obj = {};
      for (let j = 0; j < cols.length; j++) obj[cols[j]] = values[i][j];
      Object.keys(patch || {}).forEach(function (k) {
        if (cols.indexOf(k) >= 0) {
          const v = patch[k];
          obj[k] = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
        }
      });
      if ('updated_at' in obj) obj.updated_at = cfg_now_();
      const newRow = cols.map(function (c) { return obj[c] == null ? '' : obj[c]; });
      const range = sh.getRange(i + 2, 1, 1, cols.length);
      range.setNumberFormat('@');
      range.setValues([newRow]);
      const out = {};
      for (let k = 0; k < cols.length; k++) out[cols[k]] = newRow[k];
      return out;
    }
  }
  return null;
}

function DB_delete(name, id) {
  const sh = DB_ensureSchema_(name);
  const cols = SCHEMAS[name];
  let keyIdx = cols.indexOf('id'); if (keyIdx < 0) keyIdx = 0;
  const last = sh.getLastRow();
  if (last < 2) return false;
  const values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][keyIdx]) === String(id)) {
      sh.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function DB_deleteWhere(name, predicate) {
  const sh = DB_ensureSchema_(name);
  const cols = SCHEMAS[name];
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  const toDelete = [];
  for (let i = 0; i < values.length; i++) {
    const obj = {};
    for (let j = 0; j < cols.length; j++) obj[cols[j]] = values[i][j];
    if (predicate(obj)) toDelete.push(i + 2);
  }
  // Delete from bottom up to keep indices stable
  for (let i = toDelete.length - 1; i >= 0; i--) sh.deleteRow(toDelete[i]);
  return toDelete.length;
}
