export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***@***.***";
  const [local, domain] = email.split("@");
  const maskedLocal = local.length <= 2
    ? "*".repeat(local.length)
    : local[0] + "*".repeat(local.length - 2) + local[local.length - 1];
  const domainParts = domain.split(".");
  const maskedDomain = domainParts[0][0] + "*".repeat(Math.max(domainParts[0].length - 1, 2));
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join(".")}`;
}

export function maskPhone(phone: string): string {
  if (!phone) return "***";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return digits.slice(0, 2) + "*".repeat(digits.length - 4) + digits.slice(-2);
}

export function maskName(name: string): string {
  if (!name) return "***";
  const parts = name.trim().split(/\s+/);
  return parts.map((p, i) =>
    i === 0 ? p[0] + "*".repeat(Math.max(p.length - 1, 2)) : p[0] + "***"
  ).join(" ");
}

export function maskCustomer(c: Record<string, any>, fields: string[] = ["email", "name", "phone"]) {
  const masked = { ...c };
  if (fields.includes("email") && masked.email) masked.email = maskEmail(masked.email);
  if (fields.includes("name") && masked.name) masked.name = maskName(masked.name);
  if (fields.includes("phone") && masked.phone) masked.phone = maskPhone(masked.phone);
  return masked;
}
