<template>
  <div class="admin-view">
    <header class="header">
      <div class="header-top">
        <button @click="$router.push('/select-role')" class="back-btn">← Volver</button>
        <button @click="logout" class="logout-btn">Salir</button>
      </div>
      <h1>🛡️ Panel de administración</h1>
      <p class="subtitle">{{ user?.email }}</p>
    </header>

    <nav class="tabs">
      <button :class="{ active: tab === 'usuarios' }" @click="tab = 'usuarios'">
        Usuarios ({{ users.length }})
      </button>
      <button :class="{ active: tab === 'eventos' }" @click="tab = 'eventos'">
        Eventos ({{ events.length }})
      </button>
      <button :class="{ active: tab === 'comprobantes' }" @click="tab = 'comprobantes'">
        Comprobantes ({{ comprobantes.length }})
      </button>
    </nav>

    <main class="content">
      <!-- USUARIOS -->
      <section v-if="tab === 'usuarios'">
        <div class="stats-row">
          <div class="stat">
            <span class="stat-num">{{ users.length }}</span>
            <span class="stat-label">Usuarios registrados</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ totalLogins }}</span>
            <span class="stat-label">Total de inicios de sesión</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ organizadoresActivos }}</span>
            <span class="stat-label">Organizadores activos</span>
          </div>
        </div>

        <input v-model="userSearch" class="search" type="text" placeholder="Buscar por nombre o correo…" />

        <div v-if="loadingUsers" class="loading">Cargando usuarios…</div>
        <div v-else class="user-list">
          <div v-for="u in filteredUsers" :key="u.uid" class="user-card">
            <img v-if="u.photoURL" :src="u.photoURL" class="avatar" alt="" referrerpolicy="no-referrer" />
            <div v-else class="avatar placeholder">{{ (u.displayName || u.email || '?').charAt(0).toUpperCase() }}</div>
            <div class="user-info">
              <p class="user-name">
                {{ u.displayName || '(sin nombre)' }}
                <span v-if="isAdminEmail(u.email)" class="admin-tag">ADMIN</span>
              </p>
              <p class="user-email">{{ u.email }}</p>
              <p class="user-meta">
                {{ u.loginCount || 1 }} inicios · último: {{ formatDate(u.lastLoginAt) }}
              </p>
            </div>
            <label class="switch" :title="u.organizerEnabled ? 'Organizador activo' : 'Organizador desactivado'">
              <input
                type="checkbox"
                :checked="isAdminEmail(u.email) || u.organizerEnabled === true"
                :disabled="isAdminEmail(u.email) || savingUid === u.uid"
                @change="toggleOrganizer(u, $event.target.checked)"
              />
              <span class="slider"></span>
              <span class="switch-text">Organizador</span>
            </label>
          </div>
          <div v-if="filteredUsers.length === 0" class="empty">No hay usuarios.</div>
        </div>
      </section>

      <!-- EVENTOS -->
      <section v-else-if="tab === 'eventos'">
        <p class="hint">Activa "Mostrar en home" para que el evento aparezca en la landing pública (/eventos).</p>
        <input v-model="eventSearch" class="search" type="text" placeholder="Buscar evento o dueño…" />
        <div v-if="loadingEvents" class="loading">Cargando eventos…</div>
        <div v-else class="event-list">
          <div v-for="ev in filteredEvents" :key="ev.ownerUid + ev.eventoId" class="event-card">
            <div class="event-main">
              <p class="event-name">{{ ev.nombre }}</p>
              <p class="event-meta">📅 {{ ev.fecha || 'Sin fecha' }}</p>
              <p class="event-meta">👤 {{ ev.ownerEmail || ev.ownerUid }}</p>
              <p class="event-meta">
                <span :class="['pill', ev.publicEnabled ? 'on' : 'off']">
                  {{ ev.publicEnabled ? 'Venta pública activa' : 'Venta pública inactiva' }}
                </span>
              </p>
            </div>
            <div class="event-actions">
              <a
                :href="`/comprar/${ev.ownerUid}/${ev.discotecaId}/${ev.eventoId}`"
                target="_blank"
                rel="noopener"
                class="view-link"
              >Ver página</a>
              <label class="switch">
                <input
                  type="checkbox"
                  :checked="ev.showOnHome === true"
                  :disabled="savingEventKey === ev.ownerUid + ev.eventoId"
                  @change="toggleHome(ev, $event.target.checked)"
                />
                <span class="slider"></span>
                <span class="switch-text">Mostrar en home</span>
              </label>
            </div>
          </div>
          <div v-if="filteredEvents.length === 0" class="empty">No hay eventos en el catálogo todavía.</div>
        </div>
      </section>

      <!-- COMPROBANTES -->
      <section v-else>
        <p class="hint">Comprobantes de transferencia. Borrar libera espacio en Firebase.</p>
        <div v-if="loadingComprobantes" class="loading">Cargando comprobantes…</div>
        <div v-else-if="comprobantes.length === 0" class="empty">No hay comprobantes.</div>
        <div v-else>
          <div class="comprobantes-grid">
            <div v-for="c in pagedComprobantes" :key="c.ownerUid + c.ticketId" class="comprobante-card">
              <a :href="c.url" target="_blank" rel="noopener">
                <img :src="c.url" class="comprobante-img" alt="Comprobante" />
              </a>
              <div class="comprobante-info">
                <p><strong>{{ c.nombreEvento || 'Evento' }}</strong></p>
                <p>{{ c.cliente || '' }}</p>
                <p class="comprobante-date">{{ formatDate(c.createdAt) }}</p>
              </div>
              <button class="delete-btn" :disabled="deletingKey === c.ownerUid + c.ticketId" @click="deleteComprobante(c)">
                {{ deletingKey === c.ownerUid + c.ticketId ? 'Borrando…' : '🗑 Borrar' }}
              </button>
            </div>
          </div>
          <div class="pagination">
            <button :disabled="page === 0" @click="page--">← Anterior</button>
            <span>Página {{ page + 1 }} de {{ totalPages }}</span>
            <button :disabled="page >= totalPages - 1" @click="page++">Siguiente →</button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { adminService } from '../services/adminService';
import { databaseService } from '../services/databaseService';
import { storageService } from '../services/storageService';
import { isAdminEmail } from '../config/appConfig';

const router = useRouter();
const user = ref(null);
const tab = ref('usuarios');

const users = ref([]);
const events = ref([]);
const comprobantes = ref([]);
const loadingUsers = ref(true);
const loadingEvents = ref(true);
const loadingComprobantes = ref(true);
const userSearch = ref('');
const eventSearch = ref('');
const savingUid = ref(null);
const savingEventKey = ref(null);
const deletingKey = ref(null);
const page = ref(0);
const pageSize = 10;

const totalLogins = computed(() =>
  users.value.reduce((sum, u) => sum + (Number(u.loginCount) || 0), 0)
);
const organizadoresActivos = computed(() =>
  users.value.filter((u) => isAdminEmail(u.email) || u.organizerEnabled === true).length
);

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(
    (u) =>
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
  );
});

const filteredEvents = computed(() => {
  const q = eventSearch.value.trim().toLowerCase();
  if (!q) return events.value;
  return events.value.filter(
    (ev) =>
      (ev.nombre || '').toLowerCase().includes(q) ||
      (ev.ownerEmail || '').toLowerCase().includes(q)
  );
});

const totalPages = computed(() => Math.max(1, Math.ceil(comprobantes.value.length / pageSize)));
const pagedComprobantes = computed(() =>
  comprobantes.value.slice(page.value * pageSize, page.value * pageSize + pageSize)
);

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-CO');
}

onMounted(async () => {
  user.value = await authService.waitForAuthReady();
  if (!user.value) {
    router.push('/');
    return;
  }
  await Promise.all([loadUsers(), loadEvents(), loadComprobantes()]);
});

async function loadUsers() {
  loadingUsers.value = true;
  try {
    users.value = await adminService.listUsers();
  } catch (e) {
    console.error('Error cargando usuarios:', e);
  } finally {
    loadingUsers.value = false;
  }
}

async function loadEvents() {
  loadingEvents.value = true;
  try {
    events.value = await adminService.listEvents();
  } catch (e) {
    console.error('Error cargando eventos:', e);
  } finally {
    loadingEvents.value = false;
  }
}

async function loadComprobantes() {
  loadingComprobantes.value = true;
  try {
    comprobantes.value = await adminService.listAllComprobantes();
  } catch (e) {
    console.error('Error cargando comprobantes:', e);
  } finally {
    loadingComprobantes.value = false;
  }
}

async function toggleOrganizer(u, enabled) {
  if (isAdminEmail(u.email)) return;
  savingUid.value = u.uid;
  try {
    await adminService.setOrganizerEnabled(u.uid, enabled);
    u.organizerEnabled = enabled;
  } catch (e) {
    alert('No se pudo actualizar el permiso: ' + (e.message || 'error'));
  } finally {
    savingUid.value = null;
  }
}

async function toggleHome(ev, value) {
  const key = ev.ownerUid + ev.eventoId;
  savingEventKey.value = key;
  try {
    await adminService.setShowOnHome(ev.ownerUid, ev.discotecaId, ev.eventoId, value);
    ev.showOnHome = value;
  } catch (e) {
    alert('No se pudo actualizar: ' + (e.message || 'error'));
  } finally {
    savingEventKey.value = null;
  }
}

async function deleteComprobante(c) {
  if (!confirm('¿Borrar este comprobante? Esta acción no se puede deshacer.')) return;
  const key = c.ownerUid + c.ticketId;
  deletingKey.value = key;
  try {
    if (c.path) await storageService.deleteByPath(c.path);
    await databaseService.removeComprobanteRecord(c.ownerUid, c.discotecaId, c.eventoId, c.ticketId);
    comprobantes.value = comprobantes.value.filter((x) => x.ownerUid + x.ticketId !== key);
    if (page.value >= totalPages.value) page.value = Math.max(0, totalPages.value - 1);
  } catch (e) {
    alert('No se pudo borrar: ' + (e.message || 'error'));
  } finally {
    deletingKey.value = null;
  }
}

const logout = async () => {
  await authService.logout();
  localStorage.removeItem('userRole');
  router.push('/');
};
</script>

<style scoped>
.admin-view {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  background: linear-gradient(135deg, #5b3a8e 0%, #764ba2 100%);
  color: #fff;
  padding: 20px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.tabs {
  display: flex;
  gap: 8px;
  padding: 12px 20px 0;
  max-width: 1100px;
  margin: 0 auto;
  flex-wrap: wrap;
}

.tabs button {
  background: #fff;
  border: 1px solid #ddd;
  border-bottom: none;
  padding: 10px 18px;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #555;
}

.tabs button.active {
  background: #764ba2;
  color: #fff;
  border-color: #764ba2;
}

.content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.stat {
  background: #fff;
  border-radius: 10px;
  padding: 18px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.stat-num {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: #764ba2;
}

.stat-label {
  color: #666;
  font-size: 13px;
}

.search {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
}

.hint {
  color: #666;
  font-size: 14px;
  margin-bottom: 14px;
}

.loading,
.empty {
  text-align: center;
  padding: 30px;
  color: #888;
}

.user-list,
.event-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-card {
  background: #fff;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.avatar.placeholder {
  background: #764ba2;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: 600;
  color: #333;
}

.admin-tag {
  background: #ffd166;
  color: #7a5c00;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 6px;
  margin-left: 6px;
  vertical-align: middle;
}

.user-email,
.user-meta {
  font-size: 12px;
  color: #777;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switch {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.switch input {
  display: none;
}

.slider {
  width: 42px;
  height: 24px;
  background: #ccc;
  border-radius: 999px;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  top: 3px;
  left: 3px;
  transition: transform 0.2s;
}

.switch input:checked + .slider {
  background: #48bb78;
}

.switch input:checked + .slider::before {
  transform: translateX(18px);
}

.switch input:disabled + .slider {
  opacity: 0.5;
}

.switch-text {
  font-size: 12px;
  color: #555;
  white-space: nowrap;
}

.event-card {
  background: #fff;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
}

.event-name {
  font-weight: 700;
  color: #333;
  font-size: 1.05rem;
}

.event-meta {
  font-size: 13px;
  color: #777;
  margin-top: 3px;
}

.pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.pill.on {
  background: #d4edda;
  color: #155724;
}

.pill.off {
  background: #f8d7da;
  color: #721c24;
}

.event-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.view-link {
  color: #667eea;
  font-size: 13px;
  text-decoration: none;
  font-weight: 600;
}

.comprobantes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.comprobante-card {
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
}

.comprobante-img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  background: #eee;
}

.comprobante-info {
  padding: 10px;
  font-size: 13px;
  color: #555;
  flex: 1;
}

.comprobante-date {
  color: #999;
  font-size: 11px;
  margin-top: 4px;
}

.delete-btn {
  background: #dc3545;
  color: #fff;
  border: none;
  padding: 10px;
  cursor: pointer;
  font-size: 13px;
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
}

.pagination button {
  background: #764ba2;
  color: #fff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .event-card {
    flex-direction: column;
  }
  .event-actions {
    align-items: flex-start;
  }
}
</style>
