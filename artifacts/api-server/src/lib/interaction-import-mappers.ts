/**
 * Pure data-transformation utilities for bulk interaction record imports.
 * Supports two CSV/XLSX formats:
 *   - Standard format (English column names)
 *   - Infoset "Talep Detay Raporu" format (Turkish column names)
 */

// ── Turkish month abbreviation → English ─────────────────────────────────────
const TR_MONTHS: Record<string, string> = {
  Oca: "Jan", Şub: "Feb", Mar: "Mar", Nis: "Apr",
  May: "May", Haz: "Jun", Tem: "Jul", Ağu: "Aug",
  Eyl: "Sep", Eki: "Oct", Kas: "Nov", Ara: "Dec",
};

/** Parse a Turkish date string like "27 Şub 2026 16:45" into a Date. */
export function parseTrDate(raw: string): Date | null {
  if (!raw || raw === "-") return null;
  const replaced = raw.replace(/([A-ZÇĞİÖŞÜa-zçğışöşü]{3})/g, (m) => TR_MONTHS[m] ?? m);
  const d = new Date(replaced);
  return isNaN(d.getTime()) ? null : d;
}

/** Detect whether a file is Excel by MIME type or extension. */
export function isExcel(file: Express.Multer.File): boolean {
  const XLSX_MIME = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ]);
  if (XLSX_MIME.has(file.mimetype)) return true;
  const name = file.originalname.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

/** Detect whether a parsed row set is in Infoset format. */
export function isInfosetFormat(records: Record<string, string>[]): boolean {
  if (!records.length) return false;
  const firstKeys = Object.keys(records[0]);
  return firstKeys.includes("Kişi E-postası") || firstKeys.includes("Konu");
}

// ── Mapped row shape ──────────────────────────────────────────────────────────
export interface MappedRow {
  email: string;
  name: string;
  company: string;
  subject: string;
  content: string;
  type: "ticket" | "chat" | "call";
  status: string;
  channel: string;
  agentName: string | null;
  durationSeconds: number | null;
  resolution: string | null;
  interactedAt: Date;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = (row[k] ?? "").trim();
    if (v) return v;
  }
  return "";
}

// ── Infoset format mapper ─────────────────────────────────────────────────────
export function mapInfosetRow(row: Record<string, string>): MappedRow {
  const get = (k: string) => (row[k] ?? "").trim();

  const kaynak = get("Kaynak");
  let channel = "email";
  let type: "ticket" | "chat" | "call" = "ticket";
  if (kaynak === "Çağrı") { channel = "phone"; type = "call"; }
  else if (kaynak === "E-posta") channel = "email";
  else if (kaynak === "WhatsApp" || kaynak === "Canlı Sohbet") { channel = "chat"; type = "chat"; }
  else if (kaynak === "Manuel") channel = "email";
  else if (kaynak) channel = kaynak.toLowerCase();

  const durumRaw = get("Durum");
  const statusMap: Record<string, string> = {
    Açık: "open", Çözüldü: "resolved", Beklemede: "open", İptal: "closed",
  };
  const status = statusMap[durumRaw] ?? "open";

  const agentRaw = get("Atananlar");
  const agentName = agentRaw ? agentRaw.split(",")[0].trim() : null;

  const closedAt = get("Kapanma Tarihi");
  const resolution =
    status === "resolved" && closedAt && closedAt !== "-" ? `Kapanma: ${closedAt}` : null;

  const durationRaw = get("Çözüm Süresi (sn)");
  const durationSeconds =
    durationRaw && durationRaw !== "-" && !isNaN(Number(durationRaw))
      ? Number(durationRaw)
      : null;

  let content = get("Açıklama");
  const parts: string[] = [];
  const kategori = get("Kategoriler") || get("İnfoset - Ana Kategori");
  const altKategori = get("İnfoset - Alt Kategori");
  const konu2 = get("İnfoset - Alt Kategori Talep Konusu");
  const urun = get("Ürün / Modül");
  if (kategori) parts.push(`Kategori: ${kategori}`);
  if (altKategori) parts.push(`Alt Kategori: ${altKategori}`);
  if (konu2) parts.push(`Konu: ${konu2}`);
  if (urun) parts.push(`Ürün/Modül: ${urun}`);
  if (parts.length && content) content = content + "\n\n[" + parts.join(" | ") + "]";
  else if (parts.length) content = "[" + parts.join(" | ") + "]";

  return {
    email: get("Kişi E-postası").toLowerCase(),
    name: get("Kişi") || get("Kişi E-postası"),
    company: get("Şirket"),
    subject: get("Konu"),
    content: content || get("Konu"),
    type,
    status,
    channel,
    agentName,
    durationSeconds,
    resolution,
    interactedAt: parseTrDate(get("Oluşturma Tarihi")) ?? new Date(),
  };
}

// ── Standard format mapper ────────────────────────────────────────────────────
export function mapStandardRow(row: Record<string, string>): MappedRow {
  const email = getField(row, "customer_email", "email", "müşteri_email").toLowerCase();
  const rawType = getField(row, "type", "tür").toLowerCase();
  const type = (["ticket", "chat", "call"].includes(rawType) ? rawType : "ticket") as MappedRow["type"];
  const subject = getField(row, "subject", "konu");
  const content = getField(row, "content", "içerik");
  const rawStatus = getField(row, "status", "durum").toLowerCase();
  const status = ["open", "resolved", "escalated", "closed"].includes(rawStatus) ? rawStatus : "open";
  const channel = getField(row, "channel", "kanal") || "email";
  const agentName = getField(row, "agent_name", "temsilci") || null;
  const durationRaw = getField(row, "duration_seconds", "süre");
  const durationSeconds = durationRaw ? Number(durationRaw) : null;
  const resolution = getField(row, "resolution", "çözüm") || null;
  const interactedAtRaw = getField(row, "interacted_at", "tarih");
  const interactedAt = interactedAtRaw ? new Date(interactedAtRaw) : new Date();
  return { email, name: "", company: "", subject, content, type, status, channel, agentName, durationSeconds, resolution, interactedAt };
}
