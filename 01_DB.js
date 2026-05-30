function DB_ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function DB_sheet_(name, headers) {
  const ss = DB_ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const first = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (first.join("|") !== headers.join("|")) {
      sh.clear();
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sh;
}

function DB_initAllSchemas() {
  Object.keys(SHEETS).forEach(function (k) {
    const sheetName = SHEETS[k];
    DB_sheet_(sheetName, SCHEMAS[sheetName]);
  });
}

function DB_insert_(sheetName, schemaName, rowObj) {
  const sh = DB_sheet_(sheetName, SCHEMAS[schemaName]);
  const cols = SCHEMAS[schemaName];
  const row = cols.map(function (c) {
    return rowObj[c] == null ? "" : rowObj[c];
  });
  sh.appendRow(row);
  return rowObj;
}

function DB_selectAll_(sheetName) {
  const sh = DB_sheet_(sheetName, SCHEMAS[sheetName]);
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  const head = values[0];
  return values.slice(1).map(function (r) {
    const o = {};
    head.forEach(function (h, i) {
      o[h] = r[i];
    });
    return o;
  });
}

function DB_findBy_(sheetName, key, val) {
  return DB_selectAll_(sheetName).filter(function (r) {
    return String(r[key]) === String(val);
  });
}
