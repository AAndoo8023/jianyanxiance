import React, { useState } from 'react';
import { generateReport, UserProfile } from './lib/gemini';
import { FileText, Send, User, Building, Briefcase, Phone, Mail, Copy, CheckCircle2, Loader2, FileSignature, ArrowLeft, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewState = 'input' | 'thinking' | 'result';

export default function App() {
  const [view, setView] = useState<ViewState>('input');
  const [profile, setProfile] = useState<UserProfile>({
    party: '',
    title: '',
    phone: '',
    email: '',
    name: ''
  });
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    setView('thinking');
    setResult('');
    try {
      const res = await generateReport(topic, profile);
      setResult(res || '');
      setView('result');
    } catch (error) {
      console.error(error);
      alert('生成失败，请重试。');
      setView('input');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-red-100 selection:text-red-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-lg text-white">
              <FileSignature size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">建言献策AI平台</h1>
              <p className="text-xs text-slate-500 hidden sm:block">社情民意信息撰写内参专家</p>
            </div>
          </div>
          <div className="text-sm text-slate-500 font-medium">
            jianyanxiance-ai.online
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {view === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="text-red-600" size={20} />
                    撰写需求
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    输入您的社会观察、行业洞察或民生诉求，AI将为您深度拆解并生成标准内参专报。
                  </p>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Profile Section */}
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
                          placeholder="如：民盟盟员"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
                          value={profile.party}
                          onChange={e => setProfile({...profile, party: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <Briefcase size={14} className="text-slate-400" /> 职业/头衔
                        </label>
                        <input
                          type="text"
                          placeholder="如：某大学教授"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
                          value={profile.title}
                          onChange={e => setProfile({...profile, title: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <User size={14} className="text-slate-400" /> 姓名
                        </label>
                        <input
                          type="text"
                          placeholder="您的姓名"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
                          value={profile.name}
                          onChange={e => setProfile({...profile, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <Phone size={14} className="text-slate-400" /> 联系电话
                        </label>
                        <input
                          type="tel"
                          placeholder="手机号码"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
                          value={profile.phone}
                          onChange={e => setProfile({...profile, phone: e.target.value})}
                        />
                      </div>
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <Mail size={14} className="text-slate-400" /> 邮箱地址
                        </label>
                        <input
                          type="email"
                          placeholder="您的电子邮箱"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
                          value={profile.email}
                          onChange={e => setProfile({...profile, email: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Topic Section */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-900 flex items-center justify-between">
                      <span>选题与初步想法 <span className="text-red-500">*</span></span>
                    </label>
                    <textarea
                      required
                      rows={8}
                      placeholder="请详细描述您观察到的社会现象、存在的问题以及初步的建议。描述越具体，AI 拆解和生成的报告越精准..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors resize-none"
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!topic.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <Send size={18} />
                    生成内参专报
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'thinking' && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="min-h-[60vh] flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative">
                <div className="absolute inset-0 border-4 border-red-100 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileSignature size={24} className="text-red-600 animate-pulse" />
                </div>
              </div>
              <div className="space-y-3 text-center max-w-md">
                <h3 className="text-xl font-semibold text-slate-800">正在进行核心逻辑拆解</h3>
                <div className="space-y-2">
                  <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    分析问题定性与因果溯源...
                  </p>
                  <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    后台专家盲审中 (宏观站位 / 落地可行性 / 公文形式)...
                  </p>
                  <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    排版与生成标准文稿...
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto space-y-4"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setView('input')}
                  className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100"
                >
                  <ArrowLeft size={16} />
                  返回修改需求
                </button>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <Edit3 size={14} />
                    <span>内容可直接编辑</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
                  >
                    {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                    {copied ? '已复制' : '复制全文'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-1 bg-slate-100 border-b border-slate-200 flex justify-center">
                  <div className="w-32 h-1.5 bg-slate-200 rounded-full"></div>
                </div>
                <textarea
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  className="w-full h-[70vh] p-8 md:p-12 resize-none focus:outline-none font-serif text-base md:text-lg leading-relaxed text-slate-800 bg-[#fdfbf7] selection:bg-red-100"
                  spellCheck={false}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
