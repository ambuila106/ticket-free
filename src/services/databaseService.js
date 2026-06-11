import { 
  ref, 
  set, 
  get, 
  push, 
  update, 
  remove,
  onValue,
  query,
  orderByChild,
  equalTo
} from "firebase/database";
import { database } from "../firebase/config";
import { generateSecureCode } from "../utils/qrGenerator";
import { getTicketSecureCodes } from "../utils/ticketCodes";

function sanitizeCollaboratorEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function collaboratorEmailToKey(email) {
  return sanitizeCollaboratorEmail(email).replace(/[@.]/g, "_");
}

function sanitizeUserEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function userEmailToLegacyKey(email) {
  return sanitizeUserEmail(email).replace(/[@.]/g, "_");
}

const userDataKeyCache = new Map();

async function resolveUserDataKeyInternal(uid, userEmail = "") {
  const normalizedUid = String(uid || "").trim();
  if (!normalizedUid) throw new Error("UID inválido");

  const cacheKey = `${normalizedUid}|${sanitizeUserEmail(userEmail)}`;
  if (userDataKeyCache.has(cacheKey)) {
    return userDataKeyCache.get(cacheKey);
  }

  try {
    const uidRef = ref(database, `users/${normalizedUid}`);
    const uidSnapshot = await get(uidRef);
    if (uidSnapshot.exists()) {
      userDataKeyCache.set(cacheKey, normalizedUid);
      return normalizedUid;
    }
  } catch (error) {
    // Puede pasar justo al restaurar sesión: devolvemos UID para no bloquear.
    userDataKeyCache.set(cacheKey, normalizedUid);
    return normalizedUid;
  }

  const legacyKey = userEmailToLegacyKey(userEmail);
  if (legacyKey && legacyKey !== normalizedUid) {
    try {
      const legacyRef = ref(database, `users/${legacyKey}`);
      const legacySnapshot = await get(legacyRef);
      if (legacySnapshot.exists()) {
        userDataKeyCache.set(cacheKey, legacyKey);
        return legacyKey;
      }
    } catch (error) {
      // Si reglas no permiten leer clave legacy, seguimos con UID sin bloquear el flujo.
    }
  }

  userDataKeyCache.set(cacheKey, normalizedUid);
  return normalizedUid;
}

// Estructura: uid-discoteca-evento (usamos uid en lugar de email para evitar caracteres especiales)
export const databaseService = {
  async resolveUserDataKey(uid, userEmail = "") {
    return resolveUserDataKeyInternal(uid, userEmail);
  },

  async exportUserBackup(uid, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const userRef = ref(database, `users/${ownerKey}`);
    const snapshot = await get(userRef);
    return {
      ownerKey,
      exportedAt: Date.now(),
      data: snapshot.exists() ? snapshot.val() : {}
    };
  },

  // ========== DISCOTECAS ==========
  
  // Crear discoteca
  async createDiscoteca(uid, discotecaData, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const discotecaRef = ref(database, `users/${ownerKey}/discotecas/${discotecaData.id}`);
    await set(discotecaRef, {
      ...discotecaData,
      createdAt: Date.now()
    });
    return discotecaData.id;
  },

  // Obtener discotecas de un usuario
  async getDiscotecas(uid, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const discotecasRef = ref(database, `users/${ownerKey}/discotecas`);
    const snapshot = await get(discotecasRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  // Escuchar cambios en discotecas
  subscribeToDiscotecas(uid, callback, onError = null, userEmail = "") {
    let unsubscribe = null;
    let active = true;

    resolveUserDataKeyInternal(uid, userEmail)
      .then((ownerKey) => {
        if (!active) return;
        const discotecasRef = ref(database, `users/${ownerKey}/discotecas`);
        unsubscribe = onValue(
          discotecasRef,
          (snapshot) => {
            callback(snapshot.exists() ? snapshot.val() : {});
          },
          (error) => {
            if (typeof onError === "function") onError(error);
          }
        );
      })
      .catch((error) => {
        if (typeof onError === "function") onError(error);
      });

    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  },

  // ========== EVENTOS ==========

  // Crear evento
  async createEvento(uid, discotecaId, eventoData, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const eventoId = push(ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos`)).key;
    const eventoRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}`);
    await set(eventoRef, {
      ...eventoData,
      id: eventoId,
      createdAt: Date.now()
    });
    return eventoId;
  },

  // Obtener eventos de una discoteca
  async getEventos(uid, discotecaId, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const eventosRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos`);
    const snapshot = await get(eventosRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  // Escuchar cambios en eventos
  subscribeToEventos(uid, discotecaId, callback, onError = null, userEmail = "") {
    let unsubscribe = null;
    let active = true;

    resolveUserDataKeyInternal(uid, userEmail)
      .then((ownerKey) => {
        if (!active) return;
        const eventosRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos`);
        unsubscribe = onValue(
          eventosRef,
          (snapshot) => {
            callback(snapshot.exists() ? snapshot.val() : {});
          },
          (error) => {
            if (typeof onError === "function") onError(error);
          }
        );
      })
      .catch((error) => {
        if (typeof onError === "function") onError(error);
      });

    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  },

  // Obtener un evento específico
  async getEvento(uid, discotecaId, eventoId, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const eventoRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}`);
    const snapshot = await get(eventoRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  // Eliminar evento completo (tickets, colaboradores y bitácora incluidos)
  async deleteEvento(uid, discotecaId, eventoId, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const eventoRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}`);
    const eventoSnapshot = await get(eventoRef);

    if (!eventoSnapshot.exists()) {
      return { removed: false, reason: "not-found" };
    }

    const evento = eventoSnapshot.val() || {};
    const colaboradores =
      evento.colaboradores && typeof evento.colaboradores === "object"
        ? Object.keys(evento.colaboradores)
        : [];

    const cleanupOps = [
      remove(ref(database, `publicEvents/${ownerKey}/${discotecaId}/${eventoId}`)),
    ];

    for (const collaboratorKey of colaboradores) {
      cleanupOps.push(
        remove(ref(database, `collaboratorEvents/${collaboratorKey}/${ownerKey}/${discotecaId}/${eventoId}`))
      );
    }

    await Promise.allSettled(cleanupOps);
    await remove(eventoRef);

    return {
      removed: true,
      cleanedCollaborators: colaboradores.length,
    };
  },

  // Eliminar discoteca completa y limpiar índices relacionados.
  async deleteDiscoteca(uid, discotecaId, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const discotecaRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}`);
    const discotecaSnapshot = await get(discotecaRef);

    if (!discotecaSnapshot.exists()) {
      return { removed: false, reason: "not-found" };
    }

    const discotecaData = discotecaSnapshot.val() || {};
    const eventos =
      discotecaData.eventos && typeof discotecaData.eventos === "object"
        ? discotecaData.eventos
        : {};

    const collaboratorCleanupPaths = new Set();
    for (const [eventoId, evento] of Object.entries(eventos)) {
      const colaboradores =
        evento?.colaboradores && typeof evento.colaboradores === "object"
          ? Object.keys(evento.colaboradores)
          : [];

      for (const collaboratorKey of colaboradores) {
        collaboratorCleanupPaths.add(
          `collaboratorEvents/${collaboratorKey}/${ownerKey}/${discotecaId}/${eventoId}`
        );
      }
    }

    const cleanupOps = [remove(ref(database, `publicEvents/${ownerKey}/${discotecaId}`))];
    collaboratorCleanupPaths.forEach((path) => {
      cleanupOps.push(remove(ref(database, path)));
    });

    await Promise.allSettled(cleanupOps);
    await remove(discotecaRef);

    return {
      removed: true,
      cleanedEvents: Object.keys(eventos).length,
      cleanedCollaboratorIndexes: collaboratorCleanupPaths.size,
    };
  },

  // ========== TICKETS ==========

  // Crear ticket (venta) — un código QR por boleta
  async createTicket(uid, discotecaId, eventoId, ticketData, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    let qty = parseInt(ticketData.cantidadBoletas, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > 100) qty = 100;

    const seen = new Set();
    const secureCodes = [];
    while (secureCodes.length < qty) {
      const c = generateSecureCode();
      if (!seen.has(c)) {
        seen.add(c);
        secureCodes.push(c);
      }
    }

    const ticketId = push(ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`)).key;
    const ticket = {
      id: ticketId,
      secureCode: secureCodes[0],
      secureCodes,
      ...ticketData,
      cantidadBoletas: qty,
      estado: "pagado",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const ticketRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`);
    await set(ticketRef, ticket);

    return { ticketId, secureCode: secureCodes[0], secureCodes, ticket };
  },

  // Obtener tickets de un evento
  async getTickets(uid, discotecaId, eventoId, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const ticketsRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`);
    const snapshot = await get(ticketsRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  // Escuchar cambios en tickets
  subscribeToTickets(uid, discotecaId, eventoId, callback, onError = null, userEmail = "") {
    let unsubscribe = null;
    let active = true;

    resolveUserDataKeyInternal(uid, userEmail)
      .then((ownerKey) => {
        if (!active) return;
        const ticketsRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`);
        unsubscribe = onValue(
          ticketsRef,
          (snapshot) => {
            callback(snapshot.exists() ? snapshot.val() : {});
          },
          (error) => {
            if (typeof onError === "function") onError(error);
          }
        );
      })
      .catch((error) => {
        if (typeof onError === "function") onError(error);
      });

    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  },

  // Cambiar estado de ticket (por QR)
  async updateTicketStatus(uid, discotecaId, eventoId, ticketId, nuevoEstado, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const ticketRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`);
    await update(ticketRef, {
      estado: nuevoEstado,
      updatedAt: Date.now()
    });
  },

  /**
   * Marca una boleta como entregada (ventas con varios QR).
   * Si solo hay un código, marca el ticket entero como entregado.
   * @returns {Promise<{ yaUsado?: boolean, completo: boolean, entregadas?: number, total?: number, modo?: string }>}
   */
  async marcarBoletaEntregada(uid, discotecaId, eventoId, ticketId, codigoEscaneado, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const ticketRef = ref(database, `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`);
    const snap = await get(ticketRef);
    if (!snap.exists()) throw new Error("Ticket no encontrado");
    const ticket = snap.val();
    const codes = getTicketSecureCodes(ticket);

    if (!codes.length) throw new Error("Ticket sin códigos");
    if (!codes.includes(codigoEscaneado)) throw new Error("Código no pertenece a este ticket");

    if (codes.length <= 1) {
      await update(ticketRef, { estado: "entregado", updatedAt: Date.now() });
      return { modo: "unico", completo: true, entregadas: 1, total: 1 };
    }

    const prev =
      ticket.entradasCanjeadas && typeof ticket.entradasCanjeadas === "object"
        ? { ...ticket.entradasCanjeadas }
        : {};
    if (prev[codigoEscaneado]) {
      return { yaUsado: true, completo: false, entregadas: Object.keys(prev).length, total: codes.length };
    }

    prev[codigoEscaneado] = Date.now();
    const entregadas = Object.keys(prev).length;
    const updates = {
      entradasCanjeadas: prev,
      updatedAt: Date.now(),
    };
    if (entregadas >= codes.length) {
      updates.estado = "entregado";
    }
    await update(ticketRef, updates);
    return {
      completo: entregadas >= codes.length,
      entregadas,
      total: codes.length,
      modo: "multi",
    };
  },

  /**
   * Buscar ticket por código dentro de un evento (respeta reglas RTDB: no lee la raíz).
   * ownerUid = dueño del evento en Firebase (mismo path que tickets).
   */
  async findTicketByCodeInEvent(ownerUid, discotecaId, eventoId, secureCode) {
    if (!ownerUid || !discotecaId || !eventoId || !secureCode) return null;
    const ticketsRef = ref(
      database,
      `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`
    );
    const snapshot = await get(ticketsRef);
    if (!snapshot.exists()) return null;
    const tickets = snapshot.val();
    for (const ticketId in tickets) {
      const ticket = tickets[ticketId];
      const codes = getTicketSecureCodes(ticket);
      if (codes.includes(secureCode)) {
        return {
          ticket,
          uid: ownerUid,
          discotecaId,
          eventoId,
          ticketId,
        };
      }
    }
    return null;
  },

  // ========== COLABORADORES ==========

  // Agregar colaborador a un evento (usando email codificado como clave)
  async addCollaborator(uid, discotecaId, eventoId, collaboratorEmail, permisos = {}, eventoMeta = {}, userEmail = "") {
    const ownerKey = await resolveUserDataKeyInternal(uid, userEmail);
    const normalizedEmail = sanitizeCollaboratorEmail(collaboratorEmail);
    const collaboratorKey = collaboratorEmailToKey(normalizedEmail);
    const timestamp = Date.now();
    const collaboratorRef = ref(
      database,
      `users/${ownerKey}/discotecas/${discotecaId}/eventos/${eventoId}/colaboradores/${collaboratorKey}`
    );
    const collaboratorEventIndexRef = ref(
      database,
      `collaboratorEvents/${collaboratorKey}/${ownerKey}/${discotecaId}/${eventoId}`
    );
    const collaboratorData = {
      email: normalizedEmail,
      permisos: {
        crearTickets: permisos.crearTickets !== undefined ? permisos.crearTickets : true,
        leerQR: permisos.leerQR !== undefined ? permisos.leerQR : true,
        verReportes: permisos.verReportes !== undefined ? permisos.verReportes : false
      },
      addedAt: timestamp
    };

    // 1) Alta principal del colaborador (ruta histórica y crítica).
    await set(collaboratorRef, collaboratorData);

    // 2) Índice para que el colaborador vea sus eventos sin leer la raíz.
    // Si falla por reglas no actualizadas, no deshacemos el alta principal.
    try {
      await set(collaboratorEventIndexRef, {
        ownerUid: ownerKey,
        discotecaId,
        eventoId,
        nombre: eventoMeta.nombre || "",
        fecha: eventoMeta.fecha || "",
        ubicacion: eventoMeta.ubicacion || "",
        addedAt: timestamp
      });
      return { collaboratorSaved: true, indexSaved: true };
    } catch (indexError) {
      console.warn("No se pudo guardar collaboratorEvents:", indexError);
      return { collaboratorSaved: true, indexSaved: false };
    }
  },

  // Obtener eventos donde un usuario es colaborador
  async getEventsAsCollaborator(collaboratorEmail) {
    const collaboratorKey = collaboratorEmailToKey(collaboratorEmail);
    const indexRef = ref(database, `collaboratorEvents/${collaboratorKey}`);
    const snapshot = await get(indexRef);

    if (!snapshot.exists()) return [];

    const indexData = snapshot.val();
    const events = [];

    for (const ownerUid in indexData) {
      const ownerDiscotecas = indexData[ownerUid] || {};
      for (const discotecaId in ownerDiscotecas) {
        const discotecaEventos = ownerDiscotecas[discotecaId] || {};
        for (const eventoId in discotecaEventos) {
          const indexedEvent = discotecaEventos[eventoId] || {};
          events.push({
            id: indexedEvent.eventoId || eventoId,
            ownerUid: indexedEvent.ownerUid || ownerUid,
            discotecaId: indexedEvent.discotecaId || discotecaId,
            nombre: indexedEvent.nombre || "Evento",
            fecha: indexedEvent.fecha || "",
            ubicacion: indexedEvent.ubicacion || ""
          });
        }
      }
    }

    return events;
  },

  // ========== PÁGINA PÚBLICA DE EVENTO (datos seguros; sin listar tickets) ==========

  /** Lectura pública (sin login) para la página de compra */
  async getPublicEventPage(ownerUid, discotecaId, eventoId) {
    const pageRef = ref(database, `publicEvents/${ownerUid}/${discotecaId}/${eventoId}`);
    const snapshot = await get(pageRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  subscribeToPublicEventPage(ownerUid, discotecaId, eventoId, callback) {
    const pageRef = ref(database, `publicEvents/${ownerUid}/${discotecaId}/${eventoId}`);
    return onValue(pageRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null);
    });
  },

  /** Solo el dueño puede escribir (reglas Firebase) */
  async setPublicEventPage(ownerUid, discotecaId, eventoId, pageData) {
    const pageRef = ref(database, `publicEvents/${ownerUid}/${discotecaId}/${eventoId}`);
    await set(pageRef, {
      ...pageData,
      updatedAt: Date.now(),
    });
  },

  // ========== ÍNDICE DE EVENTOS (catálogo / landing / admin) ==========

  /**
   * Crea/actualiza la entrada del evento en el catálogo público.
   * Usa update (patch) para no pisar showOnHome (controlado por el admin).
   */
  async upsertEventIndex(ownerUid, discotecaId, eventoId, data) {
    const indexRef = ref(database, `eventsIndex/${ownerUid}/${discotecaId}/${eventoId}`);
    await update(indexRef, {
      ownerUid,
      discotecaId,
      eventoId,
      ...data,
      updatedAt: Date.now(),
    });
  },

  /** Lee los eventos visibles para la landing pública (/eventos). */
  async getPublicHomeEvents() {
    const snap = await get(ref(database, "eventsIndex"));
    if (!snap.exists()) return [];
    const data = snap.val();
    const events = [];
    for (const ownerUid in data) {
      const discotecas = data[ownerUid] || {};
      for (const discotecaId in discotecas) {
        const eventos = discotecas[discotecaId] || {};
        for (const eventoId in eventos) {
          const ev = eventos[eventoId] || {};
          if (ev.showOnHome === true && ev.publicEnabled === true) {
            events.push({ ownerUid, discotecaId, eventoId, ...ev });
          }
        }
      }
    }
    return events.sort((a, b) => {
      const ta = Number(a.fechaTimestamp) || Number(a.createdAt) || 0;
      const tb = Number(b.fechaTimestamp) || Number(b.createdAt) || 0;
      return tb - ta;
    });
  },

  // ========== PEDIDOS (verificación de transferencias) ==========

  /** El dueño verifica la transferencia: el pedido pasa a "pagado". */
  async verifyOrder(ownerUid, discotecaId, eventoId, ticketId) {
    await this.updateTicketStatus(ownerUid, discotecaId, eventoId, ticketId, "pagado");
  },

  /** El dueño rechaza la transferencia: el pedido pasa a "cancelado". */
  async rejectOrder(ownerUid, discotecaId, eventoId, ticketId) {
    await this.updateTicketStatus(ownerUid, discotecaId, eventoId, ticketId, "cancelado");
  },

  // ========== COMPROBANTES (galería / borrado) ==========

  /** Lee los comprobantes de un dueño (para su galería). */
  async getOwnerComprobantes(ownerUid) {
    const snap = await get(ref(database, `comprobantes/${ownerUid}`));
    if (!snap.exists()) return [];
    const data = snap.val();
    return Object.entries(data)
      .map(([ticketId, info]) => ({ ticketId, ownerUid, ...info }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  /**
   * Borra el registro del comprobante en la BD y limpia los campos del ticket.
   * (El archivo del Storage se borra aparte con storageService.)
   */
  async removeComprobanteRecord(ownerUid, discotecaId, eventoId, ticketId) {
    const ops = [remove(ref(database, `comprobantes/${ownerUid}/${ticketId}`))];
    if (discotecaId && eventoId && ticketId) {
      ops.push(
        update(
          ref(database, `users/${ownerUid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`),
          { comprobanteUrl: null, comprobantePath: null, comprobanteBorrado: true, updatedAt: Date.now() }
        )
      );
    }
    await Promise.allSettled(ops);
  },

  // ========== MIS QRs / TRANSFERENCIAS ==========

  /** Lee los QRs que posee un usuario (por clave de correo). */
  async getMyQrs(emailKey) {
    const snap = await get(ref(database, `userQrs/${emailKey}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([key, info]) => ({ key, ...info }));
  },

  subscribeToMyQrs(emailKey, callback, onError = null) {
    const r = ref(database, `userQrs/${emailKey}`);
    return onValue(
      r,
      (snap) => {
        const list = snap.exists()
          ? Object.entries(snap.val()).map(([key, info]) => ({ key, ...info }))
          : [];
        callback(list);
      },
      (error) => {
        if (typeof onError === "function") onError(error);
      }
    );
  },

  /** Lee las transferencias pendientes dirigidas a un correo. */
  async getPendingTransfers(emailKey) {
    const snap = await get(ref(database, `pendingTransfers/${emailKey}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([id, info]) => ({ id, ...info }));
  },

  subscribeToPendingTransfers(emailKey, callback, onError = null) {
    const r = ref(database, `pendingTransfers/${emailKey}`);
    return onValue(
      r,
      (snap) => {
        const list = snap.exists()
          ? Object.entries(snap.val()).map(([id, info]) => ({ id, ...info }))
          : [];
        callback(list);
      },
      (error) => {
        if (typeof onError === "function") onError(error);
      }
    );
  },
};

