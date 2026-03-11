<template>
  <div class="space-y-6">
    <h2 class="text-xl font-bold text-dark-100">{{ t('dash.title') }}</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card p-4"><p class="text-dark-400 text-xs uppercase tracking-wider">{{ t('dash.total_strategies') }}</p><p class="text-2xl font-bold text-dark-100 mt-1">{{ overview.strategies ?? '-' }}</p></div>
      <div class="card p-4"><p class="text-dark-400 text-xs uppercase tracking-wider">{{ t('dash.total_providers') }}</p><p class="text-2xl font-bold text-dark-100 mt-1">{{ overview.providers ?? '-' }}</p></div>
      <div class="card p-4" :class="overview.faultCount > 0 ? 'border-red-500/50' : ''"><p class="text-dark-400 text-xs uppercase tracking-wider">{{ t('dash.fault_throttled') }}</p><p class="text-2xl font-bold mt-1" :class="overview.faultCount > 0 ? 'text-red-400' : 'text-dark-100'">{{ overview.faultCount ?? 0 }} / {{ overview.throttledCount ?? 0 }}</p></div>
      <div class="card p-4"><p class="text-dark-400 text-xs uppercase tracking-wider">{{ t('dash.today_requests') }}</p><p class="text-2xl font-bold text-primary-400 mt-1">{{ overview.todayRequests?.toLocaleString() ?? '-' }}</p></div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-dark-300">{{ t('dash.token_trend') }}</h3>
          <div class="flex gap-1"><button @click="tokenRange='24h'" class="btn-sm" :class="tokenRange==='24h'?'btn-primary':'btn-secondary'">24h</button><button @click="tokenRange='7d'" class="btn-sm" :class="tokenRange==='7d'?'btn-primary':'btn-secondary'">7d</button></div>
        </div>
        <div v-if="tokenError" class="text-red-400 text-xs py-4 text-center">{{ tokenError }}</div>
        <div v-else class="h-48"><canvas ref="tokenChartRef"></canvas></div>
      </div>
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-dark-300">{{ t('dash.request_trend') }}</h3>
          <div class="flex gap-1"><button @click="requestRange='24h'" class="btn-sm" :class="requestRange==='24h'?'btn-primary':'btn-secondary'">24h</button><button @click="requestRange='7d'" class="btn-sm" :class="requestRange==='7d'?'btn-primary':'btn-secondary'">7d</button></div>
        </div>
        <div v-if="requestError" class="text-red-400 text-xs py-4 text-center">{{ requestError }}</div>
        <div v-else class="h-48"><canvas ref="requestChartRef"></canvas></div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-5">
        <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('dash.health_ranking') }} <span class="text-dark-500">{{ t('dash.health_24h') }}</span></h3>
        <div v-if="healthData.length===0" class="text-dark-500 text-sm py-4 text-center">{{ t('dash.no_data') }}</div>
        <div v-else class="space-y-2">
          <div v-for="item in healthData" :key="item.id" class="flex items-center gap-3 px-3 py-2 rounded-lg" :class="item.color==='red'?'bg-red-500/10':item.color==='yellow'?'bg-amber-500/10':'bg-emerald-500/5'">
            <span class="text-dark-500 text-xs w-6">#{{ item.rank }}</span>
            <span :class="item.color==='red'?'badge-red':item.color==='yellow'?'badge-yellow':'badge-green'">{{ item.availability }}%</span>
            <span class="text-sm text-dark-200 flex-1">{{ item.name }}</span>
            <span class="text-xs text-dark-500">{{ item.totalRequests }} req</span>
          </div>
        </div>
        <p class="text-[10px] text-dark-600 mt-3">🟢 {{ t('dash.health_green') }} &nbsp; 🟡 {{ t('dash.health_yellow') }} &nbsp; 🔴 {{ t('dash.health_red') }}</p>
      </div>
      <div class="card p-5">
        <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('dash.fault_pool') }}</h3>
        <div v-if="!faultData.faultProviders?.length && !faultData.throttledProviders?.length" class="text-emerald-400 text-sm py-4 text-center">{{ t('dash.all_healthy') }}</div>
        <div v-if="faultData.faultProviders?.length" class="mb-4">
          <p class="text-xs text-red-400 mb-2 uppercase tracking-wider">{{ t('dash.faulting') }}</p>
          <div v-for="fp in faultData.faultProviders" :key="fp.providerId" class="bg-red-500/10 rounded-lg p-3 mb-2">
            <div class="font-medium text-sm text-red-300">{{ fp.name }}</div>
            <div class="text-xs text-dark-400 mt-1">{{ t('dash.entered') }}: {{ new Date(fp.since).toLocaleTimeString() }} · {{ t('dash.retries') }}: {{ fp.retryCount }} · {{ t('dash.next_check') }}: {{ fp.nextCheck }}s</div>
          </div>
        </div>
        <div v-if="faultData.throttledProviders?.length">
          <p class="text-xs text-orange-400 mb-2 uppercase tracking-wider">{{ t('dash.throttled') }}</p>
          <div v-for="tp in faultData.throttledProviders" :key="tp.id" class="bg-orange-500/10 rounded-lg p-3 mb-2">
            <div class="flex items-center justify-between"><span class="font-medium text-sm text-orange-300">{{ tp.name }}</span><button @click="resetUsage(tp.id)" class="btn-sm btn-secondary">{{ t('dash.reset_usage') }}</button></div>
            <div class="text-xs text-dark-400 mt-1">Prompt: {{ tp.prompt_tokens_used?.toLocaleString() }}/{{ tp.prompt_token_limit?.toLocaleString() }} · Completion: {{ tp.completion_tokens_used?.toLocaleString() }}/{{ tp.completion_token_limit?.toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="card p-5">
      <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('dash.geo_title') }} <span class="text-dark-500">{{ t('dash.geo_7d') }}</span></h3>
      <div v-if="geoData.length===0" class="text-dark-500 text-sm py-2 text-center">{{ t('dash.no_data') }}</div>
      <div v-else class="space-y-2">
        <div v-for="item in geoData" :key="item.country" class="flex items-center gap-3">
          <span class="text-sm text-dark-300 w-32 truncate">{{ item.country }}</span>
          <div class="flex-1 h-5 bg-dark-700/30 rounded-full overflow-hidden"><div class="h-full bg-primary-500/60 rounded-full transition-all" :style="{width:item.percentage+'%'}"></div></div>
          <span class="text-xs text-dark-400 w-16 text-right">{{ item.percentage }}%</span>
        </div>
      </div>
    </div>
    <div class="card p-5">
      <h3 class="text-sm font-medium text-dark-300 mb-4">{{ t('dash.recent_title') }}</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-dark-400 text-xs uppercase tracking-wider border-b border-dark-700/50">
            <th class="text-left py-2 pr-4">{{ t('dash.col_time') }}</th><th class="text-left py-2 pr-4">{{ t('dash.col_strategy') }}</th><th class="text-left py-2 pr-4">{{ t('dash.col_provider') }}</th><th class="text-left py-2 pr-4">{{ t('dash.col_model') }}</th><th class="text-left py-2 pr-4">{{ t('dash.col_status') }}</th><th class="text-right py-2 pr-4">{{ t('dash.col_latency') }}</th><th class="text-center py-2">{{ t('dash.col_fallback') }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="req in recentData" :key="req.id" class="table-row">
              <td class="py-2 pr-4 text-dark-400 font-mono text-xs">{{ formatTime(req.created_at) }}</td>
              <td class="py-2 pr-4 text-dark-300">{{ req.strategy_name||'-' }}</td>
              <td class="py-2 pr-4 text-dark-200">{{ req.provider_name||'-' }}</td>
              <td class="py-2 pr-4 text-dark-400 font-mono text-xs">{{ req.model||'-' }}</td>
              <td class="py-2 pr-4"><span :class="req.status_code>=200&&req.status_code<300?'text-emerald-400':'text-red-400'">{{ req.status_code||'ERR' }}</span></td>
              <td class="py-2 pr-4 text-right text-dark-400">{{ req.latency_ms?(req.latency_ms/1000).toFixed(1)+'s':'-' }}</td>
              <td class="py-2 text-center"><span v-if="req.is_fallback" class="badge-yellow">{{ t('dash.yes') }}</span></td>
            </tr>
            <tr v-if="!recentData.length"><td colspan="7" class="py-8 text-center text-dark-500">{{ t('dash.no_requests') }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { api } from '../stores/api';
import { useI18n } from '../stores/i18n';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, Filler, Tooltip, Legend } from 'chart.js';
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, BarElement, BarController, Filler, Tooltip, Legend);
const { t } = useI18n();
const overview = ref<any>({}); const healthData = ref<any[]>([]); const faultData = ref<any>({ faultProviders: [], throttledProviders: [] }); const geoData = ref<any[]>([]); const recentData = ref<any[]>([]);
const tokenRange = ref('24h'); const requestRange = ref('24h');
const tokenChartRef = ref<HTMLCanvasElement|null>(null); const requestChartRef = ref<HTMLCanvasElement|null>(null);
const tokenError = ref(''); const requestError = ref('');
let tokenChart: Chart|null = null; let requestChart: Chart|null = null; let refreshTimer: ReturnType<typeof setInterval>|null = null;
function formatTime(dt: string): string { if (!dt) return '-'; const d = new Date(dt+'Z'); const hh=String(d.getHours()).padStart(2,'0'); const mi=String(d.getMinutes()).padStart(2,'0'); const ss=String(d.getSeconds()).padStart(2,'0'); return `${hh}:${mi}:${ss}`; }
async function loadOverview() { try { overview.value = await api('/api/dashboard/overview'); } catch(e) { console.error('overview:',e); } }
async function loadHealth() { try { healthData.value = await api('/api/dashboard/health'); } catch(e) { console.error('health:',e); } }
async function loadFaultPool() { try { faultData.value = await api('/api/dashboard/fault-pool'); } catch(e) { console.error('fault:',e); } }
async function loadGeo() { try { geoData.value = await api('/api/dashboard/geo'); } catch(e) { console.error('geo:',e); } }
async function loadRecent() { try { recentData.value = await api('/api/dashboard/recent?limit=15'); } catch(e) { console.error('recent:',e); } }
async function loadTokenChart() {
  tokenError.value = '';
  try {
    const data = await api(`/api/dashboard/token-chart?range=${tokenRange.value}`);
    if (!Array.isArray(data)||data.length===0) { tokenError.value = t('dash.no_data'); return; }
    await nextTick(); if (!tokenChartRef.value) return; if (tokenChart) tokenChart.destroy();
    tokenChart = new Chart(tokenChartRef.value, { type:'line', data:{ labels:data.map((d:any)=>d.label||''), datasets:[{ label:'Total Tokens', data:data.map((d:any)=>d.tokens??0), borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.1)', fill:true, tension:0.4, pointRadius:2 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#64748b',font:{size:10}},grid:{color:'rgba(51,65,85,0.3)'}}, y:{beginAtZero:true,ticks:{color:'#64748b',font:{size:10}},grid:{color:'rgba(51,65,85,0.3)'}} } } });
  } catch(e:any) { tokenError.value = `${t('dash.loading_fail')}: ${e.message}`; }
}
async function loadRequestChart() {
  requestError.value = '';
  try {
    const data = await api(`/api/dashboard/request-chart?range=${requestRange.value}`);
    if (!Array.isArray(data)||data.length===0) { requestError.value = t('dash.no_data'); return; }
    await nextTick(); if (!requestChartRef.value) return; if (requestChart) requestChart.destroy();
    requestChart = new Chart(requestChartRef.value, { type:'bar', data:{ labels:data.map((d:any)=>d.label||''), datasets:[ {label:'Success',data:data.map((d:any)=>d.success??0),backgroundColor:'rgba(16,185,129,0.6)',borderRadius:3}, {label:'Failed',data:data.map((d:any)=>d.failed??0),backgroundColor:'rgba(239,68,68,0.6)',borderRadius:3} ] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top',labels:{color:'#94a3b8',font:{size:10}}}}, scales:{ x:{stacked:true,ticks:{color:'#64748b',font:{size:10}},grid:{color:'rgba(51,65,85,0.3)'}}, y:{stacked:true,beginAtZero:true,ticks:{color:'#64748b',font:{size:10}},grid:{color:'rgba(51,65,85,0.3)'}} } } });
  } catch(e:any) { requestError.value = `${t('dash.loading_fail')}: ${e.message}`; }
}
async function resetUsage(id:string) { try { await api(`/api/providers/${id}/reset-usage`,{method:'POST'}); loadFaultPool(); loadOverview(); } catch{} }
watch(tokenRange, loadTokenChart); watch(requestRange, loadRequestChart);
onMounted(async () => { await Promise.all([loadOverview(),loadHealth(),loadFaultPool(),loadGeo(),loadRecent()]); await nextTick(); await loadTokenChart(); await loadRequestChart(); refreshTimer = setInterval(()=>{ loadOverview(); loadFaultPool(); loadRecent(); },30000); });
onUnmounted(() => { if (refreshTimer) clearInterval(refreshTimer); if (tokenChart) tokenChart.destroy(); if (requestChart) requestChart.destroy(); });
</script>
