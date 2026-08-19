import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSubscriptionQuery, useWalletQuery } from '../../hooks/useBillingQueries';
import { subscriptionService } from '../../services/subscription.service';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
    Plus,
    RefreshCw,
    CheckCircle2,
    CreditCard,
    Loader2,
    ArrowUpRight,
    Wallet as WalletIcon,
    ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlanSwitchModal from '../../components/subscription/PlanSwitchModal';
import PlanFormModal from '../../components/subscription/PlanFormModal';

const SubscriptionsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();
    const queryClient = useQueryClient();

    // Active Subscription & Wallet Data
    const { data: subscription, isLoading: subLoading, refetch: refetchSubscription } = useSubscriptionQuery();
    const { data: wallet, refetch: refetchWallet } = useWalletQuery();

    // Plans List & Switch Modal State
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [selectedPlanForSwitch, setSelectedPlanForSwitch] = useState(null);
    const [planSwitchModalOpen, setPlanSwitchModalOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingCard, setEditingCard] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setPlansLoading(true);
        try {
            const plansData = await subscriptionService.getPlans();
            setPlans(plansData || []);
        } catch (err) {
            console.error('Failed to load subscriptions data:', err);
            addToast('error', 'Failed to load subscription items');
        } finally {
            setPlansLoading(false);
        }
    };

    // Purchasing Power Calculation
    const fiatBalance = Number(wallet?.balance || 0);
    const creditLimit = Number(wallet?.creditLimit || 0);
    const creditUsed = Number(wallet?.creditUsed || 0);
    const availablePurchasingPower = fiatBalance + creditLimit - creditUsed;

    // Plan Switch Handler
    const handleInitiatePlanSwitch = (plan) => {
        setSelectedPlanForSwitch(plan);
        setPlanSwitchModalOpen(true);
    };

    // Refresh active subscription & wallet after plan changes
    const handleRefreshAll = () => {
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        refetchSubscription();
        refetchWallet();
        loadData();
    };

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
                        <CreditCard className="h-8 w-8 text-primary-600" />
                        Subscription & Billing Engine 2.0
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 mt-1 font-medium text-sm md:text-base">
                        Manage active subscription plan and purchasing power
                    </p>
                </div>
                <button
                    onClick={handleRefreshAll}
                    className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-slate-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                >
                    <RefreshCw size={16} />
                    Refresh Subscription
                </button>
            </div>

            {/* Active Subscription & Purchasing Power Banner */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-200/80 dark:border-slate-800">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Active Subscription
                        </div>
                        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                            {subscription?.plan_name || 'Tier 1 Starter Plan'}
                        </h2>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                            Status: <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase">{subscription?.status || 'ACTIVE'}</span>
                            {subscription?.next_billing && (
                                <span className="ml-3">Next Billing: <span className="font-bold text-gray-900 dark:text-white">{new Date(subscription.next_billing).toLocaleDateString()}</span></span>
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 min-w-[120px]">
                            <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Extensions</span>
                            <span className="text-lg font-extrabold text-gray-900 dark:text-white font-mono">
                                {subscription?.limits?.extensions || 5}
                            </span>
                        </div>
                        <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 min-w-[120px]">
                            <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Free Minutes</span>
                            <span className="text-lg font-extrabold text-gray-900 dark:text-white font-mono">
                                {subscription?.limits?.free_mins || 500}
                            </span>
                        </div>
                        <div className="px-4.5 py-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 min-w-[180px]">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                                <WalletIcon className="h-3.5 w-3.5" /> Purchasing Power
                            </span>
                            <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
                                ${availablePurchasingPower.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plans List & Switch Flow Section */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary-600" />
                        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                            Available Billing Plans
                        </h3>
                    </div>
                    <button
                        onClick={() => {
                            setEditingCard(null);
                            setShowModal(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all w-full sm:w-auto"
                    >
                        <Plus size={20} />
                        Add New Plans
                    </button>
                </div>

                {plansLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {plans.map((p) => {
                            const currentPlanId = subscription?.plan_id || subscription?.plan_name;
                            const isCurrent = currentPlanId && (p.plan_id || p.name) ? (subscription?.plan_id === p.plan_id || subscription?.plan_name === p.name) : false;
                            return (
                                <div
                                    key={p.plan_id || p.id || p.name}
                                    className={`bg-white dark:bg-slate-900 rounded-2xl p-6 border transition-all flex flex-col justify-between ${isCurrent
                                        ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md'
                                        : 'border-gray-200/80 dark:border-slate-800 shadow-sm hover:shadow-md'
                                        }`}
                                >
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-base font-extrabold text-gray-900 dark:text-white">
                                                {p.name}
                                            </h4>
                                            {isCurrent && (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
                                                    CURRENT
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-2xl font-extrabold font-mono text-gray-900 dark:text-white mb-4">
                                            ${Number(p.amount || p.price || 0).toFixed(2)}
                                            <span className="text-xs text-gray-400 font-normal font-sans"> / month</span>
                                        </div>

                                        <ul className="space-y-2 text-xs text-gray-600 dark:text-slate-300 font-medium">
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                <span><strong>{p.extensions || 1}</strong> SIP Extensions</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                <span><strong>{p.free_mins || 0}</strong> Free Inbound Minutes</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                <span><strong>{p.tfns || 0}</strong> Toll-Free Numbers (TFN)</span>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => handleInitiatePlanSwitch(p)}
                                            disabled={isCurrent}
                                            className="w-full inline-flex justify-center items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold shadow-sm hover:bg-gray-800 dark:hover:bg-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {isCurrent ? 'Current Plan' : (
                                                <>
                                                    Switch to Plan <ArrowUpRight className="h-4 w-4" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Plan Switch Modal Flow */}
            <PlanSwitchModal
                isOpen={planSwitchModalOpen}
                onClose={() => setPlanSwitchModalOpen(false)}
                currentPlan={subscription}
                newPlan={selectedPlanForSwitch}
                customerId={user?.tenantId}
                onSuccess={handleRefreshAll}
            />

            {/* Create New Plan Form Modal */}
            <PlanFormModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={handleRefreshAll}
            />

        </div>
    );
};

export default SubscriptionsPage;
