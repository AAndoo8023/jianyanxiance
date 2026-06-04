import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  generateFollowUpSuggestions,
  generateReport,
  generateReportStream,
  UserProfile,
  validateTopic,
} from './lib/llm';
import { INFO_TYPE_OPTIONS, type InfoType } from './lib/prompts';
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
  countFinalDraftChars,
  mergeFinalDraftTitleBody,
  parseReport,
  ParsedReport,
  splitFinalDraftTitleBody,
} from './lib/parseReport';

type ViewState = 'welcome' | 'input' | 'thinking' | 'result';

const THINKING_STEPS = [
  {
    title: '选题研判与问题拆解',
    detail: '聚焦实际、量力而行、小切口；明确信息类型（建议/监督/时政）',
  },
  {
    title: '撰写第一稿',
    detail: '问题—分析—建议三段论，倒金字塔呈现核心建议',
  },
  {
    title: '三轮专家评审',
    detail: '宏观站位 · 落地可行性 · 公文形式',
  },
  {
    title: '修订说明',
    detail: '对照第一稿与专家意见，规避常见误区',
  },
  {
    title: '最终定稿',
    detail: '800～2000 字，标题开门见山，精华靠前',
  },
  {
    title: '调研与核实备忘',
    detail: '提示撰写人待查数据、待访对象与待补材料（不随稿报送）',
  },
] as const;

const THINKING_LIVE_STATUS = [
  '正在研判选题与问题定性…',
  '正在撰写第一稿正文…',
  '正在进行三轮专家评审…',
  '正在整理修订说明…',
  '正在输出最终定稿…',
  '正在生成调研与核实备忘…',
] as const;

type ProcessingOverlayState = { title: string; detail: string };

/** 全屏毛玻璃「思考中」提示 */
function ProcessingOverlay({ title, detail }: ProcessingOverlayState) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-2xl shadow-slate-900/10 px-6 py-8 text-center">
        <div className="relative mx-auto h-14 w-14">
          <div className="absolute inset-0 rounded-full border-[3px] border-red-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-red-600 border-t-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="size-6 text-red-600" />
          </div>
        </div>
        <p className="mt-5 text-lg font-semibold text-slate-900 tracking-tight">{title}</p>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed text-pretty">{detail}</p>
      </div>
    </div>
  );
}

/** 将 `**短语**` 渲染为加粗（用于调研备忘阅读视图） */
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

type ReportState =
  | {
      kind: 'parsed';
      sections: ParsedReport;
      finalDraftTitle: string | null;
      finalDraftBody: string;
    }
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
  const [infoType, setInfoType] = useState<InfoType>('');
  const [reportState, setReportState] = useState<ReportState | null>(null);
  const [copied, setCopied] = useState(false);
  const [resultGenId, setResultGenId] = useState(0);
  const [followUpEditing, setFollowUpEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingOverlay, setProcessingOverlay] = useState<ProcessingOverlayState | null>(null);
  const thinkingPhaseRef = useRef(0);
  const streamPhaseRafRef = useRef(0);

  const topicChineseCount = useMemo(() => countChineseChars(topic), [topic]);
  const topicValidLength = topicChineseCount >= 20;

  const finalDraftCharCount = useMemo(() => {
    if (!reportState || reportState.kind !== 'parsed') return 0;
    return countFinalDraftChars(reportState.sections.finalDraft);
  }, [reportState]);

  const finalDraftLengthOk = finalDraftCharCount >= 800 && finalDraftCharCount <= 2000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    if (!topicValidLength) {
      alert('选题与初步想法至少需要 20 个汉字。');
      return;
    }

    setIsSubmitting(true);
    setProcessingOverlay({
      title: '思考中',
      detail: '正在审核选题：聚焦实际、小切口、量力而行…',
    });

    try {
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

      setProcessingOverlay({
        title: '思考中',
        detail: '选题审核通过，正在启动 AI 撰写流程…',
      });

      setView('thinking');
      setThinkingPhase(0);
      thinkingPhaseRef.current = 0;
      setReportState(null);
      setProcessingOverlay(null);

      const scheduleThinkingPhase = (phase: number) => {
        if (phase <= thinkingPhaseRef.current) return;
        thinkingPhaseRef.current = phase;
        if (streamPhaseRafRef.current) return;
        streamPhaseRafRef.current = requestAnimationFrame(() => {
          streamPhaseRafRef.current = 0;
          setThinkingPhase(thinkingPhaseRef.current);
        });
      };

      let res: string;
      try {
        res = await generateReportStream(topic, profile, (buf) => {
          scheduleThinkingPhase(computeThinkingPhaseFromBuffer(buf));
        }, infoType);
      } catch (streamErr) {
        console.warn(streamErr);
        try {
          res = await generateReport(topic, profile, infoType);
          scheduleThinkingPhase(4);
        } catch {
          if (streamPhaseRafRef.current) cancelAnimationFrame(streamPhaseRafRef.current);
          streamPhaseRafRef.current = 0;
          alert('生成失败，请重试。若长期失败，请确认模型接口支持流式（stream）或改用兼容 OpenAI 的网关。');
          setView('input');
          return;
        }
      }

      if (streamPhaseRafRef.current) {
        cancelAnimationFrame(streamPhaseRafRef.current);
        streamPhaseRafRef.current = 0;
      }

      const parsed = parseReport(res || '');
      if (!parsed.ok) {
        setReportState({ kind: 'raw', text: res || '' });
        setView('result');
        setResultGenId((n) => n + 1);
        return;
      }

      const { title, body } = splitFinalDraftTitleBody(parsed.sections.finalDraft);

      setThinkingPhase(5);
      thinkingPhaseRef.current = 5;

      let follow = '';
      try {
        follow = await generateFollowUpSuggestions(parsed.sections.finalDraft);
      } catch (e) {
        console.error(e);
        alert('主文已生成，但「调研备忘」生成失败，您可在结果页自行补充。');
      }

      setReportState({
        kind: 'parsed',
        sections: { ...parsed.sections, followUp: follow },
        finalDraftTitle: title,
        finalDraftBody: body,
      });
      setView('result');
      setResultGenId((n) => n + 1);
    } finally {
      setProcessingOverlay(null);
      setIsSubmitting(false);
    }
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

  const updateFinalDraft = (title: string | null, body: string) => {
    setReportState((prev) => {
      if (!prev || prev.kind !== 'parsed') return prev;
      return {
        ...prev,
        finalDraftTitle: title,
        finalDraftBody: body,
        sections: {
          ...prev.sections,
          finalDraft: mergeFinalDraftTitleBody(title, body),
        },
      };
    });
  };

  const updateParsedSection = (key: keyof ParsedReport, value: string) => {
    setReportState((prev) => {
      if (!prev || prev.kind !== 'parsed') return prev;
      return {
        ...prev,
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
    'w-full p-3 sm:p-4 lg:p-5 border border-slate-200 bg-[#fdfbf7] font-serif text-[15px] sm:text-base lg:text-[1.0625rem] leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/15 resize-y overflow-y-auto';

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
        className={`flex-1 flex flex-col w-full max-w-5xl xl:max-w-6xl 2xl:max-w-[90rem] mx-auto px-4 sm:px-8 xl:px-12 py-4 sm:py-6 lg:py-8 bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100/90 ${
          view === 'welcome'
            ? 'relative overflow-x-hidden'
            : 'min-h-0 overflow-y-auto'
        }`}
      >
        {view === 'welcome' && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(40vh,24rem)] bg-gradient-to-t from-slate-200/35 via-slate-100/20 to-transparent"
            aria-hidden
          />
        )}
        <div
          className={`relative flex w-full flex-1 flex-col ${
            view === 'welcome' ? '' : 'min-h-0'
          }`}
        >
          <AnimatePresence mode="wait">
            {view === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex w-full flex-1 flex-col justify-start gap-5 sm:gap-6 lg:gap-8 pt-1 sm:pt-2 lg:pt-4 pb-4 sm:pb-6"
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
                        选题（不少于 20 个汉字，<strong className="text-slate-800">小切口、能驾驭</strong>，写清具体区域/现象/案例线索与初步想法；勿仅议论全国性模式）与报送人信息（选填，用于生成标准抬头）。
                      </p>
                      <p>
                        <span className="font-medium text-slate-800">后台如何工作：</span>
                        提交后先审核选题；通过后按「问题—分析—建议」三段论完成拆解、评审与定稿。
                      </p>
                      <p>
                        <span className="font-medium text-slate-800">给出什么结果：</span>
                        可编辑的「最终定稿」（800～2000 字）与「调研备忘」（供您补调研，不随稿报送）；「复制正文」仅复制终稿。
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
                        ，须<strong className="text-slate-800">聚焦实际、量力而行、小切口深挖掘</strong>
                        ；选题决定价值，空泛过大或力所不及将无法继续。
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
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 lg:p-6 shadow-md shadow-slate-200/60 sm:col-span-2">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm sm:text-base">
                      <Sparkles className="size-4 shrink-0" />
                      撰写要诀
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
                        <p className="font-semibold text-slate-800">三段论</p>
                        <p className="mt-1 text-pretty">问题 → 分析 → 建议，逻辑清晰</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
                        <p className="font-semibold text-slate-800">倒金字塔</p>
                        <p className="mt-1 text-pretty">核心建议放最前，便于领导速览</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
                        <p className="font-semibold text-slate-800">可核实</p>
                        <p className="mt-1 text-pretty">写清区域与案例线索；无来源数字不编造，图表进备忘</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pb-1 max-w-xl sm:max-w-2xl lg:max-w-none mx-auto w-full mt-auto">
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
                      输入您的社会观察、行业洞察或民生诉求。请写清具体区域、现象或案例线索（可匿名），并标明信息类型；AI 将按三段论撰写，终稿不含无来源数据与编辑备忘，图表需求写入调研备忘。
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
                        placeholder="请聚焦小切口：具体区域/现象/案例（可匿名）、您观察到了什么、初步建议方向。示例：某市引导基金投向某类生态关联项目，返投完成但产能未落地——而非仅议论「全国基金合作模式风险」…"
                        className="w-full min-h-[11rem] sm:min-h-0 px-3.5 sm:px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors resize-y max-h-[50vh]"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                      />
                      <p className="text-xs text-slate-500 leading-relaxed">
                        建议类、问题与监督类、时政类可在下方选填。选题越具体（区域、案例、数据线索），终稿越可核实；未提供的精确数字 AI 不会编造。
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <p className="text-sm font-medium text-slate-900">
                        信息类型
                        <span className="text-slate-400 font-normal text-xs ml-1">（选填）</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {INFO_TYPE_OPTIONS.map((opt) => {
                          const selected = infoType === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              title={opt.hint}
                              onClick={() => setInfoType(selected ? '' : opt.value)}
                              className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                                selected
                                  ? 'border-red-400 bg-red-50 text-red-800 font-medium ring-2 ring-red-200/60'
                                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      {infoType ? (
                        <p className="text-xs text-slate-500">
                          {INFO_TYPE_OPTIONS.find((o) => o.value === infoType)?.hint}
                        </p>
                      ) : null}
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
                      disabled={!topic.trim() || !topicValidLength || isSubmitting}
                      className="w-full flex items-center justify-center gap-2 min-h-12 sm:min-h-[3.25rem] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white py-3 px-4 rounded-xl text-base font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] shadow-sm shadow-red-600/20"
                    >
                      {isSubmitting ? (
                        <Loader2 size={18} className="shrink-0 animate-spin" />
                      ) : (
                        <Send size={18} className="shrink-0" />
                      )}
                      {isSubmitting ? '思考中…' : '生成信息内容'}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {view === 'thinking' && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mx-auto flex w-full max-w-3xl xl:max-w-4xl flex-col justify-center px-3 sm:px-6 py-10 sm:py-14 min-h-[min(88vh,46rem)]"
              >
                <div className="mb-6 sm:mb-8 rounded-2xl border border-white/70 bg-white/75 backdrop-blur-xl px-4 py-4 sm:px-6 sm:py-5 text-center shadow-lg shadow-slate-200/40">
                  <p className="text-base sm:text-lg font-semibold text-slate-900">思考中</p>
                  <p className="mt-2 text-sm sm:text-base text-red-700 font-medium max-w-lg mx-auto leading-relaxed">
                    {THINKING_LIVE_STATUS[Math.min(thinkingPhase, 5)]}
                  </p>
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                    全部完成后将一次性展示终稿与调研备忘
                  </p>
                </div>

                <div className="relative rounded-3xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/40">
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
                          className={`relative flex gap-4 sm:gap-5 rounded-2xl border p-4 sm:p-5 min-h-[5.5rem] sm:min-h-[6rem] ${
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
                            <p
                              className={`mt-3 h-5 text-xs leading-5 ${
                                active
                                  ? 'font-semibold text-red-600'
                                  : done
                                    ? 'font-medium text-emerald-700'
                                    : 'text-slate-400'
                              }`}
                            >
                              {active ? '进行中' : done ? '已完成' : '待开始'}
                            </p>
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
                key={`result-${resultGenId}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-100 bg-gradient-to-r from-red-50 to-white px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2">
                          <FileSignature className="size-5 shrink-0 text-red-700" />
                          <h3 className="text-sm sm:text-base font-bold text-slate-900">最终定稿</h3>
                        </div>
                        {reportState.kind === 'parsed' && finalDraftCharCount > 0 && (
                          <span
                            className={`text-xs tabular-nums px-2 py-0.5 rounded-full ring-1 ${
                              finalDraftLengthOk
                                ? 'text-emerald-700 bg-emerald-50 ring-emerald-200'
                                : finalDraftCharCount < 800
                                  ? 'text-amber-700 bg-amber-50 ring-amber-200'
                                  : 'text-orange-700 bg-orange-50 ring-orange-200'
                            }`}
                          >
                            {finalDraftCharCount} 字
                            {finalDraftLengthOk ? '（符合 800～2000 字）' : '（建议 800～2000 字）'}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 border-b border-red-100/80 bg-gradient-to-b from-red-50/80 to-white px-4 py-5 sm:px-6 sm:py-6">
                        <p className="text-[11px] sm:text-xs font-medium text-red-700/90 text-center tracking-wide mb-2">
                          标　题
                        </p>
                        <input
                          id="final-draft-title"
                          type="text"
                          value={reportState.finalDraftTitle ?? ''}
                          onChange={(e) =>
                            updateFinalDraft(
                              e.target.value.trim() === '' ? null : e.target.value,
                              reportState.finalDraftBody
                            )
                          }
                          placeholder="如：远洋社区交通事故频发，亟待重视"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg sm:text-xl font-bold tracking-wide text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 leading-snug"
                          spellCheck={false}
                        />
                      </div>
                      <textarea
                        value={reportState.finalDraftBody}
                        rows={18}
                        onChange={(e) =>
                          updateFinalDraft(reportState.finalDraftTitle, e.target.value)
                        }
                        className={
                          sectionTextareaAutosizeClass +
                          ' border-0 rounded-none min-h-[18rem] sm:min-h-[22rem] max-h-[min(70vh,40rem)]'
                        }
                        spellCheck={false}
                        placeholder="报送人抬头后，先写 1～2 段核心建议提要，再分「一、现状；二、成因与风险；三、针对性建议」展开…"
                      />
                    </section>

                    <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/30 to-white shadow-md shadow-amber-100/25 flex flex-col overflow-x-hidden">
                      <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 bg-amber-100/35 px-4 py-3 sm:px-5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="size-5 shrink-0 text-amber-800" />
                            <h3 className="text-sm sm:text-base font-bold text-amber-950">调研与核实备忘</h3>
                          </div>
                          <p className="mt-1 text-[11px] sm:text-xs text-amber-800/80 leading-relaxed">
                            供撰写人报送前自行调研补材，不写入正文、不随稿报送
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFollowUpEditing((v) => !v)}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-white"
                        >
                          <Edit3 size={14} className="shrink-0" />
                          {followUpEditing ? '完成' : '编辑'}
                        </button>
                      </div>
                      {followUpEditing ? (
                        <textarea
                          value={reportState.sections.followUp}
                          rows={8}
                          onChange={(e) => updateParsedSection('followUp', e.target.value)}
                          className={
                            sectionTextareaAutosizeClass +
                            ' border-0 rounded-none bg-white/70 min-h-[9rem] max-h-[min(50vh,28rem)]'
                          }
                          spellCheck={false}
                          placeholder="待核实数据、建议调研对象、需查证的政策、待补图表等。**主题** 可加粗。"
                        />
                      ) : (
                        <div className="px-4 py-4 sm:px-5 sm:py-5 font-serif text-[15px] sm:text-base lg:text-[1.0625rem] leading-relaxed text-slate-800 bg-white/70 min-h-[6rem] whitespace-pre-wrap break-words">
                          {reportState.sections.followUp.trim() ? (
                            renderSimpleBold(reportState.sections.followUp)
                          ) : (
                            <span className="text-slate-400">
                              暂无内容；若生成失败，可点「编辑」自行记录待调研事项。
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
                      <textarea
                        value={reportState.text}
                        rows={20}
                        onChange={(e) =>
                          setReportState({ kind: 'raw', text: e.target.value })
                        }
                        className={
                          sectionTextareaAutosizeClass +
                          ' border-0 rounded-none min-h-[16rem] max-h-[min(70vh,40rem)]'
                        }
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

      {processingOverlay ? (
        <ProcessingOverlay title={processingOverlay.title} detail={processingOverlay.detail} />
      ) : null}
    </div>
  );
}
