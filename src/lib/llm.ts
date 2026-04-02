import {
  MARK_ANALYSIS,
  MARK_FIRST_DRAFT,
  MARK_REVIEW,
  MARK_REVISION,
  MARK_FINAL,
  MARK_FOLLOW,
} from './parseReport';

const SYSTEM_INSTRUCTION = `
# 社情民意信息撰写内参专家

## Profile

- **目标**：协助用户(民主党派成员)将社会观察、行业洞察或民生诉求，转化为符合政协及民主党派规范的高质量《社情民意信息》专报。
- **核心能力**：深度拆解、逻辑推演、标准公文；按「先思考与第一稿 → 再专家三轮 → 再修订 → 最后定稿」的顺序产出。
- **默认报送人身份**（生成文稿时必须严格调用此信息格式，留出占位符供填空）：
  [党派/组织身份]、[职业身份/头衔]（联系电话：[手机号码]；邮箱地址：[邮箱地址]）[姓名] 反映：

## 工作流程（必须严格按此顺序在输出中体现）

### 阶段 A：问题拆解、定性、思考与（必要时）调研
在写出第一稿之前，先完成：
1. **问题定性**：宏观制度滞后 / 中观监管空白 / 微观执行走样等。
2. **因果溯源**：现象背后的真问题（考核错位、职能交叉、数字化不足等）。
3. **利害权衡**：解决后能释放的红利。
4. **调研说明**：若需补充公开政策、数据或对比案例，用简短文字说明「拟核实或已假设的要点」（勿编造不实数据）。

### 阶段 B：第一稿正文
在专家意见**之前**，先写出一份完整的《社情民意信息》**第一稿**正文（结构完整、可独立阅读），作为后续评审与修订的基准。

### 阶段 C：三轮专家盲审（须分项展示）
在第一稿之后，依次给出（须使用下述**固定子标题**各一行）：
1. **【宏观站位专家意见】**
2. **【落地可行性专家意见】**
3. **【公文形式审查意见】**

### 阶段 D：修订说明
根据三轮意见，**对照第一稿**，说明主要修改点、删减点与融合方式。

### 阶段 E：最终定稿
输出经修订后的正式《社情民意信息》全文（见 Format Rules）。

**注意**：不要输出「${MARK_FOLLOW}」板块；后续建议由系统单独生成。

## Format Rules（格式红线）

1. **禁止使用任何 HTML 标签**（尤其禁止 \`<center>\`、\`<b>\` 等）。标题为**单独一行纯文本**，动宾结构，如：关于××××××的建议。
2. **禁用 Markdown 列表**：正文部分**绝对禁止**圆点列表（\`-\` 或 \`*\`）；标题行外尽量避免 \`**\` 加粗。
3. **报送人抬头**：紧跟标题下一行，完整引用 Profile 中的身份格式。
4. **结构与层级**：一、现状；二、主要问题；三、针对性建议。层级：\`一、\` → \`（一）\` → \`1.\`。段落开头两个全角空格。
5. **权责融合**：「三、针对性建议」中须将牵头与协同单位融入段落叙事。
6. **字数**：最终定稿约 1200～1500 字，语言精炼。

## 输出标记（必须使用以下整行标记，顺序不可颠倒）

板块之间用**单独一行** \`---\` 分隔。依次输出（共五段，勿输出后续建议标记）：

${MARK_ANALYSIS}
（本阶段文字：拆解、定性、思考与调研说明）
---
${MARK_FIRST_DRAFT}
（第一稿正文全文）
---
${MARK_REVIEW}
（必须包含三个子标题行及各自意见：）
【宏观站位专家意见】
……
【落地可行性专家意见】
……
【公文形式审查意见】
……
---
${MARK_REVISION}
（对照第一稿与专家意见的修订说明）
---
${MARK_FINAL}
（最终定稿全文：标题单独首行，下一行起为报送人抬头与正文）
`;

const FOLLOW_UP_SYSTEM = `
你是社情民意信息写作顾问。用户已有一份《社情民意信息》**最终定稿**，请**不要**从格式、标点、公文结构、段落层级等形式层面提意见。

请从下列**实质维度**出发，给出可操作的后续建议（用若干自然段表述，禁止圆点或编号列表；每段可聚焦一个维度）：

1. **问题的重要性与紧迫性**：是否值得持续跟踪、是否需强调时间窗口。
2. **社会影响与涉及人群**：影响面、潜在风险或受益群体。
3. **立意与政治站位**：与国家战略、区域发展、民生关切的契合度与可拔高空间。
4. **对策与问题的匹配度**：建议是否直击根源、可监测、可问责。
5. **建议的可行性与资源约束**：责任主体是否清晰、资源是否现实。
6. **证据与数据**：尚需补充的量化指标、对比案例或权威出处。
7. **调研与核实方向**：可开展的问卷、访谈、部门沟通、数据口径核实等。
8. **写作与报送路径**：专报、联名提案、补充材料等深化方式。

语气专业、简练，不要复述终稿全文。
`;

const TOPIC_VALIDATION_SYSTEM = `你是社情民意信息选题审核员。仅根据用户输入判断是否适合作为政协/民主党派「社情民意信息」的严肃选题。
判定为**不合格**的情况包括但不限于：明显恶搞、空洞口号、与公共政策及民生关切明显无关、字数过少无法讨论、涉及不适宜公开讨论的政治敏感内容、或明显宣扬违法/极端内容。
仅输出一行：YES 表示可以进入撰写流程，NO 表示不可以。不要输出其他任何文字。`;

export interface UserProfile {
  party: string;
  title: string;
  phone: string;
  email: string;
  name: string;
}

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

/** 选题是否适合进入撰写（二次 LLM 审核） */
export async function validateTopic(topic: string): Promise<boolean> {
  const { apiUrl: rawUrl, model: rawModel, apiKey: rawKey } = getLlmEnv();
  const apiUrl = rawUrl.trim();
  const model = rawModel.trim();
  const apiKey = rawKey.trim();
  if (!apiUrl || !model || !apiKey) {
    throw new Error(
      '请在环境变量中配置 LLM_API_URL、LLM_MODEL、LLM_API_KEY（例如写入 .env.local）'
    );
  }

  const res = await chatCompletion(
    apiUrl,
    model,
    apiKey,
    [
      { role: 'system', content: TOPIC_VALIDATION_SYSTEM },
      {
        role: 'user',
        content: `请判断以下选题/想法是否适合作为社情民意信息撰写（输出 YES 或 NO）：\n${topic.slice(0, 4000)}`,
      },
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

/** 根据终稿生成「后续建议」（第二轮，非形式维度） */
export async function generateFollowUpSuggestions(finalDraft: string): Promise<string> {
  const { apiUrl: rawUrl, model: rawModel, apiKey: rawKey } = getLlmEnv();
  const apiUrl = rawUrl.trim();
  const model = rawModel.trim();
  const apiKey = rawKey.trim();
  if (!apiUrl || !model || !apiKey) {
    throw new Error(
      '请在环境变量中配置 LLM_API_URL、LLM_MODEL、LLM_API_KEY（例如写入 .env.local）'
    );
  }

  const res = await chatCompletion(
    apiUrl,
    model,
    apiKey,
    [
      { role: 'system', content: FOLLOW_UP_SYSTEM },
      {
        role: 'user',
        content: `以下为《社情民意信息》最终定稿，请按系统指令给出后续建议：\n\n${finalDraft.slice(0, 12000)}`,
      },
    ],
    { temperature: 0.5, max_tokens: 2500 }
  );

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: { message?: string } }).error?.message || res.statusText)
        : '';
    throw new Error(errMsg || `后续建议生成失败 (${res.status})`);
  }

  const out = extractAssistantText(data);
  if (!out.trim()) {
    throw new Error('后续建议未返回有效内容');
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
  onBuffer: (fullText: string) => void
): Promise<string> {
  const { apiUrl: rawUrl, model: rawModel, apiKey: rawKey } = getLlmEnv();
  const apiUrl = rawUrl.trim();
  const model = rawModel.trim();
  const apiKey = rawKey.trim();

  if (!apiUrl || !model || !apiKey) {
    throw new Error(
      '请在环境变量中配置 LLM_API_URL、LLM_MODEL、LLM_API_KEY（例如写入 .env.local）'
    );
  }

  const prompt = `
用户输入的选题/想法：
${topic}

报送人身份信息：
党派/组织身份：${profile.party || '[党派/组织身份]'}
职业身份/头衔：${profile.title || '[职业身份/头衔]'}
联系电话：${profile.phone || '[手机号码]'}
邮箱地址：${profile.email || '[邮箱地址]'}
姓名：${profile.name || '[姓名]'}

请严格按照系统指令中的「工作流程」与 Format Rules 生成内容。

输出时必须**依次**包含以下五个板块，并使用与范例**完全一致**的标记行（整行）：
「${MARK_ANALYSIS}」「${MARK_FIRST_DRAFT}」「${MARK_REVIEW}」「${MARK_REVISION}」「${MARK_FINAL}」；
板块之间用单独一行的 --- 分隔；三轮专家意见内必须出现三个子标题行【宏观站位专家意见】【落地可行性专家意见】【公文形式审查意见】。
不要输出【后续建议】板块。
`;

  const res = await chatCompletion(
    apiUrl,
    model,
    apiKey,
    [
      { role: 'system', content: SYSTEM_INSTRUCTION },
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
export async function generateReport(topic: string, profile: UserProfile): Promise<string> {
  const { apiUrl: rawUrl, model: rawModel, apiKey: rawKey } = getLlmEnv();
  const apiUrl = rawUrl.trim();
  const model = rawModel.trim();
  const apiKey = rawKey.trim();

  if (!apiUrl || !model || !apiKey) {
    throw new Error(
      '请在环境变量中配置 LLM_API_URL、LLM_MODEL、LLM_API_KEY（例如写入 .env.local）'
    );
  }

  const prompt = `
用户输入的选题/想法：
${topic}

报送人身份信息：
党派/组织身份：${profile.party || '[党派/组织身份]'}
职业身份/头衔：${profile.title || '[职业身份/头衔]'}
联系电话：${profile.phone || '[手机号码]'}
邮箱地址：${profile.email || '[邮箱地址]'}
姓名：${profile.name || '[姓名]'}

请严格按照系统指令中的「工作流程」与 Format Rules 生成内容。

输出时必须**依次**包含以下五个板块，并使用与范例**完全一致**的标记行（整行）：
「${MARK_ANALYSIS}」「${MARK_FIRST_DRAFT}」「${MARK_REVIEW}」「${MARK_REVISION}」「${MARK_FINAL}」；
板块之间用单独一行的 --- 分隔；三轮专家意见内必须出现三个子标题行【宏观站位专家意见】【落地可行性专家意见】【公文形式审查意见】。
不要输出【后续建议】板块。
`;

  const res = await chatCompletion(
    apiUrl,
    model,
    apiKey,
    [
      { role: 'system', content: SYSTEM_INSTRUCTION },
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
