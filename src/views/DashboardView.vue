<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div class="header-content">
        <h1>Mis Discotecas</h1>
        <div class="user-info">
          <span>{{ user?.displayName || user?.email }}</span>
          <button @click="logout" class="logout-btn">Salir</button>
        </div>
      </div>
    </header>

    <main class="dashboard-main">
      <div class="top-actions">
        <button @click="showCreateModal = true" class="create-btn">
          + Crear Nueva Discoteca
        </button>
        <button @click="downloadBackup" class="backup-btn" :disabled="backingUp">
          {{ backingUp ? 'Generando backup...' : 'Descargar backup JSON' }}
        </button>
      </div>

      <div v-if="loading" class="loading">Cargando...</div>

      <div v-else-if="Object.keys(discotecas).length === 0" class="empty-state">
        <p>No tienes discotecas aún. ¡Crea tu primera discoteca!</p>
        <p class="empty-hint">Cuenta actual: {{ user?.email || 'sin correo' }}</p>
        <p class="empty-hint">Si esperabas ver datos, confirma que entraste con el correo correcto.</p>
      </div>

      <div v-else class="discotecas-grid">
        <div 
          v-for="(discoteca, id) in discotecas" 
          :key="id"
          class="discoteca-card"
          @click="goToDiscoteca(id)"
        >
          <h2>{{ discoteca.nombre }}</h2>
          <p class="discoteca-desc">{{ discoteca.descripcion || 'Sin descripción' }}</p>
          <p class="discoteca-ubicacion">📍 {{ discoteca.ubicacion || 'Sin ubicación' }}</p>
        </div>
      </div>
    </main>

    <!-- Modal crear discoteca -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal" @click.stop>
        <h2>Crear Nueva Discoteca</h2>
        <form @submit.prevent="createDiscoteca">
          <div class="form-group">
            <label>Nombre de la discoteca</label>
            <input v-model="newDiscoteca.nombre" required type="text" placeholder="Ej: La Fiesta" />
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea v-model="newDiscoteca.descripcion" placeholder="Descripción opcional"></textarea>
          </div>
          <div class="form-group">
            <label>Ubicación</label>
            <input v-model="newDiscoteca.ubicacion" type="text" placeholder="Ej: Calle 123, Ciudad" />
          </div>
          <div class="form-actions">
            <button type="button" @click="showCreateModal = false" class="cancel-btn">Cancelar</button>
            <button type="submit" class="submit-btn">Crear</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { databaseService } from '../services/databaseService';

const router = useRouter();
const user = ref(null);
const discotecas = ref({});
const loading = ref(true);
const showCreateModal = ref(false);
const backingUp = ref(false);
const newDiscoteca = ref({
  nombre: '',
  descripcion: '',
  ubicacion: ''
});

let unsubscribe = null;

onMounted(async () => {
  user.value = await authService.waitForAuthReady();

  if (!user.value) {
    loading.value = false;
    router.push('/');
    return;
  }

  await authService.getIdToken();

  try {
    // Carga inicial para evitar spinner infinito si falla la suscripción.
    discotecas.value = await databaseService.getDiscotecas(user.value.uid, user.value.email);
  } catch (error) {
    console.error('Error cargando discotecas:', error);
  } finally {
    loading.value = false;
  }

  // Suscribirse a cambios en discotecas (usar uid en lugar de email)
  unsubscribe = databaseService.subscribeToDiscotecas(
    user.value.uid,
    (data) => {
      discotecas.value = data;
      loading.value = false;
    },
    (error) => {
      console.error('Error en suscripción de discotecas:', error);
      loading.value = false;
    },
    user.value.email
  );
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

const createDiscoteca = async () => {
  if (!user.value) return;
  
  // Validar datos
  if (!newDiscoteca.value.nombre || newDiscoteca.value.nombre.trim().length === 0) {
    alert('El nombre de la discoteca es requerido');
    return;
  }
  
  if (newDiscoteca.value.nombre.length > 200) {
    alert('El nombre es demasiado largo (máximo 200 caracteres)');
    return;
  }
  
  try {
    const discotecaData = {
      id: Date.now().toString(),
      nombre: newDiscoteca.value.nombre.trim().substring(0, 200),
      descripcion: newDiscoteca.value.descripcion ? newDiscoteca.value.descripcion.trim().substring(0, 500) : '',
      ubicacion: newDiscoteca.value.ubicacion ? newDiscoteca.value.ubicacion.trim().substring(0, 200) : ''
    };
    
    await databaseService.createDiscoteca(user.value.uid, discotecaData, user.value.email);
    showCreateModal.value = false;
    newDiscoteca.value = { nombre: '', descripcion: '', ubicacion: '' };
  } catch (error) {
    console.error('Error creando discoteca:', error);
    alert('Error al crear la discoteca');
  }
};

const goToDiscoteca = (discotecaId) => {
  router.push(`/discoteca/${discotecaId}`);
};

const downloadBackup = async () => {
  if (!user.value || backingUp.value) return;

  backingUp.value = true;
  try {
    const backup = await databaseService.exportUserBackup(user.value.uid, user.value.email);
    const payload = {
      app: 'ticket-free',
      generatedAt: new Date().toISOString(),
      ownerKey: backup.ownerKey,
      ownerUid: user.value.uid,
      ownerEmail: user.value.email || '',
      data: backup.data || {}
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `backup-ticket-free-${backup.ownerKey}-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    alert('Copia de seguridad descargada correctamente.');
  } catch (error) {
    console.error('Error generando backup:', error);
    alert('No se pudo generar la copia de seguridad.');
  } finally {
    backingUp.value = false;
  }
};

const logout = async () => {
  await authService.logout();
  localStorage.removeItem('userRole');
  router.push('/');
};
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f5f5f5;
}

.dashboard-header {
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 30px;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  color: #333;
  font-size: 1.8rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info span {
  color: #333;
}

.logout-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
}

.logout-btn:hover {
  background: #e0e0e0;
}

.dashboard-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.top-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
}

.create-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s;
}

.create-btn:hover {
  background: #5568d3;
}

.backup-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s;
}

.backup-btn:hover:not(:disabled) {
  background: #218838;
}

.backup-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading, .empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.empty-hint {
  margin-top: 6px;
  font-size: 13px;
  color: #777;
}

.discotecas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.discoteca-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.discoteca-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.discoteca-card h2 {
  color: #333;
  margin-bottom: 10px;
  font-size: 1.5rem;
}

.discoteca-desc {
  color: #666;
  margin-bottom: 10px;
  font-size: 14px;
}

.discoteca-ubicacion {
  color: #999;
  font-size: 13px;
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

.modal h2 {
  margin-bottom: 20px;
  color: #333;
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

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
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

.cancel-btn:hover {
  background: #e0e0e0;
}

.submit-btn {
  background: #667eea;
  color: white;
}

.submit-btn:hover {
  background: #5568d3;
}

/* Responsive Mobile */
@media (max-width: 768px) {
  .dashboard-header {
    padding: 15px;
    margin-bottom: 20px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .header-content h1 {
    font-size: 1.5rem;
  }

  .user-info {
    width: 100%;
    justify-content: space-between;
  }

  .user-info span {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 150px;
  }

  .logout-btn {
    padding: 10px 16px;
    font-size: 13px;
  }

  .dashboard-main {
    padding: 15px;
  }

  .top-actions {
    margin-bottom: 20px;
  }

  .create-btn {
    width: 100%;
    padding: 14px;
    font-size: 15px;
  }

  .backup-btn {
    width: 100%;
    padding: 14px;
    font-size: 15px;
  }

  .discotecas-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .discoteca-card {
    padding: 20px;
  }

  .discoteca-card h2 {
    font-size: 1.3rem;
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

  .form-actions {
    flex-direction: column-reverse;
    gap: 10px;
  }

  .cancel-btn,
  .submit-btn {
    width: 100%;
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .header-content h1 {
    font-size: 1.3rem;
  }

  .user-info span {
    max-width: 120px;
    font-size: 13px;
  }

  .discoteca-card {
    padding: 16px;
  }
}
</style>

