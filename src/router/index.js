import { createRouter, createWebHistory } from 'vue-router';
import { authService } from '../services/authService';

const routes = [
  {
    path: '/',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/select-role',
    name: 'SelectRole',
    component: () => import('../views/SelectRoleView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true, requiresRole: 'organizador' }
  },
  {
    path: '/discoteca/:discotecaId',
    name: 'Discoteca',
    component: () => import('../views/DiscotecaView.vue'),
    meta: { requiresAuth: true, requiresRole: 'organizador' }
  },
  {
    path: '/evento/:discotecaId/:eventoId',
    name: 'Evento',
    component: () => import('../views/EventoView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/colaborador',
    name: 'Colaborador',
    component: () => import('../views/ColaboradorView.vue'),
    meta: { requiresAuth: true, requiresRole: 'colaborador' }
  },
  {
    path: '/qr-scanner/:discotecaId/:eventoId',
    name: 'QRScanner',
    component: () => import('../views/QRScannerView.vue'),
    meta: { requiresAuth: true }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Guard de navegación
router.beforeEach(async (to, from, next) => {
  const user = authService.getCurrentUser();
  const userRole = localStorage.getItem('userRole');

  // Verificar autenticación
  if (to.meta.requiresAuth && !user) {
    next('/');
    return;
  }

  // Verificar rol
  if (to.meta.requiresRole && userRole !== to.meta.requiresRole) {
    next('/select-role');
    return;
  }

  // Redirigir a selección de rol si está autenticado y va al login
  if (to.path === '/' && user) {
    next('/select-role');
    return;
  }

  // Para rutas de eventos, la verificación de permisos de colaborador
  // se hace en el componente EventoView
  next();
});

export default router;

