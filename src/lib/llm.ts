import {
  buildFollowUpUserPrompt,
  buildTopicValidationUserPrompt,
  buildUserReportPrompt,
  getFollowUpSystem,
  getSystemInstruction,
  getTopicValidationSystem,
  type InfoType,
  type UserProfile,
} from './prompts';

export type { InfoType, UserProfile };

function getLlmEnv(): { apiUrl: string; model: string; apiKey: string } {
  return {
    apiUrl: process.env.LLM_API_URL || '',
    model: process.env.LLM_MODEL || '',
    apiKey: process.env.LLM_API_KEY || '',
  };
}

function extractAssistantText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const err = d.error;
  if (err && typeof err === 'object') {
    const msg = (err as { message?: string }).message;
    throw new Error(typeof msg === 'string' ? msg : 'LLM API 返回错误');
  }
  const choices = d.choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const msg = (choices[0] as Record<string, unknown>)?.message;
  if (!msg || typeof msg !== 'object') return '';
  const content = (msg as { content?: unknown }).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

async function chatCompletion(
  apiUrl: string,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  options?: { temperature?: number; max_tokens?: number; stream?: boolean }
): Promise<Response> {
  return fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens,
      stream: options?.stream ?? false,
    }),
  });
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`LLM 响应非 JSON（HTTP ${res.status}）`);
  }
}

function requireLlmEnv(): { apiUrl: string; model: string; apiKey: string } {
  const { apiUrl: rawUrl, model: rawModel, apiKey: rawKey } = getLlmEnv();
  const apiUrl = rawUrl.trim();
  const model = rawModel.trim();
  const apiKey = rawKey.trim();
  if (!apiUrl || !model || !apiKey) {
    throw new Error(
      '请在环境变量中配置 LLM_API_URL、LLM_MODEL、LLM_API_KEY（例如写入 .env.local）'
    );
  }
  return { apiUrl, model, apiKey };
}

/** 选题是否适合进入撰写（二次 LLM 审核） */
export async function validateTopic(topic: string): Promise<boolean> {
  const { apiUrl, model, apiKey } = requireLlmEnv();

  const res = await chatCompletion(
    apiUrl,
    model,
    apiKey,
    [
      { role: 'system', content: getTopicValidationSystem() },
      { role: 'user', content: buildTopicValidationUserPrompt(topic) },
    ],
    { temperature: 0.2, max_tokens: 24 }
  );

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: { message?: string } }).error?.message || res.statusText)
        : '';
    throw new Error(errMsg || `选题审核请求失败 (${res.status})`);
  }

  const raw = extractAssistantText(data).trim();
  const first = raw.split(/\r?\n/)[0]?.trim() ?? '';
  const u = first.toUpperCase();
  if (u.startsWith('YES')) return true;
  if (u.startsWith('NO')) return false;
  if (/^(是|适合|可以|通过)/.test(first)) return true;
  if (/^(否|不适合|不宜)/.test(first)) return false;
  return false;
}

/** 根据终稿生成「撰写人调研备忘」（第二轮） */
export async function generateFollowUpSuggestions(finalDraft: string): Promise<string> {
  const { apiUrl, model, apiKey } = requireLlmEnv();

  const res = await chatCompletion(
    apiUrl,
    model,
    apiKey,
    [
      { role: 'system', content: getFollowUpSystem() },
      { role: 'user', content: buildFollowUpUserPrompt(finalDraft) },
    ],
    { temperature: 0.45, max_tokens: 1200 }
  );

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: { message?: string } }).error?.message || res.statusText)
        : '';
    throw new Error(errMsg || `调研备忘生成失败 (${res.status})`);
  }

  const out = extractAssistantText(data);
  if (!out.trim()) {
    throw new Error('调研备忘未返回有效内容');
  }
  return out.trim();
}

function parseSseLineForDelta(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return '';
  const data = trimmed.slice(5).trim();
  if (data === '[DONE]') return '';
  try {
    const json = JSON.parse(data) as Record<string, unknown>;
    const choices = json.choices;
    if (!Array.isArray(choices) || choices.length === 0) return '';
    const delta = (choices[0] as Record<string, unknown>)?.delta as Record<string, unknown> | undefined;
    if (!delta) return '';
    const content = delta.content;
    if (typeof content === 'string') return content;
    return '';
  } catch {
    return '';
  }
}

/** 流式生成主报告；onBuffer 在每次累积全文后调用 */
export async function generateReportStream(
  topic: string,
  profile: UserProfile,
  onBuffer: (fullText: string) => void,
  infoType: InfoType = ''
): Promise<string> {
  const { apiUrl, model, apiKey } = requireLlmEnv();
  const prompt = buildUserReportPrompt(topic, profile, infoType);

  const res = await chatCompletion(
    apiUrl,
    model,
    apiKey,
    [
      { role: 'system', content: getSystemInstruction() },
      { role: 'user', content: prompt },
    ],
    { stream: true, temperature: 0.7 }
  );

  if (!res.ok) {
    const text = await res.text();
    let err = text.slice(0, 200);
    try {
      const data = JSON.parse(text) as { error?: { message?: string } };
      err = data.error?.message || err;
    } catch {
      /* ignore */
    }
    throw new Error(`LLM 请求失败 (${res.status}): ${err}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('接口未返回可读的流式响应，请确认模型支持 stream: true');
  }

  const decoder = new TextDecoder();
  let carry = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const parts = carry.split('\n');
    carry = parts.pop() || '';
    for (const line of parts) {
      const delta = parseSseLineForDelta(line);
      if (delta) {
        full += delta;
        onBuffer(full);
      }
    }
  }
  if (carry.trim()) {
    const delta = parseSseLineForDelta(carry);
    if (delta) {
      full += delta;
      onBuffer(full);
    }
  }

  if (!full.trim()) {
    throw new Error('流式生成未返回有效正文，请检查模型是否支持 OpenAI 兼容的 SSE 流式输出');
  }
  return full;
}

/** 非流式回退（部分兼容接口不支持 stream） */
export async function generateReport(
  topic: string,
  profile: UserProfile,
  infoType: InfoType = ''
): Promise<string> {
  const { apiUrl, model, apiKey } = requireLlmEnv();
  const prompt = buildUserReportPrompt(topic, profile, infoType);

  const res = await chatCompletion(
    apiUrl,
    model,
    apiKey,
    [
      { role: 'system', content: getSystemInstruction() },
      { role: 'user', content: prompt },
    ],
    { stream: false, temperature: 0.7 }
  );

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: { message?: string } }).error?.message || res.statusText)
        : '';
    throw new Error(`LLM 请求失败 (${res.status}): ${errMsg}`);
  }

  const out = extractAssistantText(data);
  if (!out) {
    throw new Error('LLM 未返回有效正文，请检查模型与接口是否兼容 OpenAI Chat Completions 格式');
  }
  return out;
}
