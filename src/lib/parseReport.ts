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

export function parseReport(text: string): { ok: true; sections: ParsedReport } | { ok: false; raw: string } {
  const idxFinal = text.indexOf(MARK_FINAL);
  const idxFollow = text.indexOf(MARK_FOLLOW);

  if (idxFinal === -1) {
    return { ok: false, raw: text };
  }

  const idxReview = text.indexOf(MARK_REVIEW);

  let review = '';
  if (idxReview >= 0 && idxReview < idxFinal) {
    review = text
      .slice(idxReview + MARK_REVIEW.length, idxFinal)
      .replace(/^\s*\n?---\s*\n?/s, '')
      .trim();
  }

  let finalDraft: string;
  let followUp = '';

  if (idxFollow !== -1 && idxFollow > idxFinal) {
    finalDraft = text
      .slice(idxFinal + MARK_FINAL.length, idxFollow)
      .replace(/^\s*\n?---\s*\n?/s, '')
      .trim();
    followUp = text.slice(idxFollow + MARK_FOLLOW.length).trim();
  } else {
    finalDraft = text.slice(idxFinal + MARK_FINAL.length).trim();
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
