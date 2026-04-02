import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  generateFollowUpSuggestions,
  generateReport,
  generateReportStream,
  UserProfile,
  validateTopic,
} from './lib/llm';
import {
  FileText,
  Send,
  User,
  Building,
  Briefcase,
  Phone,
  Mail,
  Copy,
  CheckCircle2,
  Loader2,
  FileSignature,
  ArrowLeft,
  Edit3,
  Sparkles,
  ClipboardList,
  Circle,
  Info,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  computeThinkingPhaseFromBuffer,
  countChineseChars,
  mergeFinalDraftTitleBody,
  parseReport,
  ParsedReport,
  splitFinalDraftTitleBody,
} from './lib/parseReport';

type ViewState = 'welcome' | 'input' | 'thinking' | 'result';

const THINKING_STEPS = [
  {
    title: '问题拆解与思考',
    detail: '定性、因果、利害与必要的调研说明',
  },
  {
    title: '撰写第一稿',
    detail: '生成结构完整、可独立阅读的第一版正文',
  },
  {
    title: '三轮专家评审',
    detail: '宏观站位 · 落地可行性 · 公文形式',
  },
  {
    title: '修订说明',
    detail: '对照第一稿与专家意见的修改要点',
  },
  {
    title: '最终定稿',
    detail: '修订后的正式《社情民意信息》全文',
  },
  {
    title: '后续建议（深度维度）',
    detail: '基于终稿从重要性、立意、调研与深化方向等提炼建议',
  },
] as const;

/** 将 `**短语**` 渲染为加粗（用于后续建议阅读视图） */
function renderSimpleBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-sky-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

type AutosizeTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'rows'
> & { minHeightPx?: number };

/** 迭代同步高度：单次 height=scrollHeight 后换行重排仍可能增高，需多轮直至稳定 */
function syncTextareaHeight(el: HTMLTextAreaElement, minPx: number): void {
  el.style.height = 'auto';
  let h = Math.max(el.scrollHeight, minPx);
  for (let i = 0; i < 12; i++) {
    el.style.height = `${h}px`;
    const need = Math.max(el.scrollHeight, minPx);
    if (need <= h + 1) return;
    h = need;
  }
  el.style.height = `${Math.max(el.scrollHeight, minPx)}px`;
}

function AutosizeTextarea({
  value,
  minHeightPx = 48,
  className,
  ...rest
}: AutosizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    syncTextareaHeight(el, minHeightPx);
  }, [minHeightPx]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    syncTextareaHeight(el, minHeightPx);
  }, [value, minHeightPx]);

  useEffect(() => {
    const onResize = () => {
      sync();
    };
    window.addEventListener('resize', onResize);
    const fonts = document.fonts;
    if (fonts && typeof fonts.ready?.then === 'function') {
      fonts.ready.then(() => sync());
    }
    return () => window.removeEventListener('resize', onResize);
  }, [sync]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={className}
      {...rest}
    />
  );
}

type ReportState =
  | { kind: 'parsed'; sections: ParsedReport }
  | { kind: 'raw'; text: string };

export default function App() {
  const [view, setView] = useState<ViewState>('welcome');
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [profile, setProfile] = useState<UserProfile>({
    party: '',
    title: '',
    phone: '',
    email: '',
    name: '',
  });
  const [topic, setTopic] = useState('');
  const [reportState, setReportState] = useState<ReportState | null>(null);
  const [copied, setCopied] = useState(false);
  const [resultGenId, setResultGenId] = useState(0);
  const [followUpEditing, setFollowUpEditing] = useState(false);

  const finalDraftParts = useMemo(() => {
    if (!reportState || reportState.kind !== 'parsed') {
      return { title: null as string | null, body: '' };
    }
    return splitFinalDraftTitleBody(reportState.sections.finalDraft);
  }, [reportState]);

  const topicChineseCount = useMemo(() => countChineseChars(topic), [topic]);
  const topicValidLength = topicChineseCount >= 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    if (!topicValidLength) {
      alert('选题与初步想法至少需要 20 个汉字。');
      return;
    }

    try {
      const ok = await validateTopic(topic);
      if (!ok) {
        alert('您的想法和选题还需要慎重考虑');
        return;
      }
    } catch {
      alert('选题审核失败，请稍后重试或检查网络与接口配置。');
      return;
    }

    setView('thinking');
    setThinkingPhase(0);
    setReportState(null);

    let res: string;
    try {
      res = await generateReportStream(topic, profile, (buf) => {
        setThinkingPhase(computeThinkingPhaseFromBuffer(buf));
      });
    } catch (streamErr) {
      console.warn(streamErr);
      try {
        res = await generateReport(topic, profile);
        setThinkingPhase(4);
      } catch {
        alert('生成失败，请重试。若长期失败，请确认模型接口支持流式（stream）或改用兼容 OpenAI 的网关。');
        setView('input');
        return;
      }
    }

    const parsed = parseReport(res || '');
    if (!parsed.ok) {
      setReportState({ kind: 'raw', text: res || '' });
      setView('result');
      setResultGenId((n) => n + 1);
      return;
    }

    setThinkingPhase(5);
    let follow = '';
    try {
      follow = await generateFollowUpSuggestions(parsed.sections.finalDraft);
    } catch (e) {
      console.error(e);
      alert('主文已生成，但「后续建议」二次生成失败，您可在结果页手动补充。');
    }

    setReportState({
      kind: 'parsed',
      sections: { ...parsed.sections, followUp: follow },
    });
    setView('result');
    setResultGenId((n) => n + 1);
  };

  useEffect(() => {
    setFollowUpEditing(false);
  }, [resultGenId]);

  const getCopyFinalDraftText = (): string => {
    if (!reportState) return '';
    if (reportState.kind === 'parsed') {
      return reportState.sections.finalDraft.trim();
    }
    return reportState.text.trim();
  };

  const updateParsedSection = (key: keyof ParsedReport, value: string) => {
    setReportState((prev) => {
      if (!prev || prev.kind !== 'parsed') return prev;
      return {
        kind: 'parsed',
        sections: { ...prev.sections, [key]: value },
      };
    });
  };

  const handleCopy = async () => {
    const text = getCopyFinalDraftText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('复制失败，请检查浏览器权限，或手动全选正文后复制。');
    }
  };

  const inputClass =
    'w-full min-h-11 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base leading-normal focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors';

  const sectionTextareaClass =
    'w-full min-h-[8rem] sm:min-h-[10rem] lg:min-h-[12rem] p-3 sm:p-4 lg:p-5 rounded-xl border border-slate-200 bg-[#fdfbf7] font-serif text-[15px] sm:text-base lg:text-[1.0625rem] leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/15 resize-y';

  const sectionTextareaAutosizeClass =
    'w-full p-3 sm:p-4 lg:p-5 border border-slate-200 bg-[#fdfbf7] font-serif text-[15px] sm:text-base lg:text-[1.0625rem] leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/15 resize-none overflow-hidden';

  return (
    <div className="min-h-[100dvh] min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-red-100 selection:text-red-900 flex flex-col overflow-x-hidden">
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10 shrink-0 pt-[max(0px,env(safe-area-inset-top))]">
        <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-[90rem] mx-auto px-4 sm:px-8 xl:px-12 min-h-14 sm:min-h-[3.75rem] lg:min-h-[4.25rem] flex items-center">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="bg-red-600 p-2 rounded-xl text-white shrink-0 shadow-sm shadow-red-600/20">
              <FileSignature className="size-5 sm:size-6 lg:size-7" />
            </div>
            <div className="min-w-0 py-0.5">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
                建言献策
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 lg:mt-1">
                AI驱动的社情民意信息撰写平台
              </p>
            </div>
          </div>
        </div>
      </header>

      <main
        className={`flex-1 flex flex-col min-h-0 w-full max-w-5xl xl:max-w-6xl 2xl:max-w-[90rem] mx-auto px-4 sm:px-8 xl:px-12 py-4 sm:py-6 lg:py-8 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100/90 ${
          view === 'welcome' ? 'relative overflow-hidden' : ''
        }`}
      >
        {view === 'welcome' && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(40vh,24rem)] bg-gradient-to-t from-slate-200/35 via-slate-100/20 to-transparent"
            aria-hidden
          />
        )}
        <div className="relative flex min-h-0 w-full flex-1 flex-col">
          <AnimatePresence mode="wait">
            {view === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex w-full flex-1 flex-col justify-start gap-6 sm:gap-8 lg:gap-10 pt-2 sm:pt-4 lg:pt-6 pb-6 sm:pb-8"
              >
                <div className="text-center px-1">
                  <div className="flex justify-center">
                    <h2 className="relative inline-block text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight text-pretty pr-7 sm:pr-9">
                      勤勉履职，建言有方
                      <span
                        className="absolute right-0 top-0 inline-flex items-center rounded bg-red-600 px-[5px] py-[2px] text-[9px] sm:text-[10px] font-bold leading-none text-white shadow-sm"
                        aria-hidden
                      >
                        AI
                      </span>
                    </h2>
                  </div>
                  <p className="mt-3 sm:mt-4 max-w-2xl mx-auto text-[11px] sm:text-xs text-slate-600 leading-relaxed text-pretty px-2">
                    反映社情民意信息是民主党派参政议政中经常性、基础性的工作，是参政履职的重要抓手。
                  </p>
                </div>

                <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 max-w-4xl lg:max-w-5xl mx-auto w-full">
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 lg:p-6 shadow-md shadow-slate-200/60">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm sm:text-base">
                      <ClipboardList className="size-4 shrink-0" />
                      平台工作逻辑
                    </div>
                    <div className="mt-3 space-y-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed text-pretty">
                      <p>
                        <span className="font-medium text-slate-800">需要输入什么：</span>
                        选题（不少于 20 个汉字，写清现象与初步想法）与报送人信息（选填，用于生成标准抬头）。
                      </p>
                      <p>
                        <span className="font-medium text-slate-800">后台如何工作：</span>
                        提交后先判断选题是否适合继续；通过后由 AI 在后台完成拆解、多轮打磨与定稿，「正在生成」页会提示大致进度。
                      </p>
                      <p>
                        <span className="font-medium text-slate-800">给出什么结果：</span>
                        可编辑的「最终定稿」与「后续建议」两栏；「复制正文」仅复制终稿全文。
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 lg:p-6 shadow-md shadow-slate-200/60">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm sm:text-base">
                      <Info className="size-4 shrink-0" />
                      温馨提示
                    </div>
                    <div className="mt-3 space-y-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed text-pretty">
                      <p>
                        选题须<strong className="text-slate-800">不少于 20 个汉字</strong>
                        ，内容请严肃、务实、与建言场景相符；明显不当或无法讨论的选题将无法继续。
                      </p>
                      <p>
                        <strong className="text-slate-800">本平台不保存</strong>
                        您填写与生成的内容，关闭或刷新后需重新填写，请及时自行备份。
                      </p>
                      <p>
                        本工具仅供个人学习研究参考，请勿用于违法违规或不当用途；更多说明见页脚。
                      </p>
                      <p className="text-slate-700">
                        勤勉履职，建言有方。欢迎通过页脚联系方式交流使用感受与改进建议。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pb-1 max-w-xl sm:max-w-2xl lg:max-w-none mx-auto w-full">
                  <button
                    type="button"
                    onClick={() => setView('input')}
                    className="w-full flex items-center justify-center gap-2 min-h-12 sm:min-h-14 lg:min-h-[3.5rem] rounded-2xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-base lg:text-lg font-semibold shadow-lg shadow-red-600/30 transition-all active:scale-[0.99]"
                  >
                    我要建言
                    <ChevronRight className="size-5 shrink-0" strokeWidth={2.5} />
                  </button>
                </div>
              </motion.div>
            )}

            {view === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full"
              >
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden lg:shadow-md">
                  <div className="p-4 sm:p-6 lg:p-8 border-b border-slate-100 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => setView('welcome')}
                      className="mb-3 flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-red-700 transition-colors"
                    >
                      <ArrowLeft size={16} className="shrink-0" />
                      返回欢迎页
                    </button>
                    <h2 className="text-base sm:text-lg lg:text-xl font-semibold flex items-center gap-2">
                      <FileText className="text-red-600 shrink-0" size={20} />
                      撰写需求
                    </h2>
                    <p className="text-sm lg:text-base text-slate-500 mt-1.5 text-pretty leading-relaxed">
                      输入您的社会观察、行业洞察或民生诉求，AI 将先完成拆解与第一稿，再经三轮专家评审与修订，输出最终稿与后续建议。
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 lg:space-y-8">
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-900 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          选题与初步想法 <span className="text-red-500">*</span>
                          <span className="text-slate-400 font-normal text-xs ml-1">（至少 20 个汉字）</span>
                        </span>
                        <span
                          className={`text-xs tabular-nums ${topicValidLength ? 'text-emerald-600' : 'text-amber-600'}`}
                        >
                          已输入 {topicChineseCount} 字
                        </span>
                      </label>
                      <textarea
                        required
                        rows={7}
                        placeholder="请详细描述您观察到的社会现象、存在的问题以及初步的建议。描述越具体，生成越精准…"
                        className="w-full min-h-[11rem] sm:min-h-0 px-3.5 sm:px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors resize-y max-h-[50vh]"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                      />
                    </div>

                    <hr className="border-slate-100" />

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        报送人信息 <span className="text-xs text-slate-400 font-normal">(选填，用于生成标准抬头)</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <Building size={14} className="text-slate-400" /> 党派/组织
                          </label>
                          <input
                            type="text"
                            placeholder="如：九三学社东城区金融支社"
                            className={inputClass}
                            value={profile.party}
                            onChange={(e) => setProfile({ ...profile, party: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <Briefcase size={14} className="text-slate-400" /> 职业/头衔
                          </label>
                          <input
                            type="text"
                            placeholder="如：某大学教授"
                            className={inputClass}
                            value={profile.title}
                            onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <User size={14} className="text-slate-400" /> 姓名
                          </label>
                          <input
                            type="text"
                            placeholder="您的姓名"
                            className={inputClass}
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <Phone size={14} className="text-slate-400" /> 联系电话
                          </label>
                          <input
                            type="tel"
                            placeholder="手机号码"
                            inputMode="tel"
                            autoComplete="tel"
                            className={inputClass}
                            value={profile.phone}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <Mail size={14} className="text-slate-400" /> 邮箱地址
                          </label>
                          <input
                            type="email"
                            placeholder="您的电子邮箱"
                            inputMode="email"
                            autoComplete="email"
                            className={inputClass}
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!topic.trim() || !topicValidLength}
                      className="w-full flex items-center justify-center gap-2 min-h-12 sm:min-h-[3.25rem] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white py-3 px-4 rounded-xl text-base font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] shadow-sm shadow-red-600/20"
                    >
                      <Send size={18} className="shrink-0" />
                      生成信息内容
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {view === 'thinking' && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="mx-auto flex w-full max-w-3xl xl:max-w-4xl flex-col justify-center px-3 sm:px-6 py-10 sm:py-14 min-h-[min(88vh,46rem)]"
              >
                <div className="relative mx-auto mb-10 h-24 w-24 shrink-0 sm:mb-12 sm:h-28 sm:w-28">
                  <div className="absolute inset-0 rounded-full border-[5px] border-red-100" />
                  <div className="h-24 w-24 animate-spin rounded-full border-[5px] border-red-600 border-t-transparent sm:h-28 sm:w-28" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="size-9 text-red-600 animate-pulse sm:size-10" />
                  </div>
                </div>

                <div className="mb-6 sm:mb-8 text-center">
                  <p className="text-base sm:text-lg font-semibold text-slate-900">正在生成，请稍候</p>
                  <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-lg mx-auto leading-relaxed">
                    下方高亮为当前阶段；主文生成完成后将自动进行第二轮「后续建议」撰写。
                  </p>
                </div>

                <div className="relative rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/40">
                  <div
                    className="pointer-events-none absolute left-[2.125rem] top-14 bottom-14 w-px bg-gradient-to-b from-slate-200 via-red-200/60 to-slate-200 sm:left-[2.375rem]"
                    aria-hidden
                  />
                  <div className="space-y-4 sm:space-y-5">
                    {THINKING_STEPS.map((step, i) => {
                      const active = thinkingPhase === i;
                      const done = thinkingPhase > i;
                      return (
                        <div
                          key={step.title}
                          className={`relative flex gap-4 sm:gap-5 rounded-2xl border p-4 sm:p-5 transition-all ${
                            active
                              ? 'border-red-300 bg-gradient-to-br from-red-50/90 to-white shadow-md shadow-red-100/80 ring-2 ring-red-200/60'
                              : done
                                ? 'border-emerald-200/90 bg-emerald-50/35'
                                : 'border-slate-100 bg-slate-50/50 opacity-80'
                          }`}
                        >
                          <div className="relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 sm:h-12 sm:w-12">
                            {done ? (
                              <CheckCircle2 className="size-6 text-emerald-600 sm:size-7" />
                            ) : active ? (
                              <Loader2 className="size-6 animate-spin text-red-600 sm:size-7" />
                            ) : (
                              <Circle className="size-6 text-slate-300 sm:size-7" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 text-left pt-0.5">
                            <div className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                              {step.title}
                            </div>
                            <div className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                              {step.detail}
                            </div>
                            {active && (
                              <p className="mt-3 inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                                进行中
                              </p>
                            )}
                            {done && !active && (
                              <p className="mt-3 text-xs font-medium text-emerald-700">已完成</p>
                            )}
                            {!done && !active && (
                              <p className="mt-3 text-xs text-slate-400">待开始</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'result' && reportState && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex flex-col gap-3 sm:gap-4 lg:gap-6"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setView('input');
                      setReportState(null);
                      setFollowUpEditing(false);
                    }}
                    className="flex items-center justify-center lg:justify-start gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 min-h-11 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200/80 w-full lg:w-auto"
                  >
                    <ArrowLeft size={18} className="shrink-0" />
                    返回修改需求
                  </button>

                  <div className="flex w-full lg:w-auto lg:justify-end">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white px-4 min-h-11 rounded-xl text-sm font-medium transition-all active:scale-[0.99] w-full min-[420px]:w-auto"
                    >
                      {copied ? (
                        <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                      ) : (
                        <Copy size={18} className="shrink-0" />
                      )}
                      {copied ? '已复制' : '复制正文'}
                    </button>
                  </div>
                </div>

                {reportState.kind === 'parsed' ? (
                  <div className="flex flex-col gap-5 lg:gap-6">
                    <section className="rounded-2xl border border-red-200/90 bg-white shadow-lg shadow-red-100/30 flex flex-col overflow-x-hidden">
                      <div className="flex items-center gap-2 border-b border-red-100 bg-gradient-to-r from-red-50 to-white px-4 py-3 sm:px-5">
                        <FileSignature className="size-5 shrink-0 text-red-700" />
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">最终定稿</h3>
                      </div>
                      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-5">
                        <label htmlFor="final-draft-title" className="sr-only">
                          标题
                        </label>
                        <AutosizeTextarea
                          id="final-draft-title"
                          value={finalDraftParts.title ?? ''}
                          minHeightPx={52}
                          onChange={(e) =>
                            updateParsedSection(
                              'finalDraft',
                              mergeFinalDraftTitleBody(
                                e.target.value.trim() === '' ? null : e.target.value,
                                finalDraftParts.body
                              )
                            )
                          }
                          placeholder="关于××××××的建议"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg sm:text-xl font-bold tracking-wide text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 whitespace-normal break-words leading-snug"
                          spellCheck={false}
                        />
                      </div>
                      <AutosizeTextarea
                        value={finalDraftParts.body}
                        minHeightPx={128}
                        onChange={(e) =>
                          updateParsedSection(
                            'finalDraft',
                            mergeFinalDraftTitleBody(finalDraftParts.title, e.target.value)
                          )
                        }
                        className={sectionTextareaAutosizeClass + ' border-0 rounded-none'}
                        spellCheck={false}
                        placeholder="报送人抬头与正文（请勿再写标题行）"
                      />
                    </section>

                    <section className="rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50/40 to-white shadow-md shadow-sky-100/30 flex flex-col overflow-x-hidden">
                      <div className="flex items-center justify-between gap-2 border-b border-sky-200/60 bg-sky-100/40 px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="size-5 shrink-0 text-sky-800" />
                          <h3 className="text-sm sm:text-base font-bold text-sky-950">后续建议</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFollowUpEditing((v) => !v)}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-sky-300/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-white"
                        >
                          <Edit3 size={14} className="shrink-0" />
                          {followUpEditing ? '完成' : '编辑'}
                        </button>
                      </div>
                      {followUpEditing ? (
                        <AutosizeTextarea
                          value={reportState.sections.followUp}
                          minHeightPx={112}
                          onChange={(e) => updateParsedSection('followUp', e.target.value)}
                          className={sectionTextareaAutosizeClass + ' border-0 rounded-none bg-white/70'}
                          spellCheck={false}
                          placeholder="由第二轮 AI 根据终稿生成；可在此编辑。**视角** 可加粗。"
                        />
                      ) : (
                        <div className="px-4 py-4 sm:px-5 sm:py-5 font-serif text-[15px] sm:text-base lg:text-[1.0625rem] leading-relaxed text-slate-800 bg-white/70 min-h-[6rem] whitespace-pre-wrap break-words">
                          {reportState.sections.followUp.trim() ? (
                            renderSimpleBold(reportState.sections.followUp)
                          ) : (
                            <span className="text-slate-400">
                              暂无内容；若第二轮生成失败，可点「编辑」自行填写。
                            </span>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      未识别到标准分区标记，已以全文展示。您仍可编辑后复制。
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-white overflow-x-hidden flex flex-col shadow-sm">
                      <div className="flex items-center border-b border-slate-100 px-4 py-2 bg-slate-50">
                        <span className="text-sm font-medium text-slate-800">全文</span>
                      </div>
                      <AutosizeTextarea
                        value={reportState.text}
                        minHeightPx={160}
                        onChange={(e) =>
                          setReportState({ kind: 'raw', text: e.target.value })
                        }
                        className={sectionTextareaAutosizeClass + ' border-0 rounded-none'}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="shrink-0 border-t border-slate-200/90 bg-slate-100/80 backdrop-blur-sm mt-auto pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 lg:pt-9">
        <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-[90rem] mx-auto px-4 sm:px-8 xl:px-12 text-center">
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl lg:max-w-3xl mx-auto">
            本站仅供个人学习与研究使用，非官方或商业用途。如有优化建议，欢迎联系微信：
            <span className="font-medium text-slate-600 tabular-nums">ando233208</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
