<template>
  <div class="public-evento">
    <header class="hero">
      <p class="badge">Entradas oficiales</p>
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

      <!-- Pantalla de éxito -->
      <div v-else-if="ordenExitosa" class="card success">
        <h2>¡Pedido recibido! 🎉</h2>
        <p class="success-text">
          Tus {{ ordenExitosa.cantidad }} entrada(s) se crearon en estado
          <strong>pendiente de validación</strong>. El organizador verificará tu transferencia y las activará.
        </p>
        <div v-if="successQrs.length" class="qr-grid">
          <div v-for="(q, i) in successQrs" :key="i" class="qr-cell">
            <span class="qr-label">Entrada {{ i + 1 }} / {{ successQrs.length }}</span>
            <img :src="q" class="qr-img" alt="QR" />
          </div>
        </div>
        <p class="success-hint">
          Puedes ver y transferir tus entradas en <strong>Mis entradas</strong>.
        </p>
        <div class="success-actions">
          <router-link to="/mis-qrs" class="primary-link">Ver mis entradas</router-link>
          <router-link to="/eventos" class="secondary-link">Ver más eventos</router-link>
        </div>
      </div>

      <div v-else-if="!available" class="card muted">
        <p>Esta página de compra no está disponible o el enlace no es válido.</p>
        <p v-if="page && !isVentaActivada" class="hint">
          El organizador debe activar la <strong>venta pública</strong> del evento.
        </p>
        <p v-else-if="page && !precioValido" class="hint">
          Falta configurar el <strong>precio por entrada</strong>.
        </p>
        <p v-else-if="page && !pagoValido" class="hint">
          Falta configurar el <strong>número de Nequi / BRE-B</strong> para recibir las transferencias.
        </p>
        <p v-else class="hint">Pide al organizador un enlace actualizado.</p>
      </div>

      <!-- Necesita iniciar sesión -->
      <div v-else-if="!user" class="card login-card">
        <h2>Comprar entradas</h2>
        <p class="price-line"><strong>{{ formatCOP(unitPrice) }}</strong> por entrada</p>
        <p class="login-note">Inicia sesión para comprar y poder ver y transferir tus entradas (QRs).</p>
        <button class="google-btn" :disabled="loggingIn" @click="login">
          {{ loggingIn ? "Iniciando…" : "Iniciar sesión con Google" }}
        </button>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </div>

      <!-- Formulario de compra -->
      <div v-else class="card purchase">
        <h2>Comprar entradas</h2>
        <p class="price-line">
          <strong>{{ formatCOP(unitPrice) }}</strong> por entrada · {{ page.tipoEntrada || "General" }}
        </p>

        <label class="qty-row">
          Cantidad de entradas
          <input v-model.number="form.cantidad" type="number" min="1" max="20" />
        </label>

        <label class="colab-toggle">
          <input type="checkbox" v-model="compraParaOtro" />
          <span>Estoy comprando para otra persona (colaborador / vendedor)</span>
        </label>

        <div class="form">
          <label>
            Nombre completo de quien recibe la entrada
            <input v-model="form.nombre" type="text" autocomplete="name" />
          </label>
          <label>
            Cédula
            <input v-model="form.cedula" type="text" inputmode="numeric" />
          </label>
          <label>
            Correo
            <input v-model="form.email" type="email" autocomplete="email" />
            <small>Las entradas quedarán en la cuenta de este correo.</small>
          </label>
          <label>
            Teléfono
            <input v-model="form.telefono" type="tel" autocomplete="tel" />
          </label>
        </div>

        <div class="pay-box">
          <h3>💸 Realiza la transferencia</h3>
          <p class="pay-total">Total a transferir: <strong>{{ formatCOP(totalPrice) }}</strong></p>
          <div class="pay-data">
            <p><span class="pay-label">Método</span> {{ metodoLabel }}</p>
            <p>
              <span class="pay-label">Número</span>
              <strong class="pay-number">{{ page.pago?.numero }}</strong>
              <button type="button" class="copy-btn" @click="copyNumero">Copiar</button>
            </p>
            <p v-if="page.pago?.titular"><span class="pay-label">A nombre de</span> {{ page.pago.titular }}</p>
            <p v-if="page.pago?.instrucciones" class="pay-instr">{{ page.pago.instrucciones }}</p>
          </div>
          <p v-if="copyMsg" class="copy-msg">{{ copyMsg }}</p>
        </div>

        <div class="upload-box">
          <label class="upload-label">📎 Adjunta el pantallazo de la transferencia</label>
          <input type="file" accept="image/*" @change="onFileSelected" />
          <img v-if="comprobantePreview" :src="comprobantePreview" class="comprobante-preview" alt="Comprobante" />
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button type="button" class="pay-btn" :disabled="submitting || !puedeComprar" @click="terminarCompra">
          {{ submitting ? "Enviando pedido…" : "Terminar compra" }}
        </button>
        <p class="legal">
          Tu pedido quedará <strong>pendiente de validación</strong> hasta que el organizador confirme la transferencia.
        </p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { authService } from "../services/authService";
import { userService } from "../services/userService";
import { databaseService } from "../services/databaseService";
import { storageService } from "../services/storageService";
import { transferService } from "../services/transferService";
import { generateQRCode } from "../utils/qrGenerator";

const route = useRoute();
const ownerUid = route.params.ownerUid;
const discotecaId = route.params.discotecaId;
const eventoId = route.params.eventoId;

const loading = ref(true);
const page = ref(null);
const user = ref(null);
const loggingIn = ref(false);
const errorMsg = ref("");
const submitting = ref(false);
const compraParaOtro = ref(false);
const comprobanteFile = ref(null);
const comprobantePreview = ref("");
const copyMsg = ref("");
const ordenExitosa = ref(null);
const successQrs = ref([]);

const form = ref({
  nombre: "",
  cedula: "",
  email: "",
  telefono: "",
  cantidad: 1,
});

let unsub = null;

const isVentaActivada = computed(() => {
  if (!page.value) return false;
  const e = page.value.enabled;
  return e === true || e === "true" || e === 1;
});
const precioValido = computed(() => {
  const precio = Number(page.value?.precioPorEntradaCOP);
  return Number.isFinite(precio) && precio >= 100;
});
const pagoValido = computed(() => !!page.value?.pago?.numero);
const available = computed(() => isVentaActivada.value && precioValido.value && pagoValido.value);

const unitPrice = computed(() => {
  const n = Number(page.value?.precioPorEntradaCOP);
  return Number.isFinite(n) && n > 0 ? n : 0;
});
const cantidadSegura = computed(() => {
  let q = parseInt(form.value.cantidad, 10);
  if (!Number.isFinite(q) || q < 1) q = 1;
  if (q > 20) q = 20;
  return q;
});
const totalPrice = computed(() => unitPrice.value * cantidadSegura.value);

const metodoLabel = computed(() => {
  const m = page.value?.pago?.metodo;
  if (m === "bre-b") return "BRE-B";
  if (m === "nequi") return "Nequi";
  return m || "Transferencia";
});

const puedeComprar = computed(() => {
  return (
    !!comprobanteFile.value &&
    form.value.nombre.trim() &&
    form.value.cedula.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim()) &&
    form.value.telefono.trim()
  );
});

function formatCOP(n) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

async function autofillBuyer() {
  if (!user.value || compraParaOtro.value) return;
  // Datos por defecto: los del propio usuario / su perfil guardado.
  const profile = await userService.getBuyerProfile(user.value.uid);
  form.value.nombre = profile?.nombre || user.value.displayName || "";
  form.value.cedula = profile?.cedula || "";
  form.value.email = profile?.email || user.value.email || "";
  form.value.telefono = profile?.telefono || "";
}

onMounted(async () => {
  user.value = await authService.waitForAuthReady();
  if (user.value) {
    compraParaOtro.value = localStorage.getItem("userRole") === "colaborador";
    await userService.ensureRegistered(user.value);
    await autofillBuyer();
  }
  unsub = databaseService.subscribeToPublicEventPage(ownerUid, discotecaId, eventoId, (data) => {
    page.value = data;
    loading.value = false;
  });
});

onUnmounted(() => {
  if (unsub) unsub();
  if (comprobantePreview.value) URL.revokeObjectURL(comprobantePreview.value);
});

// Al marcar "compro para otra persona" (colaborador) limpiamos los datos para
// escribir los del cliente; al desmarcar, volvemos a autorrellenar los propios.
watch(compraParaOtro, (paraOtro) => {
  if (paraOtro) {
    form.value.nombre = "";
    form.value.cedula = "";
    form.value.email = "";
    form.value.telefono = "";
  } else {
    autofillBuyer();
  }
});

async function login() {
  loggingIn.value = true;
  errorMsg.value = "";
  const result = await authService.loginWithGoogle();
  if (result.success) {
    user.value = result.user;
    await userService.registerLogin(result.user);
    compraParaOtro.value = localStorage.getItem("userRole") === "colaborador";
    await autofillBuyer();
  } else {
    errorMsg.value = result.error || "No se pudo iniciar sesión";
  }
  loggingIn.value = false;
}

function onFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    errorMsg.value = "El comprobante debe ser una imagen";
    return;
  }
  errorMsg.value = "";
  comprobanteFile.value = file;
  if (comprobantePreview.value) URL.revokeObjectURL(comprobantePreview.value);
  comprobantePreview.value = URL.createObjectURL(file);
}

async function copyNumero() {
  try {
    await navigator.clipboard.writeText(String(page.value?.pago?.numero || ""));
    copyMsg.value = "Número copiado";
    setTimeout(() => (copyMsg.value = ""), 2500);
  } catch (_) {
    /* ignore */
  }
}

async function terminarCompra() {
  errorMsg.value = "";
  if (!puedeComprar.value) {
    errorMsg.value = "Completa todos los datos y adjunta el comprobante.";
    return;
  }
  submitting.value = true;
  try {
    const { url, path } = await storageService.uploadComprobante(comprobanteFile.value, ownerUid, eventoId, user.value.uid);

    const result = await transferService.submitTransferOrder({
      ownerUid,
      discotecaId,
      eventoId,
      cantidad: cantidadSegura.value,
      nombre: form.value.nombre.trim(),
      cedula: form.value.cedula.trim(),
      email: form.value.email.trim(),
      telefono: form.value.telefono.trim(),
      comprobantePath: path,
      comprobanteUrl: url,
      esColaborador: compraParaOtro.value,
    });

    // Guardar perfil del comprador para autorrelleno (solo si compra para sí mismo).
    if (!compraParaOtro.value && user.value) {
      await userService.saveBuyerProfile(user.value.uid, {
        nombre: form.value.nombre.trim(),
        cedula: form.value.cedula.trim(),
        email: form.value.email.trim(),
        telefono: form.value.telefono.trim(),
      });
    }

    const codes = result.secureCodes || [];
    successQrs.value = [];
    for (const c of codes) {
      successQrs.value.push(await generateQRCode(c));
    }
    ordenExitosa.value = result;
  } catch (e) {
    errorMsg.value = e.message || "No se pudo completar la compra";
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
  max-width: 480px;
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

.purchase h2,
.login-card h2,
.success h2 {
  margin-bottom: 8px;
  font-size: 1.3rem;
}

.price-line {
  margin-bottom: 18px;
  color: #444;
}

.login-note {
  color: #555;
  margin-bottom: 16px;
  line-height: 1.4;
  font-size: 0.95rem;
}

.google-btn {
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

.google-btn:disabled {
  opacity: 0.6;
}

.qty-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 600;
  color: #333;
  margin-bottom: 14px;
}

.qty-row input {
  width: 90px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  text-align: center;
}

.colab-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  color: #555;
  margin-bottom: 16px;
  background: #f5f5ff;
  padding: 10px;
  border-radius: 8px;
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

.form small {
  display: block;
  margin-top: 4px;
  color: #999;
  font-weight: 400;
  font-size: 0.78rem;
}

.pay-box {
  background: #f0fff4;
  border: 1px solid #9ae6b4;
  border-radius: 12px;
  padding: 16px;
  margin: 8px 0 18px;
}

.pay-box h3 {
  font-size: 1.05rem;
  margin-bottom: 10px;
  color: #22543d;
}

.pay-total {
  font-size: 1rem;
  margin-bottom: 12px;
  color: #22543d;
}

.pay-data p {
  margin: 6px 0;
  color: #2d3748;
  font-size: 0.92rem;
}

.pay-label {
  display: inline-block;
  width: 92px;
  color: #718096;
  font-size: 0.8rem;
}

.pay-number {
  font-size: 1.1rem;
  letter-spacing: 0.5px;
}

.copy-btn {
  margin-left: 10px;
  background: #38a169;
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.pay-instr {
  font-style: italic;
  color: #555 !important;
}

.copy-msg {
  color: #2d7a4d;
  font-size: 0.85rem;
  margin-top: 6px;
}

.upload-box {
  margin-bottom: 16px;
}

.upload-label {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.comprobante-preview {
  margin-top: 12px;
  max-width: 100%;
  max-height: 240px;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.pay-btn {
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

.pay-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: #c0392b;
  font-size: 0.9rem;
  margin-top: 10px;
}

.legal {
  margin-top: 16px;
  font-size: 0.78rem;
  color: #666;
  line-height: 1.4;
}

.success-text {
  color: #444;
  line-height: 1.5;
  margin-bottom: 16px;
}

.qr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.qr-cell {
  text-align: center;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #fafafa;
}

.qr-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: #666;
  margin-bottom: 6px;
}

.qr-img {
  width: 100%;
  max-width: 150px;
  aspect-ratio: 1;
}

.success-hint {
  color: #555;
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.success-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.primary-link,
.secondary-link {
  display: block;
  text-align: center;
  padding: 12px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 600;
}

.primary-link {
  background: #667eea;
  color: #fff;
}

.secondary-link {
  background: #f0f0f0;
  color: #444;
}
</style>
