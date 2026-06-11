import { ref, get, update } from "firebase/database";
import { database } from "../firebase/config";
import { isAdminEmail, normalizeEmail } from "../config/appConfig";

/**
 * Servicio del registro de usuarios (appUsers).
 * Cada vez que alguien inicia sesión se registra/actualiza aquí, lo que
 * permite al administrador ver cuántos usuarios han entrado y gestionar
 * el permiso de "organizador".
 */
export const userService = {
  /** Registra/actualiza al usuario tras iniciar sesión. */
  async registerLogin(user) {
    if (!user?.uid) return null;
    const userRef = ref(database, `appUsers/${user.uid}`);
    const now = Date.now();
    let prev = {};
    try {
      const snap = await get(userRef);
      if (snap.exists()) prev = snap.val() || {};
    } catch (_) {
      prev = {};
    }

    const payload = {
      uid: user.uid,
      email: user.email || "",
      emailLower: normalizeEmail(user.email),
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      firstLoginAt: prev.firstLoginAt || now,
      lastLoginAt: now,
      loginCount: (Number(prev.loginCount) || 0) + 1,
    };

    try {
      await update(userRef, payload);
    } catch (error) {
      console.warn("No se pudo registrar el login en appUsers:", error);
    }
    return payload;
  },

  /**
   * Garantiza que el usuario exista en appUsers (para sesiones ya iniciadas
   * antes de esta función). No infla el contador de logins si ya existe.
   */
  async ensureRegistered(user) {
    if (!user?.uid) return null;
    try {
      const userRef = ref(database, `appUsers/${user.uid}`);
      const snap = await get(userRef);
      if (snap.exists()) {
        await update(userRef, {
          email: user.email || "",
          emailLower: normalizeEmail(user.email),
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
          lastLoginAt: Date.now(),
        });
        return snap.val();
      }
      return this.registerLogin(user);
    } catch (error) {
      console.warn("No se pudo asegurar el registro del usuario:", error);
      return null;
    }
  },

  /** Lee el perfil del usuario en appUsers. */
  async getProfile(uid) {
    if (!uid) return null;
    try {
      const snap = await get(ref(database, `appUsers/${uid}`));
      return snap.exists() ? snap.val() : null;
    } catch (error) {
      console.warn("No se pudo leer el perfil:", error);
      return null;
    }
  },

  /**
   * ¿El usuario puede actuar como organizador?
   * El administrador siempre puede. El resto necesita organizerEnabled = true.
   */
  async isOrganizerEnabled(user) {
    if (!user) return false;
    if (isAdminEmail(user.email)) return true;
    const profile = await this.getProfile(user.uid);
    return profile?.organizerEnabled === true;
  },

  /** Guarda los datos del comprador para autorrellenar en futuras compras. */
  async saveBuyerProfile(uid, profile) {
    if (!uid) return;
    try {
      await update(ref(database, `appUsers/${uid}/buyerProfile`), {
        nombre: String(profile.nombre || "").substring(0, 120),
        cedula: String(profile.cedula || "").substring(0, 30),
        email: String(profile.email || "").substring(0, 120),
        telefono: String(profile.telefono || "").substring(0, 30),
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.warn("No se pudo guardar el perfil de comprador:", error);
    }
  },

  /** Lee los datos guardados del comprador (para autorrelleno). */
  async getBuyerProfile(uid) {
    if (!uid) return null;
    const profile = await this.getProfile(uid);
    return profile?.buyerProfile || null;
  },
};
