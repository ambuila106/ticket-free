/**
 * Lista de códigos QR de un ticket (compatibilidad: solo secureCode en tickets viejos).
 * Normaliza si Firebase devolvió secureCodes como objeto con claves "0","1",...
 */
export function getTicketSecureCodes(ticket) {
  if (!ticket) return [];
  let raw = ticket.secureCodes;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    raw = Object.keys(raw)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k]);
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c) => String(c).trim()).filter(Boolean);
  }
  if (ticket.secureCode) return [String(ticket.secureCode).trim()].filter(Boolean);
  return [];
}

/** Texto corto para listados (primer código + sufijo si hay más). */
export function formatCodesPreview(ticket, len = 12) {
  const codes = getTicketSecureCodes(ticket);
  if (!codes.length) return "—";
  const first = String(codes[0]).substring(0, len);
  if (codes.length === 1) return first;
  return `${first} (+${codes.length - 1})`;
}

/** ¿Este código pertenece al ticket? */
export function ticketHasCode(ticket, code) {
  if (!code) return false;
  return getTicketSecureCodes(ticket).includes(code);
}
