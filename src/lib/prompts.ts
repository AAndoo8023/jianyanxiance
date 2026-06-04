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

/** 社情民意信息三大类型（选填） */
export type InfoType = '' | '建议类' | '问题与监督类' | '时政类';

export const INFO_TYPE_OPTIONS: { value: InfoType; label: string; hint: string }[] = [
  { value: '建议类', label: '建议类', hint: '针对具体问题提出解决方案' },
  { value: '问题与监督类', label: '问题与监督类', hint: '反映苗头性问题进行预警' },
  { value: '时政类', label: '时政类', hint: '就重大时事或热点表态反思' },
];

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

/** 后续建议 System Prompt（撰写人调研备忘） */
export function getFollowUpSystem(): string {
  return followUpRaw.trim();
}

/** 主报告 User Prompt */
export function buildUserReportPrompt(
  topic: string,
  profile: UserProfile,
  infoType: InfoType = ''
): string {
  return fillTemplate(userReportTemplateRaw.trim(), {
    ...MARK_VARS,
    TOPIC: topic,
    INFO_TYPE: infoType || '未指定（请根据选题内容自行判断）',
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

/** 撰写人调研备忘 User Prompt */
export function buildFollowUpUserPrompt(finalDraft: string): string {
  return fillTemplate(followUpUserRaw.trim(), {
    FINAL_DRAFT: finalDraft.slice(0, 12000),
  });
}
