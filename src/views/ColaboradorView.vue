<template>
  <div class="colaborador-view">
    <header class="header">
      <h1>Eventos donde Colaboro</h1>
      <div class="user-info">
        <span>{{ user?.displayName || user?.email }}</span>
        <button @click="logout" class="logout-btn">Salir</button>
      </div>
    </header>

    <main class="main-content">
      <div v-if="loading" class="loading">Cargando eventos...</div>

      <div v-else-if="eventos.length === 0" class="empty-state">
        <p>No estás colaborando en ningún evento aún.</p>
      </div>

      <div v-else class="eventos-list">
        <div 
          v-for="evento in eventos" 
          :key="evento.id"
          class="evento-card"
          @click="goToEvento(evento)"
        >
          <div class="evento-header">
            <h2>{{ evento.nombre }}</h2>
            <span class="owner-badge">Colaborador en este evento</span>
          </div>
          <p class="evento-fecha">📅 {{ evento.fecha }}</p>
          <p class="evento-ubicacion">📍 {{ evento.ubicacion }}</p>
          <p class="evento-desc">{{ evento.descripcion || 'Sin descripción' }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { databaseService } from '../services/databaseService';

const router = useRouter();
const user = ref(null);
const eventos = ref([]);
const loading = ref(true);

onMounted(async () => {
  user.value = authService.getCurrentUser();
  
  if (user.value) {
    try {
      eventos.value = await databaseService.getEventsAsCollaborator(user.value.email);
    } catch (error) {
      console.error('Error cargando eventos:', error);
    } finally {
      loading.value = false;
    }
  } else {
    router.push('/');
  }
});

const goToEvento = (evento) => {
  router.push(`/evento/${evento.discotecaId}/${evento.id}`);
};

const logout = async () => {
  await authService.logout();
  localStorage.removeItem('userRole');
  router.push('/');
};
</script>

<style scoped>
.colaborador-view {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
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

.header h1 {
  color: #333;
  font-size: 1.8rem;
  margin-bottom: 15px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.logout-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.logout-btn:hover {
  background: #e0e0e0;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.loading, .empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.eventos-list {
  display: grid;
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

.evento-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.evento-header h2 {
  color: #333;
  font-size: 1.4rem;
  flex: 1;
}

.owner-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
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

  .main-content {
    padding: 15px;
  }

  .evento-card {
    padding: 20px;
  }

  .evento-header {
    flex-direction: column;
    gap: 10px;
  }

  .evento-header h2 {
    font-size: 1.3rem;
  }

  .owner-badge {
    align-self: flex-start;
  }
}

@media (max-width: 480px) {
  .header h1 {
    font-size: 1.3rem;
  }

  .user-info span {
    max-width: 120px;
    font-size: 13px;
  }

  .evento-card {
    padding: 16px;
  }
}
</style>

