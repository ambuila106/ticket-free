import { ref, push, get, query, orderByChild, limitToLast, onValue } from "firebase/database";
import { database } from "../firebase/config";
import { authService } from "./authService";

export const bitacoraService = {
  /**
   * Registrar una acción en la bitácora
   */
  async registrarAccion(ownerUid, discotecaId, eventoId, accion, detalles = {}) {
    const user = authService.getCurrentUser();
    if (!user) return;

    const logRef = ref(database, `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/bitacora`);
    const logEntry = {
      id: push(logRef).key,
      accion, // 'ticket_creado', 'qr_escaneado', 'estado_cambiado', 'colaborador_agregado'
      usuario: {
        uid: user.uid,
        email: user.email,
        nombre: user.displayName || user.email
      },
      timestamp: Date.now(),
      fecha: new Date().toLocaleString('es-ES'),
      detalles: {
        ...detalles
      }
    };

    await push(logRef, logEntry);
    return logEntry;
  },

  /**
   * Obtener bitácora de un evento
   */
  async getBitacora(ownerUid, discotecaId, eventoId, limite = 100) {
    const bitacoraRef = ref(database, `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/bitacora`);
    const q = query(bitacoraRef, orderByChild('timestamp'), limitToLast(limite));
    const snapshot = await get(q);
    
    if (!snapshot.exists()) return [];
    
    const logs = [];
    snapshot.forEach((child) => {
      logs.push(child.val());
    });
    
    // Ordenar por timestamp descendente (más reciente primero)
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  },

  /**
   * Suscribirse a cambios en la bitácora
   */
  subscribeToBitacora(ownerUid, discotecaId, eventoId, callback, limite = 100) {
    const bitacoraRef = ref(database, `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/bitacora`);
    const q = query(bitacoraRef, orderByChild('timestamp'), limitToLast(limite));
    
    return onValue(q, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      
      const logs = [];
      snapshot.forEach((child) => {
        logs.push(child.val());
      });
      
      // Ordenar por timestamp descendente
      callback(logs.sort((a, b) => b.timestamp - a.timestamp));
    });
  }
};

