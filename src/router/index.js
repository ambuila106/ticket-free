import { createRouter, createWebHistory } from 'vue-router';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { isAdminEmail } from '../config/appConfig';

const routes = [
  {
    path: '/eventos',
    name: 'Landing',
    component: () => import('../views/LandingView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/comprar/:ownerUid/:discotecaId/:eventoId',
    name: 'PublicEvento',
    component: () => import('../views/PublicEventView.vue'),
    meta: { requiresAuth: false }
  },
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
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/mis-qrs',
    name: 'MisQrs',
    component: () => import('../views/MisQrsView.vue'),
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
    path: '/qr-scanner/:ownerUid/:discotecaId/:eventoId',
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
  const user = await authService.waitForAuthReady();
  const userRole = localStorage.getItem('userRole');

  // Verificar autenticación
  if (to.meta.requiresAuth && !user) {
    next('/');
    return;
  }

  // Rutas exclusivas del administrador
  if (to.meta.requiresAdmin) {
    if (!user || !isAdminEmail(user.email)) {
      next('/select-role');
      return;
    }
    next();
    return;
  }

  // Rol organizador: requiere permiso habilitado por el administrador
  if (to.meta.requiresRole === 'organizador') {
    if (userRole !== 'organizador') {
      next('/select-role');
      return;
    }
    const enabled = await userService.isOrganizerEnabled(user);
    if (!enabled) {
      next('/select-role');
      return;
    }
    next();
    return;
  }

  // Verificar otros roles
  if (to.meta.requiresRole && userRole !== to.meta.requiresRole) {
    next('/select-role');
    return;
  }

  // Redirigir a selección de rol si está autenticado y va al login
  if (to.path === '/' && user) {
    next('/select-role');
    return;
  }

  next();
});

export default router;
