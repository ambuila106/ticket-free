// Configuración central de la aplicación.

/**
 * Correos con acceso total al panel de administración (/admin).
 * El primero es el super-administrador del proyecto.
 */
export const ADMIN_EMAILS = ["ambuila106@gmail.com"];

/** Estados posibles de una boleta/QR. */
export const TICKET_ESTADOS = {
  SIN_VALIDAR: "sin_validar", // Pedido recibido, transferencia sin verificar
  PAGADO: "pagado", // Transferencia verificada por el dueño del evento
  ENTREGADO: "entregado", // QR canjeado en la puerta
  CANCELADO: "cancelado", // Pedido rechazado o anulado
};

export const ROLES = {
  ADMIN: "admin",
  ORGANIZADOR: "organizador",
  COLABORADOR: "colaborador",
  CLIENTE: "cliente",
};

/** Región e ID del proyecto para construir las URLs de las Cloud Functions. */
const FUNCTIONS_REGION = "us-central1";
const PROJECT_ID = "chatonline-4aa0d";

/**
 * Base de las Cloud Functions (2ª gen) a las que llama el front.
 * Se llaman directamente (CORS habilitado), no por los rewrites de Hosting.
 * Sobreescribible con VITE_API_BASE (p. ej. emulador):
 *   VITE_API_BASE=http://127.0.0.1:5001/chatonline-4aa0d/us-central1
 */
export function functionsBaseUrl() {
  const override = import.meta.env.VITE_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return `https://${FUNCTIONS_REGION}-${PROJECT_ID}.cloudfunctions.net`;
}

/** ¿El correo pertenece a un administrador? */
export function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}

/** Normaliza un correo a minúsculas y sin espacios. */
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Convierte un correo en una clave válida para Firebase RTDB
 * (no se permiten . $ # [ ] / en las claves).
 */
export function emailToKey(email) {
  return normalizeEmail(email).replace(/[.#$/[\]@]/g, "_");
}
