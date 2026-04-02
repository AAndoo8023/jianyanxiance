import React, { useEffect, useMemo, useState } from 'react';
import { generateReport, UserProfile } from './lib/llm';
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
  BookOpen,
  Lightbulb,
  ClipboardList,
  Circle,
  Info,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  countFinalDraftChars,
  parseReport,
  ParsedReport,
  serializeReport,
} from './lib/parseReport';

type ViewState = 'welcome' | 'input' | 'thinking' | 'result';

const THINKING_STEPS = [
  {
    title: '步骤一：核心逻辑拆解',
    detail: '问题定性、因果溯源、利害权衡',
  },
  {
    title: '步骤二：三轮专家盲审',
    detail: '宏观站位、落地可行性、公文形式',
  },
  {
    title: '步骤三：排版与定稿',
    detail: '按规范撰写《社情民意信息》正文',
  },
] as const;

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

  useEffect(() => {
    if (view !== 'thinking') return;
    setThinkingPhase(0);
    const id = window.setInterval(() => {
      setThinkingPhase((p) => (p >= 2 ? 2 : p + 1));
    }, 2300);
    return () => window.clearInterval(id);
  }, [view]);

  const finalDraftChars = useMemo(() => {
    if (!reportState) return 0;
    if (reportState.kind === 'parsed') {
      return countFinalDraftChars(reportState.sections.finalDraft);
    }
    return countFinalDraftChars(reportState.text);
  }, [reportState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setView('thinking');
    setReportState(null);
    try {
      const res = await generateReport(topic, profile);
      const parsed = parseReport(res || '');
      if (parsed.ok) {
        setReportState({ kind: 'parsed', sections: parsed.sections });
      } else {
        setReportState({ kind: 'raw', text: res || '' });
      }
      setView('result');
    } catch (error) {
      console.error(error);
      alert('生成失败，请重试。');
      setView('input');
    }
  };

  const getExportText = (): string => {
    if (!reportState) return '';
    if (reportState.kind === 'parsed') return serializeReport(reportState.sections);
    return reportState.text;
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

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputClass =
    'w-full min-h-11 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base leading-normal focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors';

  const sectionTextareaClass =
    'w-full min-h-[8rem] sm:min-h-[10rem] p-3 sm:p-4 rounded-xl border border-slate-200 bg-[#fdfbf7] font-serif text-[15px] sm:text-base leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/15 resize-y';

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-sans text-slate-900 selection:bg-red-100 selection:text-red-900 flex flex-col pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10 shrink-0 pt-[max(0px,env(safe-area-inset-top))]">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 min-h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="bg-red-600 p-1.5 sm:p-2 rounded-lg text-white shrink-0">
              <FileSignature className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                建言献策
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">AI驱动的社情民意信息撰写平台</p>
            </div>
          </div>
          <div className="text-[10px] sm:text-sm text-slate-400 sm:text-slate-500 font-medium shrink-0 max-w-[40%] text-right leading-tight hidden min-[400px]:block sm:max-w-none">
            jianyanxiance-ai.online
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-1 flex-col min-h-0 w-full">
          <AnimatePresence mode="wait">
            {view === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="max-w-3xl mx-auto w-full flex flex-col gap-6 sm:gap-8"
              >
                <div className="text-center px-1 pt-2 sm:pt-4">
                  <div className="flex justify-center">
                    <h2 className="relative inline-block text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-pretty pr-7 sm:pr-8">
                      勤勉履职，建言有方
                      <span
                        className="absolute right-0 top-0 inline-flex items-center rounded bg-red-600 px-[5px] py-[2px] text-[9px] sm:text-[10px] font-bold leading-none text-white shadow-sm"
                        aria-hidden
                      >
                        AI
                      </span>
                    </h2>
                  </div>
                  <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed text-pretty">
                    请先了解下方流程与撰写要点，准备好选题后再进入「撰写需求」填写内容。
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
                      <ClipboardList className="size-4 shrink-0" />
                      生成流程
                    </div>
                    <ol className="mt-2 space-y-1.5 text-xs text-slate-600 leading-relaxed">
                      <li>
                        <span className="font-medium text-slate-800">①</span> 逻辑拆解与问题定性
                      </li>
                      <li>
                        <span className="font-medium text-slate-800">②</span> 模拟专家盲审打磨
                      </li>
                      <li>
                        <span className="font-medium text-slate-800">③</span> 输出规范文稿与后续建议
                      </li>
                    </ol>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
                      <BookOpen className="size-4 shrink-0" />
                      选题怎么写
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600 leading-relaxed text-pretty">
                      <li>写清现象、涉及人群或行业、已观察到的政策或执行缺口。</li>
                      <li>可补充数据、案例或对比，便于对策「可落地」。</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
                      <Info className="size-4 shrink-0" />
                      温馨提示
                    </div>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed text-pretty">
                      生成后页面将分区展示<strong className="text-slate-800">评审意见</strong>、
                      <strong className="text-slate-800">最终稿</strong>与
                      <strong className="text-slate-800">后续建议</strong>，均支持编辑与一键复制全文。
                    </p>
                  </div>
                </div>

                <div className="pb-2">
                  <button
                    type="button"
                    onClick={() => setView('input')}
                    className="w-full flex items-center justify-center gap-2 min-h-12 sm:min-h-14 lg:min-h-[3.5rem] rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-base lg:text-lg font-semibold shadow-md shadow-red-600/25 transition-all active:scale-[0.99]"
                  >
                    我要建言
                    <ChevronRight className="size-5 shrink-0" strokeWidth={2.5} />
                  </button>
                  <p className="mt-3 text-center text-xs text-slate-400">进入后即可填写选题与报送人信息</p>
                </div>
              </motion.div>
            )}

            {view === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl mx-auto w-full"
              >
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => setView('welcome')}
                      className="mb-3 flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-red-700 transition-colors"
                    >
                      <ArrowLeft size={16} className="shrink-0" />
                      返回欢迎页
                    </button>
                    <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                      <FileText className="text-red-600 shrink-0" size={20} />
                      撰写需求
                    </h2>
                    <p className="text-sm text-slate-500 mt-1.5 text-pretty leading-relaxed">
                      输入您的社会观察、行业洞察或民生诉求，AI 将分步完成拆解、评审与定稿，并给出可操作的后续建议。
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-900 flex items-center justify-between">
                        <span>选题与初步想法 <span className="text-red-500">*</span></span>
                      </label>
                      <textarea
                        required
                        rows={7}
                        placeholder="请详细描述您观察到的社会现象、存在的问题以及初步的建议。描述越具体，AI 拆解和生成的报告越精准..."
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
                      disabled={!topic.trim()}
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
                className="min-h-[min(72vh,36rem)] flex flex-col items-stretch justify-center px-2 sm:px-4 w-full max-w-lg mx-auto py-6"
              >
                <div className="relative mx-auto mb-8 h-20 w-20 shrink-0">
                  <div className="absolute inset-0 rounded-full border-4 border-red-100" />
                  <div className="h-20 w-20 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="size-8 text-red-600 animate-pulse" />
                  </div>
                </div>

                <p className="text-center text-sm text-slate-500 mb-4">当前仅进行下方高亮阶段，请稍候</p>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  {THINKING_STEPS.map((step, i) => {
                    const active = thinkingPhase === i;
                    const done = thinkingPhase > i;
                    return (
                      <div
                        key={step.title}
                        className={`flex gap-3 rounded-xl border p-3 transition-colors ${
                          active
                            ? 'border-red-300 bg-red-50/80 ring-1 ring-red-200'
                            : done
                              ? 'border-emerald-200 bg-emerald-50/50'
                              : 'border-slate-100 bg-slate-50/80 opacity-75'
                        }`}
                      >
                        <div className="shrink-0 pt-0.5">
                          {done ? (
                            <CheckCircle2 className="size-5 text-emerald-600" />
                          ) : active ? (
                            <Loader2 className="size-5 animate-spin text-red-600" />
                          ) : (
                            <Circle className="size-5 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                          <div className="text-xs text-slate-600 mt-0.5">{step.detail}</div>
                          {active && (
                            <p className="text-xs text-red-700 font-medium mt-2">进行中…</p>
                          )}
                          {done && !active && (
                            <p className="text-xs text-emerald-700 mt-2">已完成</p>
                          )}
                          {!done && !active && (
                            <p className="text-xs text-slate-400 mt-2">待开始</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {view === 'result' && reportState && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0 gap-3 sm:gap-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setView('input');
                      setReportState(null);
                    }}
                    className="flex items-center justify-center sm:justify-start gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 min-h-11 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200/80 w-full sm:w-auto"
                  >
                    <ArrowLeft size={18} className="shrink-0" />
                    返回修改需求
                  </button>

                  <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-2 sm:gap-3 w-full sm:w-auto sm:justify-end">
                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end">
                      <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        <span className="text-slate-500">最终稿字数（不含空白）</span>
                        <span className="font-semibold tabular-nums text-red-700">{finalDraftChars}</span>
                        <span className="text-slate-400 text-xs">字</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200">
                        <Edit3 size={14} />
                        <span>分区可编辑</span>
                      </div>
                    </div>
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
                      {copied ? '已复制' : '复制全文'}
                    </button>
                  </div>
                </div>

                <p className="sm:hidden text-xs text-slate-500 text-center -mt-1">各分区正文可直接编辑</p>

                {reportState.kind === 'parsed' ? (
                  <div className="flex flex-col gap-4 flex-1 min-h-0">
                    <section className="rounded-xl border border-amber-200/80 bg-amber-50/40 overflow-hidden flex flex-col shadow-sm">
                      <div className="flex items-center gap-2 border-b border-amber-200/60 bg-amber-100/50 px-4 py-2.5">
                        <Lightbulb className="size-4 text-amber-800 shrink-0" />
                        <h3 className="text-sm font-semibold text-amber-950">内部打磨 · 三轮专家评审意见</h3>
                      </div>
                      <textarea
                        value={reportState.sections.review}
                        onChange={(e) => updateParsedSection('review', e.target.value)}
                        className={sectionTextareaClass + ' border-0 rounded-none bg-amber-50/30'}
                        spellCheck={false}
                      />
                    </section>

                    <section className="rounded-xl border border-red-200/90 bg-white overflow-hidden flex flex-col shadow-sm flex-1 min-h-0">
                      <div className="flex items-center gap-2 border-b border-red-100 bg-red-50/80 px-4 py-2.5">
                        <FileSignature className="size-4 text-red-700 shrink-0" />
                        <h3 className="text-sm font-semibold text-slate-900">最终定稿</h3>
                        <span className="ml-auto text-xs text-slate-500 tabular-nums">
                          {countFinalDraftChars(reportState.sections.finalDraft)} 字
                        </span>
                      </div>
                      <textarea
                        value={reportState.sections.finalDraft}
                        onChange={(e) => updateParsedSection('finalDraft', e.target.value)}
                        className={
                          sectionTextareaClass +
                          ' flex-1 min-h-[min(55vh,calc(100dvh-20rem))] sm:min-h-[18rem] border-0 rounded-none'
                        }
                        spellCheck={false}
                      />
                    </section>

                    <section className="rounded-xl border border-sky-200/80 bg-sky-50/30 overflow-hidden flex flex-col shadow-sm">
                      <div className="flex items-center gap-2 border-b border-sky-200/60 bg-sky-100/50 px-4 py-2.5">
                        <Sparkles className="size-4 text-sky-800 shrink-0" />
                        <h3 className="text-sm font-semibold text-sky-950">后续建议</h3>
                      </div>
                      <textarea
                        value={reportState.sections.followUp}
                        onChange={(e) => updateParsedSection('followUp', e.target.value)}
                        className={sectionTextareaClass + ' border-0 rounded-none bg-white/60'}
                        spellCheck={false}
                        placeholder="若模型未返回本区块，可在此自行补充报送渠道、调研计划等。"
                      />
                    </section>
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 min-h-0 gap-2">
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      未识别到标准分区标记，已以全文展示。您仍可编辑后复制。
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col flex-1 min-h-0 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 bg-slate-50">
                        <span className="text-sm font-medium text-slate-800">全文</span>
                        <span className="text-xs text-slate-500 tabular-nums">{finalDraftChars} 字（全文，不含空白）</span>
                      </div>
                      <textarea
                        value={reportState.text}
                        onChange={(e) =>
                          setReportState({ kind: 'raw', text: e.target.value })
                        }
                        className={
                          sectionTextareaClass +
                          ' flex-1 min-h-[min(60vh,calc(100dvh-14rem))] border-0 rounded-none'
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
    </div>
  );
}