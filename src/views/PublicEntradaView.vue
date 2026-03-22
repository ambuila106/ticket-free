<template>
  <div class="public-entrada">
    <header class="hero">
      <p class="badge">Tu entrada</p>
      <h1 v-if="success">{{ success.nombreEvento || "Evento" }}</h1>
      <h1 v-else>Confirmando compra…</h1>
      <p v-if="success?.nombreDiscoteca" class="sub">{{ success.nombreDiscoteca }}</p>
      <p v-if="success?.fecha" class="meta">📅 {{ success.fecha }}</p>
      <p v-if="success?.ubicacion" class="meta">📍 {{ success.ubicacion }}</p>
    </header>

    <main class="content">
      <div v-if="timedOut && !success" class="card muted">
        <p>
          Aún no vemos la confirmación del pago. Si ya pagaste, espera unos segundos y recarga; también revisa tu
          <strong>correo</strong> (te enviamos el QR si el correo está configurado en el servidor).
        </p>
        <button type="button" class="primary" @click="reload">Recargar</button>
      </div>

      <div v-else-if="!success" class="card">
        <p class="loading-text">Esperando confirmación del pago…</p>
        <p class="hint">No cierres esta ventana. Tras aprobar el pago aparecerá tu código QR.</p>
      </div>

      <div v-else class="card success">
        <p class="greet">Hola, <strong>{{ success.nombreCliente }}</strong></p>
        <p class="detail">
          {{ success.tipoEntrada || "General" }} · {{ success.cantidadBoletas || 1 }}
          {{ Number(success.cantidadBoletas) === 1 ? "entrada" : "entradas" }}
        </p>
        <p v-if="qrItems.length > 1" class="multi-hint">
          Cada código es <strong>una entrada</strong>. Lleva un QR distinto por persona.
        </p>
        <div v-if="buildingQrs" class="loading-text">Generando códigos QR…</div>
        <div v-else-if="qrItems.length" class="qr-grid" :class="{ many: qrItems.length > 4 }">
          <div v-for="(item, i) in qrItems" :key="i" class="qr-cell">
            <span class="qr-label">Entrada {{ i + 1 }} / {{ qrItems.length }}</span>
            <img :src="item.url" :alt="'QR entrada ' + (i + 1)" class="qr-img" />
            <button type="button" class="mini-dl" @click="downloadOne(item.url, i)">Descargar</button>
          </div>
        </div>
        <p class="email-hint">
          Te enviamos todos los QR a tu correo (si Resend está configurado en el servidor).
        </p>
        <div class="actions">
          <router-link v-if="backCompraHref" :to="backCompraHref" class="link-secondary">Volver al evento</router-link>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { databaseService } from "../services/databaseService";
import { generateQRCode } from "../utils/qrGenerator";
import { getTicketSecureCodes } from "../utils/ticketCodes";

const route = useRoute();
const reference = computed(() => String(route.params.reference || "").trim());

const success = ref(null);
const qrItems = ref([]);
const buildingQrs = ref(false);
const timedOut = ref(false);

let unsub = null;
let timeoutId = null;

const backCompraHref = computed(() => {
  const s = success.value;
  if (!s?.ownerUid || !s?.discotecaId || !s?.eventoId) return null;
  return {
    name: "PublicEvento",
    params: { ownerUid: s.ownerUid, discotecaId: s.discotecaId, eventoId: s.eventoId },
  };
});

function reload() {
  window.location.reload();
}

watch(
  () => success.value,
  async (s) => {
    qrItems.value = [];
    if (!s) return;
    const codes = getTicketSecureCodes(s);
    if (!codes.length) return;
    buildingQrs.value = true;
    try {
      const items = [];
      for (let i = 0; i < codes.length; i++) {
        const url = await generateQRCode(codes[i]);
        items.push({ url, code: codes[i] });
      }
      qrItems.value = items;
    } catch (e) {
      console.error(e);
    } finally {
      buildingQrs.value = false;
    }
  },
  { immediate: true }
);

function downloadOne(dataUrl, index) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `entrada-${reference.value || "qr"}-${String(index + 1).padStart(2, "0")}.png`;
  a.click();
}

onMounted(() => {
  const refKey = reference.value;
  if (!refKey || !refKey.startsWith("TF")) {
    timedOut.value = true;
    return;
  }

  unsub = databaseService.subscribeToPublicPurchaseSuccess(refKey, (data) => {
    success.value = data;
    if (data) timedOut.value = false;
  });

  timeoutId = window.setTimeout(() => {
    if (!success.value) timedOut.value = true;
  }, 120000);
});

onUnmounted(() => {
  if (unsub) unsub();
  if (timeoutId) clearTimeout(timeoutId);
});
</script>

<style scoped>
.public-entrada {
  min-height: 100vh;
  background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #fff;
  padding-bottom: 48px;
}

.hero {
  padding: 32px 20px 16px;
  text-align: center;
  max-width: 560px;
  margin: 0 auto;
}

.badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.15);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.hero h1 {
  font-size: 1.6rem;
  line-height: 1.2;
  margin-bottom: 8px;
}

.sub {
  opacity: 0.9;
  margin-bottom: 8px;
}

.meta {
  margin: 4px 0;
  font-size: 0.95rem;
  opacity: 0.88;
}

.content {
  max-width: 560px;
  margin: 0 auto;
  padding: 0 20px;
}

.card {
  background: #fff;
  color: #222;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.card.muted {
  color: #444;
  line-height: 1.5;
}

.loading-text {
  font-weight: 600;
  margin-bottom: 8px;
}

.hint {
  font-size: 0.9rem;
  color: #666;
}

.greet {
  margin-bottom: 8px;
}

.detail {
  color: #555;
  font-size: 0.95rem;
  margin-bottom: 20px;
}

.multi-hint {
  font-size: 0.9rem;
  color: #444;
  margin-bottom: 16px;
  line-height: 1.4;
}

.qr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.qr-grid.many {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.qr-cell {
  text-align: center;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 12px;
  background: #fafafa;
}

.qr-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #555;
  margin-bottom: 8px;
}

.qr-img {
  width: 100%;
  max-width: 220px;
  height: auto;
  aspect-ratio: 1;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.qr-grid.many .qr-img {
  max-width: 160px;
}

.mini-dl {
  margin-top: 8px;
  padding: 6px 12px;
  font-size: 0.8rem;
  border: 1px solid #667eea;
  background: #fff;
  color: #667eea;
  border-radius: 6px;
  cursor: pointer;
}

.email-hint {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 20px;
  line-height: 1.4;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.primary {
  width: 100%;
  padding: 14px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.link-secondary {
  text-align: center;
  color: #667eea;
  font-size: 0.95rem;
  text-decoration: none;
}

.link-secondary:hover {
  text-decoration: underline;
}
</style>
