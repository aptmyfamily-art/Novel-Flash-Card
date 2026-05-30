/**
 * ═══════════════════════════════════════════════════════════════
 *  SHVR · ระบบบันทึกการเยี่ยมบ้านนักเรียน
 *  File:        05_Files.gs — File upload to Drive (lh3 URL)
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Files_folder_() {
  const settings = Settings_map_();
  const rootId = String(settings.drive_root_id || '').trim();
  if (rootId) {
    try {
      return DriveApp.getFolderById(rootId);
    } catch (e) {
      throw new Error('ไม่พบโฟลเดอร์หลักใน Google Drive ตามไอดีที่กำหนดไว้ (' + rootId + ') หรือคุณไม่มีสิทธิ์เข้าถึง: ' + e.message);
    }
  }
  const ss = DB_ss_();
  const file = DriveApp.getFileById(ss.getId());
  const parents = file.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const folderName = ss.getName();

  // Cache folder id to avoid repeated getFoldersByName() scans (slow in batch Drive saves)
  const cacheKey = 'driveFolder:root:' + folderName;
  const props = PropertiesService.getScriptProperties();
  const cachedId = String(props.getProperty(cacheKey) || '').trim();
  if (cachedId) {
    try { return DriveApp.getFolderById(cachedId); } catch (e) { props.deleteProperty(cacheKey); }
  }

  const it = parent.getFoldersByName(folderName);
  const folder = it.hasNext() ? it.next() : parent.createFolder(folderName);
  try { props.setProperty(cacheKey, folder.getId()); } catch (e) {}
  return folder;
}

function Files_subfolder_(name) {
  const root = Files_folder_();
  const folderName = name === 'uploads' ? 'asset' : name;

  const cacheKey = 'driveFolder:sub:' + root.getId() + ':' + folderName;
  const props = PropertiesService.getScriptProperties();
  const cachedId = String(props.getProperty(cacheKey) || '').trim();
  if (cachedId) {
    try { return DriveApp.getFolderById(cachedId); } catch (e) { props.deleteProperty(cacheKey); }
  }

  const it = root.getFoldersByName(folderName);
  const folder = it.hasNext() ? it.next() : root.createFolder(folderName);
  try { props.setProperty(cacheKey, folder.getId()); } catch (e) {}
  return folder;
}

function Files_year_folder_(year) {
  const root = Files_folder_();
  const folderName = year || 'Unknown_Year';

  const cacheKey = 'driveFolder:year:' + root.getId() + ':' + folderName;
  const props = PropertiesService.getScriptProperties();
  const cachedId = String(props.getProperty(cacheKey) || '').trim();
  if (cachedId) {
    try { return DriveApp.getFolderById(cachedId); } catch (e) { props.deleteProperty(cacheKey); }
  }

  const it = root.getFoldersByName(folderName);
  const folder = it.hasNext() ? it.next() : root.createFolder(folderName);
  try { props.setProperty(cacheKey, folder.getId()); } catch (e) {}
  return folder;
}

function Files_upload(user, p) {
  Auth_requireCap(user, 'file.upload');
  if (!p || !p.data) throw new Error('ไม่พบข้อมูลไฟล์');
  const dataUrl = String(p.data);
  
  // More robust Data URL parsing
  const parts = dataUrl.split(',');
  if (parts.length < 2 || !parts[0].startsWith('data:')) {
    throw new Error('รูปแบบไฟล์ไม่ถูกต้อง (ต้องเป็น data URL)');
  }
  
  const header = parts[0];
  const base64Data = parts[1];
  
  // Extract MIME type
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mime, p.name || ('upload_' + Date.now()));
  const sub = p.subfolder || 'uploads';
  let folder;
  if (/^\d{4}$/.test(sub)) {
    folder = Files_year_folder_(sub);
  } else {
    folder = Files_subfolder_(sub);
  }
  
  if (p.overwrite) {
    const existing = folder.getFilesByName(p.name);
    while (existing.hasNext()) existing.next().setTrashed(true);
  }
  
  const file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  const id = file.getId();
  const url = 'https://lh3.googleusercontent.com/d/' + id;
  Audit_log_(user, 'file.upload', 'file', id, { name: p.name, mime: mime, sub: sub });
  return { id: id, url: url, name: p.name || file.getName(), mime: mime, size: bytes.length };
}
