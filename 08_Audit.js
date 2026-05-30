/**
 * ═══════════════════════════════════════════════════════════════
 *  NOVEL · ระบบคลังคำศัพท์นิยาย
 *  File:        08_Audit.gs — Audit log
 *  Version:     1.0.0
 *  Last Update: 2026-05-12
 *  Developer:   ครูวิรัตน์ หาดคำ · www.kruwirat.com
 *  License:     Proprietary · © 2026
 * ═══════════════════════════════════════════════════════════════
 */

function Audit_log_(user, action, entity, entityId, meta) {
  try {
    DB_insert(SHEETS.AUDIT, {
      ts: cfg_now_(),
      user_id: (user && user.id) || '',
      username: (user && user.username) || '',
      action: action || '',
      entity: entity || '',
      entity_id: entityId || '',
      meta: typeof meta === 'object' ? JSON.stringify(meta) : (meta || '')
    });
  } catch (e) {}
}
