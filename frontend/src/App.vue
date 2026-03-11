<template>
  <div class="min-h-screen bg-dark-950">
    <div v-if="isAuthPage" class="min-h-screen flex items-center justify-center">
      <router-view />
    </div>
    <div v-else class="flex min-h-screen">
      <aside class="w-60 bg-dark-900/80 border-r border-dark-700/50 flex flex-col fixed h-full">
        <div class="p-5 border-b border-dark-700/50">
          <h1 class="text-lg font-bold tracking-tight">
            <span class="text-primary-400">AK</span><span class="text-dark-300">DN</span>
          </h1>
          <p class="text-[10px] text-dark-500 mt-0.5 tracking-widest uppercase">API Key Delivery Network</p>
        </div>
        <nav class="flex-1 py-4 px-3 space-y-1">
          <router-link v-for="item in navItems" :key="item.path" :to="item.path"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200"
            :class="$route.path === item.path ? 'bg-primary-600/15 text-primary-400 font-medium' : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/60'">
            <span class="text-base" v-html="item.icon"></span>
            <span>{{ t(item.labelKey) }}</span>
          </router-link>
        </nav>
        <div class="p-4 border-t border-dark-700/50 flex items-center justify-between">
          <button @click="logout" class="text-left px-3 py-2 text-sm text-dark-500 hover:text-red-400 transition-colors rounded-lg hover:bg-dark-800/60">
            {{ t('nav.logout') }}
          </button>
          <a href="https://github.com/Yorkian/AKDN" target="_blank" class="text-dark-600 hover:text-dark-400 transition-colors p-2 rounded-lg hover:bg-dark-800/60" title="GitHub">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/></svg>
          </a>
        </div>
      </aside>
      <main class="flex-1 ml-60">
        <div class="p-6 max-w-[1400px]"><router-view /></div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clearToken } from './stores/api';
import { useI18n } from './stores/i18n';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const isAuthPage = computed(() => ['login', 'setup'].includes(route.name as string));

const navItems = [
  { path: '/', labelKey: 'nav.dashboard', icon: '📊' },
  { path: '/providers', labelKey: 'nav.providers', icon: '🔌' },
  { path: '/strategies', labelKey: 'nav.strategies', icon: '⚡' },
  { path: '/logs', labelKey: 'nav.logs', icon: '📋' },
  { path: '/settings', labelKey: 'nav.settings', icon: '⚙️' },
];

function logout() { clearToken(); router.push('/login'); }
</script>
