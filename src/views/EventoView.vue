<template>
  <div class="evento-view">
    <header class="header">
      <button @click="goBack" class="back-btn">← Volver</button>
      <h1>{{ evento?.nombre || 'Cargando...' }}</h1>
      <div class="header-actions">
        <button 
          v-if="isOrganizador" 
          @click="showCollaboratorModal = true" 
          class="action-btn"
        >
          + Colaborador
        </button>
        <button 
          v-if="isOrganizador" 
          @click="openBitacora" 
          class="bitacora-btn"
        >
          📋 Bitácora
        </button>
        <button @click="goToScanner" class="scanner-btn">📷 Leer QR</button>
      </div>
    </header>

    <main class="main-content">
      <div class="evento-info">
        <p><strong>Fecha:</strong> {{ evento?.fecha }}</p>
        <p><strong>Ubicación:</strong> {{ evento?.ubicacion }}</p>
      </div>

      <div v-if="isOrganizador" class="public-sales-card">
        <h3>🌐 Venta pública (Wompi)</h3>
        <p class="public-sales-hint">
          Comparte solo el enlace de abajo. Los compradores no ven el panel de administración.
        </p>
        <label class="toggle-row">
          <input type="checkbox" v-model="publicPageForm.enabled" />
          <span>Activar página pública de compra</span>
        </label>
        <div class="public-form-grid">
          <label>
            Precio por entrada (COP)
            <input v-model.number="publicPageForm.precioPorEntradaCOP" type="number" min="100" step="100" />
          </label>
          <label>
            Tipo de entrada (etiqueta)
            <input v-model="publicPageForm.tipoEntrada" type="text" placeholder="Ej: General" />
          </label>
        </div>
        <div class="public-actions">
          <button type="button" class="save-public-btn" @click="savePublicPage" :disabled="savingPublicPage">
            {{ savingPublicPage ? 'Guardando…' : 'Guardar página pública' }}
          </button>
          <button type="button" class="copy-link-btn" @click="copyPublicLink" :disabled="!ownerUid">
            Copiar enlace de compra
          </button>
        </div>
        <p v-if="publicCopyMsg" class="copy-msg">{{ publicCopyMsg }}</p>
        <code class="public-url-preview">{{ publicPurchaseLink }}</code>
      </div>

      <div class="tickets-section">
        <div class="section-header">
          <h2>Tickets</h2>
          <div class="header-actions-right">
            <button @click="exportData" class="export-btn">📊 Exportar</button>
            <button @click="showTicketModal = true" class="create-ticket-btn">
              + Crear Ticket
            </button>
          </div>
        </div>

        <div class="tickets-stats">
          <div class="stat-card clickable" @click="showTicketsList = true">
            <span class="stat-label">Total</span>
            <span class="stat-value">{{ totalTickets }}</span>
          </div>
          <div class="stat-card pagado">
            <span class="stat-label">Pagados</span>
            <span class="stat-value">{{ ticketsByStatus.pagado }}</span>
          </div>
          <div class="stat-card entregado">
            <span class="stat-label">Entregados</span>
            <span class="stat-value">{{ ticketsByStatus.entregado }}</span>
          </div>
          <div class="stat-card cancelado">
            <span class="stat-label">Cancelados</span>
            <span class="stat-value">{{ ticketsByStatus.cancelado }}</span>
          </div>
        </div>

        <div v-if="loading" class="loading">Cargando tickets...</div>

        <div v-else-if="Object.keys(tickets).length === 0" class="empty-state">
          <p>No hay tickets aún. ¡Crea tu primer ticket!</p>
        </div>

        <div v-else class="tickets-list">
          <div 
            v-for="(ticket, id) in tickets" 
            :key="id"
            class="ticket-card"
            :class="ticket.estado"
          >
            <div class="ticket-header">
              <span class="ticket-code">{{ ticket.secureCode.substring(0, 12) }}</span>
              <span class="ticket-status" :class="ticket.estado">{{ ticket.estado }}</span>
            </div>
            <div class="ticket-body">
              <p><strong>Cliente:</strong> {{ ticket.nombreCliente }}</p>
              <p><strong>Teléfono:</strong> {{ ticket.telefono }}</p>
              <p><strong>Tipo:</strong> {{ ticket.tipoEntrada }}</p>
              <p><strong>Boletas:</strong> {{ ticket.cantidadBoletas || 1 }}</p>
              <p><strong>Precio:</strong> {{ ticket.precio || 'Gratis' }}</p>
            </div>
            <div class="ticket-actions">
              <button @click="viewTicket(ticket, id)" class="view-btn">Ver QR</button>
              <button 
                v-if="ticket.estado === 'pagado'"
                @click="updateStatus(id, 'cancelado')" 
                class="cancel-btn"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal crear ticket -->
    <div v-if="showTicketModal" class="modal-overlay" @click="showTicketModal = false">
      <div class="modal" @click.stop>
        <h2>Crear Nuevo Ticket</h2>
        <form @submit.prevent="createTicket">
          <div class="form-group">
            <label>Nombre del cliente</label>
            <input v-model="newTicket.nombreCliente" required type="text" />
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input v-model="newTicket.telefono" required type="tel" />
          </div>
          <div class="form-group">
            <label>Tipo de entrada</label>
            <input v-model="newTicket.tipoEntrada" type="text" placeholder="Ej: Fashion Perreo - etapa BLING" />
          </div>
          <div class="form-group">
            <label>Cantidad de boletas/manillas</label>
            <input v-model.number="newTicket.cantidadBoletas" type="number" min="1" value="1" required />
          </div>
          <div class="form-group">
            <label>Precio total</label>
            <input v-model="newTicket.precio" type="text" placeholder="Ej: Gratis o $50.000" />
            <small class="form-hint">Precio total de todas las boletas</small>
          </div>
          <div class="form-actions">
            <button type="button" @click="showTicketModal = false" class="cancel-btn">Cancelar</button>
            <button type="submit" class="submit-btn" :disabled="creatingTicket">
              {{ creatingTicket ? 'Creando...' : 'Crear' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal ver ticket/QR -->
    <div v-if="showTicketView" class="modal-overlay" @click="showTicketView = false">
      <div class="modal ticket-modal" @click.stop>
        <h2>Ticket</h2>
        <div v-if="selectedTicket" class="ticket-preview">
          <img :src="ticketImage" alt="Ticket QR" class="ticket-image" />
          <div class="ticket-actions-modal">
            <button @click="downloadTicket" class="download-btn">Descargar Imagen</button>
            <button @click="showTicketView = false" class="close-btn">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal agregar colaborador -->
    <div v-if="showCollaboratorModal" class="modal-overlay" @click="showCollaboratorModal = false">
      <div class="modal" @click.stop>
        <h2>Agregar Colaborador</h2>
        <form @submit.prevent="addCollaborator">
          <div class="form-group">
            <label>Email del colaborador</label>
            <input v-model="collaboratorEmail" required type="email" placeholder="colaborador@example.com" />
          </div>
          <div class="form-group">
            <label class="permissions-label">Permisos</label>
            <div class="permissions-checkboxes">
              <label class="checkbox-label">
                <input type="checkbox" v-model="collaboratorPermisos.crearTickets" />
                <span>Crear tickets</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="collaboratorPermisos.leerQR" />
                <span>Leer QR</span>
              </label>
              <label class="checkbox-label">
                <input type="checkbox" v-model="collaboratorPermisos.verReportes" />
                <span>Ver reportes</span>
              </label>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="showCollaboratorModal = false" class="cancel-btn">Cancelar</button>
            <button type="submit" class="submit-btn">Agregar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal lista de tickets -->
    <div v-if="showTicketsList" class="modal-overlay" @click="showTicketsList = false">
      <div class="modal tickets-list-modal" @click.stop>
        <h2>Todos los Tickets ({{ totalTickets }})</h2>
        <div class="search-box">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Buscar por cliente, teléfono, código..." 
            class="search-input"
          />
        </div>
        <div class="tickets-list-container">
          <div 
            v-for="(ticket, id) in filteredTickets" 
            :key="id"
            class="ticket-list-item"
            :class="ticket.estado"
          >
            <div class="ticket-list-header">
              <span class="ticket-list-code">{{ ticket.secureCode.substring(0, 12) }}</span>
              <span class="ticket-list-status" :class="ticket.estado">{{ ticket.estado }}</span>
            </div>
            <div class="ticket-list-body">
              <p><strong>Cliente:</strong> {{ ticket.nombreCliente }}</p>
              <p><strong>Teléfono:</strong> {{ ticket.telefono }}</p>
              <p><strong>Boletas:</strong> {{ ticket.cantidadBoletas || 1 }}</p>
              <p><strong>Precio:</strong> {{ ticket.precio || 'Gratis' }}</p>
            </div>
            <div class="ticket-list-actions">
              <button @click="viewTicketFromList(ticket, id)" class="view-qr-btn">Ver QR</button>
            </div>
          </div>
          <div v-if="filteredTickets.length === 0" class="no-results">
            <p>No se encontraron tickets</p>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showTicketsList = false" class="close-btn">Cerrar</button>
        </div>
      </div>
    </div>

    <!-- Modal Bitácora -->
    <div v-if="showBitacoraModal" class="modal-overlay" @click="showBitacoraModal = false">
      <div class="modal bitacora-modal" @click.stop>
        <h2>Bitácora del Evento</h2>
        <div class="bitacora-search">
          <input 
            v-model="bitacoraSearchQuery" 
            type="text" 
            placeholder="Buscar por usuario, acción..." 
            class="search-input"
          />
        </div>
        <div class="bitacora-list-container">
          <div v-if="loadingBitacora" class="loading">Cargando bitácora...</div>
          <div v-else-if="filteredBitacora.length === 0" class="empty-state">
            <p>No hay registros en la bitácora</p>
          </div>
          <div v-else>
            <div 
              v-for="(log, index) in filteredBitacora" 
              :key="index"
              class="bitacora-item"
            >
              <div class="bitacora-header">
                <div class="bitacora-user">
                  <strong>{{ log.usuario?.nombre || log.usuario?.email }}</strong>
                  <span class="bitacora-email">{{ log.usuario?.email }}</span>
                </div>
                <span class="bitacora-time">{{ log.fecha }}</span>
              </div>
              <div class="bitacora-action">
                <span class="action-badge" :class="getActionClass(log.accion)">
                  {{ getActionLabel(log.accion) }}
                </span>
              </div>
              <div v-if="log.detalles" class="bitacora-details">
                <p v-if="log.detalles.ticketId">
                  <strong>Ticket:</strong> {{ log.detalles.ticketCode || log.detalles.ticketId }}
                </p>
                <p v-if="log.detalles.cliente">
                  <strong>Cliente:</strong> {{ log.detalles.cliente }}
                </p>
                <p v-if="log.detalles.estadoAnterior && log.detalles.estadoNuevo">
                  <strong>Estado:</strong> {{ log.detalles.estadoAnterior }} → {{ log.detalles.estadoNuevo }}
                </p>
                <p v-if="log.detalles.colaboradorEmail">
                  <strong>Colaborador:</strong> {{ log.detalles.colaboradorEmail }}
                </p>
                <p v-if="log.detalles.cantidadBoletas">
                  <strong>Boletas:</strong> {{ log.detalles.cantidadBoletas }}
                </p>
                <p v-if="log.detalles.precio">
                  <strong>Precio:</strong> {{ log.detalles.precio }}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showBitacoraModal = false" class="close-btn">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { databaseService } from '../services/databaseService';
import { permissionService } from '../services/permissionService';
import { bitacoraService } from '../services/bitacoraService';
import { generateQRCode, generateTicketImage } from '../utils/qrGenerator';
import { validators, sanitizeInput, sanitizeNumber } from '../utils/validation';

const route = useRoute();
const router = useRouter();
const discotecaId = route.params.discotecaId;
const eventoId = route.params.eventoId;
const user = ref(null);
const evento = ref(null);
const tickets = ref({});
const loading = ref(true);
const showTicketModal = ref(false);
const showTicketView = ref(false);
const showCollaboratorModal = ref(false);
const showTicketsList = ref(false);
const showBitacoraModal = ref(false);
const creatingTicket = ref(false);
const selectedTicket = ref(null);
const ticketImage = ref(null);
const collaboratorEmail = ref('');
const searchQuery = ref('');
const bitacoraSearchQuery = ref('');
const bitacora = ref([]);
const loadingBitacora = ref(false);
const collaboratorPermisos = ref({
  crearTickets: true,
  leerQR: true,
  verReportes: false
});
const ownerUid = ref(null);
const isOrganizador = ref(false);
const discoteca = ref(null);
const publicPageForm = ref({
  enabled: false,
  precioPorEntradaCOP: 50000,
  tipoEntrada: 'General'
});
const savingPublicPage = ref(false);
const publicCopyMsg = ref('');

const newTicket = ref({
  nombreCliente: '',
  telefono: '',
  tipoEntrada: '',
  precio: '',
  cantidadBoletas: 1
});

let unsubscribe = null;
let unsubscribeBitacora = null;

const publicPurchaseLink = computed(() => {
  if (!ownerUid.value) return '';
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/comprar/${ownerUid.value}/${discotecaId}/${eventoId}`;
});

const totalTickets = computed(() => Object.keys(tickets.value).length);

const ticketsByStatus = computed(() => {
  const stats = { pagado: 0, entregado: 0, cancelado: 0 };
  Object.values(tickets.value).forEach(ticket => {
    if (stats[ticket.estado] !== undefined) {
      stats[ticket.estado]++;
    }
  });
  return stats;
});

const filteredTickets = computed(() => {
  if (!searchQuery.value) {
    return Object.entries(tickets.value).map(([id, ticket]) => ({ id, ...ticket }));
  }
  
  const query = searchQuery.value.toLowerCase();
  return Object.entries(tickets.value)
    .map(([id, ticket]) => ({ id, ...ticket }))
    .filter(ticket => 
      ticket.nombreCliente?.toLowerCase().includes(query) ||
      ticket.telefono?.includes(query) ||
      ticket.secureCode?.toLowerCase().includes(query) ||
      ticket.tipoEntrada?.toLowerCase().includes(query)
    );
});

const filteredBitacora = computed(() => {
  if (!bitacoraSearchQuery.value) {
    return bitacora.value;
  }
  
  const query = bitacoraSearchQuery.value.toLowerCase();
  return bitacora.value.filter(log => 
    log.usuario?.nombre?.toLowerCase().includes(query) ||
    log.usuario?.email?.toLowerCase().includes(query) ||
    getActionLabel(log.accion).toLowerCase().includes(query) ||
    log.detalles?.cliente?.toLowerCase().includes(query) ||
    log.detalles?.ticketCode?.toLowerCase().includes(query)
  );
});

const getActionLabel = (accion) => {
  const labels = {
    'ticket_creado': 'Ticket Creado',
    'qr_escaneado': 'QR Escaneado',
    'estado_cambiado': 'Estado Cambiado',
    'colaborador_agregado': 'Colaborador Agregado',
    'ticket_cancelado': 'Ticket Cancelado'
  };
  return labels[accion] || accion;
};

const getActionClass = (accion) => {
  const classes = {
    'ticket_creado': 'action-created',
    'qr_escaneado': 'action-scanned',
    'estado_cambiado': 'action-changed',
    'colaborador_agregado': 'action-collaborator',
    'ticket_cancelado': 'action-cancelled'
  };
  return classes[accion] || '';
};

onMounted(async () => {
  user.value = authService.getCurrentUser();
  const userRole = localStorage.getItem('userRole');
  isOrganizador.value = userRole === 'organizador';
  
  if (user.value) {
    // Determinar uid del propietario
    if (isOrganizador.value) {
      ownerUid.value = user.value.uid;
    } else {
      // Si es colaborador, buscar el evento para obtener el ownerUid
      const eventosColaborador = await databaseService.getEventsAsCollaborator(user.value.email);
      const eventoEncontrado = eventosColaborador.find(e => 
        e.id === eventoId && e.discotecaId === discotecaId
      );
      if (eventoEncontrado) {
        ownerUid.value = eventoEncontrado.ownerUid;
        evento.value = eventoEncontrado;
      } else {
        // Si no se encuentra, intentar con el uid del usuario
        ownerUid.value = user.value.uid;
      }
    }
    
    // Obtener evento si no se obtuvo antes
    if (!evento.value) {
      evento.value = await databaseService.getEvento(ownerUid.value, discotecaId, eventoId);
    }

    if (isOrganizador.value && ownerUid.value) {
      const discotecas = await databaseService.getDiscotecas(ownerUid.value);
      discoteca.value = discotecas[discotecaId] || null;
      const pub = await databaseService.getPublicEventPage(ownerUid.value, discotecaId, eventoId);
      if (pub) {
        publicPageForm.value = {
          enabled: !!pub.enabled,
          precioPorEntradaCOP: Number(pub.precioPorEntradaCOP) || 50000,
          tipoEntrada: pub.tipoEntrada || 'General'
        };
      }
    }
    
    // Suscribirse a tickets
    unsubscribe = databaseService.subscribeToTickets(
      ownerUid.value,
      discotecaId,
      eventoId,
      (data) => {
        tickets.value = data;
        loading.value = false;
      }
    );

    // Suscribirse a bitácora solo si es organizador
    if (isOrganizador.value) {
      unsubscribeBitacora = bitacoraService.subscribeToBitacora(
        ownerUid.value,
        discotecaId,
        eventoId,
        (data) => {
          bitacora.value = data;
          loadingBitacora.value = false;
        }
      );
    }
  }
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
  if (unsubscribeBitacora) {
    unsubscribeBitacora();
  }
});

const createTicket = async () => {
  if (!user.value) return;
  
  // Validar permisos si es colaborador
  if (!isOrganizador.value) {
    const canCreate = await permissionService.checkCollaboratorPermission(
      ownerUid.value,
      discotecaId,
      eventoId,
      'crearTickets'
    );
    if (!canCreate) {
      alert('No tienes permiso para crear tickets');
      return;
    }
  }
  
  // Validar y sanitizar datos
  if (!validators.text(newTicket.value.nombreCliente, 100)) {
    alert('Nombre del cliente inválido. Debe tener entre 1 y 100 caracteres.');
    return;
  }
  
  if (!validators.phone(newTicket.value.telefono)) {
    alert('Teléfono inválido. Debe contener entre 7 y 15 dígitos.');
    return;
  }
  
  if (!validators.cantidadBoletas(newTicket.value.cantidadBoletas)) {
    alert('Cantidad de boletas debe ser entre 1 y 100');
    return;
  }
  
  if (!validators.precio(newTicket.value.precio)) {
    alert('Precio inválido. Debe ser un número válido o "Gratis".');
    return;
  }
  
  creatingTicket.value = true;
  
  try {
    const ticketData = {
      nombreCliente: sanitizeInput(newTicket.value.nombreCliente),
      telefono: sanitizeInput(newTicket.value.telefono),
      tipoEntrada: sanitizeInput(newTicket.value.tipoEntrada || ''),
      precio: sanitizeInput(newTicket.value.precio || 'Gratis'),
      cantidadBoletas: sanitizeNumber(newTicket.value.cantidadBoletas, 1, 100),
      eventoNombre: evento.value.nombre,
      fecha: evento.value.fecha,
      ubicacion: evento.value.ubicacion
    };
    
    const result = await databaseService.createTicket(
      ownerUid.value,
      discotecaId,
      eventoId,
      ticketData
    );
    
    // Registrar en bitácora
    await bitacoraService.registrarAccion(
      ownerUid.value,
      discotecaId,
      eventoId,
      'ticket_creado',
      {
        ticketId: result.ticketId,
        ticketCode: result.secureCode.substring(0, 12),
        cliente: ticketData.nombreCliente,
        telefono: ticketData.telefono,
        cantidadBoletas: ticketData.cantidadBoletas,
        precio: ticketData.precio,
        tipoEntrada: ticketData.tipoEntrada
      }
    );
    
    // Generar QR e imagen
    const qrDataURL = await generateQRCode(result.secureCode);
    const imageURL = await generateTicketImage(
      { ...result.ticket, ...ticketData },
      qrDataURL
    );
    
    selectedTicket.value = result.ticket;
    ticketImage.value = imageURL;
    showTicketModal.value = false;
    showTicketView.value = true;
    newTicket.value = { nombreCliente: '', telefono: '', tipoEntrada: '', precio: '', cantidadBoletas: 1 };
  } catch (error) {
    console.error('Error creando ticket:', error);
    alert('Error al crear el ticket');
  } finally {
    creatingTicket.value = false;
  }
};

const viewTicket = async (ticket, ticketId) => {
  selectedTicket.value = ticket;
  const qrDataURL = await generateQRCode(ticket.secureCode);
  const imageURL = await generateTicketImage(
    { ...ticket, eventoNombre: evento.value.nombre, fecha: evento.value.fecha, ubicacion: evento.value.ubicacion },
    qrDataURL
  );
  ticketImage.value = imageURL;
  showTicketView.value = true;
};

const viewTicketFromList = async (ticket, ticketId) => {
  // Cerrar el modal de lista primero
  showTicketsList.value = false;
  
  // Generar QR e imagen
  selectedTicket.value = ticket;
  const qrDataURL = await generateQRCode(ticket.secureCode);
  const imageURL = await generateTicketImage(
    { ...ticket, eventoNombre: evento.value.nombre, fecha: evento.value.fecha, ubicacion: evento.value.ubicacion },
    qrDataURL
  );
  ticketImage.value = imageURL;
  showTicketView.value = true;
};

const downloadTicket = () => {
  if (!ticketImage.value) return;
  
  const link = document.createElement('a');
  link.href = ticketImage.value;
  link.download = `ticket-${selectedTicket.value.secureCode.substring(0, 8)}.png`;
  link.click();
};

const updateStatus = async (ticketId, nuevoEstado) => {
  if (!ownerUid.value) return;
  
  // Validar estado permitido
  if (!validators.estado(nuevoEstado)) {
    alert('Estado inválido');
    return;
  }
  
  // Verificar permisos si es colaborador
  if (!isOrganizador.value) {
    const canReadQR = await permissionService.checkCollaboratorPermission(
      ownerUid.value,
      discotecaId,
      eventoId,
      'leerQR'
    );
    if (!canReadQR) {
      alert('No tienes permiso para cambiar estados');
      return;
    }
  }
  
  // Obtener estado anterior del ticket
  const ticket = tickets.value[ticketId];
  const estadoAnterior = ticket?.estado || 'pagado';
  
  await databaseService.updateTicketStatus(
    ownerUid.value,
    discotecaId,
    eventoId,
    ticketId,
    nuevoEstado
  );
  
  // Registrar en bitácora
  await bitacoraService.registrarAccion(
    ownerUid.value,
    discotecaId,
    eventoId,
    nuevoEstado === 'cancelado' ? 'ticket_cancelado' : 'estado_cambiado',
    {
      ticketId,
      ticketCode: ticket?.secureCode?.substring(0, 12) || '',
      cliente: ticket?.nombreCliente || '',
      estadoAnterior,
      estadoNuevo: nuevoEstado
    }
  );
};

const addCollaborator = async () => {
  if (!ownerUid.value || !isOrganizador.value) {
    alert('Solo los organizadores pueden agregar colaboradores');
    return;
  }
  
  // Validar email
  if (!validators.email(collaboratorEmail.value)) {
    alert('Email inválido');
    return;
  }
  
  // No permitir agregarse a sí mismo
  if (collaboratorEmail.value === user.value.email) {
    alert('No puedes agregarte como colaborador');
    return;
  }
  
  await databaseService.addCollaborator(
    ownerUid.value,
    discotecaId,
    eventoId,
    sanitizeInput(collaboratorEmail.value),
    collaboratorPermisos.value
  );
  
  // Registrar en bitácora
  await bitacoraService.registrarAccion(
    ownerUid.value,
    discotecaId,
    eventoId,
    'colaborador_agregado',
    {
      colaboradorEmail: collaboratorEmail.value,
      permisos: collaboratorPermisos.value
    }
  );
  
  showCollaboratorModal.value = false;
  collaboratorEmail.value = '';
  collaboratorPermisos.value = {
    crearTickets: true,
    leerQR: true,
    verReportes: false
  };
  alert('Colaborador agregado exitosamente');
};

const openBitacora = async () => {
  if (!isOrganizador.value || !ownerUid.value) return;
  
  showBitacoraModal.value = true;
  loadingBitacora.value = true;
  
  try {
    const logs = await bitacoraService.getBitacora(ownerUid.value, discotecaId, eventoId);
    bitacora.value = logs;
  } catch (error) {
    console.error('Error cargando bitácora:', error);
    alert('Error al cargar la bitácora');
  } finally {
    loadingBitacora.value = false;
  }
};

const exportData = async () => {
  // Verificar permisos si es colaborador
  if (!isOrganizador.value) {
    const canViewReports = await permissionService.checkCollaboratorPermission(
      ownerUid.value,
      discotecaId,
      eventoId,
      'verReportes'
    );
    if (!canViewReports) {
      alert('No tienes permiso para ver reportes');
      return;
    }
  }
  
  const ticketsArray = Object.entries(tickets.value).map(([id, ticket]) => ({
    id,
    ...ticket
  }));

  // Calcular totales
  let totalGanancias = 0;
  let totalBoletas = 0;
  let ticketsPagados = 0;
  let ticketsEntregados = 0;
  let ticketsCancelados = 0;
  let totalTickets = ticketsArray.length;

  ticketsArray.forEach(ticket => {
    const cantidad = ticket.cantidadBoletas || 1;
    totalBoletas += cantidad;
    
    if (ticket.estado === 'pagado') ticketsPagados++;
    if (ticket.estado === 'entregado') ticketsEntregados++;
    if (ticket.estado === 'cancelado') ticketsCancelados++;

    // Extraer número del precio
    if (ticket.precio && ticket.precio !== 'Gratis') {
      const precioStr = ticket.precio.toString().replace(/[^0-9]/g, '');
      const precioNum = parseInt(precioStr) || 0;
      if (ticket.estado !== 'cancelado') {
        totalGanancias += precioNum;
      }
    }
  });

  // Crear CSV con resúmenes primero
  const csvRows = [];
  
  // Encabezado del evento
  csvRows.push(['EVENTO', evento.value?.nombre || '']);
  csvRows.push(['FECHA', evento.value?.fecha || '']);
  csvRows.push(['UBICACIÓN', evento.value?.ubicacion || '']);
  csvRows.push(['FECHA DE EXPORTACIÓN', new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES')]);
  csvRows.push([]);
  
  // RESUMEN DE VENTAS
  csvRows.push(['=== RESUMEN DE VENTAS ===']);
  csvRows.push(['Total de Tickets', totalTickets]);
  csvRows.push(['Total de Boletas/Manillas', totalBoletas]);
  csvRows.push(['Total de Ganancias', `$${totalGanancias.toLocaleString('es-ES')}`]);
  csvRows.push([]);
  
  // ESTADOS
  csvRows.push(['=== ESTADOS ===']);
  csvRows.push(['Tickets Pagados', ticketsPagados]);
  csvRows.push(['Tickets Entregados', ticketsEntregados]);
  csvRows.push(['Tickets Cancelados', ticketsCancelados]);
  csvRows.push([]);
  csvRows.push([]);
  
  // DETALLE DE TICKETS
  csvRows.push(['=== DETALLE DE TICKETS ===']);
  const headers = ['Código', 'Cliente', 'Teléfono', 'Tipo Entrada', 'Cantidad Boletas', 'Precio', 'Estado', 'Fecha Creación'];
  csvRows.push(headers);
  
  // Agregar cada ticket
  ticketsArray.forEach(ticket => {
    const fecha = new Date(ticket.createdAt || Date.now()).toLocaleDateString('es-ES');
    csvRows.push([
      ticket.secureCode || '',
      ticket.nombreCliente || '',
      ticket.telefono || '',
      ticket.tipoEntrada || '',
      ticket.cantidadBoletas || 1,
      ticket.precio || 'Gratis',
      ticket.estado || '',
      fecha
    ]);
  });

  // Convertir a CSV
  const csvContent = csvRows.map(row => {
    if (row.length === 0) return '';
    return row.map(cell => `"${cell}"`).join(',');
  }).join('\n');

  // Descargar archivo
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `ventas_${evento.value?.nombre || 'evento'}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const savePublicPage = async () => {
  if (!ownerUid.value || !evento.value) return;
  savingPublicPage.value = true;
  publicCopyMsg.value = '';
  try {
    await databaseService.setPublicEventPage(ownerUid.value, discotecaId, eventoId, {
      enabled: publicPageForm.value.enabled,
      nombreEvento: evento.value.nombre || '',
      fecha: evento.value.fecha || '',
      ubicacion: evento.value.ubicacion || discoteca.value?.ubicacion || '',
      descripcion: evento.value.descripcion || '',
      nombreDiscoteca: discoteca.value?.nombre || '',
      precioPorEntradaCOP: Math.max(100, Number(publicPageForm.value.precioPorEntradaCOP) || 0),
      tipoEntrada: (publicPageForm.value.tipoEntrada || 'General').trim().substring(0, 80)
    });
    alert('Página pública guardada. Copia el enlace para compartirlo.');
  } catch (e) {
    alert('Error al guardar: ' + (e.message || 'desconocido'));
  } finally {
    savingPublicPage.value = false;
  }
};

const copyPublicLink = async () => {
  publicCopyMsg.value = '';
  const url = publicPurchaseLink.value;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    publicCopyMsg.value = 'Enlace copiado al portapapeles.';
  } catch {
    publicCopyMsg.value = url;
  }
};

const goToScanner = () => {
  router.push(`/qr-scanner/${discotecaId}/${eventoId}`);
};

const goBack = () => {
  const userRole = localStorage.getItem('userRole');
  if (userRole === 'organizador') {
    router.push(`/discoteca/${discotecaId}`);
  } else {
    router.push('/colaborador');
  }
};
</script>

<style scoped>
.evento-view {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 30px;
}

.back-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 14px;
  margin-bottom: 10px;
  padding: 5px 0;
}

.header h1 {
  color: #333;
  font-size: 1.8rem;
  margin-bottom: 15px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.action-btn,
.scanner-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.action-btn {
  background: #667eea;
  color: white;
}

.scanner-btn {
  background: #28a745;
  color: white;
}

.bitacora-btn {
  background: #6c757d;
  color: white;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.evento-info {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.evento-info p {
  margin-bottom: 8px;
  color: #666;
}

.public-sales-card {
  background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%);
  border: 1px solid #c5d0f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.public-sales-card h3 {
  margin-bottom: 8px;
  color: #333;
  font-size: 1.1rem;
}

.public-sales-hint {
  font-size: 0.9rem;
  color: #555;
  margin-bottom: 16px;
  line-height: 1.4;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-weight: 500;
  color: #333;
  cursor: pointer;
}

.public-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}

.public-form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #444;
}

.public-form-grid input {
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 14px;
}

.public-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.save-public-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.copy-link-btn {
  background: #48bb78;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.copy-msg {
  font-size: 0.85rem;
  color: #2d7a4d;
  margin-bottom: 8px;
}

.public-url-preview {
  display: block;
  font-size: 11px;
  word-break: break-all;
  background: rgba(255, 255, 255, 0.8);
  padding: 10px;
  border-radius: 6px;
  color: #333;
}

.tickets-section {
  background: white;
  padding: 24px;
  border-radius: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.header-actions-right {
  display: flex;
  gap: 10px;
  align-items: center;
}

.section-header h2 {
  color: #333;
}

.create-ticket-btn,
.export-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.export-btn {
  background: #28a745;
}

.tickets-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.stat-card {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-card.clickable {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.stat-card.pagado {
  background: #fff3cd;
}

.stat-card.entregado {
  background: #d4edda;
}

.stat-card.cancelado {
  background: #f8d7da;
}

.stat-label {
  display: block;
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: bold;
  color: #333;
}

.tickets-list {
  display: grid;
  gap: 15px;
}

.ticket-card {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.ticket-card.pagado {
  border-left-color: #ffc107;
}

.ticket-card.entregado {
  border-left-color: #28a745;
}

.ticket-card.cancelado {
  border-left-color: #dc3545;
  opacity: 0.7;
}

.ticket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.ticket-code {
  font-family: monospace;
  font-weight: bold;
  color: #333;
}

.ticket-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.ticket-status.pagado {
  background: #fff3cd;
  color: #856404;
}

.ticket-status.entregado {
  background: #d4edda;
  color: #155724;
}

.ticket-status.cancelado {
  background: #f8d7da;
  color: #721c24;
}

.ticket-body p {
  margin-bottom: 8px;
  color: #666;
  font-size: 14px;
}

.ticket-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.view-btn,
.cancel-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.view-btn {
  background: #667eea;
  color: white;
}

.cancel-btn {
  background: #dc3545;
  color: white;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 30px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.ticket-modal {
  max-width: 600px;
}

.modal h2 {
  margin-bottom: 20px;
  color: #333;
}

.ticket-preview {
  text-align: center;
}

.ticket-image {
  max-width: 100%;
  border-radius: 8px;
  margin-bottom: 20px;
}

.ticket-actions-modal {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.download-btn,
.close-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.download-btn {
  background: #667eea;
  color: white;
}

.close-btn {
  background: #f5f5f5;
  color: #666;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.form-hint {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: #999;
}

.permissions-label {
  margin-bottom: 12px !important;
}

.permissions-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.tickets-list-modal,
.bitacora-modal {
  max-width: 800px;
  max-height: 90vh;
}

.search-box {
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.tickets-list-container {
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.ticket-list-item {
  background: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 10px;
  border-left: 4px solid #667eea;
}

.ticket-list-item.pagado {
  border-left-color: #ffc107;
}

.ticket-list-item.entregado {
  border-left-color: #28a745;
}

.ticket-list-item.cancelado {
  border-left-color: #dc3545;
  opacity: 0.7;
}

.ticket-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.ticket-list-code {
  font-family: monospace;
  font-weight: bold;
  color: #333;
  font-size: 13px;
}

.ticket-list-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.ticket-list-status.pagado {
  background: #fff3cd;
  color: #856404;
}

.ticket-list-status.entregado {
  background: #d4edda;
  color: #155724;
}

.ticket-list-status.cancelado {
  background: #f8d7da;
  color: #721c24;
}

.ticket-list-body p {
  margin: 5px 0;
  color: #666;
  font-size: 13px;
}

.ticket-list-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.view-qr-btn {
  width: 100%;
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.3s;
}

.view-qr-btn:hover {
  background: #5568d3;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: #999;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.bitacora-search {
  margin-bottom: 20px;
}

.bitacora-list-container {
  max-height: 500px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.bitacora-item {
  background: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 12px;
  border-left: 4px solid #667eea;
}

.bitacora-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.bitacora-user {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bitacora-user strong {
  color: #333;
  font-size: 15px;
}

.bitacora-email {
  color: #666;
  font-size: 12px;
}

.bitacora-time {
  color: #999;
  font-size: 12px;
  white-space: nowrap;
}

.bitacora-action {
  margin-bottom: 10px;
}

.action-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.action-badge.action-created {
  background: #d4edda;
  color: #155724;
}

.action-badge.action-scanned {
  background: #cfe2ff;
  color: #084298;
}

.action-badge.action-changed {
  background: #fff3cd;
  color: #856404;
}

.action-badge.action-collaborator {
  background: #e7f3ff;
  color: #0c5460;
}

.action-badge.action-cancelled {
  background: #f8d7da;
  color: #721c24;
}

.bitacora-details {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.bitacora-details p {
  margin: 5px 0;
  color: #666;
  font-size: 13px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
}

.cancel-btn,
.submit-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn {
  background: #f5f5f5;
  color: #666;
}

.submit-btn {
  background: #667eea;
  color: white;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading, .empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

/* Responsive Mobile */
@media (max-width: 768px) {
  .header {
    padding: 15px;
    margin-bottom: 20px;
  }

  .header h1 {
    font-size: 1.5rem;
    margin-bottom: 12px;
  }

  .header-actions {
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .action-btn,
  .scanner-btn {
    width: 100%;
    padding: 12px;
    font-size: 15px;
  }

  .main-content {
    padding: 15px;
  }

  .evento-info {
    padding: 15px;
    margin-bottom: 20px;
  }

  .public-form-grid {
    grid-template-columns: 1fr;
  }

  .public-actions {
    flex-direction: column;
  }

  .save-public-btn,
  .copy-link-btn {
    width: 100%;
  }

  .tickets-section {
    padding: 15px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .header-actions-right {
    width: 100%;
    flex-direction: column;
  }

  .export-btn,
  .create-ticket-btn {
    width: 100%;
  }

  .section-header h2 {
    font-size: 1.3rem;
  }

  .create-ticket-btn {
    width: 100%;
    padding: 12px;
    font-size: 15px;
  }

  .tickets-stats {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-bottom: 20px;
  }

  .stat-card {
    padding: 15px;
  }

  .stat-value {
    font-size: 1.5rem;
  }

  .stat-label {
    font-size: 12px;
  }

  .ticket-card {
    padding: 15px;
  }

  .ticket-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .ticket-code {
    font-size: 13px;
    word-break: break-all;
  }

  .ticket-actions {
    flex-direction: column;
    width: 100%;
  }

  .view-btn,
  .cancel-btn {
    width: 100%;
    padding: 10px;
  }

  .modal {
    padding: 20px;
    width: 95%;
    max-height: 95vh;
    margin: 10px;
  }

  .modal h2 {
    font-size: 1.3rem;
  }

  .ticket-actions-modal {
    flex-direction: column;
  }

  .download-btn,
  .close-btn {
    width: 100%;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .cancel-btn,
  .submit-btn {
    width: 100%;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .header-actions-right {
    width: 100%;
    flex-direction: column;
  }

  .export-btn,
  .create-ticket-btn {
    width: 100%;
  }

  .tickets-list-modal,
  .bitacora-modal {
    width: 95%;
    max-height: 95vh;
  }

  .tickets-list-container,
  .bitacora-list-container {
    max-height: 400px;
  }

  .bitacora-header {
    flex-direction: column;
    gap: 8px;
  }

  .bitacora-time {
    align-self: flex-start;
  }
}

@media (max-width: 480px) {
  .header h1 {
    font-size: 1.3rem;
  }

  .tickets-stats {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-value {
    font-size: 1.8rem;
  }
}
</style>

