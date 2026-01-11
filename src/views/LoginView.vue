<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Ticket Free</h1>
      <p class="subtitle">Sistema de gestión de tickets</p>
      <button @click="loginWithGoogle" class="google-btn" :disabled="loading">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span v-if="!loading">Continuar con Google</span>
        <span v-else>Iniciando sesión...</span>
      </button>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="credit">Creada por <strong>Brandon Ambuila</strong></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authService } from '../services/authService';

const router = useRouter();
const loading = ref(false);
const error = ref('');

const loginWithGoogle = async () => {
  loading.value = true;
  error.value = '';
  
  const result = await authService.loginWithGoogle();
  
  if (result.success) {
    router.push('/select-role');
  } else {
    error.value = result.error || 'Error al iniciar sesión';
  }
  
  loading.value = false;
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 10px;
}

.subtitle {
  color: #666;
  margin-bottom: 30px;
  font-size: 1rem;
}

.google-btn {
  width: 100%;
  padding: 12px 24px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transition: all 0.3s;
}

.google-btn:hover:not(:disabled) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #999;
}

.google-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e74c3c;
  margin-top: 15px;
  font-size: 14px;
}

.credit {
  margin-top: 25px;
  color: #999;
  font-size: 13px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.credit strong {
  color: #667eea;
  font-weight: 600;
}

/* Responsive Mobile */
@media (max-width: 768px) {
  .login-container {
    padding: 15px;
  }

  .login-card {
    padding: 30px 25px;
  }

  h1 {
    font-size: 2rem;
  }

  .subtitle {
    font-size: 0.9rem;
    margin-bottom: 25px;
  }

  .google-btn {
    padding: 14px 20px;
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 25px 20px;
  }

  h1 {
    font-size: 1.8rem;
  }

  .google-btn {
    padding: 12px 16px;
    font-size: 14px;
  }
}
</style>

