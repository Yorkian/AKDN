import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection';
import { encrypt, decrypt } from '../db/encrypt';

export interface Provider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  api_type: string;
  model_id: string;
  model_name: string;
  proxy_url: string;
  prompt_token_limit: number;
  completion_token_limit: number;
  prompt_tokens_used: number;
  completion_tokens_used: number;
  status: 'normal' | 'fault' | 'throttled';
  health_reset_at: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderInput {
  name: string;
  base_url: string;
  api_key: string;
  api_type?: string;
  model_id: string;
  proxy_url?: string;
  prompt_token_limit?: number;
  completion_token_limit?: number;
}

export function listProviders(): Omit<Provider, 'api_key'>[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM providers ORDER BY created_at DESC').all() as any[];
  return rows.map(r => ({
    ...r,
    api_key: '***masked***',
  }));
}

export function getProviderById(id: string): Provider | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any;
  if (!row) return null;
  try {
    return { ...row, api_key: decrypt(row.api_key) };
  } catch (err) {
    console.error(`Failed to decrypt API key for provider ${id}:`, err);
    return { ...row, api_key: '' };
  }
}

export function createProvider(input: CreateProviderInput): Provider {
  const db = getDb();
  const id = uuidv4();
  const encryptedKey = encrypt(input.api_key);
  // model_name = model_id (simplified, kept for DB compat)
  const modelName = input.model_id;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  db.prepare(`
    INSERT INTO providers (id, name, base_url, api_key, api_type, model_id, model_name,
      proxy_url, prompt_token_limit, completion_token_limit, health_reset_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.name, input.base_url, encryptedKey,
    input.api_type || 'openai-completions',
    input.model_id, modelName,
    input.proxy_url || '',
    input.prompt_token_limit || 0,
    input.completion_token_limit || 0,
    now,
  );

  return getProviderById(id)!;
}

export function updateProvider(id: string, input: Partial<CreateProviderInput> & {
  prompt_token_limit?: number;
  completion_token_limit?: number;
}): Provider | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any;
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
  if (input.base_url !== undefined) { updates.push('base_url = ?'); values.push(input.base_url); }
  if (input.api_key !== undefined && input.api_key !== '') { updates.push('api_key = ?'); values.push(encrypt(input.api_key)); }
  if (input.api_type !== undefined) { updates.push('api_type = ?'); values.push(input.api_type); }
  if (input.model_id !== undefined) {
    updates.push('model_id = ?'); values.push(input.model_id);
    updates.push('model_name = ?'); values.push(input.model_id); // sync
  }
  if (input.proxy_url !== undefined) { updates.push('proxy_url = ?'); values.push(input.proxy_url); }
  if (input.prompt_token_limit !== undefined) { updates.push('prompt_token_limit = ?'); values.push(input.prompt_token_limit); }
  if (input.completion_token_limit !== undefined) { updates.push('completion_token_limit = ?'); values.push(input.completion_token_limit); }

  if (updates.length === 0) return getProviderById(id);

  // Reset health tracking on edit — historical health data no longer applies
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  updates.push('health_reset_at = ?'); values.push(now);
  updates.push('updated_at = ?'); values.push(now);
  values.push(id);
  db.prepare(`UPDATE providers SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  return getProviderById(id);
}

export function deleteProvider(id: string): { success: boolean; error?: string } {
  const db = getDb();
  const refs = db.prepare('SELECT COUNT(*) as count FROM strategy_providers WHERE provider_id = ?').get(id) as any;
  if (refs.count > 0) {
    return { success: false, error: 'Provider is referenced by one or more strategies. Remove it from strategies first.' };
  }
  db.prepare('DELETE FROM providers WHERE id = ?').run(id);
  return { success: true };
}

export function updateProviderStatus(id: string, status: 'normal' | 'fault' | 'throttled'): void {
  const db = getDb();
  db.prepare("UPDATE providers SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

export function resetProviderUsage(id: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE providers SET
      prompt_tokens_used = 0, completion_tokens_used = 0,
      status = CASE WHEN status = 'throttled' THEN 'normal' ELSE status END,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

export function accumulateProviderUsage(id: string, promptTokens: number, completionTokens: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE providers SET
      prompt_tokens_used = prompt_tokens_used + ?,
      completion_tokens_used = completion_tokens_used + ?
    WHERE id = ?
  `).run(promptTokens, completionTokens, id);

  const provider = db.prepare('SELECT prompt_token_limit, completion_token_limit, prompt_tokens_used, completion_tokens_used FROM providers WHERE id = ?').get(id) as any;
  if (!provider) return;

  const promptExceeded = provider.prompt_token_limit > 0 && provider.prompt_tokens_used >= provider.prompt_token_limit;
  const completionExceeded = provider.completion_token_limit > 0 && provider.completion_tokens_used >= provider.completion_token_limit;
  if (promptExceeded || completionExceeded) {
    updateProviderStatus(id, 'throttled');
  }
}

export function isProviderExceeded(provider: any): boolean {
  const promptExceeded = provider.prompt_token_limit > 0 && provider.prompt_tokens_used >= provider.prompt_token_limit;
  const completionExceeded = provider.completion_token_limit > 0 && provider.completion_tokens_used >= provider.completion_token_limit;
  return promptExceeded || completionExceeded;
}
