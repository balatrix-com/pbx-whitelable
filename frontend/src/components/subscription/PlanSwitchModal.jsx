import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, RefreshCw, Loader2, ArrowRight, ShieldCheck, Zap, AlertCircle, CheckCircle2, ChevronRight, Calendar, Clock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { subscriptionService } from '../../services/subscription.service';
import { useToast } from '../../context/ToastContext';

const PlanSwitchModal = ({ isOpen, onClose, currentPlan, newPlan, customerId, isArchived, onSuccess }) => {
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Plans list state for in-modal selection
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(newPlan || null);

    // Sync selected plan when newPlan prop changes
    useEffect(() => {
        if (newPlan) {
            setSelectedPlan(newPlan);
        }
    }, [newPlan]);

    // Load available plans when modal opens
    useEffect(() => {
        if (isOpen) {
            setError(null);
            fetchAvailablePlans();
        }
    }, [isOpen]);

    const fetchAvailablePlans = async () => {
        setPlansLoading(true);
        try {
            const data = await subscriptionService.getPlans();
            setPlans(Array.isArray(data) ? data : []);
            // If no plan selected yet and plans are loaded, default to the first available or non-current plan
            if (!newPlan && Array.isArray(data) && data.length > 0) {
                const currentPlanId = currentPlan?.plan_id || currentPlan?.id || currentPlan?.plan_name;
                const targetDefault = currentPlanId ? data.find(p => (p.plan_id || p.id) !== currentPlanId) : data[0];
                if (targetDefault) {
                    setSelectedPlan(targetDefault);
                }
            }
        } catch (err) {
            console.error('Failed to load plans for switch modal:', err);
        } finally {
            setPlansLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentPlanId = currentPlan?.plan_id || currentPlan?.id || currentPlan?.plan_name;
    const currentPrice = Number(currentPlan?.amount || currentPlan?.price || 0);
    const targetPrice = Number(selectedPlan?.amount || selectedPlan?.price || 0);
    const isUpgrade = targetPrice > currentPrice;
    const isSamePlan = currentPlan && selectedPlan && (selectedPlan.plan_id || selectedPlan.id) === currentPlanId;

    const handleConfirmSwitch = async () => {
        if (isArchived) {
            addToast('error', 'Cannot assign plan: Target tenant is deactivated/archived.');
            return;
        }
        if (!selectedPlan || isSamePlan) return;
        setSubmitting(true);
        setError(null);
        try {
            const targetPlanId = selectedPlan.plan_id || selectedPlan.id;
            // Existing subscription switches strictly apply on next billing cycle (immediate: false)
            // Brand new / planless tenant initial activation applies immediately (immediate: true)
            const isInitialActivation = !currentPlan;
            const res = await subscriptionService.switchPlan(
                customerId,
                targetPlanId,
                isInitialActivation
            );
            const defaultMsg = isInitialActivation
                ? `Successfully activated ${selectedPlan.name}!`
                : `Successfully scheduled plan switch to ${selectedPlan.name} for the next billing cycle!`;
            addToast('success', res?.message || defaultMsg);
            queryClient.invalidateQueries({ queryKey: ['subscription'] });
            queryClient.invalidateQueries({ queryKey: ['wallet'] });
            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err) {
            console.error('Plan switch/activation error:', err);
            const msg = err.response?.data?.message || err.normalized?.message || err.message || 'Failed to activate plan';
            setError(msg);
            addToast('error', msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" aria-hidden="true" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="mx-auto max-w-xl w-full rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl ring-1 ring-gray-900/10 dark:ring-slate-800 transition-all max-h-[90vh] overflow-y-auto">
                    
                    {/* Header */}
                    <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                                <RefreshCw className="h-5 w-5 stroke-[2.2]" />
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
                                    {currentPlan ? 'Change Subscription Plan' : 'Assign / Activate Subscription Plan'}
                                </Dialog.Title>
                                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                                    {currentPlan 
                                        ? 'Upgrade or downgrade your active PBX billing tier' 
                                        : 'Select an initial billing plan to activate PBX features for this tenant'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors focus:outline-none"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content Details */}
                    <div className="py-5 space-y-6">

                        {/* Step 1: Select Plan */}
                        <div className="space-y-2.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 block">
                                1. Select New Target Plan
                            </label>

                            {plansLoading ? (
                                <div className="flex justify-center py-6">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2.5 max-h-52 overflow-y-auto pr-1">
                                    {plans.map((p) => {
                                        const pId = p.plan_id || p.id;
                                        const isCurrent = pId === currentPlanId;
                                        const isSelected = selectedPlan && (selectedPlan.plan_id || selectedPlan.id) === pId;

                                        return (
                                            <div
                                                key={pId}
                                                onClick={() => !isCurrent && setSelectedPlan(p)}
                                                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                                                    isCurrent 
                                                        ? 'bg-gray-50/70 dark:bg-slate-800/30 border-gray-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                                                        : isSelected 
                                                            ? 'bg-primary-50/70 dark:bg-primary-950/40 border-primary-500 ring-2 ring-primary-500/20'
                                                            : 'bg-white dark:bg-slate-800/50 border-gray-200/80 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                                        isSelected 
                                                            ? 'bg-primary-600 text-white' 
                                                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                                                    }`}>
                                                        <ShieldCheck className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                                {p.name}
                                                            </span>
                                                            {isCurrent && (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                                                                    CURRENT
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 dark:text-slate-400">
                                                            {p.extensions || 1} Ext • {p.free_mins || 0} Free Mins
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-right flex items-center gap-3">
                                                    <span className="text-xs font-extrabold font-mono text-gray-900 dark:text-white">
                                                        ${Number(p.amount || p.price || 0).toFixed(2)}/mo
                                                    </span>
                                                    {isSelected && (
                                                        <div className="h-2 w-2 rounded-full bg-primary-600"></div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Step 2: Comparison Box / Plan Details */}
                        {selectedPlan && (
                            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-4">
                                {currentPlan ? (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Current</span>
                                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                {currentPlan?.name || currentPlan?.plan_name || 'Active Plan'}
                                            </p>
                                            <p className="text-xs font-mono text-gray-500 dark:text-slate-400">
                                                ${currentPrice.toFixed(2)}/mo
                                            </p>
                                        </div>

                                        <ArrowRight className="h-4 w-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />

                                        <div className="flex-1 min-w-0 text-right">
                                            <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider block">
                                                {isUpgrade ? 'Upgrade To' : 'Downgrade To'}
                                            </span>
                                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                {selectedPlan.name}
                                            </p>
                                            <p className="text-xs font-mono font-bold text-primary-600 dark:text-primary-400">
                                                ${targetPrice.toFixed(2)}/mo
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-between w-full">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider block">Plan to Activate</span>
                                            <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                                                {selectedPlan.name}
                                            </p>
                                            <span className="text-xs text-gray-500 dark:text-slate-400">
                                                {selectedPlan.extensions || 1} Extensions • {selectedPlan.free_mins || 0} Free Mins
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-base font-extrabold font-mono text-primary-600 dark:text-primary-400 block">
                                                ${targetPrice.toFixed(2)}/mo
                                            </span>
                                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                                                Initial Activation
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}                        {/* Step 2: Next Billing Cycle Information (only if already has an active plan) */}
                        {currentPlan ? (
                            <div className="space-y-2.5">
                                <label className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-slate-200 flex items-center justify-between">
                                    <span>2. Effective Timing: Next Billing Cycle</span>
                                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
                                        Scheduled Switch
                                    </span>
                                </label>

                                <div className="relative overflow-hidden p-4 rounded-2xl border-2 border-primary-300 dark:border-primary-700/80 bg-gradient-to-br from-primary-50/90 via-primary-50/40 to-white dark:from-primary-950/40 dark:via-slate-900/80 dark:to-slate-900 space-y-3.5 shadow-sm">
                                    <div className="flex items-center gap-3.5">
                                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary-500/25 ring-4 ring-primary-100 dark:ring-primary-950">
                                            <Calendar className="h-5 w-5 stroke-[2.3]" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-sm font-extrabold text-gray-900 dark:text-white block">
                                                Takes Effect on Next Billing Cycle Rollover
                                            </span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Clock className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400 shrink-0" />
                                                <span className="text-xs font-bold text-primary-700 dark:text-primary-300">
                                                    Effective Date: {currentPlan?.next_billing 
                                                        ? new Date(currentPlan.next_billing).toLocaleDateString(undefined, {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        }) 
                                                        : 'Upcoming renewal date'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-primary-200/60 dark:border-primary-900/50 space-y-2 text-xs text-gray-700 dark:text-slate-300">
                                        <div className="flex items-start gap-2.5">
                                            <div className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </div>
                                            <span><strong>Zero charge today:</strong> Your subscription will renew into this new plan for <strong className="font-mono text-gray-900 dark:text-white">${targetPrice.toFixed(2)}/mo</strong> on your next cycle date.</span>
                                        </div>
                                        <div className="flex items-start gap-2.5">
                                            <div className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </div>
                                            <span><strong>Zero downtime or loss:</strong> Your current extension limits and remaining allocated free minutes stay active until rollover.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {isArchived && (
                            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2.5">
                                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                                <span>Cannot assign plan: Target tenant is deactivated/archived.</span>
                            </div>
                        )}

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </div>
                        )}

                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-slate-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all focus:outline-none"
                        >
                            Cancel
                        </button>

                        <button
                            type="button"
                            onClick={handleConfirmSwitch}
                            disabled={submitting || !selectedPlan || isSamePlan || isArchived}
                            title={isArchived ? "Cannot assign plan: Target tenant is deactivated/archived." : undefined}
                            className="inline-flex justify-center items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {currentPlan ? 'Scheduling Switch...' : 'Activating Plan...'}
                                </>
                            ) : isArchived ? (
                                'Tenant Deactivated'
                            ) : !currentPlan ? (
                                'Activate Plan'
                            ) : isSamePlan ? (
                                'Current Plan'
                            ) : (
                                `Schedule ${isUpgrade ? 'Upgrade' : 'Switch'}`
                            )}
                        </button>
                    </div>

                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default PlanSwitchModal;
