<template>
  <div class="role-container">
    <div class="role-card">
      <h1>Selecciona tu rol</h1>
      <p class="user-info">Hola, {{ user?.displayName || user?.email }}</p>

      <div v-if="loading" class="loading">Cargando...</div>

      <div v-else class="role-options">
        <button v-if="isAdmin" @click="goAdmin" class="role-btn admin">
          <div class="role-icon">🛡️</div>
          <h2>Administrador</h2>
          <p>Gestiona usuarios, permisos y eventos</p>
        </button>

        <button
          v-if="organizerEnabled"
          @click="selectRole('organizador')"
          class="role-btn"
        >
          <div class="role-icon">🎪</div>
          <h2>Organizador</h2>
          <p>Gestiona tus discotecas y eventos</p>
        </button>

        <div v-else class="role-btn disabled">
          <div class="role-icon">🎪</div>
          <h2>Organizador</h2>
          <p class="pending-note">
            Necesitas que un administrador active esta función para tu cuenta.
          </p>
        </div>

        <button @click="selectRole('colaborador')" class="role-btn">
          <div class="role-icon">👥</div>
          <h2>Colaborador</h2>
          <p>Accede a eventos donde colaboras</p>
        </button>

        <button @click="goCliente" class="role-btn">
          <div class="role-icon">🎟️</div>
          <h2>Mis entradas</h2>
          <p>Ve tus QRs y transfiérelos</p>
        </button>
      </div>

      <button @click="logout" class="logout-btn">Cerrar sesión</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { isAdminEmail } from '../config/appConfig';

const router = useRouter();
const user = ref(null);
const isAdmin = ref(false);
const organizerEnabled = ref(false);
const loading = ref(true);

onMounted(async () => {
  user.value = await authService.waitForAuthReady();
  if (!user.value) {
    router.push('/');
    return;
  }
  isAdmin.value = isAdminEmail(user.value.email);
  await userService.ensureRegistered(user.value);
  organizerEnabled.value = await userService.isOrganizerEnabled(user.value);
  loading.value = false;
});

const selectRole = (role) => {
  localStorage.setItem('userRole', role);
  if (role === 'organizador') {
    router.push('/dashboard');
  } else {
    router.push('/colaborador');
  }
};

const goCliente = () => {
  localStorage.setItem('userRole', 'cliente');
  router.push('/mis-qrs');
};

const goAdmin = () => {
  localStorage.setItem('userRole', 'admin');
  router.push('/admin');
};

const logout = async () => {
  await authService.logout();
  localStorage.removeItem('userRole');
  router.push('/');
};
</script>

<style scoped>
.role-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.role-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 720px;
  width: 100%;
}

h1 {
  font-size: 2rem;
  color: #333;
  margin-bottom: 10px;
}

.user-info {
  color: #666;
  margin-bottom: 30px;
}

.loading {
  padding: 30px;
  color: #666;
}

.role-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.role-btn {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 30px 20px;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}

.role-btn:hover:not(.disabled) {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.role-btn.admin {
  border-color: #764ba2;
  background: #faf7ff;
}

.role-btn.disabled {
  cursor: not-allowed;
  opacity: 0.7;
  background: #f7f7f7;
}

.role-icon {
  font-size: 3rem;
  margin-bottom: 10px;
}

.role-btn h2 {
  color: #333;
  margin-bottom: 8px;
  font-size: 1.3rem;
}

.role-btn p {
  color: #666;
  font-size: 0.9rem;
}

.pending-note {
  color: #b8860b !important;
}

.logout-btn {
  width: 100%;
  padding: 12px;
  background: #f5f5f5;
  border: none;
  border-radius: 8px;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.logout-btn:hover {
  background: #e0e0e0;
}

@media (max-width: 768px) {
  .role-container {
    padding: 15px;
  }

  .role-card {
    padding: 30px 25px;
  }

  h1 {
    font-size: 1.7rem;
  }

  .role-options {
    grid-template-columns: 1fr;
    gap: 15px;
    margin-bottom: 25px;
  }

  .role-btn {
    padding: 25px 20px;
  }

  .role-icon {
    font-size: 2.5rem;
  }

  .role-btn h2 {
    font-size: 1.2rem;
  }
}

@media (max-width: 480px) {
  .role-card {
    padding: 25px 20px;
  }

  h1 {
    font-size: 1.5rem;
  }

  .role-btn {
    padding: 20px 15px;
  }

  .role-icon {
    font-size: 2rem;
  }
}
</style>
