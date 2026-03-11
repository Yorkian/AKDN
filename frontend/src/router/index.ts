import { createRouter, createWebHistory } from 'vue-router';
import { isAuthenticated, api } from '../stores/api';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/setup', name: 'setup', component: () => import('../views/SetupView.vue') },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { auth: true } },
    { path: '/providers', name: 'providers', component: () => import('../views/ProvidersView.vue'), meta: { auth: true } },
    { path: '/strategies', name: 'strategies', component: () => import('../views/StrategiesView.vue'), meta: { auth: true } },
    { path: '/logs', name: 'logs', component: () => import('../views/LogsView.vue'), meta: { auth: true } },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { auth: true } },
  ],
});

router.beforeEach(async (to) => {
  // Check if first run
  if (to.name !== 'setup' && to.name !== 'login') {
    try {
      const status = await api('/api/auth/status');
      if (status.needsSetup) return { name: 'setup' };
    } catch { /* ignore */ }
  }

  if (to.meta.auth && !isAuthenticated()) {
    return { name: 'login' };
  }
});

export default router;
