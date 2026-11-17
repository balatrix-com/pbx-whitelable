import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { formatCustomerId } from '../../../utils/billing.utils';
import { Headphones, Copy, Check, MessageSquare } from 'lucide-react';

const HelpContactCard = () => {
    const { user } = useAuth();
    const [copied, setCopied] = useState(false);

    const customerCode = user?.tenant?.customerCode ? formatCustomerId(user.tenant.customerCode) : null;
    const tenantName = user?.tenant?.name || 'Your Account';

    const handleCopyCode = () => {
        if (!customerCode) return;
        navigator.clipboard.writeText(customerCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenChat = () => {
        if (typeof window !== 'undefined' && window.$zoho?.salesiq?.chat?.start) {
            window.$zoho.salesiq.chat.start();
        } else {
            // Fallback: alert or prompt user
            alert('Live support chat is currently initializing. Please check the chat bubble in the bottom right corner of your screen.');
        }
    };

    return (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-indigo-900/40 relative overflow-hidden">
            {/* Background decorative glow */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2 max-w-xl">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-md">
                        <Headphones className="w-3.5 h-3.5 text-indigo-300" />
                        <span>Direct Support Escalation</span>
                    </div>
                    <h3 className="text-xl font-extrabold tracking-tight text-white">
                        Could not resolve your issue with the self-service steps?
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                        Our technical support team is available to assist with network routing, carrier interconnects, or custom dialplan configurations.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {customerCode && (
                        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
                            <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                                    Account Reference
                                </span>
                                <span className="font-mono text-xs font-bold text-white uppercase">
                                    {customerCode}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyCode}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
                                title="Copy Customer ID"
                            >
                                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleOpenChat}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition shadow-sm active:scale-95"
                    >
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                        <span>Start Support Chat</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelpContactCard;
