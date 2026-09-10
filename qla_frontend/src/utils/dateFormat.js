/**
 * The backend stores/sends timestamps in UTC, but sometimes without an
 * explicit timezone marker (no "Z" or "+00:00" suffix). Without that
 * marker, JavaScript's Date() assumes the string is already in the
 * browser's LOCAL timezone, which shows the wrong (unconverted) time.
 * This wraps every date string so it's always treated as UTC before
 * converting to the viewer's local time.
 */
export function toLocalDateTime(isoString) {
  if (!isoString) return null;
  const hasTimezoneMarker = isoString.includes("Z") || /[+-]\d{2}:\d{2}$/.test(isoString);
  const normalized = hasTimezoneMarker ? isoString : isoString + "Z";
  return new Date(normalized);
}

export function formatDateTime(isoString) {
  const d = toLocalDateTime(isoString);
  return d ? d.toLocaleString() : "—";
}

export function formatDate(isoString) {
  const d = toLocalDateTime(isoString);
  return d ? d.toLocaleDateString() : "—";
}