const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-01-01" -> "1 Jan 2024". Empty or odd values are returned as-is (or "Undated"). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Undated";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function deptLabel(d: string | null | undefined): string {
  if (!d) return "All";
  if (d === "common") return "Common";
  return d.toUpperCase();
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}
