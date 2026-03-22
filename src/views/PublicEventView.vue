<template>
  <div class="public-evento">
    <header class="hero">
      <p class="badge">Entrada oficial</p>
      <h1>{{ page?.nombreEvento || "Evento" }}</h1>
      <p class="discoteca-name" v-if="page?.nombreDiscoteca">{{ page.nombreDiscoteca }}</p>
      <div class="meta">
        <p v-if="page?.fecha"><span>📅</span> {{ page.fecha }}</p>
        <p v-if="page?.ubicacion"><span>📍</span> {{ page.ubicacion }}</p>
      </div>
      <p v-if="page?.descripcion" class="descripcion">{{ page.descripcion }}</p>
    </header>

    <main class="content">
      <div v-if="loading" class="card">Cargando…</div>

      <div v-else-if="!available" class="card muted">
        <p>Esta página de compra no está disponible o el enlace no es válido.</p>
        <p class="hint">Pide al organizador un enlace actualizado.</p>
      </div>

      <div v-else class="card purchase">
        <h2>Comprar entradas</h2>
        <p class="price-line">
          <strong>{{ formatCOP(unitPrice) }}</strong>
          por entrada · {{ page.tipoEntrada || "General" }}
        </p>

        <form @submit.prevent="startPayment" class="form">
          <label>
            Nombre completo
            <input v-model="form.nombreCliente" type="text" required autocomplete="name" />
          </label>
          <label>
            Correo
            <input v-model="form.email" type="email" required autocomplete="email" />
          </label>
          <label>
            Teléfono
            <input v-model="form.telefono" type="tel" required autocomplete="tel" />
          </label>
          <label>
            Cantidad de entradas / manillas
            <input v-model.number="form.cantidad" type="number" min="1" max="20" required />
          </label>

          <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
          <p v-if="infoMsg" class="info">{{ infoMsg }}</p>

          <button type="submit" class="pay-btn" :disabled="submitting">
            {{ submitting ? "Preparando pago…" : "Pagar con Wompi" }}
          </button>
        </form>

        <p v-if="showThanks" class="thanks-banner">
          Gracias. Si tu pago fue aprobado, tu entrada quedará registrada en el sistema del evento. Revisa tu correo o
          contacta al organizador si necesitas el QR.
        </p>

        <p class="legal">
          El pago se procesa de forma segura con Wompi. Tras aprobar el pago, tu entrada se registrará automáticamente;
          conserva el comprobante y el QR que te envíe el organizador si aplica.
        </p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { databaseService } from "../services/databaseService";
import { getPreparePaymentUrl, openWompiCheckout } from "../services/wompiService";

const route = useRoute();
const router = useRouter();
const ownerUid = route.params.ownerUid;
const discotecaId = route.params.discotecaId;
const eventoId = route.params.eventoId;

const loading = ref(true);
const page = ref(null);
const errorMsg = ref("");
const infoMsg = ref("");
const submitting = ref(false);
const showThanks = ref(false);

const form = ref({
  nombreCliente: "",
  email: "",
  telefono: "",
  cantidad: 1,
});

const available = computed(() => page.value && page.value.enabled === true);

const unitPrice = computed(() => {
  const n = Number(page.value?.precioPorEntradaCOP);
  return Number.isFinite(n) && n > 0 ? n : 0;
});

let unsub = null;

function formatCOP(n) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

onMounted(() => {
  if (route.query.gracias === "1") {
    showThanks.value = true;
    router.replace({
      name: "PublicEvento",
      params: route.params,
      query: {},
    });
  }
  unsub = databaseService.subscribeToPublicEventPage(
    ownerUid,
    discotecaId,
    eventoId,
    (data) => {
      page.value = data;
      loading.value = false;
    }
  );
});

onUnmounted(() => {
  if (unsub) unsub();
});

async function startPayment() {
  errorMsg.value = "";
  infoMsg.value = "";
  if (!available.value || unitPrice.value <= 0) {
    errorMsg.value = "Precio no configurado para este evento.";
    return;
  }
  submitting.value = true;
  try {
    const url = getPreparePaymentUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerUid,
        discotecaId,
        eventoId,
        nombreCliente: form.value.nombreCliente.trim(),
        email: form.value.email.trim(),
        telefono: form.value.telefono.trim(),
        cantidad: form.value.cantidad,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || "No se pudo iniciar el pago");
    }
    await openWompiCheckout(data, () => {
      infoMsg.value =
        "Si completaste el pago, en unos segundos quedará registrada tu entrada. Revisa con el organizador o tu correo.";
    });
  } catch (e) {
    errorMsg.value = e.message || "Error al conectar con el servidor de pagos.";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.public-evento {
  min-height: 100vh;
  background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #fff;
  padding-bottom: 48px;
}

.hero {
  padding: 32px 20px 24px;
  text-align: center;
  max-width: 640px;
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
  font-size: 1.75rem;
  line-height: 1.2;
  margin-bottom: 8px;
}

.discoteca-name {
  opacity: 0.85;
  font-size: 1rem;
  margin-bottom: 16px;
}

.meta p {
  margin: 6px 0;
  font-size: 0.95rem;
  opacity: 0.9;
}

.descripcion {
  margin-top: 16px;
  text-align: left;
  opacity: 0.88;
  line-height: 1.5;
  font-size: 0.95rem;
}

.content {
  max-width: 440px;
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
  text-align: center;
  color: #555;
}

.hint {
  font-size: 0.9rem;
  margin-top: 8px;
  color: #888;
}

.purchase h2 {
  margin-bottom: 8px;
  font-size: 1.25rem;
}

.price-line {
  margin-bottom: 20px;
  color: #444;
  font-size: 0.95rem;
}

.form label {
  display: block;
  margin-bottom: 14px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.form input {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
}

.pay-btn {
  width: 100%;
  margin-top: 8px;
  padding: 14px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.pay-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #c0392b;
  font-size: 0.9rem;
  margin-top: 8px;
}

.info {
  color: #1e8449;
  font-size: 0.9rem;
  margin-top: 8px;
}

.legal {
  margin-top: 20px;
  font-size: 0.75rem;
  color: #666;
  line-height: 1.4;
}

.thanks-banner {
  background: #e8f8ef;
  border: 1px solid #b7e4c7;
  color: #1b4332;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  margin-bottom: 16px;
  line-height: 1.4;
}
</style>
