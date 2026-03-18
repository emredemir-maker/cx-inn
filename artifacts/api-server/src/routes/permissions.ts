import { Router } from "express";
import { db } from "@workspace/db";
import { rolePermissionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "../middleware/requireRole";
import { requireAuth } from "../middleware/requireRole";

const router = Router();

type RoleKey = "superadmin" | "cx_manager" | "cx_user";

const DEFAULT_PERMISSIONS: Record<RoleKey, Record<string, string>> = {
  superadmin: {
    "module.dashboard": "full", "module.analytics": "full", "module.customers": "full",
    "module.companies": "full", "module.segments": "full", "module.interactions": "full",
    "module.anomalies": "full", "module.surveys": "full", "module.campaigns": "full",
    "module.approvals": "full", "module.audit_logs": "full", "module.settings": "full",
    "module.user_management": "full", "module.ai_analyze_single": "full",
    "module.ai_analyze_bulk": "full", "module.manual": "full",
    "pii.email": "visible", "pii.phone": "visible",
    "action.import_customers": "true", "action.add_interaction": "true",
    "action.exclude_interaction": "true", "action.delete_interaction": "true",
    "action.manage_segments": "true", "action.create_survey": "true",
    "action.edit_survey": "true", "action.create_campaign": "true",
    "action.send_campaign": "true", "action.trigger_survey": "true",
    "action.analyze_single": "true", "action.bulk_analyze": "true",
    "action.nlp_query": "true", "action.ai_personalize": "true",
    "action.invite_user": "true", "action.change_role": "true",
    "action.remove_user": "true", "action.edit_settings": "true",
    "action.manage_api_keys": "true", "action.approve": "true", "action.view_as": "true",
  },
  cx_manager: {
    "module.dashboard": "full", "module.analytics": "full", "module.customers": "full",
    "module.companies": "full", "module.segments": "full", "module.interactions": "full",
    "module.anomalies": "full", "module.surveys": "full", "module.campaigns": "approval",
    "module.approvals": "full", "module.audit_logs": "readonly", "module.settings": "restricted",
    "module.user_management": "none", "module.ai_analyze_single": "full",
    "module.ai_analyze_bulk": "none", "module.manual": "full",
    "pii.email": "visible", "pii.phone": "visible",
    "action.import_customers": "true", "action.add_interaction": "true",
    "action.exclude_interaction": "true", "action.delete_interaction": "true",
    "action.manage_segments": "true", "action.create_survey": "true",
    "action.edit_survey": "true", "action.create_campaign": "true",
    "action.send_campaign": "approval", "action.trigger_survey": "true",
    "action.analyze_single": "true", "action.bulk_analyze": "false",
    "action.nlp_query": "true", "action.ai_personalize": "true",
    "action.invite_user": "false", "action.change_role": "false",
    "action.remove_user": "false", "action.edit_settings": "false",
    "action.manage_api_keys": "false", "action.approve": "true", "action.view_as": "false",
  },
  cx_user: {
    "module.dashboard": "full", "module.analytics": "readonly", "module.customers": "readonly",
    "module.companies": "readonly", "module.segments": "readonly", "module.interactions": "readonly",
    "module.anomalies": "readonly", "module.surveys": "readonly", "module.campaigns": "none",
    "module.approvals": "none", "module.audit_logs": "readonly", "module.settings": "restricted",
    "module.user_management": "none", "module.ai_analyze_single": "none",
    "module.ai_analyze_bulk": "none", "module.manual": "full",
    "pii.email": "masked", "pii.phone": "masked",
    "action.import_customers": "false", "action.add_interaction": "false",
    "action.exclude_interaction": "false", "action.delete_interaction": "false",
    "action.manage_segments": "false", "action.create_survey": "false",
    "action.edit_survey": "false", "action.create_campaign": "false",
    "action.send_campaign": "false", "action.trigger_survey": "false",
    "action.analyze_single": "false", "action.bulk_analyze": "false",
    "action.nlp_query": "false", "action.ai_personalize": "false",
    "action.invite_user": "false", "action.change_role": "false",
    "action.remove_user": "false", "action.edit_settings": "false",
    "action.manage_api_keys": "false", "action.approve": "false", "action.view_as": "false",
  },
};

async function ensureDefaults() {
  const existing = await db.select().from(rolePermissionsTable);
  if (existing.length > 0) return;
  const rows: { role: RoleKey; permissionKey: string; permissionValue: string }[] = [];
  for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
    for (const [key, val] of Object.entries(perms)) {
      rows.push({ role: role as RoleKey, permissionKey: key, permissionValue: val });
    }
  }
  await db.insert(rolePermissionsTable).values(rows);
}

router.get("/permissions", requireAuth, async (req, res) => {
  try {
    await ensureDefaults();
    const rows = await db.select().from(rolePermissionsTable);
    const result: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      if (!result[row.role]) result[row.role] = {};
      result[row.role][row.permissionKey] = row.permissionValue;
    }
    res.json(result);
  } catch (err) {
    console.error("GET /permissions error:", err);
    res.status(500).json({ error: "Yetkiler alınamadı" });
  }
});

router.put("/permissions", requireRole("superadmin"), async (req, res) => {
  try {
    const { role, permissionKey, permissionValue } = req.body as {
      role: RoleKey; permissionKey: string; permissionValue: string;
    };
    if (!role || !permissionKey || !permissionValue) {
      res.status(400).json({ error: "role, permissionKey ve permissionValue gerekli" });
      return;
    }
    if (role === "superadmin") {
      res.status(403).json({ error: "Süper Admin yetkileri değiştirilemez" });
      return;
    }
    await db
      .insert(rolePermissionsTable)
      .values({ role, permissionKey, permissionValue })
      .onConflictDoUpdate({
        target: [rolePermissionsTable.role, rolePermissionsTable.permissionKey],
        set: { permissionValue, updatedAt: new Date() },
      });
    res.json({ success: true });
  } catch (err) {
    console.error("PUT /permissions error:", err);
    res.status(500).json({ error: "Yetki güncellenemedi" });
  }
});

router.post("/permissions/reset", requireRole("superadmin"), async (req, res) => {
  try {
    const { role } = req.body as { role?: RoleKey };
    if (role === "superadmin") {
      res.status(403).json({ error: "Süper Admin yetkileri değiştirilemez" });
      return;
    }
    const rolesToReset = role ? [role] : (["cx_manager", "cx_user"] as RoleKey[]);
    for (const r of rolesToReset) {
      const perms = DEFAULT_PERMISSIONS[r];
      for (const [key, val] of Object.entries(perms)) {
        await db
          .insert(rolePermissionsTable)
          .values({ role: r, permissionKey: key, permissionValue: val })
          .onConflictDoUpdate({
            target: [rolePermissionsTable.role, rolePermissionsTable.permissionKey],
            set: { permissionValue: val, updatedAt: new Date() },
          });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error("POST /permissions/reset error:", err);
    res.status(500).json({ error: "Yetkiler sıfırlanamadı" });
  }
});

export default router;
