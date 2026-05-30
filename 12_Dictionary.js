function Dictionary_jobKey_(jobId) {
  return 'dictionary_import_job:' + String(jobId || '');
}

function Dictionary_jobSave_(job) {
  job = job || {};
  job.updated_at = cfg_now_();
  PropertiesService.getScriptProperties().setProperty(Dictionary_jobKey_(job.job_id), JSON.stringify(job));
  return job;
}

function Dictionary_jobLoad_(jobId) {
  const raw = PropertiesService.getScriptProperties().getProperty(Dictionary_jobKey_(jobId));
  if (!raw) return null;
  return JSON.parse(raw);
}

function Dictionary_jobDelete_(jobId) {
  PropertiesService.getScriptProperties().deleteProperty(Dictionary_jobKey_(jobId));
}

function Dictionary_progressPercent_(processed, total) {
  if (!total || total < 1) return 100;
  return Math.max(0, Math.min(100, Math.floor((processed / total) * 100)));
}

function Dictionary_jobPublic_(job) {
  job = job || {};
  return {
    job_id: job.job_id || '',
    status: job.status || 'pending',
    percent: Number(job.percent || 0),
    message: job.message || 'กำลังรอเริ่มงาน',
    source_title: job.source_title || '',
    total: Number(job.total_entries || 0),
    processed: Number(job.processed || 0),
    inserted: Number(job.inserted || 0),
    current_file: job.current_file || '',
    drive_file_id: job.drive_file_id || '',
    batch_id: job.batch_id || '',
    updated_at: job.updated_at || ''
  };
}

function Dictionary_jobFolder_(jobId) {
  const root = Files_subfolder_('imports');
  const it = root.getFoldersByName('job_' + jobId);
  return it.hasNext() ? it.next() : root.createFolder('job_' + jobId);
}

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

function Dictionary_import_progress(user, p) {
  Auth_requireCap(user, 'file.manage');
  p = p || {};
  const job = Dictionary_jobLoad_(p.job_id);
  return job ? Dictionary_jobPublic_(job) : {
    job_id: String(p.job_id || ''),
    status: 'pending',
    percent: 0,
    message: 'กำลังรอเริ่มงาน',
    total: 0,
    processed: 0,
    inserted: 0,
    current_file: ''
  };
}

function Dictionary_import_start(user, p) {
  Auth_requireCap(user, 'file.manage');
  p = p || {};

  if (!p.file_id) throw new Error('ไม่พบไฟล์สำหรับเริ่ม import');

  const driveFile = DriveApp.getFileById(String(p.file_id));
  const fileName = String(p.name || driveFile.getName() || 'dictionary.zip').trim();
  const titleOverride = String(p.title || '').trim();
  const replaceExisting = p.replace_existing !== false;
  const jobId = cfg_uuid_();
  const batchId = cfg_uuid_();
  const jobFolder = Dictionary_jobFolder_(jobId);
  const blob = driveFile.getBlob();

  let job = Dictionary_jobSave_({
    job_id: jobId,
    batch_id: batchId,
    status: 'preparing',
    percent: 2,
    message: 'กำลังเตรียมไฟล์จาก Drive',
    drive_file_id: driveFile.getId(),
    drive_file_name: fileName,
    replace_existing: replaceExisting,
    source_title: titleOverride || '',
    temp_folder_id: jobFolder.getId(),
    term_files: [],
    total_entries: 0,
    processed: 0,
    inserted: 0,
    current_file_index: 0,
    current_offset: 0,
    replace_done: false,
    created_at: cfg_now_()
  });

  const extracted = Dictionary_extractJsonFilesToDrive_(blob, fileName, jobFolder);
  if (!extracted.termFiles.length) throw new Error('ไม่พบไฟล์ term_bank_*.json ในพจนานุกรมนี้');

  job.source_title = titleOverride || extracted.indexTitle || fileName.replace(/\.[^.]+$/, '');
  job.term_files = extracted.termFiles;
  job.total_entries = extracted.totalEntries;
  job.status = 'queued';
  job.percent = 5;
  job.message = 'เตรียมข้อมูลเสร็จแล้ว พร้อมเริ่ม import';
  job.current_file = extracted.termFiles.length ? extracted.termFiles[0].name : '';
  Dictionary_jobSave_(job);

  return Dictionary_jobPublic_(job);
}

function Dictionary_import_tick(user, p) {
  Auth_requireCap(user, 'file.manage');
  p = p || {};

  const job = Dictionary_jobLoad_(p.job_id);
  if (!job) throw new Error('ไม่พบงาน import นี้');
  if (job.status === 'done' || job.status === 'error') return Dictionary_jobPublic_(job);

  if (!job.replace_done && job.replace_existing) {
    job.status = 'replacing';
    job.message = 'กำลังล้างข้อมูล source เดิม';
    job.percent = Math.max(5, job.percent || 5);
    Dictionary_jobSave_(job);
    DB_deleteWhere(SHEETS.DICTIONARY_ENTRIES, function (row) {
      return String(row.source_title || '') === String(job.source_title || '');
    });
    job.replace_done = true;
  }

  const chunkSize = Math.min(1000, Math.max(200, Number(p.chunk_size || 800)));
  while (job.current_file_index < job.term_files.length) {
    const fileMeta = job.term_files[job.current_file_index];
    const file = DriveApp.getFileById(fileMeta.id);
    const entries = Dictionary_parseJsonBlob_(file.getBlob());
    const start = Number(job.current_offset || 0);
    const slice = entries.slice(start, start + chunkSize);

    if (!slice.length) {
      job.current_file_index++;
      job.current_offset = 0;
      job.current_file = job.current_file_index < job.term_files.length ? job.term_files[job.current_file_index].name : '';
      continue;
    }

    const rows = slice.map(function (entry, idx) {
      return Dictionary_mapTermEntry_(entry, {
        batch_id: job.batch_id,
        source_title: job.source_title,
        source_file: fileMeta.name,
        source_index: start + idx
      });
    });

    job.status = 'importing';
    job.message = 'กำลังนำเข้า ' + fileMeta.name;
    job.current_file = fileMeta.name;
    DB_insertMany(SHEETS.DICTIONARY_ENTRIES, rows);
    job.inserted += rows.length;
    job.processed += rows.length;
    job.current_offset = start + rows.length;
    job.percent = Dictionary_progressPercent_(job.processed, job.total_entries);
    Dictionary_jobSave_(job);

    if (job.current_offset >= entries.length) {
      job.current_file_index++;
      job.current_offset = 0;
      job.current_file = job.current_file_index < job.term_files.length ? job.term_files[job.current_file_index].name : '';
    }

    return Dictionary_jobPublic_(job);
  }

  job.status = 'done';
  job.percent = 100;
  job.message = 'นำเข้าสำเร็จ';
  job.current_file = '';
  Dictionary_jobSave_(job);
  Audit_log_(user, 'dictionary.import_yomitan', 'dictionary', job.batch_id, {
    source_title: job.source_title,
    source_files: job.term_files.map(function (x) { return x.name; }),
    inserted: job.inserted,
    drive_file_id: job.drive_file_id
  });

  try {
    DriveApp.getFolderById(job.temp_folder_id).setTrashed(true);
  } catch (e) {}

  return Dictionary_jobPublic_(job);
}

function Dictionary_import_yomitan(user, p) {
  return Dictionary_import_tick(user, p || {});
}

function Dictionary_extractJsonFilesToDrive_(blob, fileName, folder) {
  const name = String(fileName || blob.getName() || '').toLowerCase();
  const out = { indexTitle: '', termFiles: [], totalEntries: 0 };

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
        const driveFile = folder.createFile(child.setName(childName));
        out.termFiles.push({ id: driveFile.getId(), name: childName, entries: parsed.length });
        out.totalEntries += parsed.length;
      }
    });
    return out;
  }

  const parsed = Dictionary_parseJsonBlob_(blob);
  if (Array.isArray(parsed)) {
    const driveFile = folder.createFile(blob.getCopyBlob().setName(fileName || blob.getName() || 'term_bank.json'));
    out.termFiles.push({ id: driveFile.getId(), name: fileName || blob.getName() || 'term_bank.json', entries: parsed.length });
    out.totalEntries = parsed.length;
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
