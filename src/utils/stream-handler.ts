export interface ParsedSSEChunk {
  delta?: { content?: string; role?: string };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finishReason?: string;
  done: boolean;
}

export function parseSSEData(data: string): ParsedSSEChunk {
  if (data === '[DONE]') {
    return { done: true };
  }
  
  try {
    const json = JSON.parse(data);
    const choice = json.choices?.[0];
    return {
      delta: choice?.delta,
      usage: json.usage || undefined,
      finishReason: choice?.finish_reason || undefined,
      done: false,
    };
  } catch {
    return { done: false };
  }
}

export function extractSSELines(chunk: Buffer | string): string[] {
  const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
  const lines: string[] = [];
  
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      lines.push(trimmed.substring(6));
    }
  }
  
  return lines;
}
