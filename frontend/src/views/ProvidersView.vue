<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-dark-100">{{ t('prov.title') }}</h2>
      <button @click="openForm()" class="btn-primary">{{ t('prov.add') }}</button>
    </div>
    <div v-if="providers.length===0" class="card p-12 text-center text-dark-500">{{ t('prov.empty') }}</div>
    <div v-else class="grid gap-4">
      <div v-for="p in providers" :key="p.id" class="card p-5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-medium text-dark-100">{{ p.name }}</h3>
              <span :class="statusBadge(p.status)">{{ statusLabel(p.status) }}</span>
            </div>
            <p class="text-xs text-dark-500 font-mono mt-1">{{ p.base_url }} · {{ p.model_id }}</p>
            <p v-if="p.proxy_url" class="text-xs text-dark-600 font-mono mt-0.5">{{ t('prov.proxy_label') }}: {{ maskProxy(p.proxy_url) }}</p>
          </div>
          <div class="flex gap-2">
            <button @click="runTest(p.id)" class="btn-sm btn-secondary">{{ t('prov.test') }}</button>
            <button @click="openForm(p)" class="btn-sm btn-secondary">{{ t('prov.edit') }}</button>
            <button @click="resetUsage(p.id)" class="btn-sm btn-secondary">{{ t('prov.reset') }}</button>
            <button @click="deleteProvider(p.id)" class="btn-sm btn-danger">{{ t('prov.delete') }}</button>
          </div>
        </div>
        <div v-if="p.prompt_token_limit>0||p.completion_token_limit>0" class="space-y-2">
          <div v-if="p.prompt_token_limit>0" class="flex items-center gap-3 text-xs">
            <span class="text-dark-400 w-24">Prompt</span>
            <div class="flex-1 h-2 bg-dark-700/50 rounded-full overflow-hidden"><div class="h-full rounded-full transition-all" :class="usageColor(p.prompt_tokens_used,p.prompt_token_limit)" :style="{width:Math.min(100,(p.prompt_tokens_used/p.prompt_token_limit)*100)+'%'}"></div></div>
            <span class="text-dark-400 w-32 text-right">{{ p.prompt_tokens_used.toLocaleString() }} / {{ p.prompt_token_limit.toLocaleString() }}</span>
          </div>
          <div v-if="p.completion_token_limit>0" class="flex items-center gap-3 text-xs">
            <span class="text-dark-400 w-24">Completion</span>
            <div class="flex-1 h-2 bg-dark-700/50 rounded-full overflow-hidden"><div class="h-full rounded-full transition-all" :class="usageColor(p.completion_tokens_used,p.completion_token_limit)" :style="{width:Math.min(100,(p.completion_tokens_used/p.completion_token_limit)*100)+'%'}"></div></div>
            <span class="text-dark-400 w-32 text-right">{{ p.completion_tokens_used.toLocaleString() }} / {{ p.completion_token_limit.toLocaleString() }}</span>
          </div>
        </div>
        <div v-else class="text-xs text-dark-500">{{ t('prov.usage_unlimited') }}</div>
      </div>
    </div>
    <!-- Test Modal -->
    <div v-if="testModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="testModal=false">
      <div class="card p-6 w-full max-w-md">
        <div class="flex items-center justify-between mb-4"><h3 class="text-sm font-medium text-dark-200">{{ t('prov.test_title') }}</h3><button @click="testModal=false" class="text-dark-500 hover:text-dark-300">✕</button></div>
        <div v-if="testLoading" class="flex items-center gap-3 py-6 justify-center"><div class="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin"></div><span class="text-sm text-dark-400">{{ t('prov.testing') }}</span></div>
        <div v-else class="space-y-3">
          <div v-for="(step,idx) in testSteps" :key="idx" class="flex items-start gap-3 p-3 rounded-lg" :class="step.status==='ok'?'bg-emerald-500/10':step.status==='fail'?'bg-red-500/10':'bg-dark-700/20'">
            <span class="shrink-0 mt-0.5"><span v-if="step.status==='ok'" class="text-emerald-400">✅</span><span v-else-if="step.status==='fail'" class="text-red-400">❌</span><span v-else class="text-dark-500">⏭️</span></span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium" :class="step.status==='fail'?'text-red-300':'text-dark-200'">{{ stepName(step) }}</p>
              <p class="text-xs text-dark-400 mt-0.5 break-all">{{ stepDetail(step) }}</p>
              <div v-if="step.lines&&step.lines.length" class="mt-1.5 space-y-0.5">
                <div v-for="(line,li) in step.lines" :key="li" class="text-xs">
                  <span class="text-dark-500">{{ lineLabel(line.label) }}：</span>
                  <span class="text-dark-300 font-mono">{{ line.value }}</span>
                </div>
              </div>
              <p v-if="step.ms" class="text-[10px] text-dark-500 mt-1">{{ step.ms }}ms</p>
            </div>
          </div>
        </div>
        <div class="mt-4"><button @click="testModal=false" class="btn-secondary w-full">{{ t('prov.test_close') }}</button></div>
      </div>
    </div>
    <!-- Add/Edit Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="showForm=false">
      <div class="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-medium text-dark-100 mb-4">{{ editingId ? t('prov.form_edit') : t('prov.form_add') }}</h3>
        <div v-if="!editingId" class="mb-5"><p class="label">{{ t('prov.presets') }}</p><div class="flex flex-wrap gap-2"><button v-for="preset in presets" :key="preset.name" @click="applyPreset(preset)" class="btn-sm btn-secondary text-xs">{{ preset.name }}</button></div></div>
        <div class="space-y-3">
          <div><label class="label">{{ t('prov.name') }}</label><input v-model="form.name" class="input" :placeholder="t('prov.name_ph')" /></div>
          <div><label class="label">{{ t('prov.base_url') }}</label><input v-model="form.base_url" class="input font-mono text-xs" placeholder="https://api.openai.com/v1" /></div>
          <div><label class="label">{{ t('prov.api_key') }}</label><div class="relative"><input v-model="form.api_key" :type="showKey?'text':'password'" class="input font-mono text-xs pr-14" :placeholder="editingId?t('prov.api_key_keep'):'sk-xxx'" /><button @click="showKey=!showKey" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-dark-500 hover:text-dark-300">{{ showKey?t('prov.hide'):t('prov.show') }}</button></div></div>
          <div><label class="label">{{ t('prov.api_type') }}</label><input v-model="form.api_type" class="input" /></div>
          <div><label class="label">{{ t('prov.model') }}</label><input v-model="form.model_id" class="input font-mono text-xs" placeholder="gpt-4o" /></div>
          <div class="border-t border-dark-700/50 pt-3">
            <label class="label">{{ t('prov.proxy') }} <span class="text-dark-500 font-normal">{{ t('prov.proxy_optional') }}</span></label>
            <input v-model="form.proxy_url" class="input font-mono text-xs" :placeholder="t('prov.proxy_ph')" />
            <p class="text-[10px] text-dark-500 mt-1">{{ t('prov.proxy_protocols') }}</p>
          </div>
          <div class="border-t border-dark-700/50 pt-3">
            <p class="text-sm font-medium text-dark-300 mb-2">{{ t('prov.quota_title') }}</p>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="label">{{ t('prov.prompt_limit') }}</label><input v-model.number="form.prompt_token_limit" type="number" class="input" /></div>
              <div><label class="label">{{ t('prov.completion_limit') }}</label><input v-model.number="form.completion_token_limit" type="number" class="input" /></div>
            </div>
          </div>
        </div>
        <p v-if="formError" class="text-red-400 text-sm mt-3">{{ formError }}</p>
        <div class="flex justify-end gap-2 mt-5"><button @click="showForm=false" class="btn-secondary">{{ t('prov.cancel') }}</button><button @click="saveProvider" :disabled="saving" class="btn-primary">{{ saving?t('prov.saving'):t('prov.save') }}</button></div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../stores/api';
import { useI18n } from '../stores/i18n';
const { t } = useI18n();
const providers = ref<any[]>([]); const presets = ref<any[]>([]); const showForm = ref(false); const editingId = ref<string|null>(null); const showKey = ref(false); const saving = ref(false); const formError = ref('');
const testModal = ref(false); const testLoading = ref(false); const testSteps = ref<any[]>([]);
const form = ref({ name:'',base_url:'',api_key:'',api_type:'openai-completions',model_id:'',proxy_url:'',prompt_token_limit:0,completion_token_limit:0 });
function statusBadge(s:string) { return s==='fault'?'badge-red':s==='throttled'?'badge-orange':'badge-green'; }
function statusLabel(s:string) { return s==='fault'?t('prov.status_fault'):s==='throttled'?t('prov.status_throttled'):t('prov.status_normal'); }
function stepName(step:any):string {
  if(step.step==='proxy_test') return t('prov.step_proxy');
  if(step.step==='api_test') return t('prov.step_api');
  return t('prov.step_error');
}
function stepDetail(step:any):string {
  if(step.step==='proxy_test') {
    if(step.status==='ok') return t('prov.proxy_ok');
    if(step.status==='skip') return t('prov.proxy_skip');
    return `${t('prov.proxy_fail')}: ${step.errorRaw||''}`;
  }
  if(step.step==='api_test') {
    if(step.status==='ok') return `${t('prov.api_model')}: ${step.model||'-'} — ${t('prov.api_ok')}`;
    return `${t('prov.api_fail')}: ${step.errorRaw||''}`;
  }
  return step.errorRaw||step.detail||'';
}
function lineLabel(key:string):string {
  if(key==='ip') return t('prov.proxy_ip');
  if(key==='isp') return t('prov.proxy_isp');
  return key;
}
function usageColor(u:number,l:number) { const p=(u/l)*100; return p>=90?'bg-red-500':p>=70?'bg-amber-500':'bg-primary-500'; }
function maskProxy(url:string) { try { const u=new URL(url); if(u.password) u.password='***'; return u.toString(); } catch { return url; } }
function openForm(p?:any) { formError.value=''; showKey.value=false; if(p){editingId.value=p.id;form.value={name:p.name,base_url:p.base_url,api_key:'',api_type:p.api_type,model_id:p.model_id,proxy_url:p.proxy_url||'',prompt_token_limit:p.prompt_token_limit,completion_token_limit:p.completion_token_limit};}else{editingId.value=null;form.value={name:'',base_url:'',api_key:'',api_type:'openai-completions',model_id:'',proxy_url:'',prompt_token_limit:0,completion_token_limit:0};} showForm.value=true; }
function applyPreset(p:any) { form.value.name=p.name;form.value.base_url=p.base_url;form.value.api_type=p.api_type;form.value.model_id=p.model_id; }
async function loadProviders() { try{providers.value=await api('/api/providers');}catch{} }
async function loadPresets() { try{presets.value=await api('/api/providers/presets');}catch{} }
async function saveProvider() { formError.value=''; const data:any={...form.value}; if(editingId.value&&!data.api_key) delete data.api_key; saving.value=true; try { if(editingId.value){await api(`/api/providers/${editingId.value}`,{method:'PUT',body:JSON.stringify(data)});}else{await api('/api/providers',{method:'POST',body:JSON.stringify(data)});} showForm.value=false; loadProviders(); } catch(err:any){formError.value=err.message;} finally{saving.value=false;} }
async function deleteProvider(id:string) { if(!confirm(t('prov.delete_confirm'))) return; try{await api(`/api/providers/${id}`,{method:'DELETE'}); loadProviders();}catch(err:any){alert(err.message);} }
async function runTest(id:string) { testModal.value=true; testLoading.value=true; testSteps.value=[]; try{const r=await api(`/api/providers/${id}/test`,{method:'POST'}); testSteps.value=r.steps||[];}catch(err:any){testSteps.value=[{step:'Error',status:'fail',detail:err.message}];} finally{testLoading.value=false;} }
async function resetUsage(id:string) { try{await api(`/api/providers/${id}/reset-usage`,{method:'POST'}); loadProviders();}catch{} }
onMounted(()=>{loadProviders();loadPresets();});
</script>
