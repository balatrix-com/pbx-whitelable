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
    platform: 'bg-primary-50 text-primary-700 border-primary-200/60',
    carriers: 'bg-sky-50 text-sky-700 border-sky-200/60',
    pricing: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
    extensions: 'bg-blue-50 text-blue-700 border-blue-200/60',
    calls: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    audio: 'bg-purple-50 text-purple-700 border-purple-200/60',
    features: 'bg-amber-50 text-amber-700 border-amber-200/60',
    account: 'bg-rose-50 text-rose-700 border-rose-200/60'
};

const CATEGORY_LABELS = {
    platform: 'Platform & Tenants',
    carriers: 'Carriers & Traces',
    pricing: 'Rate Cards & Plans',
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

    const badgeStyle = CATEGORY_STYLES[article.category] || 'bg-slate-100 text-slate-700 border-slate-200/60';
    const categoryLabel = CATEGORY_LABELS[article.category] || article.category;

    return (
        <div className={`transition-all duration-150 ${isOpen ? 'bg-slate-50/40' : 'bg-white hover:bg-slate-50/30'}`}>
            {/* Accordion Trigger Header */}
            <button
                type="button"
                onClick={onToggle}
                className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 focus:outline-none"
            >
                <div className="space-y-1 flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${badgeStyle}`}>
                            {categoryLabel}
                        </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-snug pt-0.5">
                        {article.title}
                    </h3>

                    <p className="text-xs text-gray-500 line-clamp-2">
                        {article.summary}
                    </p>
                </div>

                <div className="shrink-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        isOpen
                            ? 'bg-primary-50 text-primary-600 rotate-180'
                            : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                    }`}>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </div>
            </button>

            {/* Accordion Content Body */}
            {isOpen && (
                <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-slate-100 space-y-4">
                    {/* Steps List */}
                    <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                            Recommended Troubleshooting Steps:
                        </h4>
                        <ol className="space-y-2">
                            {article.steps.map((step, index) => (
                                <li key={index} className="flex items-start gap-2.5 text-xs text-gray-700 leading-relaxed">
                                    <span className="shrink-0 w-4 h-4 rounded-full bg-primary-50 text-primary-600 font-bold flex items-center justify-center text-[10px] mt-0.5">
                                        {index + 1}
                                    </span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Tech Snippet (e.g. STUN, SIP port) */}
                    {article.techSnippet && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                            <div>
                                <span className="font-semibold text-gray-500">
                                    {article.techSnippet.label}:
                                </span>{' '}
                                <code className="font-mono font-bold text-gray-900 ml-1">
                                    {article.techSnippet.value}
                                </code>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => handleCopy(e, article.techSnippet.value)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:text-primary-700 transition"
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

                    {/* Footer Row: In-App Direct Action & Helpful Feedback */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        {article.action ? (
                            <Link
                                to={article.action.path}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 transition"
                            >
                                <span>{article.action.label}</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        ) : (
                            <span />
                        )}

                        {/* Was this helpful? */}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            {feedback ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Thank you for your feedback!</span>
                                </span>
                            ) : (
                                <>
                                    <span className="text-[11px]">Did this resolve the issue?</span>
                                    <button
                                        type="button"
                                        onClick={() => handleFeedback('yes')}
                                        className="p-1 rounded hover:bg-slate-100 text-gray-400 hover:text-emerald-600 transition"
                                        title="Yes"
                                    >
                                        <ThumbsUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFeedback('no')}
                                        className="p-1 rounded hover:bg-slate-100 text-gray-400 hover:text-rose-600 transition"
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
