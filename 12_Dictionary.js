function Dictionary_summary(user) {
  Auth_requireCap(user, 'setting.read');
  const rows = DB_readAll(SHEETS.DICTIONARY_ENTRIES);
  const bySource = {};

  rows.forEach(function (row) {
    const key = String(row.source_title || '').trim() || '(untitled)';
    if (!bySource[key]) bySource[key] = { source_title: key, entries: 0, updated_at: row.created_at || '' };
    bySource[key].entries++;
    if (String(row.created_at || '') > String(bySource[key].updated_at || '')) bySource[key].updated_at = row.created_at || '';
  });

  const sources = Object.keys(bySource).map(function (key) { return bySource[key]; })
    .sort(function (a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); });

  return {
    total_entries: rows.length,
    total_sources: sources.length,
    latest_batch_size: sources.length ? (sources[0].entries || 0) : 0,
    sources: sources.slice(0, 20)
  };
}

function Dictionary_import_yomitan(user, p) {
  Auth_requireCap(user, 'file.manage');
  p = p || {};

  if (!p.data) throw new Error('กรุณาอัปโหลดไฟล์พจนานุกรมก่อนนำเข้า');

  const fileName = String(p.name || 'dictionary.zip').trim();
  const titleOverride = String(p.title || '').trim();
  const replaceExisting = p.replace_existing !== false;
  const blob = Dictionary_blobFromDataUrl_(String(p.data), fileName);
  const files = Dictionary_extractJsonFiles_(blob, fileName);

  if (!files.termBanks.length) throw new Error('ไม่พบไฟล์ term_bank_*.json ในพจนานุกรมนี้');

  const sourceTitle = titleOverride || files.indexTitle || fileName.replace(/\.[^.]+$/, '');
  const batchId = cfg_uuid_();

  if (replaceExisting) {
    DB_deleteWhere(SHEETS.DICTIONARY_ENTRIES, function (row) {
      return String(row.source_title || '') === sourceTitle;
    });
  }

  const chunkSize = 500;
  let inserted = 0;
  files.termBanks.forEach(function (file) {
    const batch = [];
    file.entries.forEach(function (entry, idx) {
      batch.push(Dictionary_mapTermEntry_(entry, {
        batch_id: batchId,
        source_title: sourceTitle,
        source_file: file.name,
        source_index: idx
      }));
      if (batch.length >= chunkSize) {
        inserted += DB_insertMany(SHEETS.DICTIONARY_ENTRIES, batch);
        batch.length = 0;
      }
    });
    if (batch.length) inserted += DB_insertMany(SHEETS.DICTIONARY_ENTRIES, batch);
  });

  Audit_log_(user, 'dictionary.import_yomitan', 'dictionary', batchId, {
    source_title: sourceTitle,
    source_files: files.termBanks.map(function (x) { return x.name; }),
    inserted: inserted
  });

  return {
    ok: true,
    batch_id: batchId,
    source_title: sourceTitle,
    source_files: files.termBanks.map(function (x) { return x.name; }),
    inserted: inserted,
    replaced_existing: replaceExisting
  };
}

function Dictionary_blobFromDataUrl_(dataUrl, fileName) {
  const parts = String(dataUrl || '').split(',');
  if (parts.length < 2 || parts[0].indexOf('data:') !== 0) {
    throw new Error('รูปแบบไฟล์ที่อัปโหลดไม่ถูกต้อง');
  }
  const mimeMatch = parts[0].match(/^data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bytes = Utilities.base64Decode(parts[1]);
  return Utilities.newBlob(bytes, mime, fileName || 'dictionary.bin');
}

function Dictionary_extractJsonFiles_(blob, fileName) {
  const name = String(fileName || blob.getName() || '').toLowerCase();
  const out = { indexTitle: '', termBanks: [] };

  if (/\.zip$/i.test(name) || blob.getContentType() === 'application/zip' || blob.getContentType() === 'application/x-zip-compressed') {
    Utilities.unzip(blob).forEach(function (child) {
      const childName = String(child.getName() || '');
      if (!/\.json$/i.test(childName)) return;
      const parsed = Dictionary_parseJsonBlob_(child);
      if (/^index\.json$/i.test(childName) && parsed && !Array.isArray(parsed)) {
        out.indexTitle = String(parsed.title || parsed.name || '').trim();
        return;
      }
      if (/^term_bank_.*\.json$/i.test(childName) && Array.isArray(parsed)) {
        out.termBanks.push({ name: childName, entries: parsed });
      }
    });
    return out;
  }

  const parsed = Dictionary_parseJsonBlob_(blob);
  if (Array.isArray(parsed)) {
    out.termBanks.push({ name: fileName || blob.getName() || 'term_bank.json', entries: parsed });
    return out;
  }

  throw new Error('ไฟล์ที่อัปโหลดต้องเป็น JSON array หรือ ZIP ของพจนานุกรม Yomitan');
}

function Dictionary_parseJsonBlob_(blob) {
  let text = blob.getDataAsString('UTF-8');
  text = text.replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function Dictionary_mapTermEntry_(entry, meta) {
  if (!Array.isArray(entry) || entry.length < 6) {
    throw new Error('พบรูปแบบ entry ที่ไม่รองรับใน term bank');
  }

  const glossary = Array.isArray(entry[5]) ? entry[5] : [];
  return {
    batch_id: meta.batch_id,
    source_title: meta.source_title,
    source_file: meta.source_file,
    term: String(entry[0] == null ? '' : entry[0]),
    reading: String(entry[1] == null ? '' : entry[1]),
    definition_tags: String(entry[2] == null ? '' : entry[2]),
    rules: String(entry[3] == null ? '' : entry[3]),
    score: entry[4] == null ? '' : entry[4],
    glossary: Dictionary_glossaryText_(glossary),
    glossary_json: JSON.stringify(glossary),
    sequence: entry.length > 6 && entry[6] != null ? entry[6] : '',
    term_tags: entry.length > 7 && entry[7] != null ? String(entry[7]) : '',
    source_index: meta.source_index,
    raw_json: '',
    created_at: cfg_now_()
  };
}

function Dictionary_glossaryText_(glossary) {
  return glossary.map(function (item) {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return String(item == null ? '' : item);
    if (typeof item.content === 'string') return item.content;
    if (item.content != null) return JSON.stringify(item.content);
    return JSON.stringify(item);
  }).join(' | ');
}
