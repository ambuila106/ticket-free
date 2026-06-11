<template>
  <div class="mis-qrs">
    <header class="header">
      <div class="header-top">
        <button @click="$router.push('/select-role')" class="back-btn">← Volver</button>
        <button @click="logout" class="logout-btn">Salir</button>
      </div>
      <h1>🎟️ Mis entradas</h1>
      <p class="subtitle">{{ user?.email }}</p>
    </header>

    <main class="content">
      <!-- Transferencias pendientes de aceptar -->
      <section v-if="pendientes.length" class="pending-zone">
        <h2>Transferencias recibidas</h2>
        <p class="hint">Alguien te envió entradas. Acéptalas para que aparezcan en tu cuenta.</p>
        <div v-for="t in pendientes" :key="t.id" class="pending-card">
          <div>
            <p><strong>{{ t.cantidad || (t.items ? t.items.length : 1) }}</strong> entrada(s)</p>
            <p class="pending-meta">{{ t.nombreEvento || 'Evento' }}</p>
            <p class="pending-meta">De: {{ t.fromEmail || '—' }}</p>
          </div>
          <button class="accept-btn" :disabled="acceptingId === t.id" @click="accept(t)">
            {{ acceptingId === t.id ? 'Aceptando…' : 'Aceptar' }}
          </button>
        </div>
      </section>

      <!-- Barra de acciones de transferencia -->
      <section v-if="selected.size > 0" class="transfer-bar">
        <span>{{ selected.size }} seleccionada(s)</span>
        <input v-model="transferEmail" type="email" placeholder="correo destino@ejemplo.com" class="transfer-input" />
        <button class="transfer-btn" :disabled="transferring" @click="transfer">
          {{ transferring ? 'Enviando…' : 'Transferir' }}
        </button>
        <button class="clear-sel-btn" @click="clearSelection">Cancelar</button>
      </section>

      <div v-if="loading" class="state">Cargando tus entradas…</div>

      <div v-else-if="qrs.length === 0" class="state">
        <p>Todavía no tienes entradas.</p>
        <router-link to="/eventos" class="state-link">Ver eventos próximos</router-link>
      </div>

      <div v-else class="qr-grid">
        <div
          v-for="qr in qrs"
          :key="qr.key"
          class="qr-card"
          :class="qr.estado"
        >
          <div class="qr-card-head">
            <span class="estado-badge" :class="qr.estado">{{ estadoLabel(qr) }}</span>
            <label v-if="canSelect(qr)" class="check">
              <input
                type="checkbox"
                :checked="selected.has(qr.key)"
                @change="toggleSelect(qr.key, $event.target.checked)"
              />
            </label>
          </div>
          <img v-if="qrImages[qr.code]" :src="qrImages[qr.code]" class="qr-img" alt="QR" />
          <div v-else class="qr-img placeholder">QR</div>
          <p class="qr-event">{{ qr.nombreEvento || 'Evento' }}</p>
          <p v-if="qr.fecha" class="qr-meta">📅 {{ qr.fecha }}</p>
          <p v-if="qr.ubicacion" class="qr-meta">📍 {{ qr.ubicacion }}</p>
          <p v-if="qr.pendingToEmail" class="qr-pending">En transferencia a {{ qr.pendingToEmail }}</p>
          <button
            v-if="qr.pendingToEmail"
            class="cancel-transfer-btn"
            :disabled="cancelingKey === qr.key"
            @click="cancelTransfer(qr)"
          >
            {{ cancelingKey === qr.key ? 'Cancelando…' : 'Cancelar transferencia' }}
          </button>
          <button v-if="qrImages[qr.code] && !qr.pendingToEmail" class="dl-btn" @click="download(qr)">Descargar</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { databaseService } from '../services/databaseService';
import { transferService } from '../services/transferService';
import { generateQRCode } from '../utils/qrGenerator';
import { emailToKey } from '../config/appConfig';

const router = useRouter();
const user = ref(null);
const qrs = ref([]);
const pendientes = ref([]);
const qrImages = ref({});
const loading = ref(true);
const selected = ref(new Set());
const transferEmail = ref('');
const transferring = ref(false);
const acceptingId = ref(null);
const cancelingKey = ref(null);

let unsubQrs = null;
let unsubPending = null;

function estadoLabel(qr) {
  if (qr.pendingToEmail) return 'En transferencia';
  const map = {
    sin_validar: 'Pendiente de validación',
    pagado: 'Válida',
    entregado: 'Entregada',
    cancelado: 'Cancelada',
  };
  return map[qr.estado] || qr.estado;
}

function canSelect(qr) {
  if (qr.pendingToEmail) return false;
  return qr.estado === 'pagado' || qr.estado === 'sin_validar';
}

function toggleSelect(key, checked) {
  const next = new Set(selected.value);
  if (checked) next.add(key);
  else next.delete(key);
  selected.value = next;
}

function clearSelection() {
  selected.value = new Set();
}

watch(
  qrs,
  async (list) => {
    for (const qr of list) {
      if (qr.code && !qrImages.value[qr.code]) {
        try {
          qrImages.value = { ...qrImages.value, [qr.code]: await generateQRCode(qr.code) };
        } catch (_) {
          /* ignore */
        }
      }
    }
  },
  { deep: false }
);

onMounted(async () => {
  user.value = await authService.waitForAuthReady();
  if (!user.value) {
    router.push('/');
    return;
  }
  await authService.getIdToken();
  const key = emailToKey(user.value.email);

  unsubQrs = databaseService.subscribeToMyQrs(
    key,
    (list) => {
      qrs.value = list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      loading.value = false;
    },
    () => {
      loading.value = false;
    }
  );

  unsubPending = databaseService.subscribeToPendingTransfers(key, (list) => {
    pendientes.value = list;
  });
});

onUnmounted(() => {
  if (unsubQrs) unsubQrs();
  if (unsubPending) unsubPending();
});

async function transfer() {
  const email = transferEmail.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Escribe un correo válido');
    return;
  }
  if (email === (user.value.email || '').toLowerCase()) {
    alert('No puedes transferirte a ti mismo');
    return;
  }
  const items = qrs.value
    .filter((q) => selected.value.has(q.key))
    .map((q) => ({
      ownerUid: q.ownerUid,
      discotecaId: q.discotecaId,
      eventoId: q.eventoId,
      ticketId: q.ticketId,
      code: q.code,
    }));
  if (items.length === 0) return;

  transferring.value = true;
  try {
    await transferService.requestQrTransfer(items, email);
    alert('Transferencia enviada. Aparecerá como pendiente hasta que el destinatario la acepte.');
    clearSelection();
    transferEmail.value = '';
  } catch (e) {
    alert('No se pudo transferir: ' + (e.message || 'error'));
  } finally {
    transferring.value = false;
  }
}

async function accept(t) {
  acceptingId.value = t.id;
  try {
    await transferService.acceptQrTransfer(t.id);
    alert('Entradas aceptadas. Ya aparecen en tu cuenta.');
  } catch (e) {
    alert('No se pudo aceptar: ' + (e.message || 'error'));
  } finally {
    acceptingId.value = null;
  }
}

async function cancelTransfer(qr) {
  if (!confirm('¿Cancelar la transferencia de este QR? Volverá a quedar disponible en tu cuenta.')) return;
  cancelingKey.value = qr.key;
  try {
    await transferService.cancelQrTransfer([
      {
        ownerUid: qr.ownerUid,
        discotecaId: qr.discotecaId,
        eventoId: qr.eventoId,
        ticketId: qr.ticketId,
        code: qr.code,
      },
    ]);
  } catch (e) {
    alert('No se pudo cancelar: ' + (e.message || 'error'));
  } finally {
    cancelingKey.value = null;
  }
}

function download(qr) {
  const url = qrImages.value[qr.code];
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = `entrada-${String(qr.code).substring(0, 8)}.png`;
  a.click();
}

const logout = async () => {
  await authService.logout();
  localStorage.removeItem('userRole');
  router.push('/');
};
</script>

<style scoped>
.mis-qrs {
  min-height: 100vh;
  background: #f5f6fa;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 20px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.back-btn,
.logout-btn {
  background: rgba(255, 255, 255, 0.18);
  border: none;
  color: #fff;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.header h1 {
  font-size: 1.6rem;
}

.subtitle {
  opacity: 0.85;
  font-size: 0.9rem;
  margin-top: 4px;
}

.content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.pending-zone {
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 20px;
}

.pending-zone h2 {
  font-size: 1.2rem;
  color: #7a5c00;
  margin-bottom: 6px;
}

.hint {
  color: #8a6d00;
  font-size: 13px;
  margin-bottom: 12px;
}

.pending-card {
  background: #fff;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.pending-meta {
  font-size: 13px;
  color: #777;
  margin-top: 2px;
}

.accept-btn {
  background: #48bb78;
  color: #fff;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.accept-btn:disabled {
  opacity: 0.6;
}

.transfer-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 18px;
}

.transfer-input {
  flex: 1;
  min-width: 180px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.transfer-btn {
  background: #667eea;
  color: #fff;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.transfer-btn:disabled {
  opacity: 0.6;
}

.clear-sel-btn {
  background: #f0f0f0;
  border: none;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
}

.state {
  text-align: center;
  padding: 50px 20px;
  color: #666;
  background: #fff;
  border-radius: 14px;
}

.state-link {
  display: inline-block;
  margin-top: 12px;
  color: #667eea;
  font-weight: 600;
  text-decoration: none;
}

.qr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}

.qr-card {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.07);
  text-align: center;
  border-top: 4px solid #ccc;
}

.qr-card.pagado {
  border-top-color: #48bb78;
}
.qr-card.sin_validar {
  border-top-color: #ffc107;
}
.qr-card.entregado {
  border-top-color: #6c757d;
}
.qr-card.cancelado {
  border-top-color: #dc3545;
  opacity: 0.7;
}

.qr-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.estado-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}

.estado-badge.pagado {
  background: #d4edda;
  color: #155724;
}
.estado-badge.sin_validar {
  background: #fff3cd;
  color: #856404;
}
.estado-badge.entregado {
  background: #e2e3e5;
  color: #383d41;
}
.estado-badge.cancelado {
  background: #f8d7da;
  color: #721c24;
}

.qr-img {
  width: 100%;
  max-width: 180px;
  aspect-ratio: 1;
  margin: 0 auto;
  border-radius: 8px;
  border: 1px solid #eee;
}

.qr-img.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f3f3;
  color: #aaa;
}

.qr-event {
  font-weight: 700;
  color: #333;
  margin-top: 12px;
}

.qr-meta {
  font-size: 13px;
  color: #777;
  margin-top: 3px;
}

.qr-pending {
  font-size: 12px;
  color: #b8860b;
  margin-top: 6px;
}

.dl-btn {
  margin-top: 12px;
  background: #667eea;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.cancel-transfer-btn {
  margin-top: 10px;
  background: #fff;
  color: #dc3545;
  border: 1px solid #dc3545;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.cancel-transfer-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .transfer-bar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
