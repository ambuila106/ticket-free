import { ref, get, update } from "firebase/database";
import { database } from "../firebase/config";
import { authService } from "./authService";
import { isAdminEmail } from "../config/appConfig";

/**
 * Servicio del panel de administración (/admin).
 * Solo accesible para los correos definidos en ADMIN_EMAILS.
 */
export const adminService = {
  /** ¿El usuario actual es administrador? */
  isCurrentUserAdmin() {
    const user = authService.getCurrentUser();
    return isAdminEmail(user?.email);
  },

  /** Lista todos los usuarios que han iniciado sesión. */
  async listUsers() {
    const snap = await get(ref(database, "appUsers"));
    if (!snap.exists()) return [];
    const data = snap.val();
    return Object.values(data).sort(
      (a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0)
    );
  },

  /** Activa/desactiva la función de organizador para un usuario. */
  async setOrganizerEnabled(uid, enabled) {
    await update(ref(database, `appUsers/${uid}`), {
      organizerEnabled: !!enabled,
      organizerUpdatedAt: Date.now(),
    });
  },

  /** Lista todos los eventos del catálogo (eventsIndex). */
  async listEvents() {
    const snap = await get(ref(database, "eventsIndex"));
    if (!snap.exists()) return [];
    const data = snap.val();
    const events = [];
    for (const ownerUid in data) {
      const discotecas = data[ownerUid] || {};
      for (const discotecaId in discotecas) {
        const eventos = discotecas[discotecaId] || {};
        for (const eventoId in eventos) {
          events.push({ ownerUid, discotecaId, eventoId, ...eventos[eventoId] });
        }
      }
    }
    return events.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  /** Muestra u oculta un evento en la landing pública (/eventos). */
  async setShowOnHome(ownerUid, discotecaId, eventoId, value) {
    await update(
      ref(database, `eventsIndex/${ownerUid}/${discotecaId}/${eventoId}`),
      { showOnHome: !!value }
    );
  },

  /** Lista todos los comprobantes de todos los eventos (para el admin). */
  async listAllComprobantes() {
    const snap = await get(ref(database, "comprobantes"));
    if (!snap.exists()) return [];
    const data = snap.val();
    const items = [];
    for (const ownerUid in data) {
      const porTicket = data[ownerUid] || {};
      for (const ticketId in porTicket) {
        items.push({ ownerUid, ticketId, ...porTicket[ticketId] });
      }
    }
    return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },
};
