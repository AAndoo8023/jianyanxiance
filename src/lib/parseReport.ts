/** 与系统提示中的标记保持一致，便于分区展示与还原全文 */
export const MARK_REVIEW = '【内部打磨：三轮专家评审意见】';
export const MARK_FINAL = '【最终定稿】';
export const MARK_FOLLOW = '【后续建议】';

export interface ParsedReport {
  review: string;
  finalDraft: string;
  followUp: string;
}

/** 最终稿字数：不含空白字符（与常见中文「字数」统计接近） */
export function countFinalDraftChars(finalDraft: string): number {
  return finalDraft.replace(/\s/g, '').length;
}

/**
 * 去掉板块切片首尾可能出现的独立分隔行 `---`。
 * 分隔符在原文中位于两板块之间，对上一段而言在切片末尾，对下一段在开头；
 * 仅用 `^...---` 无法去掉段尾的 `---`。
 */
function trimInterBlockSeparators(raw: string): string {
  return raw
    .replace(/^\s*[\r\n]*---\s*[\r\n]*/s, '')
    .replace(/[\r\n]+\s*---\s*$/s, '')
    .replace(/\s*---\s*$/s, '')
    .trim();
}

export function parseReport(text: string): { ok: true; sections: ParsedReport } | { ok: false; raw: string } {
  const idxFinal = text.indexOf(MARK_FINAL);
  const idxFollow = text.indexOf(MARK_FOLLOW);

  if (idxFinal === -1) {
    return { ok: false, raw: text };
  }

  const idxReview = text.indexOf(MARK_REVIEW);

  let review = '';
  if (idxReview >= 0 && idxReview < idxFinal) {
    review = trimInterBlockSeparators(text.slice(idxReview + MARK_REVIEW.length, idxFinal));
  }

  let finalDraft: string;
  let followUp = '';

  if (idxFollow !== -1 && idxFollow > idxFinal) {
    finalDraft = trimInterBlockSeparators(text.slice(idxFinal + MARK_FINAL.length, idxFollow));
    followUp = trimInterBlockSeparators(text.slice(idxFollow + MARK_FOLLOW.length));
  } else {
    finalDraft = trimInterBlockSeparators(text.slice(idxFinal + MARK_FINAL.length));
  }

  return {
    ok: true,
    sections: { review, finalDraft, followUp },
  };
}

export function serializeReport(s: ParsedReport): string {
  return [MARK_REVIEW, s.review.trim(), '---', MARK_FINAL, s.finalDraft.trim(), '---', MARK_FOLLOW, s.followUp.trim()].join(
    '\n'
  );
}