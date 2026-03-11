import { Strategy } from './strategy.service';
import { getProviderById, Provider } from './provider.service';

// Round-robin counters per strategy
const rrCounters = new Map<string, number>();

export interface ScheduleResult {
  provider: Provider;
  isFallback: boolean;
}

export function selectProvider(strategy: Strategy): ScheduleResult | null {
  const providers = strategy.providers || [];
  
  // Get full provider data for normal-status providers
  const available: { provider: Provider; priority: number }[] = [];
  
  for (const sp of providers) {
    const p = getProviderById(sp.provider_id);
    if (p && p.status === 'normal' && p.is_active) {
      available.push({ provider: p, priority: sp.priority });
    }
  }

  if (available.length === 0) return null;

  if (strategy.mode === 'priority') {
    // Sort by priority (lower number = higher priority)
    available.sort((a, b) => a.priority - b.priority);
    return { provider: available[0].provider, isFallback: false };
  }

  // Round Robin
  const counter = rrCounters.get(strategy.id) || 0;
  const index = counter % available.length;
  rrCounters.set(strategy.id, counter + 1);
  return { provider: available[index].provider, isFallback: false };
}

export function selectNextProvider(strategy: Strategy, excludeIds: string[]): ScheduleResult | null {
  const providers = strategy.providers || [];
  
  const available: { provider: Provider; priority: number }[] = [];
  
  for (const sp of providers) {
    if (excludeIds.includes(sp.provider_id)) continue;
    const p = getProviderById(sp.provider_id);
    if (p && p.status === 'normal' && p.is_active) {
      available.push({ provider: p, priority: sp.priority });
    }
  }

  if (available.length === 0) return null;

  if (strategy.mode === 'priority') {
    available.sort((a, b) => a.priority - b.priority);
    return { provider: available[0].provider, isFallback: true };
  }

  // Round Robin - just take next available
  const counter = rrCounters.get(strategy.id) || 0;
  const index = counter % available.length;
  rrCounters.set(strategy.id, counter + 1);
  return { provider: available[index].provider, isFallback: true };
}
