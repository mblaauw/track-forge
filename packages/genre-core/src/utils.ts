export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Encode key+scale into a display string ("C" or "Cm"). */
export function encodeKey(key: string, scale: string): string {
  if (!key || key === "auto") return "";
  return scale === "minor" ? `${key}m` : key;
}

/** Decode a select-format key string ("C maj") into components and validate scale. */
export function decodeKeyValue(
  keyValue: string,
  scaleRaw?: string,
): { key: string; scale: "major" | "minor" } {
  const parts = (keyValue ?? "C").split(" ");
  const key = parts[0] ?? "C";
  const scaleHint = parts[1] ?? (scaleRaw ?? "major");
  const scale =
    scaleHint === "min" || scaleHint === "minor" ? "minor" : "major";
  return { key, scale };
}
