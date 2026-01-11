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
        <button @click="goToScanner" class="scanner-btn">📷 Leer QR</button>
      </div>
    </header>

    <main class="main-content">
      <div class="evento-info">
        <p><strong>Fecha:</strong> {{ evento?.fecha }}</p>
        <p><strong>Ubicación:</strong> {{ evento?.ubicacion }}</p>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { databaseService } from '../services/databaseService';
import { generateQRCode, generateTicketImage } from '../utils/qrGenerator';

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
const creatingTicket = ref(false);
const selectedTicket = ref(null);
const ticketImage = ref(null);
const collaboratorEmail = ref('');
const searchQuery = ref('');
const collaboratorPermisos = ref({
  crearTickets: true,
  leerQR: true,
  verReportes: false
});
const ownerUid = ref(null);
const isOrganizador = ref(false);

const newTicket = ref({
  nombreCliente: '',
  telefono: '',
  tipoEntrada: '',
  precio: '',
  cantidadBoletas: 1
});

let unsubscribe = null;

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
  }
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

const createTicket = async () => {
  if (!user.value) return;
  
  creatingTicket.value = true;
  
  try {
    const ticketData = {
      ...newTicket.value,
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

const downloadTicket = () => {
  if (!ticketImage.value) return;
  
  const link = document.createElement('a');
  link.href = ticketImage.value;
  link.download = `ticket-${selectedTicket.value.secureCode.substring(0, 8)}.png`;
  link.click();
};

const updateStatus = async (ticketId, nuevoEstado) => {
  if (!ownerUid.value) return;
  
  await databaseService.updateTicketStatus(
    ownerUid.value,
    discotecaId,
    eventoId,
    ticketId,
    nuevoEstado
  );
};

const addCollaborator = async () => {
  if (!ownerUid.value) return;
  
  await databaseService.addCollaborator(
    ownerUid.value,
    discotecaId,
    eventoId,
    collaboratorEmail.value,
    collaboratorPermisos.value
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

const exportData = () => {
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

.tickets-list-modal {
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

  .tickets-list-modal {
    width: 95%;
    max-height: 95vh;
  }

  .tickets-list-container {
    max-height: 400px;
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

