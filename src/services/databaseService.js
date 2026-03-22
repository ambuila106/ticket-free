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

// Estructura: uid-discoteca-evento (usamos uid en lugar de email para evitar caracteres especiales)
export const databaseService = {
  // ========== DISCOTECAS ==========
  
  // Crear discoteca
  async createDiscoteca(uid, discotecaData) {
    const discotecaRef = ref(database, `users/${uid}/discotecas/${discotecaData.id}`);
    await set(discotecaRef, {
      ...discotecaData,
      createdAt: Date.now()
    });
    return discotecaData.id;
  },

  // Obtener discotecas de un usuario
  async getDiscotecas(uid) {
    const discotecasRef = ref(database, `users/${uid}/discotecas`);
    const snapshot = await get(discotecasRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  // Escuchar cambios en discotecas
  subscribeToDiscotecas(uid, callback) {
    const discotecasRef = ref(database, `users/${uid}/discotecas`);
    return onValue(discotecasRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    });
  },

  // ========== EVENTOS ==========

  // Crear evento
  async createEvento(uid, discotecaId, eventoData) {
    const eventoId = push(ref(database, `users/${uid}/discotecas/${discotecaId}/eventos`)).key;
    const eventoRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}`);
    await set(eventoRef, {
      ...eventoData,
      id: eventoId,
      createdAt: Date.now()
    });
    return eventoId;
  },

  // Obtener eventos de una discoteca
  async getEventos(uid, discotecaId) {
    const eventosRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos`);
    const snapshot = await get(eventosRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  // Escuchar cambios en eventos
  subscribeToEventos(uid, discotecaId, callback) {
    const eventosRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos`);
    return onValue(eventosRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    });
  },

  // Obtener un evento específico
  async getEvento(uid, discotecaId, eventoId) {
    const eventoRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}`);
    const snapshot = await get(eventoRef);
    return snapshot.exists() ? snapshot.val() : null;
  },

  // ========== TICKETS ==========

  // Crear ticket (venta) — un código QR por boleta
  async createTicket(uid, discotecaId, eventoId, ticketData) {
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

    const ticketId = push(ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`)).key;
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

    const ticketRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`);
    await set(ticketRef, ticket);

    return { ticketId, secureCode: secureCodes[0], secureCodes, ticket };
  },

  // Obtener tickets de un evento
  async getTickets(uid, discotecaId, eventoId) {
    const ticketsRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`);
    const snapshot = await get(ticketsRef);
    return snapshot.exists() ? snapshot.val() : {};
  },

  // Escuchar cambios en tickets
  subscribeToTickets(uid, discotecaId, eventoId, callback) {
    const ticketsRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`);
    return onValue(ticketsRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    });
  },

  // Cambiar estado de ticket (por QR)
  async updateTicketStatus(uid, discotecaId, eventoId, ticketId, nuevoEstado) {
    const ticketRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`);
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
  async marcarBoletaEntregada(uid, discotecaId, eventoId, ticketId, codigoEscaneado) {
    const ticketRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`);
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

  // Buscar ticket por código seguro
  async findTicketByCode(secureCode) {
    // Necesitamos buscar en toda la base de datos
    // Esto es ineficiente, pero necesario para la búsqueda por código
    const rootRef = ref(database);
    const snapshot = await get(rootRef);
    
    if (!snapshot.exists()) return null;

    const data = snapshot.val();
    
    // Buscar recursivamente en users/{uid}/discotecas/...
    if (data.users) {
      for (const uid in data.users) {
        if (data.users[uid].discotecas) {
          for (const discotecaId in data.users[uid].discotecas) {
            if (data.users[uid].discotecas[discotecaId].eventos) {
              for (const eventoId in data.users[uid].discotecas[discotecaId].eventos) {
                if (data.users[uid].discotecas[discotecaId].eventos[eventoId].tickets) {
                  for (const ticketId in data.users[uid].discotecas[discotecaId].eventos[eventoId].tickets) {
                    const ticket = data.users[uid].discotecas[discotecaId].eventos[eventoId].tickets[ticketId];
                    const codes = getTicketSecureCodes(ticket);
                    if (codes.includes(secureCode)) {
                      return {
                        ticket,
                        uid,
                        discotecaId,
                        eventoId,
                        ticketId
                      };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return null;
  },

  // ========== COLABORADORES ==========

  // Agregar colaborador a un evento (usando email codificado como clave)
  async addCollaborator(uid, discotecaId, eventoId, collaboratorEmail, permisos = {}) {
    // Codificar email para usar como clave (reemplazar caracteres especiales)
    const collaboratorKey = collaboratorEmail.replace(/[@.]/g, '_');
    const collaboratorRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/colaboradores/${collaboratorKey}`);
    await set(collaboratorRef, {
      email: collaboratorEmail,
      permisos: {
        crearTickets: permisos.crearTickets !== undefined ? permisos.crearTickets : true,
        leerQR: permisos.leerQR !== undefined ? permisos.leerQR : true,
        verReportes: permisos.verReportes !== undefined ? permisos.verReportes : false
      },
      addedAt: Date.now()
    });
  },

  // Obtener eventos donde un usuario es colaborador
  async getEventsAsCollaborator(collaboratorEmail) {
    const rootRef = ref(database);
    const snapshot = await get(rootRef);
    
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    const events = [];
    const collaboratorKey = collaboratorEmail.replace(/[@.]/g, '_');

    if (data.users) {
      for (const uid in data.users) {
        if (data.users[uid].discotecas) {
          for (const discotecaId in data.users[uid].discotecas) {
            if (data.users[uid].discotecas[discotecaId].eventos) {
              for (const eventoId in data.users[uid].discotecas[discotecaId].eventos) {
                const evento = data.users[uid].discotecas[discotecaId].eventos[eventoId];
                if (evento.colaboradores && evento.colaboradores[collaboratorKey]) {
                  events.push({
                    ...evento,
                    ownerUid: uid,
                    discotecaId
                  });
                }
              }
            }
          }
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

  /**
   * Lectura pública tras pago Wompi (solo escribe el webhook).
   * @param {string} purchaseReference - Referencia TF... devuelta por prepareWompiPayment
   */
  subscribeToPublicPurchaseSuccess(purchaseReference, callback) {
    const r = ref(database, `publicPurchaseSuccess/${purchaseReference}`);
    return onValue(r, (snapshot) => {
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
};

