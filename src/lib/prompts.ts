import systemInstructionRaw from '../prompts/system-instruction.md?raw';
import topicValidationRaw from '../prompts/topic-validation.md?raw';
import followUpRaw from '../prompts/follow-up.md?raw';
import userReportTemplateRaw from '../prompts/user-report.template.md?raw';
import topicValidationUserRaw from '../prompts/topic-validation-user.template.md?raw';
import followUpUserRaw from '../prompts/follow-up-user.template.md?raw';
import {
  MARK_ANALYSIS,
  MARK_FIRST_DRAFT,
  MARK_REVIEW,
  MARK_REVISION,
  MARK_FINAL,
  MARK_FOLLOW,
} from './parseReport';

export interface UserProfile {
  party: string;
  title: string;
  phone: string;
  email: string;
  name: string;
}

const MARK_VARS = {
  MARK_ANALYSIS,
  MARK_FIRST_DRAFT,
  MARK_REVIEW,
  MARK_REVISION,
  MARK_FINAL,
  MARK_FOLLOW,
} as const;

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

/** 主报告 System Prompt */
export function getSystemInstruction(): string {
  return fillTemplate(systemInstructionRaw.trim(), { ...MARK_VARS });
}

/** 选题审核 System Prompt */
export function getTopicValidationSystem(): string {
  return topicValidationRaw.trim();
}

/** 后续建议 System Prompt */
export function getFollowUpSystem(): string {
  return followUpRaw.trim();
}

/** 主报告 User Prompt */
export function buildUserReportPrompt(topic: string, profile: UserProfile): string {
  return fillTemplate(userReportTemplateRaw.trim(), {
    ...MARK_VARS,
    TOPIC: topic,
    PARTY: profile.party || '[党派/组织身份]',
    TITLE: profile.title || '[职业身份/头衔]',
    PHONE: profile.phone || '[手机号码]',
    EMAIL: profile.email || '[邮箱地址]',
    NAME: profile.name || '[姓名]',
  });
}

/** 选题审核 User Prompt */
export function buildTopicValidationUserPrompt(topic: string): string {
  return fillTemplate(topicValidationUserRaw.trim(), {
    TOPIC: topic.slice(0, 4000),
  });
}

/** 后续建议 User Prompt */
export function buildFollowUpUserPrompt(finalDraft: string): string {
  return fillTemplate(followUpUserRaw.trim(), {
    FINAL_DRAFT: finalDraft.slice(0, 12000),
  });
}
