/** 新版分区标记（须与系统提示一致） */
export const MARK_ANALYSIS = '【问题拆解与思考】';
export const MARK_FIRST_DRAFT = '【第一稿正文】';
export const MARK_REVIEW = '【三轮专家评审意见】';
export const MARK_REVISION = '【修订说明】';
export const MARK_FINAL = '【最终定稿】';
export const MARK_FOLLOW = '【后续建议】';

/** 旧版兼容：历史全文或旧模型输出 */
export const LEGACY_MARK_REVIEW = '【内部打磨：三轮专家评审意见】';

export interface ParsedReport {
  analysis: string;
  firstDraft: string;
  review: string;
  revision: string;
  finalDraft: string;
  followUp: string;
}

export interface ExpertOpinionBlock {
  badge: string;
  title: string;
  content: string;
}

/** 最终稿字数：不含空白字符（与常见中文「字数」统计接近） */
export function countFinalDraftChars(finalDraft: string): number {
  return finalDraft.replace(/\s/g, '').length;
}

/** 选题中汉字数量（用于「至少 N 个汉字」校验） */
export function countChineseChars(text: string): number {
  return (text.match(/[\u4e00-\u9fff]/g) || []).length;
}

/**
 * 根据流式累积的正文判断当前阶段（0～4），与 THINKING_STEPS 前五步对应。
 */
export function computeThinkingPhaseFromBuffer(buffer: string): number {
  if (buffer.includes(MARK_FINAL)) return 4;
  if (buffer.includes(MARK_REVISION)) return 3;
  if (buffer.includes(MARK_REVIEW) || buffer.includes(LEGACY_MARK_REVIEW)) return 2;
  if (buffer.includes(MARK_FIRST_DRAFT)) return 1;
  if (buffer.includes(MARK_ANALYSIS)) return 0;
  return 0;
}

/**
 * 去掉板块切片首尾可能出现的独立分隔行 `---`。
 */
function trimInterBlockSeparators(raw: string): string {
  return raw
    .replace(/^\s*[\r\n]*---\s*[\r\n]*/s, '')
    .replace(/[\r\n]+\s*---\s*$/s, '')
    .replace(/\s*---\s*$/s, '')
    .trim();
}

function extractUntil(text: string, startTag: string, endTags: string[]): string {
  const si = text.indexOf(startTag);
  if (si === -1) return '';
  const from = si + startTag.length;
  let end = text.length;
  for (const tag of endTags) {
    const j = text.indexOf(tag, from);
    if (j !== -1 && j < end) end = j;
  }
  return trimInterBlockSeparators(text.slice(from, end));
}

function extractAfterMarker(text: string, startTag: string): string {
  const i = text.indexOf(startTag);
  if (i === -1) return '';
  return trimInterBlockSeparators(text.slice(i + startTag.length));
}

function pickReviewMarker(text: string): string | null {
  const iNew = text.indexOf(MARK_REVIEW);
  const iOld = text.indexOf(LEGACY_MARK_REVIEW);
  if (iNew === -1 && iOld === -1) return null;
  if (iNew === -1) return LEGACY_MARK_REVIEW;
  if (iOld === -1) return MARK_REVIEW;
  return iNew < iOld ? MARK_REVIEW : LEGACY_MARK_REVIEW;
}

/**
 * 从最终稿中分离标题（居中/首行）与正文，避免把 `<center>` 当纯文本展示。
 */
export function splitFinalDraftTitleBody(finalDraft: string): { title: string | null; body: string } {
  const raw = finalDraft.trim();
  const center = raw.match(/^<center[\s\S]*?>([\s\S]*?)<\/center>\s*/i);
  if (center) {
    const inner = center[1].replace(/<[^>]+>/g, '').trim();
    return { title: inner || null, body: raw.slice(center[0].length).trim() };
  }
  const lines = raw.split(/\r?\n/);
  const first = lines[0]?.trim() ?? '';
  const looksLikeTitle =
    first.length > 0 &&
    first.length <= 120 &&
    /^关于.+的(建议|提案)/.test(first);

  // 仅一行且像标题：兼容旧版「正文清空后只存标题字符串」的存储形式
  if (lines.length === 1 && looksLikeTitle) {
    return { title: first, body: '' };
  }

  if (looksLikeTitle && lines.length > 1) {
    return {
      title: first,
      body: lines.slice(1).join('\n').trim(),
    };
  }
  return { title: null, body: raw };
}

export function mergeFinalDraftTitleBody(title: string | null, body: string): string {
  const t = (title ?? '').trim();
  const b = body.trim();
  if (!t) return b;
  // 有标题时始终保留「标题 + 空行 + 正文」，便于 split 在正文为空时仍能识别标题行
  return `${t}\n\n${b}`;
}

/** 按模型约定拆成三轮专家卡片；若无子标题则整段放入一块 */
export function splitExpertReview(review: string): ExpertOpinionBlock[] {
  const text = review.trim();
  const tagged = [
    { badge: '1', title: '宏观站位', token: '【宏观站位专家意见】' },
    { badge: '2', title: '落地可行性', token: '【落地可行性专家意见】' },
    { badge: '3', title: '公文形式', token: '【公文形式审查意见】' },
  ];
  const hits = tagged
    .map((b) => ({ ...b, i: text.indexOf(b.token) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);

  if (hits.length === 0) {
    return [{ badge: '·', title: '专家评审', content: text }];
  }

  return hits.map((h, k) => {
    const start = h.i + h.token.length;
    const end = k + 1 < hits.length ? hits[k + 1].i : text.length;
    return {
      badge: h.badge,
      title: h.title,
      content: trimInterBlockSeparators(text.slice(start, end)),
    };
  });
}

function emptySections(): ParsedReport {
  return {
    analysis: '',
    firstDraft: '',
    review: '',
    revision: '',
    finalDraft: '',
    followUp: '',
  };
}

export function parseReport(text: string): { ok: true; sections: ParsedReport } | { ok: false; raw: string } {
  if (text.indexOf(MARK_FINAL) === -1) {
    return { ok: false, raw: text };
  }

  const s = emptySections();

  s.analysis = extractUntil(text, MARK_ANALYSIS, [
    MARK_FIRST_DRAFT,
    MARK_REVIEW,
    LEGACY_MARK_REVIEW,
    MARK_REVISION,
    MARK_FINAL,
  ]);

  s.firstDraft = extractUntil(text, MARK_FIRST_DRAFT, [MARK_REVIEW, LEGACY_MARK_REVIEW, MARK_REVISION, MARK_FINAL]);

  const reviewTag = pickReviewMarker(text);
  if (reviewTag) {
    s.review = extractUntil(text, reviewTag, [MARK_REVISION, MARK_FINAL]);
  }

  s.revision = extractUntil(text, MARK_REVISION, [MARK_FINAL]);

  s.finalDraft = extractUntil(text, MARK_FINAL, [MARK_FOLLOW]);

  if (text.indexOf(MARK_FOLLOW) !== -1) {
    s.followUp = extractAfterMarker(text, MARK_FOLLOW);
  }

  const hasNewBlocks =
    text.indexOf(MARK_ANALYSIS) >= 0 ||
    text.indexOf(MARK_FIRST_DRAFT) >= 0 ||
    (text.indexOf(MARK_REVISION) >= 0 && text.indexOf(MARK_REVISION) < text.indexOf(MARK_FINAL));

  if (!hasNewBlocks && reviewTag === LEGACY_MARK_REVIEW) {
    s.analysis = '';
    s.firstDraft = '';
    s.revision = '';
  }

  return { ok: true, sections: s };
}

export function serializeReport(s: ParsedReport): string {
  const parts: string[] = [];
  const push = (line: string) => parts.push(line);

  push(MARK_ANALYSIS);
  push(s.analysis.trim());
  push('---');
  push(MARK_FIRST_DRAFT);
  push(s.firstDraft.trim());
  push('---');
  push(MARK_REVIEW);
  push(s.review.trim());
  push('---');
  push(MARK_REVISION);
  push(s.revision.trim());
  push('---');
  push(MARK_FINAL);
  push(s.finalDraft.trim());
  push('---');
  push(MARK_FOLLOW);
  push(s.followUp.trim());

  return parts.join('\n');
}
