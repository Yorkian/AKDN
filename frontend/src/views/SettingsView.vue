<template>
  <div class="space-y-6">
    <h2 class="text-xl font-bold text-dark-100">{{ t('set.title') }}</h2>

    <!-- Language -->
    <div class="card p-6">
      <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('set.language') }}</h3>
      <div class="flex gap-2">
        <button @click="switchLang('en')" class="btn-sm" :class="lang==='en'?'btn-primary':'btn-secondary'">{{ t('set.lang_en') }}</button>
        <button @click="switchLang('zh')" class="btn-sm" :class="lang==='zh'?'btn-primary':'btn-secondary'">{{ t('set.lang_zh') }}</button>
      </div>
    </div>

    <!-- Timeouts -->
    <div class="card p-6">
      <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('set.timeout_title') }}</h3>
      <p class="text-xs text-dark-500 mb-4">{{ t('set.timeout_hint') }}</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label class="label">{{ t('set.first_token') }}</label><input v-model.number="settings.first_token_timeout" type="number" class="input" /><p class="text-[10px] text-dark-500 mt-1">{{ t('set.first_token_hint') }}</p></div>
        <div><label class="label">{{ t('set.non_stream') }}</label><input v-model.number="settings.non_stream_timeout" type="number" class="input" /><p class="text-[10px] text-dark-500 mt-1">{{ t('set.non_stream_hint') }}</p></div>
        <div><label class="label">{{ t('set.health_interval') }}</label><input v-model.number="settings.health_check_interval" type="number" class="input" /><p class="text-[10px] text-dark-500 mt-1">{{ t('set.health_interval_hint') }}</p></div>
        <div><label class="label">{{ t('set.geo_ttl') }}</label><input v-model.number="settings.geo_cache_ttl" type="number" class="input" /><p class="text-[10px] text-dark-500 mt-1">{{ t('set.geo_ttl_hint') }}</p></div>
      </div>
      <div class="mt-4 flex items-center gap-3">
        <button @click="saveSettings" :disabled="savingSettings" class="btn-primary">{{ savingSettings?t('set.saving'):t('set.save') }}</button>
        <p v-if="settingsMsg" :class="settingsMsgOk?'text-emerald-400':'text-red-400'" class="text-sm">{{ settingsMsg }}</p>
      </div>
    </div>

    <!-- Data Management -->
    <div class="card p-6">
      <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('set.data_title') }}</h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between bg-dark-800/40 rounded-lg p-4">
          <div><p class="text-sm text-dark-200">{{ t('set.logs_label') }}</p><p class="text-xs text-dark-500">{{ stats.logCount?.toLocaleString()??'-' }} {{ t('set.logs_count') }}</p></div>
          <button @click="clearLogs" :disabled="clearingLogs" class="btn-sm btn-danger">{{ clearingLogs?t('set.clearing_logs'):t('set.clear_logs') }}</button>
        </div>
        <div class="flex items-center justify-between bg-dark-800/40 rounded-lg p-4">
          <div><p class="text-sm text-dark-200">{{ t('set.geo_label') }}</p><p class="text-xs text-dark-500">{{ stats.geoCacheCount?.toLocaleString()??'-' }} {{ t('set.geo_count') }}</p></div>
          <button @click="clearGeoCache" :disabled="clearingGeo" class="btn-sm btn-danger">{{ clearingGeo?t('set.clearing_geo'):t('set.clear_geo') }}</button>
        </div>
      </div>
    </div>

    <!-- Password -->
    <div class="card p-6">
      <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('set.password_title') }}</h3>
      <div class="space-y-3 max-w-md">
        <div><label class="label">{{ t('set.current_pw') }}</label><input v-model="pwForm.currentPassword" type="password" class="input" /></div>
        <div><label class="label">{{ t('set.new_pw') }}</label><input v-model="pwForm.newPassword" type="password" class="input" :placeholder="t('set.new_pw_ph')" /></div>
        <div><label class="label">{{ t('set.confirm_pw') }}</label><input v-model="pwForm.confirmPassword" type="password" class="input" /></div>
        <p v-if="pwError" class="text-red-400 text-sm">{{ pwError }}</p>
        <p v-if="pwSuccess" class="text-emerald-400 text-sm">{{ pwSuccess }}</p>
        <button @click="changePassword" :disabled="pwLoading" class="btn-primary">{{ pwLoading?t('set.changing_pw'):t('set.change_pw') }}</button>
      </div>
    </div>

    <!-- System Info -->
    <div class="card p-6">
      <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('set.system_title') }}</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div class="bg-dark-800/40 rounded-lg p-3"><p class="text-dark-500 text-xs">{{ t('set.version') }}</p><p class="text-dark-200 font-mono mt-1">AKDN v1.4.3</p></div>
        <div class="bg-dark-800/40 rounded-lg p-3"><p class="text-dark-500 text-xs">{{ t('set.nodejs') }}</p><p class="text-dark-200 font-mono mt-1">{{ stats.nodeVersion||'-' }}</p></div>
        <div class="bg-dark-800/40 rounded-lg p-3"><p class="text-dark-500 text-xs">{{ t('set.uptime') }}</p><p class="text-dark-200 font-mono mt-1">{{ formatUptime(stats.uptime) }}</p></div>
        <div class="bg-dark-800/40 rounded-lg p-3"><p class="text-dark-500 text-xs">{{ t('set.memory') }}</p><p class="text-dark-200 font-mono mt-1">{{ stats.memoryMB??'-' }} MB</p></div>
        <div class="bg-dark-800/40 rounded-lg p-3"><p class="text-dark-500 text-xs">{{ t('set.providers_count') }}</p><p class="text-dark-200 font-mono mt-1">{{ stats.providerCount??'-' }}</p></div>
        <div class="bg-dark-800/40 rounded-lg p-3"><p class="text-dark-500 text-xs">{{ t('set.strategies_count') }}</p><p class="text-dark-200 font-mono mt-1">{{ stats.strategyCount??'-' }}</p></div>
      </div>
    </div>

    <!-- Donate -->
    <div class="card p-6">
      <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('set.donate_title') }}</h3>

      <!-- English: USDT addresses -->
      <div v-if="lang==='en'" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-dark-400 text-xs uppercase tracking-wider border-b border-dark-700/50">
              <th class="text-left py-2 pr-4 w-32">Network</th>
              <th class="text-left py-2">Address</th>
            </tr>
          </thead>
          <tbody>
            <tr class="table-row">
              <td class="py-2.5 pr-4 text-dark-300">BNB (BEP20)</td>
              <td class="py-2.5"><span class="copiable font-mono text-xs" @click="copyAddr('0x6104ff99c18405c4f3fc6bfd16adc7ff7f5b1e89')">0x6104ff99c18405c4f3fc6bfd16adc7ff7f5b1e89</span></td>
            </tr>
            <tr class="table-row">
              <td class="py-2.5 pr-4 text-dark-300">TRC20</td>
              <td class="py-2.5"><span class="copiable font-mono text-xs" @click="copyAddr('TMwgiHHXmPrAMFNqa3eMvZpntsnKYuw7yp')">TMwgiHHXmPrAMFNqa3eMvZpntsnKYuw7yp</span></td>
            </tr>
            <tr class="table-row">
              <td class="py-2.5 pr-4 text-dark-300">Aptos</td>
              <td class="py-2.5"><span class="copiable font-mono text-xs break-all" @click="copyAddr('0x4323ed79c686015848a883392ed3cbc5fe7239819933546abab8cacf9ab77f46')">0x4323ed79c686015848a883392ed3cbc5fe7239819933546abab8cacf9ab77f46</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Chinese: QR code -->
      <div v-else class="flex justify-center">
        <img :src="donateQR" alt="赞赏码" class="w-[230px] h-[230px] rounded-lg" />
      </div>
    </div>

    <!-- Copy toast -->
    <Transition name="fade">
      <div v-if="copyToast" class="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-[100]">{{ t('set.donate_copied') }}</div>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../stores/api';
import { useI18n } from '../stores/i18n';
import donateQR from '../assets/donate-qr.png';
const { t, lang, setLang } = useI18n();

const settings = ref<Record<string,number>>({ first_token_timeout:15000, non_stream_timeout:30000, health_check_interval:60000, geo_cache_ttl:604800000 });
const savingSettings = ref(false); const settingsMsg = ref(''); const settingsMsgOk = ref(false);
const stats = ref<any>({}); const clearingLogs = ref(false); const clearingGeo = ref(false);
const pwForm = ref({ currentPassword:'', newPassword:'', confirmPassword:'' });
const pwError = ref(''); const pwSuccess = ref(''); const pwLoading = ref(false);
const copyToast = ref(false);
let toastTimer: ReturnType<typeof setTimeout>;

function switchLang(l: 'en'|'zh') { setLang(l); }

function formatUptime(seconds?:number):string {
  if(!seconds) return '-';
  const d=Math.floor(seconds/86400); const h=Math.floor((seconds%86400)/3600); const m=Math.floor((seconds%3600)/60); const s=seconds%60;
  if(d>0) return `${d}${t('set.uptime_days')} ${h}${t('set.uptime_hours')} ${m}${t('set.uptime_mins')}`;
  if(h>0) return `${h}${t('set.uptime_hours')} ${m}${t('set.uptime_mins')}`;
  return `${m}${t('set.uptime_mins')} ${s}${t('set.uptime_secs')}`;
}
async function loadSettings() { try{ const data=await api('/api/settings'); for(const key of Object.keys(settings.value)){ if(data[key]!==undefined) settings.value[key]=parseInt(data[key]); } }catch{} }
async function loadStats() { try{ stats.value=await api('/api/settings/stats'); }catch{} }
async function saveSettings() { savingSettings.value=true; settingsMsg.value=''; try{ await api('/api/settings',{method:'PUT',body:JSON.stringify(settings.value)}); settingsMsg.value=t('set.saved'); settingsMsgOk.value=true; }catch(err:any){ settingsMsg.value=err.message; settingsMsgOk.value=false; }finally{ savingSettings.value=false; } }
async function clearLogs() { if(!confirm(t('set.clear_logs_confirm'))) return; clearingLogs.value=true; try{ const r=await api('/api/settings/clear-logs',{method:'POST'}); alert(t('set.cleared_logs',{n:r.deletedCount})); loadStats(); }catch(err:any){alert(err.message);} finally{clearingLogs.value=false;} }
async function clearGeoCache() { if(!confirm(t('set.clear_geo_confirm'))) return; clearingGeo.value=true; try{ const r=await api('/api/settings/clear-geo-cache',{method:'POST'}); alert(t('set.cleared_geo',{n:r.deletedCount})); loadStats(); }catch(err:any){alert(err.message);} finally{clearingGeo.value=false;} }
async function changePassword() { pwError.value=''; pwSuccess.value=''; if(!pwForm.value.currentPassword||!pwForm.value.newPassword){pwError.value=t('set.pw_err_required');return;} if(pwForm.value.newPassword.length<6){pwError.value=t('set.pw_err_length');return;} if(pwForm.value.newPassword!==pwForm.value.confirmPassword){pwError.value=t('set.pw_err_mismatch');return;} pwLoading.value=true; try{ await api('/api/auth/password',{method:'PUT',body:JSON.stringify(pwForm.value)}); pwSuccess.value=t('set.pw_changed'); pwForm.value={currentPassword:'',newPassword:'',confirmPassword:''}; }catch(err:any){pwError.value=err.message;} finally{pwLoading.value=false;} }
function copyAddr(text:string) {
  try {
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text); }
    else { const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.left='-9999px'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    copyToast.value=true; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{copyToast.value=false;},1500);
  } catch {}
}
onMounted(()=>{loadSettings();loadStats();});
</script>

<style scoped>
.copiable {
  cursor: pointer;
  color: #94a3b8;
  transition: color 0.15s;
  border-bottom: 1px dashed rgba(96, 165, 250, 0.3);
}
.copiable:hover { color: #60a5fa !important; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
