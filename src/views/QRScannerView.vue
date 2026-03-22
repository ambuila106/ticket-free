<template>
  <div class="scanner-view">
    <header class="header">
      <button @click="goBack" class="back-btn">← Volver</button>
      <h1>Lector de QR</h1>
    </header>

    <!-- Elemento oculto para decodificar QR desde archivo -->
    <div id="qr-file-reader" class="qr-file-reader-placeholder" aria-hidden="true"></div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden-file-input"
      aria-label="Cargar imagen con QR"
      @change="onFileSelected"
    />

    <main class="main-content">
      <div v-if="!scanning" class="start-section">
        <p>Inicia el escáner con cámara o sube una foto con el QR</p>
        <div class="start-actions">
          <button @click="startScanner" class="start-btn">Iniciar Escáner (cámara)</button>
          <button type="button" class="upload-btn" @click="triggerFileInput">Cargar foto con QR</button>
        </div>
      </div>

      <div v-else class="scanner-section">
        <div id="qr-reader" class="qr-reader-container"></div>
        <div class="scanner-actions">
          <button type="button" class="upload-btn inline" @click="triggerFileInput">Cargar foto</button>
          <button
            v-if="cameraList.length > 1"
            @click="switchCamera"
            class="switch-camera-btn"
            type="button"
          >
            📷 {{ currentCameraIsRear ? 'Cámara frontal' : 'Cámara trasera' }}
          </button>
          <button @click="stopScanner" class="stop-btn">Detener Escáner</button>
        </div>
      </div>

      <div v-if="scannedTicket" class="ticket-result">
        <h2>Ticket Encontrado</h2>
        <div class="ticket-info">
          <p><strong>Cliente:</strong> {{ scannedTicket.ticket.nombreCliente }}</p>
          <p><strong>Teléfono:</strong> {{ scannedTicket.ticket.telefono }}</p>
          <p><strong>Manillas / Boletas:</strong> {{ scannedTicket.ticket.cantidadBoletas ?? 1 }}</p>
          <p v-if="boletaIndex > 0"><strong>QR escaneado:</strong> entrada {{ boletaIndex }} de {{ totalBoletas }}</p>
          <p v-if="scannedTicket.ticket.tipoEntrada"><strong>Tipo entrada:</strong> {{ scannedTicket.ticket.tipoEntrada }}</p>
          <p v-if="scannedTicket.ticket.precio != null"><strong>Precio:</strong> {{ formatPrecio(scannedTicket.ticket.precio) }}</p>
          <p><strong>Estado:</strong>
            <span class="status-badge" :class="scannedTicket.ticket.estado">
              {{ scannedTicket.ticket.estado }}
            </span>
          </p>
          <p v-if="progresoEntrega" class="progress-line">{{ progresoEntrega }}</p>
          <p class="ticket-code"><strong>Código:</strong> {{ scannedTicket.scannedCode?.substring(0, 24) }}…</p>
        </div>
        
        <div v-if="scannedTicket.ticket.estado === 'pagado' && !codigoYaCanjeado" class="action-section">
          <button @click="markAsDelivered" class="deliver-btn">
            {{ totalBoletas > 1 ? '✅ Registrar esta entrada' : '✅ Marcar como Entregado' }}
          </button>
        </div>

        <div v-else-if="scannedTicket.ticket.estado === 'pagado' && codigoYaCanjeado" class="info-message">
          <p>Esta boleta ya fue registrada como entregada.</p>
        </div>
        
        <div v-else-if="scannedTicket.ticket.estado === 'entregado'" class="info-message">
          <p>Todas las entradas de esta compra ya fueron entregadas.</p>
        </div>
        
        <div v-else class="info-message">
          <p>Este ticket está cancelado</p>
        </div>

        <button @click="clearResult" class="clear-btn">Escanear Otro</button>
      </div>

      <div v-if="loadingFile" class="loading-file-message">
        <p>Leyendo QR de la imagen…</p>
      </div>

      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
        <button @click="error = ''" class="close-error-btn">Cerrar</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { databaseService } from '../services/databaseService';
import { permissionService } from '../services/permissionService';
import { bitacoraService } from '../services/bitacoraService';
import { QRReader, getCameraList, getDefaultCameraId, scanFileFromImage } from '../utils/qrReader';
import { getTicketSecureCodes } from '../utils/ticketCodes';

const route = useRoute();
const router = useRouter();
const discotecaId = route.params.discotecaId;
const eventoId = route.params.eventoId;
const user = ref(null);
const scanning = ref(false);
const scannedTicket = ref(null);
const error = ref('');
const cameraList = ref([]);
const currentCameraId = ref(null);
const fileInputRef = ref(null);
const loadingFile = ref(false);
let qrReader = null;

const currentCameraIsRear = computed(() => {
  const cam = cameraList.value.find((c) => c.id === currentCameraId.value);
  return cam?.isRear ?? false;
});

const totalBoletas = computed(() => {
  const t = scannedTicket.value?.ticket;
  if (!t) return 1;
  return getTicketSecureCodes(t).length || t.cantidadBoletas || 1;
});

const boletaIndex = computed(() => {
  const st = scannedTicket.value;
  if (!st?.ticket || !st.scannedCode) return 0;
  const codes = getTicketSecureCodes(st.ticket);
  const i = codes.indexOf(st.scannedCode);
  return i >= 0 ? i + 1 : 0;
});

const codigoYaCanjeado = computed(() => {
  const st = scannedTicket.value;
  if (!st?.ticket || !st.scannedCode) return false;
  const ec = st.ticket.entradasCanjeadas;
  if (!ec || typeof ec !== 'object') return false;
  return Boolean(ec[st.scannedCode]);
});

const progresoEntrega = computed(() => {
  const t = scannedTicket.value?.ticket;
  if (!t) return '';
  const codes = getTicketSecureCodes(t);
  if (codes.length <= 1) return '';
  const ec = t.entradasCanjeadas && typeof t.entradasCanjeadas === 'object' ? t.entradasCanjeadas : {};
  const n = Object.keys(ec).length;
  return `Entregadas en puerta: ${n} / ${codes.length}`;
});

function formatPrecio(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat('es', { style: 'currency', currency: 'COP' }).format(n);
}

onUnmounted(() => {
  if (qrReader) {
    qrReader.stop();
  }
});

/** Procesar código QR decodificado (cámara o archivo) */
async function processDecodedCode(decodedText) {
  try {
    const result = await databaseService.findTicketByCode(decodedText);
    if (!result) {
      error.value = 'Ticket no encontrado';
      return;
    }
    if (result.discotecaId !== discotecaId || result.eventoId !== eventoId) {
      error.value = 'Este ticket no pertenece a este evento';
      return;
    }
    scannedTicket.value = { ...result, scannedCode: decodedText };
    await bitacoraService.registrarAccion(
      result.uid,
      result.discotecaId,
      result.eventoId,
      'qr_escaneado',
      {
        ticketId: result.ticketId,
        ticketCode: decodedText.substring(0, 12),
        cliente: result.ticket.nombreCliente,
        estado: result.ticket.estado,
      }
    );
    if (qrReader) {
      await qrReader.stop();
    }
    scanning.value = false;
  } catch (err) {
    error.value = 'Error al buscar el ticket: ' + err.message;
  }
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

const onFileSelected = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  user.value = authService.getCurrentUser();
  if (!user.value) {
    router.push('/');
    return;
  }
  error.value = '';
  scannedTicket.value = null;
  loadingFile.value = true;
  const result = await scanFileFromImage(file);
  loadingFile.value = false;
  if (fileInputRef.value) fileInputRef.value.value = '';
  if (!result.success) {
    error.value = result.error || 'No se pudo leer el QR de la imagen';
    return;
  }
  await processDecodedCode(result.decodedText);
};

const startScanner = async () => {
  user.value = authService.getCurrentUser();
  if (!user.value) {
    router.push('/');
    return;
  }

  scanning.value = true;
  error.value = '';
  scannedTicket.value = null;
  cameraList.value = await getCameraList();
  currentCameraId.value = null;

  await new Promise((resolve) => setTimeout(resolve, 100));

  qrReader = new QRReader();
  qrReader.setOnScanSuccess((decodedText) => {
    processDecodedCode(decodedText);
  });

  qrReader.setOnScanError((errorMessage) => {
    // Ignorar errores menores de escaneo
    console.log('Error de escaneo:', errorMessage);
  });

  const preferredId = getDefaultCameraId(cameraList.value);
  const result = await qrReader.start(preferredId);
  if (!result.success) {
    error.value = result.error || 'Error al iniciar el escáner';
    scanning.value = false;
  } else {
    currentCameraId.value = qrReader.cameraId;
  }
};

const switchCamera = async () => {
  if (!qrReader || cameraList.value.length < 2) return;
  const currentIdx = cameraList.value.findIndex((c) => c.id === currentCameraId.value);
  const nextIdx = (currentIdx + 1) % cameraList.value.length;
  const nextCamera = cameraList.value[nextIdx];
  const result = await qrReader.switchCamera(nextCamera.id);
  if (result.success) {
    currentCameraId.value = nextCamera.id;
  } else {
    error.value = result.error || 'No se pudo cambiar la cámara';
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
    const code = scannedTicket.value.scannedCode;
    if (!code) {
      error.value = 'Código de escaneo no disponible';
      return;
    }

    const res = await databaseService.marcarBoletaEntregada(
      scannedTicket.value.uid,
      scannedTicket.value.discotecaId,
      scannedTicket.value.eventoId,
      scannedTicket.value.ticketId,
      code
    );

    if (res.yaUsado) {
      alert('Esta boleta ya había sido registrada.');
      return;
    }

    if (res.completo) {
      scannedTicket.value.ticket.estado = 'entregado';
      await bitacoraService.registrarAccion(
        scannedTicket.value.uid,
        scannedTicket.value.discotecaId,
        scannedTicket.value.eventoId,
        'estado_cambiado',
        {
          ticketId: scannedTicket.value.ticketId,
          ticketCode: code.substring(0, 12),
          cliente: scannedTicket.value.ticket.nombreCliente,
          estadoAnterior: 'pagado',
          estadoNuevo: 'entregado',
        }
      );
      alert(
        res.total > 1
          ? `Listo: las ${res.total} entradas de esta compra quedaron entregadas.`
          : 'Ticket marcado como entregado.'
      );
    } else {
      scannedTicket.value.ticket.entradasCanjeadas = {
        ...(scannedTicket.value.ticket.entradasCanjeadas || {}),
        [code]: Date.now(),
      };
      await bitacoraService.registrarAccion(
        scannedTicket.value.uid,
        scannedTicket.value.discotecaId,
        scannedTicket.value.eventoId,
        'estado_cambiado',
        {
          ticketId: scannedTicket.value.ticketId,
          ticketCode: code.substring(0, 12),
          cliente: scannedTicket.value.ticket.nombreCliente,
          estadoAnterior: 'pagado',
          estadoNuevo: 'pagado',
          detalle: `Boleta ${res.entregadas}/${res.total} entregada`,
        }
      );
      alert(`Entrada registrada (${res.entregadas} de ${res.total}). Escanea el siguiente QR cuando corresponda.`);
    }
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

.qr-file-reader-placeholder {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.hidden-file-input {
  position: absolute;
  width: 0.1px;
  height: 0.1px;
  opacity: 0;
  overflow: hidden;
  z-index: -1;
}

.start-section {
  background: white;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
}

.start-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  margin-top: 20px;
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
  width: 100%;
  max-width: 280px;
}

.upload-btn {
  background: #48bb78;
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  max-width: 280px;
  width: 100%;
}

.upload-btn.inline {
  padding: 12px 20px;
  font-size: 14px;
  width: auto;
}

.upload-btn:hover {
  background: #38a169;
}

.loading-file-message {
  background: #e6fffa;
  color: #234e52;
  padding: 16px;
  border-radius: 8px;
  margin-top: 20px;
  text-align: center;
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

.scanner-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
}

.switch-camera-btn {
  background: #5a67d8;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.switch-camera-btn:hover {
  background: #4c51bf;
}

.stop-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.stop-btn:hover {
  background: #c82333;
}

.ticket-code {
  font-size: 12px;
  color: #888;
  word-break: break-all;
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

  .scanner-actions {
    flex-direction: column;
  }

  .switch-camera-btn,
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

