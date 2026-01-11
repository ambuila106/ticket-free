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
router.beforeEach((to, from, next) => {
  const user = authService.getCurrentUser();
  const userRole = localStorage.getItem('userRole');

  if (to.meta.requiresAuth && !user) {
    next('/');
  } else if (to.meta.requiresRole && userRole !== to.meta.requiresRole) {
    next('/select-role');
  } else if (to.path === '/' && user) {
    next('/select-role');
  } else {
    next();
  }
});

export default router;

