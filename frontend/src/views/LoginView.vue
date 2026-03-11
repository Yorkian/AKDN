<template>
  <div class="w-full max-w-md">
    <div class="card p-8">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold"><span class="text-primary-400">AK</span><span class="text-dark-300">DN</span></h1>
        <p class="text-dark-400 text-sm mt-2">{{ t('login.title') }}</p>
      </div>
      <div class="space-y-4">
        <div><label class="label">{{ t('login.username') }}</label><input v-model="form.username" class="input" @keyup.enter="login" /></div>
        <div><label class="label">{{ t('login.password') }}</label><input v-model="form.password" type="password" class="input" @keyup.enter="login" /></div>
        <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
        <button @click="login" :disabled="loading" class="btn-primary w-full">{{ loading ? t('login.submitting') : t('login.submit') }}</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, setToken } from '../stores/api';
import { useI18n } from '../stores/i18n';
const { t } = useI18n();
const router = useRouter();
const form = ref({ username: '', password: '' });
const error = ref(''); const loading = ref(false);
async function login() {
  error.value = '';
  if (!form.value.username || !form.value.password) { error.value = t('login.err_required'); return; }
  loading.value = true;
  try { const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form.value) }); setToken(res.token); router.push('/'); }
  catch (err: any) { error.value = err.message; } finally { loading.value = false; }
}
</script>
