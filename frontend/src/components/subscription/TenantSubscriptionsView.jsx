import React, { useState, useEffect } from 'react';
import { 
    Package, 
    CreditCard, 
    Calendar, 
    RefreshCw, 
    ArrowUpDown, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Sparkles, 
    Layers, 
    Trash2,
    Clock,
    Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSubscriptionQuery } from '../../hooks/useBillingQueries';
import { subscriptionService } from '../../services/subscription.service';
import { addonsService } from '../../services/addons.service';
import PlanSwitchModal from './PlanSwitchModal';
import ConfirmActionModal from './ConfirmActionModal';

const TenantSubscriptionsView = ({ onBrowseCatalog, onBrowsePlans }) => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const tenantId = user?.tenantId;

    // Primary Subscription
    const { 
        data: subscription, 
        isLoading: subLoading, 
        isFetching: subFetching, 
        refetch: refetchSubscription 
    } = useSubscriptionQuery();

    // Add-on Subscriptions State
    const [addons, setAddons] = useState([]);
    const [addonsLoading, setAddonsLoading] = useState(false);
    const [togglingPlanAutoRenew, setTogglingPlanAutoRenew] = useState(false);
    const [togglingAddonId, setTogglingAddonId] = useState(null);

    // Plan Switch Modal
    const [planSwitchModalOpen, setPlanSwitchModalOpen] = useState(false);

    // Cancel Addon Modal State
    const [addonToCancel, setAddonToCancel] = useState(null);
    const [cancellingAddon, setCancellingAddon] = useState(false);

    const subscriptionId = subscription?.id || subscription?.subscription_id;

    // Fetch active add-ons when subscription is available
    useEffect(() => {
        if (subscriptionId) {
            fetchSubscriptionAddons(subscriptionId);
        } else {
            setAddons([]);
        }
    }, [subscriptionId]);

    const fetchSubscriptionAddons = async (subId) => {
        setAddonsLoading(true);
        try {
            const data = await addonsService.getSubscriptionAddons(subId);
            setAddons(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch subscription add-ons:', err);
            // Graceful fallback: set empty array if none found
            setAddons([]);
        } finally {
            setAddonsLoading(false);
        }
    };

    const handleRefreshAll = () => {
        refetchSubscription();
        if (subscriptionId) {
            fetchSubscriptionAddons(subscriptionId);
        }
    };

    // Toggle Primary Plan Auto-Renew
    const handleTogglePlanAutoRenew = async () => {
        if (togglingPlanAutoRenew) return;
        const currentVal = !!subscription?.auto_renew;
        const nextVal = !currentVal;

        setTogglingPlanAutoRenew(true);
        try {
            await subscriptionService.toggleAutoRenew(tenantId, nextVal);
            addToast('success', `Plan auto-renew turned ${nextVal ? 'ON' : 'OFF'}`);
            refetchSubscription();
        } catch (err) {
            console.error('Failed to toggle plan auto-renew:', err);
            const msg = err.response?.data?.message || err.normalized?.message || 'Failed to update auto-renew setting';
            addToast('error', msg);
        } finally {
            setTogglingPlanAutoRenew(false);
        }
    };

    // Toggle Add-on Auto-Renew
    const handleToggleAddonAutoRenew = async (addonItem) => {
        const addonSubId = addonItem.id || addonItem.subscription_addon_id;
        if (!addonSubId || togglingAddonId === addonSubId) return;

        const nextVal = !addonItem.auto_renew;
        setTogglingAddonId(addonSubId);

        // Optimistic UI update
        setAddons(prev => prev.map(item => {
            const id = item.id || item.subscription_addon_id;
            return id === addonSubId ? { ...item, auto_renew: nextVal } : item;
        }));

        try {
            await addonsService.toggleAutoRenew(addonSubId, nextVal);
            addToast('success', `Add-on auto-renew turned ${nextVal ? 'ON' : 'OFF'}`);
        } catch (err) {
            console.error('Failed to toggle add-on auto-renew:', err);
            // Revert optimistic update
            setAddons(prev => prev.map(item => {
                const id = item.id || item.subscription_addon_id;
                return id === addonSubId ? { ...item, auto_renew: !nextVal } : item;
            }));
            const msg = err.response?.data?.message || err.normalized?.message || 'Failed to update add-on auto-renew';
            addToast('error', msg);
        } finally {
            setTogglingAddonId(null);
        }
    };

    // Confirm cancel add-on
    const handleConfirmCancelAddon = async () => {
        if (!addonToCancel) return;
        const addonSubId = addonToCancel.id || addonToCancel.subscription_addon_id;
        setCancellingAddon(true);
        try {
            await addonsService.cancelSubscriptionAddon(addonSubId);
            addToast('success', 'Add-on subscription cancelled successfully');
            setAddonToCancel(null);
            if (subscriptionId) {
                fetchSubscriptionAddons(subscriptionId);
            }
        } catch (err) {
            console.error('Failed to cancel addon subscription:', err);
            const msg = err.response?.data?.message || err.normalized?.message || 'Failed to cancel add-on';
            addToast('error', msg);
        } finally {
            setCancellingAddon(false);
        }
    };

    // Calculate days remaining helper
    const getDaysRemaining = (expiryDate) => {
        if (!expiryDate) return null;
        const diffTime = new Date(expiryDate).getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-300">

            {/* Top Toolbar / Refresh Status */}
            <div className="flex items-center justify-between pb-2">
                <div>
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        <CreditCard className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                        Subscription & Recurring Services
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        Manage your active plan, recurring add-ons, and automated renewals
                    </p>
                </div>
                <button
                    onClick={handleRefreshAll}
                    disabled={subFetching || addonsLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-xs disabled:opacity-50"
                    title="Refresh Subscriptions"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${(subFetching || addonsLoading) ? 'animate-spin' : ''}`} />
                    <span>Sync Status</span>
                </button>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 2A: Primary Subscription Table                                    */}
            {/* ========================================================================= */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                            Primary Subscription
                        </h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/80 dark:border-slate-800 overflow-hidden">
                    {subLoading ? (
                        <div className="flex items-center justify-center py-12 gap-3 text-sm text-gray-500 dark:text-slate-400 font-medium">
                            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                            <span>Loading subscription details...</span>
                        </div>
                    ) : !subscription ? (
                        <div className="py-12 px-6 text-center">
                            <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">No Active Subscription Found</h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                                You do not have an active billing plan assigned yet. Choose a plan to unlock PBX features.
                            </p>
                            {onBrowsePlans && (
                                <button
                                    onClick={onBrowsePlans}
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition shadow-sm"
                                >
                                    Browse Plans
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800 text-left">
                                <thead className="bg-gray-50/70 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Plan Name</th>
                                        <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Status</th>
                                        <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Limits & Resources</th>
                                        <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Expiry / Renewal Date</th>
                                        <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Auto-Renew</th>
                                        <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    <tr className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        {/* Plan Name */}
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-200/60 dark:border-primary-800/40 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                                                    <Package className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                                                        {subscription.plan_name || subscription.name || 'Standard Plan'}
                                                    </div>
                                                    <div className="text-[11px] font-mono text-gray-400 dark:text-slate-500">
                                                        ID: {subscription.plan_id || subscription.id || 'primary'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                <CheckCircle2 className="h-3 w-3" />
                                                {subscription.status || 'ACTIVE'}
                                            </span>
                                        </td>

                                        {/* Limits & Resources */}
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300 font-medium">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-mono">
                                                    {subscription?.limits?.extensions ?? 5} Ext
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-mono">
                                                    {subscription?.limits?.free_mins ?? 500} Mins
                                                </span>
                                            </div>
                                        </td>

                                        {/* Expiry Date */}
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            {subscription.next_billing ? (
                                                <div className="space-y-0.5">
                                                    <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                        {new Date(subscription.next_billing).toLocaleDateString(undefined, {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </div>
                                                    {getDaysRemaining(subscription.next_billing) !== null && (
                                                        <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400 flex items-center gap-1">
                                                            <Clock className="h-3 w-3 text-amber-500" />
                                                            {getDaysRemaining(subscription.next_billing) > 0 
                                                                ? `${getDaysRemaining(subscription.next_billing)} days remaining`
                                                                : 'Renews today'}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>

                                        {/* Auto-Renew Toggle */}
                                        <td className="px-6 py-5 whitespace-nowrap text-center">
                                            <div className="inline-flex flex-col items-center gap-1">
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={!!subscription.auto_renew}
                                                    disabled={togglingPlanAutoRenew}
                                                    onClick={handleTogglePlanAutoRenew}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                                                        subscription.auto_renew 
                                                            ? 'bg-primary-600' 
                                                            : 'bg-gray-200 dark:bg-slate-700'
                                                    } ${togglingPlanAutoRenew ? 'opacity-60 cursor-wait' : ''}`}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                            subscription.auto_renew ? 'translate-x-5' : 'translate-x-0'
                                                        }`}
                                                    />
                                                </button>
                                                <span className={`text-[10px] font-bold ${
                                                    subscription.auto_renew 
                                                        ? 'text-primary-600 dark:text-primary-400' 
                                                        : 'text-gray-400 dark:text-slate-500'
                                                }`}>
                                                    {subscription.auto_renew ? 'ON' : 'OFF'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Actions: Upgrade / Downgrade */}
                                        <td className="px-6 py-5 whitespace-nowrap text-right">
                                            <button
                                                type="button"
                                                onClick={() => setPlanSwitchModalOpen(true)}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800 ring-1 ring-inset ring-primary-200 dark:ring-primary-800/40 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition shadow-xs active:scale-95"
                                            >
                                                <ArrowUpDown className="h-3.5 w-3.5" />
                                                <span>Upgrade / Downgrade Plan</span>
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 2B: Add-on Subscriptions Table                                    */}
            {/* ========================================================================= */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <Layers className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
                                Add-on Subscriptions
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                Extra extensions, numbers, and features provisioned for your tenant
                            </p>
                        </div>
                    </div>

                    {onBrowseCatalog && (
                        <button
                            onClick={onBrowseCatalog}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 border border-primary-200/60 dark:border-primary-800/40 hover:bg-primary-100 transition shadow-xs"
                        >
                            <Zap className="h-3.5 w-3.5" />
                            <span>Browse Add-on Catalog</span>
                        </button>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200/80 dark:border-slate-800 overflow-hidden">
                    {addonsLoading ? (
                        <div className="flex items-center justify-center py-12 gap-3 text-sm text-gray-500 dark:text-slate-400 font-medium">
                            <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                            <span>Loading add-on subscriptions...</span>
                        </div>
                    ) : addons.length === 0 ? (
                        <div className="py-12 px-6 text-center">
                            <Layers className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">No Active Add-on Subscriptions</h4>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                                You currently don't have any standalone add-ons. You can purchase additional extensions or DIDs anytime from the catalog.
                            </p>
                            {onBrowseCatalog && (
                                <button
                                    onClick={onBrowseCatalog}
                                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition shadow-xs"
                                >
                                    Get Extra Add-ons
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800 text-left">
                                <thead className="bg-gray-50/70 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Add-on Item</th>
                                        <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Quantity</th>
                                        <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Start Date</th>
                                        <th className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Expiry Date</th>
                                        <th className="px-6 py-4 text-center text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Auto-Renew</th>
                                        <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-slate-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                    {addons.map((addon) => {
                                        const addonSubId = addon.id || addon.subscription_addon_id;
                                        const isToggling = togglingAddonId === addonSubId;
                                        const daysRemaining = getDaysRemaining(addon.expiration_date);

                                        return (
                                            <tr key={addonSubId || addon.addon_id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                {/* Add-on Name */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                                            <Package className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                                {addon.name || addon.addon_id}
                                                            </div>
                                                            <div className="text-[11px] font-mono text-gray-400 dark:text-slate-500">
                                                                {addon.addon_id}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Quantity */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
                                                        × {addon.quantity || 1}
                                                    </span>
                                                </td>

                                                {/* Start Date */}
                                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 dark:text-slate-300 font-medium">
                                                    {addon.created_at ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                            <span>
                                                                {new Date(addon.created_at).toLocaleDateString(undefined, {
                                                                    year: 'numeric',
                                                                    month: 'short',
                                                                    day: 'numeric'
                                                                })}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>

                                                {/* Expiry Date */}
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {addon.expiration_date ? (
                                                        <div className="space-y-0.5">
                                                            <div className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                                <span>
                                                                    {new Date(addon.expiration_date).toLocaleDateString(undefined, {
                                                                        year: 'numeric',
                                                                        month: 'short',
                                                                        day: 'numeric'
                                                                    })}
                                                                </span>
                                                            </div>
                                                            {daysRemaining !== null && (
                                                                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400 flex items-center gap-1">
                                                                    <Clock className="h-3 w-3 text-amber-500" />
                                                                    {daysRemaining > 0 
                                                                        ? `${daysRemaining} days left`
                                                                        : 'Expired'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </td>

                                                {/* Auto-Renew Toggle */}
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="inline-flex flex-col items-center gap-1">
                                                        <button
                                                            type="button"
                                                            role="switch"
                                                            aria-checked={!!addon.auto_renew}
                                                            disabled={isToggling}
                                                            onClick={() => handleToggleAddonAutoRenew(addon)}
                                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                                                                addon.auto_renew 
                                                                    ? 'bg-primary-600' 
                                                                    : 'bg-gray-200 dark:bg-slate-700'
                                                            } ${isToggling ? 'opacity-60 cursor-wait' : ''}`}
                                                        >
                                                            <span
                                                                aria-hidden="true"
                                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                                    addon.auto_renew ? 'translate-x-5' : 'translate-x-0'
                                                                }`}
                                                            />
                                                        </button>
                                                        <span className={`text-[10px] font-bold ${
                                                            addon.auto_renew 
                                                                ? 'text-primary-600 dark:text-primary-400' 
                                                                : 'text-gray-400 dark:text-slate-500'
                                                        }`}>
                                                            {addon.auto_renew ? 'ON' : 'OFF'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setAddonToCancel(addon)}
                                                        title="Cancel Add-on"
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 transition"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        <span>Cancel</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Plan Switch Modal */}
            <PlanSwitchModal
                isOpen={planSwitchModalOpen}
                onClose={() => setPlanSwitchModalOpen(false)}
                currentPlan={subscription}
                customerId={tenantId}
                onSuccess={handleRefreshAll}
            />

            {/* Cancel Add-on Confirmation Modal */}
            <ConfirmActionModal
                isOpen={!!addonToCancel}
                onClose={() => setAddonToCancel(null)}
                onConfirm={handleConfirmCancelAddon}
                title="Cancel Add-on Subscription"
                message={`Are you sure you want to cancel the add-on "${addonToCancel?.name || addonToCancel?.addon_id}"? This item will not renew at expiration.`}
                confirmText="Confirm Cancel"
                cancelText="Keep Add-on"
                isDanger={true}
                loading={cancellingAddon}
            />

        </div>
    );
};

export default TenantSubscriptionsView;
