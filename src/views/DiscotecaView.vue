<template>
  <div class="discoteca-view">
    <header class="header">
      <button @click="$router.push('/dashboard')" class="back-btn">← Volver</button>
      <h1>{{ discoteca?.nombre || 'Cargando...' }}</h1>
    </header>

    <main class="main-content">
      <button @click="showCreateModal = true" class="create-btn">
        + Crear Nuevo Evento
      </button>

      <div v-if="loading" class="loading">Cargando eventos...</div>

      <div v-else-if="Object.keys(eventos).length === 0" class="empty-state">
        <p>No hay eventos aún. ¡Crea tu primer evento!</p>
      </div>

      <div v-else class="eventos-grid">
        <div 
          v-for="(evento, id) in eventos" 
          :key="id"
          class="evento-card"
          @click="goToEvento(id)"
        >
          <h2>{{ evento.nombre }}</h2>
          <p class="evento-fecha">📅 {{ evento.fecha }}</p>
          <p class="evento-ubicacion">📍 {{ evento.ubicacion || discoteca?.ubicacion }}</p>
          <p class="evento-desc">{{ evento.descripcion || 'Sin descripción' }}</p>
        </div>
      </div>
    </main>

    <!-- Modal crear evento -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal" @click.stop>
        <h2>Crear Nuevo Evento</h2>
        <form @submit.prevent="createEvento">
          <div class="form-group">
            <label>Nombre del evento</label>
            <input v-model="newEvento.nombre" required type="text" placeholder="Ej: Fashion Perreo" />
          </div>
          <div class="form-group">
            <label>Fecha y hora</label>
            <input v-model="newEvento.fecha" required type="text" placeholder="Ej: 18 de noviembre de 2022, 9:00 p.m." />
          </div>
          <div class="form-group">
            <label>Ubicación</label>
            <input v-model="newEvento.ubicacion" type="text" :placeholder="discoteca?.ubicacion || 'Ubicación del evento'" />
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <textarea v-model="newEvento.descripcion" placeholder="Descripción opcional"></textarea>
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
import { useRoute, useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { databaseService } from '../services/databaseService';

const route = useRoute();
const router = useRouter();
const discotecaId = route.params.discotecaId;
const user = ref(null);
const discoteca = ref(null);
const eventos = ref({});
const loading = ref(true);
const showCreateModal = ref(false);
const newEvento = ref({
  nombre: '',
  fecha: '',
  ubicacion: '',
  descripcion: ''
});

let unsubscribe = null;

onMounted(async () => {
  user.value = authService.getCurrentUser();
  
  if (user.value) {
    // Obtener discoteca
    const discotecas = await databaseService.getDiscotecas(user.value.uid);
    discoteca.value = discotecas[discotecaId];
    
    // Suscribirse a eventos
    unsubscribe = databaseService.subscribeToEventos(
      user.value.uid,
      discotecaId,
      (data) => {
        eventos.value = data;
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

const createEvento = async () => {
  if (!user.value) return;
  
  // Validar datos
  if (!newEvento.value.nombre || newEvento.value.nombre.trim().length === 0) {
    alert('El nombre del evento es requerido');
    return;
  }
  
  if (newEvento.value.nombre.length > 200) {
    alert('El nombre del evento es demasiado largo (máximo 200 caracteres)');
    return;
  }
  
  try {
    await databaseService.createEvento(user.value.uid, discotecaId, {
      nombre: newEvento.value.nombre.trim().substring(0, 200),
      fecha: newEvento.value.fecha ? newEvento.value.fecha.trim().substring(0, 100) : '',
      ubicacion: newEvento.value.ubicacion ? newEvento.value.ubicacion.trim().substring(0, 200) : '',
      descripcion: newEvento.value.descripcion ? newEvento.value.descripcion.trim().substring(0, 500) : ''
    });
    showCreateModal.value = false;
    newEvento.value = { nombre: '', fecha: '', ubicacion: '', descripcion: '' };
  } catch (error) {
    console.error('Error creando evento:', error);
    alert('Error al crear el evento');
  }
};

const goToEvento = (eventoId) => {
  router.push(`/evento/${discotecaId}/${eventoId}`);
};
</script>

<style scoped>
.discoteca-view {
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

.back-btn:hover {
  text-decoration: underline;
}

.header h1 {
  color: #333;
  font-size: 1.8rem;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
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
  margin-bottom: 30px;
}

.create-btn:hover {
  background: #5568d3;
}

.loading, .empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.eventos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.evento-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.evento-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.evento-card h2 {
  color: #333;
  margin-bottom: 12px;
  font-size: 1.4rem;
}

.evento-fecha,
.evento-ubicacion {
  color: #666;
  margin-bottom: 8px;
  font-size: 14px;
}

.evento-desc {
  color: #999;
  font-size: 13px;
  margin-top: 10px;
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

  .create-btn {
    width: 100%;
    padding: 14px;
    font-size: 15px;
    margin-bottom: 20px;
  }

  .eventos-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .evento-card {
    padding: 20px;
  }

  .evento-card h2 {
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
  .header h1 {
    font-size: 1.3rem;
  }

  .evento-card {
    padding: 16px;
  }
}
</style>

