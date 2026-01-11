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

  // Crear ticket (venta)
  async createTicket(uid, discotecaId, eventoId, ticketData) {
    const secureCode = generateSecureCode();
    const ticketId = push(ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets`)).key;
    
    const ticket = {
      id: ticketId,
      secureCode,
      ...ticketData,
      estado: "pagado",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const ticketRef = ref(database, `users/${uid}/discotecas/${discotecaId}/eventos/${eventoId}/tickets/${ticketId}`);
    await set(ticketRef, ticket);
    
    return { ticketId, secureCode, ticket };
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
                    if (ticket.secureCode === secureCode) {
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
  }
};

