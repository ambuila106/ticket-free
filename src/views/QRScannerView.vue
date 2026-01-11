<template>
  <div class="scanner-view">
    <header class="header">
      <button @click="goBack" class="back-btn">← Volver</button>
      <h1>Lector de QR</h1>
    </header>

    <main class="main-content">
      <div v-if="!scanning" class="start-section">
        <p>Presiona el botón para iniciar el escáner de QR</p>
        <button @click="startScanner" class="start-btn">Iniciar Escáner</button>
      </div>

      <div v-else class="scanner-section">
        <div id="qr-reader" class="qr-reader-container"></div>
        <button @click="stopScanner" class="stop-btn">Detener Escáner</button>
      </div>

      <div v-if="scannedTicket" class="ticket-result">
        <h2>Ticket Encontrado</h2>
        <div class="ticket-info">
          <p><strong>Cliente:</strong> {{ scannedTicket.ticket.nombreCliente }}</p>
          <p><strong>Teléfono:</strong> {{ scannedTicket.ticket.telefono }}</p>
          <p><strong>Estado actual:</strong> 
            <span class="status-badge" :class="scannedTicket.ticket.estado">
              {{ scannedTicket.ticket.estado }}
            </span>
          </p>
        </div>
        
        <div v-if="scannedTicket.ticket.estado === 'pagado'" class="action-section">
          <button @click="markAsDelivered" class="deliver-btn">
            ✅ Marcar como Entregado
          </button>
        </div>
        
        <div v-else-if="scannedTicket.ticket.estado === 'entregado'" class="info-message">
          <p>Este ticket ya fue entregado</p>
        </div>
        
        <div v-else class="info-message">
          <p>Este ticket está cancelado</p>
        </div>

        <button @click="clearResult" class="clear-btn">Escanear Otro</button>
      </div>

      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
        <button @click="error = ''" class="close-error-btn">Cerrar</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { databaseService } from '../services/databaseService';
import { permissionService } from '../services/permissionService';
import { bitacoraService } from '../services/bitacoraService';
import { QRReader } from '../utils/qrReader';

const route = useRoute();
const router = useRouter();
const discotecaId = route.params.discotecaId;
const eventoId = route.params.eventoId;
const user = ref(null);
const scanning = ref(false);
const scannedTicket = ref(null);
const error = ref('');
let qrReader = null;

onUnmounted(() => {
  if (qrReader) {
    qrReader.stop();
  }
});

const startScanner = async () => {
  user.value = authService.getCurrentUser();
  if (!user.value) {
    router.push('/');
    return;
  }

  scanning.value = true;
  error.value = '';
  scannedTicket.value = null;

  // Esperar un momento para que el DOM se actualice
  await new Promise(resolve => setTimeout(resolve, 100));

  qrReader = new QRReader();
  
  qrReader.setOnScanSuccess(async (decodedText) => {
    try {
      // Buscar ticket por código
      const result = await databaseService.findTicketByCode(decodedText);
      
      if (result) {
        // Verificar que el ticket pertenece a este evento
        if (result.discotecaId === discotecaId && result.eventoId === eventoId) {
          scannedTicket.value = result;
          
          // Registrar escaneo en bitácora
          await bitacoraService.registrarAccion(
            result.uid,
            result.discotecaId,
            result.eventoId,
            'qr_escaneado',
            {
              ticketId: result.ticketId,
              ticketCode: result.ticket.secureCode.substring(0, 12),
              cliente: result.ticket.nombreCliente,
              estado: result.ticket.estado
            }
          );
          
          await qrReader.stop();
          scanning.value = false;
        } else {
          error.value = 'Este ticket no pertenece a este evento';
        }
      } else {
        error.value = 'Ticket no encontrado';
      }
    } catch (err) {
      error.value = 'Error al buscar el ticket: ' + err.message;
    }
  });

  qrReader.setOnScanError((errorMessage) => {
    // Ignorar errores menores de escaneo
    console.log('Error de escaneo:', errorMessage);
  });

  const result = await qrReader.start();
  if (!result.success) {
    error.value = result.error || 'Error al iniciar el escáner';
    scanning.value = false;
  }
};

const stopScanner = async () => {
  if (qrReader) {
    await qrReader.stop();
  }
  scanning.value = false;
};

const markAsDelivered = async () => {
  if (!scannedTicket.value) return;

  // Verificar permisos
  const user = authService.getCurrentUser();
  if (!user) {
    error.value = 'Usuario no autenticado';
    return;
  }

  // Verificar si es el dueño o tiene permiso de leerQR
  const isOwner = user.uid === scannedTicket.value.uid;
  let hasPermission = isOwner;

  if (!isOwner) {
    hasPermission = await permissionService.checkCollaboratorPermission(
      scannedTicket.value.uid,
      scannedTicket.value.discotecaId,
      scannedTicket.value.eventoId,
      'leerQR'
    );
  }

  if (!hasPermission) {
    error.value = 'No tienes permiso para cambiar el estado de este ticket';
    return;
  }

  try {
    await databaseService.updateTicketStatus(
      scannedTicket.value.uid,
      scannedTicket.value.discotecaId,
      scannedTicket.value.eventoId,
      scannedTicket.value.ticketId,
      'entregado'
    );

    scannedTicket.value.ticket.estado = 'entregado';
    
    // Registrar cambio de estado en bitácora
    await bitacoraService.registrarAccion(
      scannedTicket.value.uid,
      scannedTicket.value.discotecaId,
      scannedTicket.value.eventoId,
      'estado_cambiado',
      {
        ticketId: scannedTicket.value.ticketId,
        ticketCode: scannedTicket.value.ticket.secureCode.substring(0, 12),
        cliente: scannedTicket.value.ticket.nombreCliente,
        estadoAnterior: 'pagado',
        estadoNuevo: 'entregado'
      }
    );
    
    alert('Ticket marcado como entregado exitosamente');
  } catch (err) {
    error.value = 'Error al actualizar el estado: ' + err.message;
  }
};

const clearResult = () => {
  scannedTicket.value = null;
  error.value = '';
  startScanner();
};

const goBack = async () => {
  if (qrReader) {
    await qrReader.stop();
  }
  router.push(`/evento/${discotecaId}/${eventoId}`);
};
</script>

<style scoped>
.scanner-view {
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
}

.main-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.start-section {
  background: white;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
}

.start-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 20px;
}

.scanner-section {
  background: white;
  padding: 20px;
  border-radius: 12px;
}

.qr-reader-container {
  width: 100%;
  max-width: 500px;
  margin: 0 auto 20px;
}

.stop-btn {
  display: block;
  margin: 20px auto 0;
  background: #dc3545;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.ticket-result {
  background: white;
  padding: 30px;
  border-radius: 12px;
  margin-top: 20px;
}

.ticket-result h2 {
  color: #333;
  margin-bottom: 20px;
}

.ticket-info p {
  margin-bottom: 12px;
  color: #666;
  font-size: 16px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.pagado {
  background: #fff3cd;
  color: #856404;
}

.status-badge.entregado {
  background: #d4edda;
  color: #155724;
}

.status-badge.cancelado {
  background: #f8d7da;
  color: #721c24;
}

.action-section {
  margin: 20px 0;
}

.deliver-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
}

.deliver-btn:hover {
  background: #218838;
}

.info-message {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
  color: #666;
}

.clear-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 15px;
  border-radius: 8px;
  margin-top: 20px;
}

.close-error-btn {
  margin-top: 10px;
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

/* Responsive Mobile */
@media (max-width: 768px) {
  .header {
    padding: 15px;
    margin-bottom: 20px;
  }

  .header h1 {
    font-size: 1.5rem;
  }

  .main-content {
    padding: 15px;
  }

  .start-section {
    padding: 30px 20px;
  }

  .start-btn {
    width: 100%;
    padding: 14px;
    font-size: 15px;
  }

  .scanner-section {
    padding: 15px;
  }

  .qr-reader-container {
    max-width: 100%;
  }

  .stop-btn {
    width: 100%;
    padding: 14px;
    font-size: 15px;
  }

  .ticket-result {
    padding: 20px;
  }

  .ticket-result h2 {
    font-size: 1.3rem;
  }

  .ticket-info p {
    font-size: 14px;
  }

  .deliver-btn {
    width: 100%;
    padding: 14px;
  }

  .clear-btn {
    width: 100%;
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .header h1 {
    font-size: 1.3rem;
  }

  .start-section {
    padding: 25px 15px;
  }

  .ticket-result {
    padding: 15px;
  }
}
</style>

