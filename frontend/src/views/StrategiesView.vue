<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-dark-100">{{ t('strat.title') }}</h2>
      <button @click="openForm()" class="btn-primary">{{ t('strat.add') }}</button>
    </div>
    <div v-if="strategies.length===0" class="card p-12 text-center text-dark-500">{{ t('strat.empty') }}</div>
    <div v-else class="grid gap-4">
      <div v-for="s in strategies" :key="s.id" class="card p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="flex items-center gap-2"><h3 class="font-medium text-dark-100">{{ s.name }}</h3><span class="badge bg-primary-500/20 text-primary-400">{{ s.mode==='priority'?t('strat.mode_priority'):t('strat.mode_round_robin') }}</span></div>
            <p class="text-xs text-dark-500 mt-1">{{ s.providers?.length||0 }} {{ t('strat.providers_count') }}</p>
          </div>
          <div class="flex gap-2">
            <button @click="showGuide=s" class="btn-sm btn-success">{{ t('strat.view_config') }}</button>
            <button @click="openForm(s)" class="btn-sm btn-secondary">{{ t('strat.edit') }}</button>
            <button @click="resetUsage(s.id)" class="btn-sm btn-secondary">{{ t('strat.reset') }}</button>
            <button @click="deleteStrategy(s.id)" class="btn-sm btn-danger">{{ t('strat.delete') }}</button>
          </div>
        </div>
        <div class="flex items-center gap-2 bg-dark-900/60 rounded-lg px-3 py-2 mb-3">
          <span class="text-xs text-dark-400">Key:</span>
          <code class="copiable text-xs text-primary-400 font-mono flex-1" @click="copy(s.key0)">{{ s.key0 }}</code>
        </div>
        <div class="flex flex-wrap gap-1.5 mb-3">
          <span v-for="(p,idx) in s.providers" :key="p.provider_id" class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-dark-700/40">
            <span class="text-dark-500 mr-0.5">{{ idx+1 }}.</span>
            <span class="w-1.5 h-1.5 rounded-full" :class="p.status==='normal'?'bg-emerald-400':p.status==='fault'?'bg-red-400':'bg-orange-400'"></span>
            {{ p.name }}
          </span>
        </div>
        <div v-if="s.prompt_token_limit>0||s.completion_token_limit>0" class="space-y-1.5">
          <div v-if="s.prompt_token_limit>0" class="flex items-center gap-3 text-xs"><span class="text-dark-400 w-24">Prompt</span><div class="flex-1 h-2 bg-dark-700/50 rounded-full overflow-hidden"><div class="h-full bg-primary-500 rounded-full" :style="{width:Math.min(100,(s.prompt_tokens_used/s.prompt_token_limit)*100)+'%'}"></div></div><span class="text-dark-400 w-36 text-right">{{ s.prompt_tokens_used.toLocaleString() }} / {{ s.prompt_token_limit.toLocaleString() }}</span></div>
          <div v-if="s.completion_token_limit>0" class="flex items-center gap-3 text-xs"><span class="text-dark-400 w-24">Completion</span><div class="flex-1 h-2 bg-dark-700/50 rounded-full overflow-hidden"><div class="h-full bg-primary-500 rounded-full" :style="{width:Math.min(100,(s.completion_tokens_used/s.completion_token_limit)*100)+'%'}"></div></div><span class="text-dark-400 w-36 text-right">{{ s.completion_tokens_used.toLocaleString() }} / {{ s.completion_token_limit.toLocaleString() }}</span></div>
        </div>
      </div>
    </div>
    <Transition name="fade"><div v-if="copyToast" class="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-[100]">{{ t('strat.copied') }}</div></Transition>
    <!-- Guide Modal -->
    <div v-if="showGuide" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="showGuide=null">
      <div class="card p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4"><h3 class="text-lg font-medium text-emerald-400">{{ t('strat.guide_title') }}</h3><button @click="showGuide=null" class="text-dark-500 hover:text-dark-300 text-lg">✕</button></div>
        <div class="bg-dark-900 rounded-lg p-4 font-mono text-sm space-y-2 mb-5">
          <div class="flex items-center gap-2"><span class="text-dark-500 shrink-0">API Base URL:</span><span class="copiable text-primary-400" @click="copy(baseUrl+'/v1')">{{ baseUrl }}/v1</span></div>
          <div class="flex items-center gap-2"><span class="text-dark-500 shrink-0">API Key:</span><span class="copiable text-primary-400" @click="copy(showGuide.key0)">{{ showGuide.key0 }}</span></div>
          <div><span class="text-dark-500">Model:</span> <span class="text-dark-300">{{ t('strat.model_hint') }}</span></div>
        </div>
        <div class="space-y-5 text-sm">
          <div><p class="font-medium text-dark-200 mb-2">▸ OpenClaw</p><pre class="code-block" @click="copy(openclawConfig)">{{ openclawConfig }}</pre></div>
          <div><p class="font-medium text-dark-200 mb-2">▸ LobeChat</p><p class="text-dark-400 text-xs leading-relaxed">API URL: <span class="copiable text-primary-400" @click="copy(baseUrl+'/v1')">{{ baseUrl }}/v1</span><br>API Key: <span class="copiable text-primary-400" @click="copy(showGuide.key0)">{{ showGuide.key0 }}</span></p></div>
          <div><p class="font-medium text-dark-200 mb-2">▸ {{ t('strat.curl_test') }}</p><pre class="code-block" @click="copy(curlCommand)">{{ curlCommand }}</pre></div>
        </div>
        <div class="flex gap-2 mt-5"><button @click="showGuide=null" class="btn-secondary flex-1">{{ t('strat.close') }}</button></div>
      </div>
    </div>
    <!-- Create/Edit Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="showForm=false">
      <div class="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-medium text-dark-100 mb-4">{{ editingId?t('strat.form_edit'):t('strat.form_create') }}</h3>
        <div class="space-y-3">
          <div><label class="label">{{ t('strat.name') }}</label><input v-model="form.name" class="input" :placeholder="t('strat.name_ph')" /></div>
          <div><label class="label">{{ t('strat.mode_label') }}</label><div class="flex gap-3"><label class="flex items-center gap-2 cursor-pointer"><input type="radio" v-model="form.mode" value="priority" class="text-primary-500" /><span class="text-sm text-dark-300">{{ t('strat.mode_priority_label') }}</span></label><label class="flex items-center gap-2 cursor-pointer"><input type="radio" v-model="form.mode" value="round_robin" class="text-primary-500" /><span class="text-sm text-dark-300">{{ t('strat.mode_rr_label') }}</span></label></div></div>
          <div class="border-t border-dark-700/50 pt-3"><p class="text-sm font-medium text-dark-300 mb-2">{{ t('strat.quota_title') }}</p><div class="grid grid-cols-2 gap-3"><div><label class="label">{{ t('strat.prompt_limit') }}</label><input v-model.number="form.prompt_token_limit" type="number" class="input" /></div><div><label class="label">{{ t('strat.completion_limit') }}</label><input v-model.number="form.completion_token_limit" type="number" class="input" /></div></div></div>
          <div class="border-t border-dark-700/50 pt-3">
            <label class="label">{{ t('strat.select_providers') }}</label>
            <p class="text-[10px] text-dark-500 mb-2">{{ t('strat.drag_hint') }}</p>
            <div v-if="allProviders.length===0" class="text-dark-500 text-sm py-2">{{ t('strat.no_providers') }}</div>
            <div v-if="orderedSelected.length>0" class="mb-3">
              <p class="text-[10px] text-dark-500 uppercase tracking-wider mb-1">{{ t('strat.selected') }}</p>
              <div class="space-y-1">
                <div v-for="(p,idx) in orderedSelected" :key="p.id" class="flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-lg px-3 py-2 cursor-grab select-none" draggable="true" @dragstart="onDragStart(idx,$event)" @dragover.prevent="onDragOver(idx,$event)" @dragenter.prevent @drop="onDrop(idx)" @dragend="dragIdx=-1" :class="{'opacity-40':dragIdx===idx,'border-primary-400 bg-primary-500/20':dropIdx===idx}">
                  <span class="text-dark-500 text-xs w-5 shrink-0 font-mono">{{ idx+1 }}</span>
                  <span class="text-dark-400 cursor-grab mr-1">⠿</span>
                  <span class="text-sm text-dark-200 flex-1">{{ p.name }}</span>
                  <span :class="p.status==='normal'?'badge-green':p.status==='fault'?'badge-red':'badge-orange'" class="text-[10px]">{{ p.status==='normal'?t('prov.status_normal'):p.status==='fault'?t('prov.status_fault'):t('prov.status_throttled') }}</span>
                  <button @click="removeProvider(p.id)" class="text-dark-500 hover:text-red-400 text-sm ml-1">✕</button>
                </div>
              </div>
            </div>
            <div v-if="unselectedProviders.length>0">
              <p class="text-[10px] text-dark-500 uppercase tracking-wider mb-1">{{ t('strat.available') }}</p>
              <div class="space-y-1"><div v-for="p in unselectedProviders" :key="p.id" @click="addProvider(p.id)" class="flex items-center gap-3 bg-dark-800/40 rounded-lg px-3 py-2 cursor-pointer hover:bg-dark-700/40 transition-colors"><span class="text-primary-400 text-sm w-5 shrink-0 text-center">+</span><span class="text-sm text-dark-400 flex-1">{{ p.name }}</span><span :class="p.status==='normal'?'badge-green':p.status==='fault'?'badge-red':'badge-orange'" class="text-[10px]">{{ p.status==='normal'?t('prov.status_normal'):p.status==='fault'?t('prov.status_fault'):t('prov.status_throttled') }}</span></div></div>
            </div>
          </div>
        </div>
        <p v-if="formError" class="text-red-400 text-sm mt-3">{{ formError }}</p>
        <div class="flex justify-end gap-2 mt-5"><button @click="showForm=false" class="btn-secondary">{{ t('strat.cancel') }}</button><button @click="saveStrategy" :disabled="saving" class="btn-primary">{{ saving?t('strat.saving'):editingId?t('strat.save'):t('strat.create') }}</button></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../stores/api';
import { useI18n } from '../stores/i18n';
const { t } = useI18n();
const strategies = ref<any[]>([]); const allProviders = ref<any[]>([]); const showForm = ref(false); const showGuide = ref<any>(null); const editingId = ref<string|null>(null); const saving = ref(false); const formError = ref(''); const copyToast = ref(false);
const baseUrl = computed(()=>window.location.origin);
const selectedOrder = ref<string[]>([]); const dragIdx = ref(-1); const dropIdx = ref(-1);
const form = ref({ name:'', mode:'priority' as 'priority'|'round_robin', prompt_token_limit:0, completion_token_limit:0 });
const orderedSelected = computed(()=>selectedOrder.value.map(id=>allProviders.value.find(p=>p.id===id)).filter(Boolean));
const unselectedProviders = computed(()=>{ const s=new Set(selectedOrder.value); return allProviders.value.filter(p=>!s.has(p.id)); });
function addProvider(id:string) { if(!selectedOrder.value.includes(id)) selectedOrder.value.push(id); }
function removeProvider(id:string) { selectedOrder.value=selectedOrder.value.filter(pid=>pid!==id); }
function onDragStart(idx:number,e:DragEvent) { dragIdx.value=idx; if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(idx));} }
function onDragOver(idx:number,e:DragEvent) { dropIdx.value=idx; if(e.dataTransfer) e.dataTransfer.dropEffect='move'; }
function onDrop(target:number) { const from=dragIdx.value; if(from<0||from===target){dropIdx.value=-1;return;} const list=[...selectedOrder.value]; const[moved]=list.splice(from,1); list.splice(target,0,moved); selectedOrder.value=list; dragIdx.value=-1; dropIdx.value=-1; }
const openclawConfig = computed(()=>{ if(!showGuide.value) return ''; return JSON.stringify({baseUrl:`${baseUrl.value}/v1`,apiKey:showGuide.value.key0,api:'openai-completions'},null,2); });
const curlCommand = computed(()=>{ if(!showGuide.value) return ''; return `curl ${baseUrl.value}/v1/chat/completions \\\n  -H "Authorization: Bearer ${showGuide.value.key0}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"akdn","messages":[{"role":"user","content":"hello"}]}'`; });
let toastTimer:ReturnType<typeof setTimeout>;
function copy(text:string) { navigator.clipboard.writeText(text); copyToast.value=true; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{copyToast.value=false;},1500); }
function openForm(s?:any) { formError.value=''; if(s){editingId.value=s.id;form.value={name:s.name,mode:s.mode,prompt_token_limit:s.prompt_token_limit,completion_token_limit:s.completion_token_limit}; const sorted=[...(s.providers||[])].sort((a:any,b:any)=>a.priority-b.priority); selectedOrder.value=sorted.map((p:any)=>p.provider_id);}else{editingId.value=null;form.value={name:'',mode:'priority',prompt_token_limit:0,completion_token_limit:0}; selectedOrder.value=[];} showForm.value=true; }
async function loadStrategies() { try{strategies.value=await api('/api/strategies');}catch{} }
async function loadProviders() { try{allProviders.value=await api('/api/providers');}catch{} }
async function saveStrategy() { formError.value=''; if(!form.value.name){formError.value=t('strat.err_name');return;} if(selectedOrder.value.length===0){formError.value=t('strat.err_providers');return;} const pids=selectedOrder.value.map((id,idx)=>({provider_id:id,priority:idx+1})); const data={...form.value,provider_ids:pids}; saving.value=true; try{ if(editingId.value){await api(`/api/strategies/${editingId.value}`,{method:'PUT',body:JSON.stringify(data)});}else{const r=await api('/api/strategies',{method:'POST',body:JSON.stringify(data)}); showGuide.value=r;} showForm.value=false; loadStrategies(); }catch(err:any){formError.value=err.message;} finally{saving.value=false;} }
async function deleteStrategy(id:string) { if(!confirm(t('strat.delete_confirm'))) return; try{await api(`/api/strategies/${id}`,{method:'DELETE'}); loadStrategies();}catch(err:any){alert(err.message);} }
async function resetUsage(id:string) { try{await api(`/api/strategies/${id}/reset-usage`,{method:'POST'}); loadStrategies();}catch{} }
onMounted(()=>{loadStrategies();loadProviders();});
</script>
<style scoped>
.copiable { cursor:pointer; transition:color 0.15s; border-bottom:1px dashed rgba(96,165,250,0.3); }
.copiable:hover { color:#60a5fa !important; }
.code-block { background:rgba(15,23,42,0.8); border-radius:0.5rem; padding:0.75rem 1rem; font-family:'JetBrains Mono',monospace; font-size:0.75rem; color:#94a3b8; overflow-x:auto; white-space:pre; cursor:pointer; border:1px solid transparent; transition:border-color 0.15s; }
.code-block:hover { border-color:rgba(96,165,250,0.4); }
.fade-enter-active,.fade-leave-active { transition:opacity 0.3s; }
.fade-enter-from,.fade-leave-to { opacity:0; }
</style>
