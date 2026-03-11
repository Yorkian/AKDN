import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection';
import { generateKey0 } from '../utils/key-generator';

export interface Strategy {
  id: string;
  name: string;
  mode: 'priority' | 'round_robin';
  prompt_token_limit: number;
  completion_token_limit: number;
  prompt_tokens_used: number;
  completion_tokens_used: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  key0?: string;
  providers?: StrategyProvider[];
}

export interface StrategyProvider {
  provider_id: string;
  priority: number;
  name?: string;
  status?: string;
}

export interface CreateStrategyInput {
  name: string;
  mode: 'priority' | 'round_robin';
  prompt_token_limit?: number;
  completion_token_limit?: number;
  provider_ids: { provider_id: string; priority: number }[];
}

export function listStrategies(): Strategy[] {
  const db = getDb();
  const strategies = db.prepare('SELECT * FROM strategies ORDER BY created_at DESC').all() as Strategy[];

  return strategies.map(s => {
    const key = db.prepare('SELECT key_value FROM api_keys WHERE strategy_id = ?').get(s.id) as any;
    const providers = db.prepare(`
      SELECT sp.provider_id, sp.priority, p.name, p.status
      FROM strategy_providers sp
      JOIN providers p ON p.id = sp.provider_id
      WHERE sp.strategy_id = ?
      ORDER BY sp.priority ASC
    `).all(s.id) as StrategyProvider[];

    return { ...s, key0: key?.key_value, providers };
  });
}

export function getStrategyById(id: string): Strategy | null {
  const db = getDb();
  const s = db.prepare('SELECT * FROM strategies WHERE id = ?').get(id) as Strategy | undefined;
  if (!s) return null;

  const key = db.prepare('SELECT key_value FROM api_keys WHERE strategy_id = ?').get(s.id) as any;
  const providers = db.prepare(`
    SELECT sp.provider_id, sp.priority, p.name, p.status
    FROM strategy_providers sp
    JOIN providers p ON p.id = sp.provider_id
    WHERE sp.strategy_id = ?
    ORDER BY sp.priority ASC
  `).all(s.id) as StrategyProvider[];

  return { ...s, key0: key?.key_value, providers };
}

export function getStrategyByKey0(keyValue: string): Strategy | null {
  const db = getDb();
  const key = db.prepare('SELECT strategy_id, id FROM api_keys WHERE key_value = ? AND is_active = 1').get(keyValue) as any;
  if (!key) return null;
  const strategy = getStrategyById(key.strategy_id);
  if (strategy) (strategy as any).api_key_id = key.id;
  return strategy;
}

export function createStrategy(input: CreateStrategyInput): Strategy {
  const db = getDb();
  const id = uuidv4();
  const keyId = uuidv4();
  const keyValue = generateKey0();

  const insertStrategy = db.prepare(`
    INSERT INTO strategies (id, name, mode, prompt_token_limit, completion_token_limit)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertKey = db.prepare(`
    INSERT INTO api_keys (id, strategy_id, key_value)
    VALUES (?, ?, ?)
  `);

  const insertProvider = db.prepare(`
    INSERT INTO strategy_providers (strategy_id, provider_id, priority)
    VALUES (?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insertStrategy.run(id, input.name, input.mode, input.prompt_token_limit || 0, input.completion_token_limit || 0);
    insertKey.run(keyId, id, keyValue);
    for (const p of input.provider_ids) {
      insertProvider.run(id, p.provider_id, p.priority);
    }
  });

  tx();
  return getStrategyById(id)!;
}

export function updateStrategy(id: string, input: Partial<CreateStrategyInput>): Strategy | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM strategies WHERE id = ?').get(id) as any;
  if (!existing) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
  if (input.mode !== undefined) { updates.push('mode = ?'); values.push(input.mode); }
  if (input.prompt_token_limit !== undefined) { updates.push('prompt_token_limit = ?'); values.push(input.prompt_token_limit); }
  if (input.completion_token_limit !== undefined) { updates.push('completion_token_limit = ?'); values.push(input.completion_token_limit); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE strategies SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  // Update providers if provided
  if (input.provider_ids !== undefined) {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM strategy_providers WHERE strategy_id = ?').run(id);
      const insert = db.prepare('INSERT INTO strategy_providers (strategy_id, provider_id, priority) VALUES (?, ?, ?)');
      for (const p of input.provider_ids!) {
        insert.run(id, p.provider_id, p.priority);
      }
    });
    tx();
  }

  return getStrategyById(id);
}

export function deleteStrategy(id: string): boolean {
  const db = getDb();
  db.prepare('DELETE FROM strategies WHERE id = ?').run(id);
  return true;
}

export function resetStrategyUsage(id: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE strategies SET
      prompt_tokens_used = 0,
      completion_tokens_used = 0,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

export function accumulateStrategyUsage(id: string, promptTokens: number, completionTokens: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE strategies SET
      prompt_tokens_used = prompt_tokens_used + ?,
      completion_tokens_used = completion_tokens_used + ?
    WHERE id = ?
  `).run(promptTokens, completionTokens, id);
}

export function isStrategyExceeded(strategy: Strategy): boolean {
  const promptExceeded = strategy.prompt_token_limit > 0 && strategy.prompt_tokens_used >= strategy.prompt_token_limit;
  const completionExceeded = strategy.completion_token_limit > 0 && strategy.completion_tokens_used >= strategy.completion_token_limit;
  return promptExceeded || completionExceeded;
}
