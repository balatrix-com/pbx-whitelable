import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ChevronDown,
    ArrowUpRight,
    Copy,
    Check,
    ThumbsUp,
    ThumbsDown,
    CheckCircle2
} from 'lucide-react';

const CATEGORY_STYLES = {
    extensions: 'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40',
    calls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40',
    audio: 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40',
    features: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40',
    account: 'bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40'
};

const CATEGORY_LABELS = {
    extensions: 'Softphones & Extensions',
    calls: 'Calling & Inbound Routing',
    audio: 'Audio & Headset',
    features: 'IVR, Schedules & Forwards',
    account: 'Account & Wallet'
};

const HelpAccordionItem = ({ article, isOpen, onToggle }) => {
    const [copied, setCopied] = useState(false);
    const [feedback, setFeedback] = useState(null); // 'yes' | 'no' | null

    const handleCopy = (e, text) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFeedback = (type) => {
        setFeedback(type);
    };

    const badgeStyle = CATEGORY_STYLES[article.category] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    const categoryLabel = CATEGORY_LABELS[article.category] || article.category;

    return (
        <div className={`transition-all duration-200 border rounded-xl overflow-hidden ${
            isOpen
                ? 'bg-white dark:bg-[#0d0e13] border-indigo-200/80 dark:border-indigo-900/50 shadow-sm ring-1 ring-indigo-500/10'
                : 'bg-white dark:bg-[#0d0e13] border-gray-200/80 dark:border-white/[0.08] hover:border-gray-300 dark:hover:border-white/[0.15]'
        }`}>
            {/* Header / Click to expand */}
            <button
                type="button"
                onClick={onToggle}
                className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 focus:outline-none transition-colors"
                aria-expanded={isOpen}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${badgeStyle}`}>
                            {categoryLabel}
                        </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                        {article.title}
                    </h3>
                </div>

                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 ${
                    isOpen
                        ? 'rotate-180 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                        : 'bg-gray-50 dark:bg-white/[0.04] text-gray-400 group-hover:text-gray-600'
                }`}>
                    <ChevronDown className="w-4 h-4" />
                </div>
            </button>

            {/* Collapsible Content */}
            {isOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-white/[0.06] space-y-4">
                    {/* Summary */}
                    {article.summary && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                            {article.summary}
                        </p>
                    )}

                    {/* Step-by-Step Resolution */}
                    <div className="space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                            Troubleshooting Steps:
                        </h4>
                        <ol className="space-y-2">
                            {article.steps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 dark:text-slate-300">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5 border border-indigo-100 dark:border-indigo-900/40">
                                        {idx + 1}
                                    </span>
                                    <span className="flex-1 leading-relaxed">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Copyable Technical Snippet (if any) */}
                    {article.techSnippet && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06]">
                            <div className="min-w-0 pr-3">
                                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 block">
                                    {article.techSnippet.label}
                                </span>
                                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white truncate block">
                                    {article.techSnippet.value}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => handleCopy(e, article.techSnippet.value)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-xs flex-shrink-0"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-emerald-600">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Direct Action Link & Feedback */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
                        {article.action ? (
                            <Link
                                to={article.action.path}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition"
                            >
                                <span>{article.action.label}</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        ) : (
                            <div />
                        )}

                        {/* Interactive Feedback */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                            {feedback ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Thanks for your feedback!
                                </span>
                            ) : (
                                <>
                                    <span>Was this helpful?</span>
                                    <button
                                        type="button"
                                        onClick={() => handleFeedback('yes')}
                                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400 hover:text-emerald-600 transition"
                                        title="Yes"
                                    >
                                        <ThumbsUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFeedback('no')}
                                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-400 hover:text-rose-600 transition"
                                        title="No"
                                    >
                                        <ThumbsDown className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpAccordionItem;
