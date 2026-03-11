<template>
  <div class="space-y-6">
    <h2 class="text-xl font-bold text-dark-100">{{ t('logs.title') }}</h2>
    <div class="card p-4">
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div><label class="label">{{ t('logs.provider') }}</label><select v-model="filters.provider_id" @change="loadLogs" class="input"><option value="">{{ t('logs.all') }}</option><option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option></select></div>
        <div><label class="label">{{ t('logs.strategy') }}</label><select v-model="filters.strategy_id" @change="loadLogs" class="input"><option value="">{{ t('logs.all') }}</option><option v-for="s in strategies" :key="s.id" :value="s.id">{{ s.name }}</option></select></div>
        <div><label class="label">{{ t('logs.country') }}</label><input v-model="filters.country" @input="debounceLoad" class="input" placeholder="e.g. China" /></div>
        <div><label class="label">{{ t('logs.start_date') }}</label><input v-model="filters.start_date" type="date" class="input" @change="loadLogs" /></div>
        <div><label class="label">{{ t('logs.end_date') }}</label><input v-model="filters.end_date" type="date" class="input" @change="loadLogs" /></div>
      </div>
    </div>
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-dark-400 text-xs uppercase tracking-wider bg-dark-800/40">
            <th class="text-left py-3 px-4">{{ t('logs.col_time') }}</th><th class="text-left py-3 px-3">{{ t('logs.col_provider') }}</th><th class="text-left py-3 px-3">{{ t('logs.col_model') }}</th><th class="text-center py-3 px-3">{{ t('logs.col_status') }}</th><th class="text-right py-3 px-3" :title="t('logs.col_tokens')">{{ t('logs.col_tokens') }}</th><th class="text-left py-3 px-3">{{ t('logs.col_ip') }}</th><th class="text-left py-3 px-3">{{ t('logs.col_country') }}</th><th class="text-right py-3 px-3">{{ t('logs.col_latency') }}</th><th class="text-center py-3 px-3">{{ t('logs.col_fallback') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id" class="table-row">
              <td class="py-2.5 px-4 text-dark-400 font-mono text-xs whitespace-nowrap">{{ formatTime(log.created_at) }}</td>
              <td class="py-2.5 px-3 text-dark-200">{{ log.provider_name||'-' }}</td>
              <td class="py-2.5 px-3 text-dark-400 font-mono text-xs">{{ log.model||'-' }}</td>
              <td class="py-2.5 px-3 text-center"><span :class="log.status_code>=200&&log.status_code<300?'text-emerald-400':'text-red-400'" class="font-mono text-xs">{{ log.status_code||'ERR' }}</span></td>
              <td class="py-2.5 px-3 text-right font-mono text-xs"><span class="text-dark-200">{{ (log.provider_total_tokens||0).toLocaleString() }}</span><span class="text-dark-600"> / </span><span class="text-dark-400">{{ (log.estimated_total_tokens||0).toLocaleString() }}</span></td>
              <td class="py-2.5 px-3 text-dark-400 font-mono text-xs">{{ log.client_ip||'-' }}</td>
              <td class="py-2.5 px-3 text-dark-400 text-xs">{{ log.client_country||'-' }}</td>
              <td class="py-2.5 px-3 text-right text-dark-400 text-xs">{{ log.latency_ms?(log.latency_ms/1000).toFixed(1)+'s':'-' }}</td>
              <td class="py-2.5 px-3 text-center"><span v-if="log.is_fallback" class="badge-yellow text-[10px]">{{ t('logs.yes') }}</span></td>
            </tr>
            <tr v-if="logs.length===0"><td colspan="9" class="py-12 text-center text-dark-500">{{ t('logs.no_records') }}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between px-4 py-3 border-t border-dark-700/50">
        <span class="text-xs text-dark-500">{{ t('logs.total') }} {{ total }} {{ t('logs.records') }}</span>
        <div class="flex gap-1"><button @click="page>1&&(page--,loadLogs())" :disabled="page<=1" class="btn-sm btn-secondary">{{ t('logs.prev') }}</button><span class="btn-sm text-dark-400">{{ page }} / {{ totalPages }}</span><button @click="page<totalPages&&(page++,loadLogs())" :disabled="page>=totalPages" class="btn-sm btn-secondary">{{ t('logs.next') }}</button></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../stores/api';
import { useI18n } from '../stores/i18n';
const { t } = useI18n();
const logs = ref<any[]>([]); const providers = ref<any[]>([]); const strategies = ref<any[]>([]); const total = ref(0); const page = ref(1); const perPage=50; const totalPages = ref(1); let debounceTimer:ReturnType<typeof setTimeout>;
const filters = ref({ provider_id:'',strategy_id:'',country:'',start_date:'',end_date:'' });
function formatTime(dt:string):string { if(!dt) return '-'; const d=new Date(dt+'Z'); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mi=String(d.getMinutes()).padStart(2,'0'); const ss=String(d.getSeconds()).padStart(2,'0'); return `${mm}-${dd} ${hh}:${mi}:${ss}`; }
function debounceLoad() { clearTimeout(debounceTimer); debounceTimer=setTimeout(loadLogs,500); }
async function loadLogs() { try { const params=new URLSearchParams(); params.set('page',String(page.value)); params.set('limit',String(perPage)); if(filters.value.provider_id) params.set('provider_id',filters.value.provider_id); if(filters.value.strategy_id) params.set('strategy_id',filters.value.strategy_id); if(filters.value.country) params.set('country',filters.value.country); if(filters.value.start_date) params.set('start_date',filters.value.start_date); if(filters.value.end_date) params.set('end_date',filters.value.end_date); const r=await api(`/api/logs?${params}`); logs.value=r.logs; total.value=r.total; totalPages.value=Math.max(1,Math.ceil(r.total/perPage)); } catch{} }
onMounted(async()=>{ try{providers.value=await api('/api/providers');}catch{} try{strategies.value=await api('/api/strategies');}catch{} loadLogs(); });
</script>
