<template>
  <div class="w-full max-w-md">
    <div class="card p-8">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold"><span class="text-primary-400">AK</span><span class="text-dark-300">DN</span></h1>
        <p class="text-dark-400 text-sm mt-2">{{ t('setup.title') }}</p>
      </div>
      <div class="space-y-4">
        <div><label class="label">{{ t('setup.username') }}</label><input v-model="form.username" class="input" placeholder="admin" @keyup.enter="register" /></div>
        <div><label class="label">{{ t('setup.password') }}</label><input v-model="form.password" type="password" class="input" :placeholder="t('setup.password_ph')" @keyup.enter="register" /></div>
        <div><label class="label">{{ t('setup.confirm') }}</label><input v-model="form.confirmPassword" type="password" class="input" :placeholder="t('setup.confirm_ph')" @keyup.enter="register" /></div>
        <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
        <button @click="register" :disabled="loading" class="btn-primary w-full">{{ loading ? t('setup.submitting') : t('setup.submit') }}</button>
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
const form = ref({ username: '', password: '', confirmPassword: '' });
const error = ref(''); const loading = ref(false);
async function register() {
  error.value = '';
  if (!form.value.username || !form.value.password) { error.value = t('setup.err_required'); return; }
  if (form.value.password.length < 6) { error.value = t('setup.err_length'); return; }
  if (form.value.password !== form.value.confirmPassword) { error.value = t('setup.err_mismatch'); return; }
  loading.value = true;
  try { const res = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: form.value.username, password: form.value.password }) }); setToken(res.token); router.push('/'); }
  catch (err: any) { error.value = err.message; } finally { loading.value = false; }
}
</script>
