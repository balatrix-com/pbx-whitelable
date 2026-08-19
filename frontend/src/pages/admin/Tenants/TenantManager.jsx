import React, { useState, useEffect } from 'react';
import { X, Wallet, Phone, Users, Info, Building2, Plus, Trash2, Loader, CreditCard, RefreshCw, User, LogIn, Sliders, ShieldAlert, Clock, Server, Mic, Zap, Loader2, Radio, HardDrive, Activity, Package } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import MonitoringExtensionModal from '../../../components/admin/MonitoringExtensionModal';
import { formatCustomerId } from '../../../utils/billing.utils';
import { subscriptionService } from '../../../services/subscription.service';
import AddonPurchaseModal from '../../../components/subscription/AddonPurchaseModal';

const TABS = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'numbers', label: 'Numbers', icon: Phone },
    { id: 'extensions', label: 'Extensions', icon: Users },
    { id: 'users', label: 'Users', icon: User },
    { id: 'features', label: 'Feature Controller', icon: Sliders },
    { id: 'carrier', label: 'Outbound Carrier', icon: Server },
    { id: 'addons', label: 'Add-ons', icon: CreditCard },
];

const TenantManager = ({ tenantId, onClose }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [tenant, setTenant] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch tenant details on mount and refresh
    useEffect(() => {
        fetchTenantDetails();
    }, [tenantId, refreshTrigger]);

    const fetchTenantDetails = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/tenants/${tenantId}`);
            setTenant(res.data);
        } catch (err) {
            console.error('Failed to fetch tenant details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

    if (loading && !tenant) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl"><Loader className="animate-spin" /></div>
            </div>
        );
    }

    if (!tenant) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-gray-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary-50 p-2.5 rounded-xl ring-1 ring-inset ring-primary-100 shadow-sm">
                            <Building2 className="text-primary-600 h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{tenant.name}</h2>
                            <p className="text-sm font-mono text-gray-500 font-medium">ID: {tenant.id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-56 bg-gray-50/50 border-r border-gray-100 flex flex-col p-4 space-y-1.5 shrink-0 overflow-y-auto">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-extrabold transition-all ${isActive
                                        ? 'bg-indigo-600 text-white shadow-md font-bold'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                                        }`}
                                >
                                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-white">
                        {activeTab === 'overview' && <OverviewTab tenant={tenant} />}
                        {activeTab === 'wallet' && <WalletTab tenant={tenant} onUpdate={handleRefresh} />}
                        {activeTab === 'numbers' && <NumbersTab tenant={tenant} onUpdate={handleRefresh} />}
                        {activeTab === 'extensions' && <ExtensionsTab tenant={tenant} onUpdate={handleRefresh} />}
                        {activeTab === 'users' && <UsersTab tenant={tenant} />}
                        {activeTab === 'features' && <FeaturesTab tenant={tenant} onUpdate={handleRefresh} />}
                        {activeTab === 'carrier' && <CarrierTab tenant={tenant} onUpdate={handleRefresh} />}
                        {activeTab === 'addons' && <AddonsTab tenant={tenant} onUpdate={handleRefresh} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Sub-Components ---

const OverviewTab = ({ tenant }) => (
    <div className="space-y-6 max-w-4xl">
        <div>
            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Organization Overview</h3>
            <p className="text-sm font-medium text-gray-500 mt-1">Core platform details and system status for this tenant.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-gray-200/50 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="relative z-10">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                        Company Code
                    </div>
                    <p className="text-2xl font-mono font-extrabold text-gray-900">{formatCustomerId(tenant.customerCode)}</p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-gray-200/50 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="relative z-10">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-500"></div>
                        Created At
                    </div>
                    <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
                        {new Date(tenant.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-gray-200/50 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="relative z-10">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${tenant.serviceBlocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
                        System Status
                    </div>
                    <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ring-1 ring-inset uppercase tracking-wider ${tenant.serviceBlocked ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-green-50 text-green-700 ring-green-600/20'
                            }`}>
                            {tenant.serviceBlocked ? 'Blocked' : 'Active'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-gray-200/50 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="relative z-10">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                        Total Users
                    </div>
                    <p className="text-2xl font-extrabold text-gray-900 font-mono tracking-tight">{tenant.stats?.users || 0}</p>
                </div>
            </div>
        </div>
    </div>
);

const WalletTab = ({ tenant, onUpdate }) => {
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('CREDIT');
    const [description, setDescription] = useState('Admin adjustment');
    const [loading, setLoading] = useState(false);

    const [creditLimitInput, setCreditLimitInput] = useState('');
    const [creditLimitLoading, setCreditLimitLoading] = useState(false);

    // Sync input value with current creditLimit when tenant changes
    useEffect(() => {
        if (tenant?.wallet?.creditLimit !== undefined) {
            setCreditLimitInput(String(tenant.wallet.creditLimit));
        }
    }, [tenant]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/wallet/internal-adjust', {
                targetTenantId: tenant.id,
                amount: Number(amount),
                type,
                description
            });
            setAmount('');
            onUpdate();
        } catch (err) {
            alert('Failed to update wallet: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCreditLimitSubmit = async (e) => {
        e.preventDefault();
        setCreditLimitLoading(true);
        try {
            await api.post('/wallet/credit-limit', {
                targetTenantId: tenant.id,
                creditLimit: Number(creditLimitInput)
            });
            onUpdate();
        } catch (err) {
            alert('Failed to update credit limit: ' + (err.response?.data?.message || err.message));
        } finally {
            setCreditLimitLoading(false);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex sm:justify-between sm:items-center flex-col sm:flex-row gap-4">
                <div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Wallet Management</h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">Adjust tenant funds and view balance.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white px-5 py-3 rounded-2xl shadow-sm ring-1 ring-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 text-right">Current Balance</p>
                        <p className={`text-3xl font-mono font-extrabold tracking-tight ${Number(tenant.wallet?.balance || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${Number(tenant.wallet?.balance || 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white px-5 py-3 rounded-2xl shadow-sm ring-1 ring-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 text-right">Credit Limit</p>
                        <p className="text-3xl font-mono font-extrabold tracking-tight text-gray-900">
                            ${Number(tenant.wallet?.creditLimit || 0).toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Administrative Adjustment Card */}
                <div className="bg-gray-50/50 p-6 sm:p-8 rounded-2xl ring-1 ring-inset ring-gray-100 shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <h4 className="text-base font-extrabold text-gray-900 mb-6 flex items-center gap-2 tracking-tight">
                            <CreditCard className="h-5 w-5 text-primary-500" /> Administrative Adjustment
                        </h4>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Transaction Type</label>
                                    <select
                                        className="block w-full rounded-xl border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-white transition-all"
                                        value={type}
                                        onChange={e => setType(e.target.value)}
                                    >
                                        <option value="CREDIT">Add Credit (Deposit)</option>
                                        <option value="DEBIT">Remove Credit (Charge)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Amount</label>
                                    <div className="relative rounded-md shadow-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <span className="text-gray-500 sm:text-sm font-medium">$</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            className="block w-full rounded-xl border-0 py-2.5 pl-7 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-white transition-all font-mono"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Description (Internal Note)</label>
                                <input
                                    type="text"
                                    required
                                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-white transition-all"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="E.g., Platform fee adjustment"
                                />
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="inline-flex justify-center items-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <><Loader className="animate-spin -ml-1 mr-2 h-4 w-4" /> Processing...</>
                                    ) : (
                                        'Process Transaction'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Edit Credit Limit Card */}
                <div className="bg-gray-50/50 p-6 sm:p-8 rounded-2xl ring-1 ring-inset ring-gray-100 shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <h4 className="text-base font-extrabold text-gray-900 mb-6 flex items-center gap-2 tracking-tight">
                            <CreditCard className="h-5 w-5 text-primary-500" /> Credit Limit Control
                        </h4>
                        <form onSubmit={handleCreditLimitSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Tenant Credit Limit</label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <span className="text-gray-500 sm:text-sm font-medium">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        className="block w-full rounded-xl border-0 py-2.5 pl-7 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-white transition-all font-mono"
                                        value={creditLimitInput}
                                        onChange={e => setCreditLimitInput(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Determines how much negative balance this tenant is permitted before outbound services are restricted.
                                </p>
                            </div>
                            <div className="flex justify-end pt-8">
                                <button
                                    type="submit"
                                    disabled={creditLimitLoading}
                                    className="inline-flex justify-center items-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {creditLimitLoading ? (
                                        <><Loader className="animate-spin -ml-1 mr-2 h-4 w-4" /> Updating...</>
                                    ) : (
                                        'Update Credit Limit'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

const NumbersTab = ({ tenant, onUpdate }) => {
    const [tfns, setTfns] = useState([]);
    const [dids, setDids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showTfnSelector, setShowTfnSelector] = useState(false);

    // Add DID state
    const [showDidForm, setShowDidForm] = useState(false);
    const [newDid, setNewDid] = useState({ didNumber: '' });

    useEffect(() => {
        fetchNumbers();
    }, [tenant.id]);

    const fetchNumbers = async () => {
        setLoading(true);
        try {
            const [tfnRes, didRes] = await Promise.all([
                api.get(`/telecom/tfns?tenantId=${tenant.id}`),
                api.get(`/telecom/dids?tenantId=${tenant.id}`)
            ]);
            setTfns(tfnRes.data);
            setDids(didRes.data);
        } catch (err) {
            console.error('Failed to fetch numbers', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDid = async (e) => {
        e.preventDefault();
        try {
            await api.post('/telecom/dids', {
                didNumber: newDid.didNumber,
                targetTenantId: tenant.id
            });
            setShowDidForm(false);
            setNewDid({ didNumber: '' });
            fetchNumbers();
            onUpdate();
        } catch (err) {
            console.error('Failed to add DID:', err);
            const res = err.response?.data;
            let msg = 'Failed to add DID';
            if (res) {
                if (typeof res === 'string') msg = res;
                else if (res.message) {
                    if (Array.isArray(res.message)) msg = res.message.join(', ');
                    else if (typeof res.message === 'object') msg = JSON.stringify(res.message);
                    else msg = res.message;
                }
                else if (res.error) msg = res.error;
            }
            alert(msg);
        }
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Phone Numbers</h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">Manage DIDs and Toll-Free Numbers.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowTfnSelector(true)}
                        className="inline-flex justify-center items-center rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500 gap-1.5"
                    >
                        <Plus size={16} className="text-gray-400" /> TFN
                    </button>
                    <button
                        onClick={() => setShowDidForm(true)}
                        className="inline-flex justify-center items-center rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500 gap-1.5"
                    >
                        <Plus size={16} className="text-gray-400" /> DID
                    </button>
                    <button
                        onClick={fetchNumbers}
                        className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* DIDs List */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Phone size={14} className="text-gray-400" /> Local/Mobile Numbers (DIDs)
                    </h4>
                </div>
                <div className="p-5">
                    {dids.length === 0 ? (
                        <div className="text-center py-8">
                            <Phone className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                            <p className="text-sm font-medium text-gray-500">No DIDs assigned.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {dids.map(did => (
                                <div key={did.id} className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                    <span className="font-mono font-bold text-sm text-gray-900">{did.number}</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset uppercase tracking-wider bg-gray-50 text-gray-600 ring-gray-500/10">
                                        {did.routeType || 'Unassigned'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* TFNs List */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden mt-6">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Phone size={14} className="text-gray-400" /> Toll-Free Numbers
                    </h4>
                </div>
                <div className="p-5">
                    {tfns.length === 0 ? (
                        <div className="text-center py-8">
                            <Phone className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                            <p className="text-sm font-medium text-gray-500">No TFNs assigned.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {tfns.map(tfn => (
                                <div key={tfn.id} className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all group bg-blue-50/10">
                                    <span className="font-mono font-bold text-sm text-blue-700">{tfn.number}</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset uppercase tracking-wider ${tfn.status === 'ACTIVE' ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-gray-50 text-gray-600 ring-gray-500/10'
                                        }`}>
                                        {tfn.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals/Forms Overlay logic would go here, simplified for now */}
            {showTfnSelector && (
                <TfnSelector
                    tenantId={tenant.id}
                    onClose={() => setShowTfnSelector(false)}
                    onSuccess={() => { setShowTfnSelector(false); fetchNumbers(); onUpdate(); }}
                />
            )}

            {showDidForm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowDidForm(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col ring-1 ring-gray-200 p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h4 className="text-lg font-extrabold text-gray-900 tracking-tight">Add New DID</h4>
                            <button onClick={() => setShowDidForm(false)} className="rounded-xl p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateDid} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Number</label>
                                <input
                                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-white transition-all font-mono"
                                    placeholder="+1..."
                                    value={newDid.didNumber}
                                    onChange={e => setNewDid({ ...newDid, didNumber: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="bg-blue-50/50 p-3 rounded-xl ring-1 ring-inset ring-blue-100">
                                <p className="text-xs font-medium text-blue-700 flex items-start gap-1.5">
                                    <Info size={14} className="mt-0.5 shrink-0" />
                                    Routing will be configured by the customer.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDidForm(false)}
                                    className="inline-flex justify-center items-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98] focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex justify-center items-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    Add DID
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const ExtensionsTab = ({ tenant, onUpdate }) => {
    const [extensions, setExtensions] = useState([]);
    const [monitoringUsers, setMonitoringUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newExt, setNewExt] = useState({ name: '', password: '' });
    const [predictedExt, setPredictedExt] = useState('...');

    // Monitoring Edit State
    const [showMonitoringModal, setShowMonitoringModal] = useState(false);
    const [selectedMonitoringUser, setSelectedMonitoringUser] = useState(null);

    useEffect(() => {
        fetchExtensions();
    }, [tenant.id]);

    // Fetch the real next extension number from the backend whenever the Add modal opens
    useEffect(() => {
        if (!showAdd) return;
        const fetchNextNumber = async () => {
            try {
                const res = await api.get('/telecom/extensions/next-number', { params: { tenantId: tenant.id } });
                if (res.data.nextExtensionNumber) {
                    setPredictedExt(res.data.nextExtensionNumber.toString());
                }
            } catch (err) {
                console.error('Failed to fetch next extension number', err);
            }
        };
        fetchNextNumber();
    }, [showAdd, tenant.id]);

    const fetchExtensions = async () => {
        setLoading(true);
        try {
            const [extRes, usersRes] = await Promise.all([
                api.get(`/telecom/extensions?tenantId=${tenant.id}`),
                api.get(`/users?tenantId=${tenant.id}`)
            ]);

            setExtensions(extRes.data);

            // Filter users for monitoring extensions
            const users = usersRes.data.data || [];
            const monitoring = users.filter(u => u.monitoringEnabled && u.monitoringExtension);
            setMonitoringUsers(monitoring);
        } catch (err) {
            console.error('Failed to fetch extensions', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddExtension = async (e) => {
        e.preventDefault();
        try {
            await api.post('/telecom/extensions', {
                targetTenantId: tenant.id,
                name: newExt.name,
                password: newExt.password
            });
            setShowAdd(false);
            setNewExt({ name: '', password: '' });
            fetchExtensions();
            onUpdate();
        } catch (err) {
            alert('Failed to add extension: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleEditMonitoring = (user) => {
        setSelectedMonitoringUser(user);
        setShowMonitoringModal(true);
    };

    const handleUpdateMonitoring = async ({ monitoringExtension, monitoringSecret, name }) => {
        if (!selectedMonitoringUser) return;
        try {
            await api.patch(`/users/${selectedMonitoringUser.id}/permissions`, {
                monitoringEnabled: true,
                monitoringExtension,
                monitoringSecret,
                name
            });
            setShowMonitoringModal(false);
            setSelectedMonitoringUser(null);
            fetchExtensions(); // Refresh
        } catch (err) {
            console.error("Failed to update monitoring user", err);
            alert("Failed to update: " + (err.response?.data?.message || err.message));
        }
    };

    const handleDisableMonitoring = async (user) => {
        if (!window.confirm(`Are you sure you want to disable monitoring for ${user.name || user.email}?`)) {
            return;
        }

        try {
            await api.patch(`/users/${user.id}/permissions`, {
                monitoringEnabled: false,
                monitoringExtension: null, // Clear these too nicely
                monitoringSecret: null
            });
            fetchExtensions();
        } catch (err) {
            console.error('Failed to disable monitoring:', err);
            alert('Failed to disable monitoring: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDeleteExtension = async (extension) => {
        if (!window.confirm(`Are you sure you want to delete extension ${extension.extensionNumber}?`)) {
            return;
        }

        try {
            await api.delete(`/telecom/extensions/${extension.id}`, {
                params: { tenantId: tenant.id }
            });
            fetchExtensions();
            onUpdate();
        } catch (err) {
            console.error('Failed to delete extension:', err);
            alert('Failed to delete extension: ' + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Extensions</h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">Manage standard and monitoring lines.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAdd(true)}
                        className="inline-flex justify-center items-center rounded-xl bg-primary-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500 gap-1.5"
                    >
                        <Plus size={16} /> Add Extension
                    </button>
                    <button
                        onClick={fetchExtensions}
                        className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader className="animate-spin text-primary-600 h-8 w-8" />
                </div>
            ) : (
                <>
                    {/* Standard Extensions list */}
                    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Users size={14} className="text-gray-400" /> Standard Extensions
                            </h4>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {extensions.length === 0 ? <div className="col-span-full text-center py-6 text-sm font-medium text-gray-500">No standard extensions found.</div> :
                                    extensions.map(ext => (
                                        <div key={ext.id} className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                            <div>
                                                <span className="font-mono font-extrabold text-sm text-gray-900 mr-2">{ext.extensionNumber}</span>
                                                <span className="text-sm font-medium text-gray-600">{ext.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 px-2 py-0.5 rounded ring-1 ring-inset ring-gray-500/10">
                                                    {ext.ringGroupMembers?.length > 0 ? 'Ring Grp' : 'Std'}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteExtension(ext)}
                                                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:outline-none"
                                                    title="Delete Extension"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>

                    {/* Monitoring Extensions Section */}
                    {monitoringUsers.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden mt-6">
                            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Info size={14} className="text-blue-500" /> Monitoring Extensions
                                </h4>
                            </div>
                            <div className="p-5">
                                <div className="space-y-3 max-w-2xl">
                                    {monitoringUsers.map(user => (
                                        <div key={user.id} className="flex justify-between items-center bg-blue-50/30 p-4 rounded-xl ring-1 ring-inset ring-blue-100 shadow-sm hover:shadow-md transition-all">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono font-extrabold text-sm text-blue-900">{user.monitoringExtension}</span>
                                                    <span className="text-sm font-bold text-blue-800">{user.name || 'Unnamed'}</span>
                                                </div>
                                                <p className="text-xs font-medium text-blue-600/80">{user.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEditMonitoring(user)}
                                                    className="inline-flex justify-center items-center rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-blue-700 shadow-sm ring-1 ring-inset ring-blue-200 hover:bg-blue-50 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDisableMonitoring(user)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none"
                                                    title="Disable Monitoring"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {showAdd && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowAdd(false)}></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col ring-1 ring-gray-200 p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h4 className="text-lg font-extrabold text-gray-900 tracking-tight">Add Extension</h4>
                            <button onClick={() => setShowAdd(false)} className="rounded-xl p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddExtension} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Predicted Number</label>
                                <input
                                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-gray-500 shadow-sm ring-1 ring-inset ring-gray-200 bg-gray-50 sm:text-sm font-medium font-mono cursor-not-allowed"
                                    disabled
                                    value={predictedExt}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Name</label>
                                <input
                                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-white transition-all"
                                    placeholder="E.g., Support Team"
                                    value={newExt.name}
                                    onChange={e => setNewExt({ ...newExt, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">SIP Password</label>
                                <input
                                    className="block w-full rounded-xl border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-white transition-all font-mono"
                                    placeholder="Secure password"
                                    type="text"
                                    value={newExt.password}
                                    onChange={e => setNewExt({ ...newExt, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAdd(false)}
                                    className="inline-flex justify-center items-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98] focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex justify-center items-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    Create Extension
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showMonitoringModal && selectedMonitoringUser && (
                <MonitoringExtensionModal
                    onClose={() => {
                        setShowMonitoringModal(false);
                        setSelectedMonitoringUser(null);
                    }}
                    onSubmit={handleUpdateMonitoring}
                    initialExtension={selectedMonitoringUser.monitoringExtension}
                    initialSecret={selectedMonitoringUser.monitoringSecret}
                    initialName={selectedMonitoringUser.name}
                    isEditing={true}
                    tenantId={tenant.id}
                />
            )}
        </div>
    );
};

// Helper for TFN selection (Reusing logic from Wizard somewhat)
const TfnSelector = ({ tenantId, onClose, onSuccess }) => {
    const [available, setAvailable] = useState([]);
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/telecom/tfns/available').then(res => {
            setAvailable(res.data);
            setLoading(false);
        });
    }, []);

    const handleAssign = async () => {
        if (selected.length === 0) return;
        setLoading(true);
        try {
            for (const id of selected) {
                await api.post(`/telecom/tfns/${id}/assign`, { tenantId });
            }
            onSuccess();
        } catch (err) {
            alert('Failed to assign TFNs');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-[550px] max-h-[85vh] flex flex-col ring-1 ring-gray-200">
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <h4 className="text-lg font-extrabold text-gray-900 tracking-tight">Assign TFNs</h4>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    {available.length === 0 ? (
                        <div className="text-center py-12">
                            <Phone className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                            <p className="text-sm font-medium text-gray-500">No available TFNs in inventory.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12">
                                            {/* Select All could go here */}
                                        </th>
                                        <th scope="col" className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                            Number
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {available.map(tfn => (
                                        <tr key={tfn.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                                                    checked={selected.includes(tfn.id)}
                                                    onChange={e => {
                                                        if (e.target.checked) setSelected(prev => [...prev, tfn.id]);
                                                        else setSelected(prev => prev.filter(id => id !== tfn.id));
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-sm text-gray-900">
                                                {tfn.number}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="inline-flex justify-center items-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all active:scale-[0.98] focus:outline-none"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={selected.length === 0 || loading}
                        className="inline-flex justify-center items-center rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <><Loader className="animate-spin -ml-1 mr-2 h-4 w-4" /> Assigning...</>
                        ) : (
                            `Assign ${selected.length} Numbers`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UsersTab = ({ tenant }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { } = useAuth(); // No longer needed for impersonation, but maybe for other things? 
    // actually we don't need useAuth here anymore if we use api directly.
    // But let's check if it was used elsewhere in the file.
    // It is imported at top.
    // UsersTab uses it.
    // Let's just remove the destructuring of impersonateUser.
    const [impersonatingId, setImpersonatingId] = useState(null);
    const [showMonitoringModal, setShowMonitoringModal] = useState(false);
    const [monitoringTarget, setMonitoringTarget] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, [tenant.id]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/users?tenantId=${tenant.id}`);
            setUsers(res.data.data);
        } catch (err) {
            console.error('Failed to fetch users', err);
        } finally {
            setLoading(false);
        }
    };

    const handleImpersonate = async (userId) => {
        if (!window.confirm('Open impersonation session in a new tab?')) return;

        setImpersonatingId(userId);
        try {
            const response = await api.post(`/users/impersonate/${userId}`);
            const { accessToken, refreshToken } = response.data;
            const url = `/impersonate?token=${accessToken}&refresh=${refreshToken}`;
            window.open(url, '_blank');
        } catch (err) {
            alert('Impersonation failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setImpersonatingId(null);
        }
    };

    const handleToggleMonitoring = async (user, currentValue) => {
        if (!currentValue) {
            setMonitoringTarget(user.id);
            setShowMonitoringModal(true);
        } else {
            try {
                await api.patch(`/users/${user.id}/permissions`, { monitoringEnabled: false });
                fetchUsers();
            } catch (err) {
                console.error('Failed to disable monitoring', err);
            }
        }
    };

    const handleEnableMonitoring = async ({ monitoringExtension, monitoringSecret, name }) => {
        if (!monitoringTarget) return;
        try {
            await api.patch(`/users/${monitoringTarget}/permissions`, {
                monitoringEnabled: true,
                monitoringExtension,
                monitoringSecret,
                name
            });
            setShowMonitoringModal(false);
            setMonitoringTarget(null);
            fetchUsers();
        } catch (err) {
            console.error('Failed to enable monitoring', err);
            alert('Failed to enable monitoring: ' + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <div>
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Users</h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">Manage users and impersonation sessions.</p>
                </div>
                <button
                    onClick={fetchUsers}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader className="animate-spin text-primary-600 h-8 w-8" />
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden text-left">
                    {users.length === 0 ? (
                        <div className="text-center py-12">
                            <User className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                            <p className="text-sm font-medium text-gray-500">No users found for this tenant.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {users.map(user => (
                                <div key={user.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors group">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-gray-100 h-10 w-10 rounded-full flex items-center justify-center shrink-0 ring-1 ring-inset ring-gray-200">
                                            <span className="text-sm font-extrabold text-gray-600">
                                                {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-extrabold text-sm text-gray-900">{user.name || 'Unnamed User'}</span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${user.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 ring-purple-600/20' :
                                                    user.role === 'SUPPORT' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                        'bg-gray-50 text-gray-600 ring-gray-500/10'
                                                    }`}>
                                                    {user.role}
                                                </span>
                                            </div>
                                            <p className="text-xs font-medium text-gray-500">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 mt-2 sm:mt-0">
                                        <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={user.monitoringEnabled || false}
                                                    onChange={() => handleToggleMonitoring(user, user.monitoringEnabled)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600 transition-colors"></div>
                                            </div>
                                            <span className="text-xs font-bold text-gray-600 group-hover/toggle:text-gray-900 transition-colors">
                                                Monitoring
                                            </span>
                                        </label>
                                        <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
                                        <button
                                            onClick={() => handleImpersonate(user.id)}
                                            disabled={impersonatingId === user.id}
                                            className="inline-flex justify-center items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-primary-600 shadow-sm ring-1 ring-inset ring-primary-200 hover:bg-primary-50 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {impersonatingId === user.id ? <Loader className="animate-spin h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                                            Impersonate
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showMonitoringModal && monitoringTarget && (
                <MonitoringExtensionModal
                    onClose={() => {
                        setShowMonitoringModal(false);
                        setMonitoringTarget(null);
                    }}
                    onSubmit={handleEnableMonitoring}
                    tenantId={tenant.id}
                />
            )}
        </div>
    );
};

const FeaturesTab = ({ tenant, onUpdate }) => {
    const [features, setFeatures] = useState(tenant.tenantFeatures || {
        ivrEnabled: true,
        ivrLimit: 10,
        ringGroupEnabled: true,
        ringGroupLimit: 10,
        schedulerEnabled: true,
        schedulerLimit: 10,
        didForwardEnabled: true,
        didForwardLimit: 10,
        monitorEnabled: true,
        monitorLimit: 10,
    });
    const [updatingFeature, setUpdatingFeature] = useState(null);

    // Keep state in sync if tenant prop updates
    useEffect(() => {
        if (tenant.tenantFeatures) {
            setFeatures(tenant.tenantFeatures);
        }
    }, [tenant.tenantFeatures]);

    const handleToggle = async (key) => {
        setUpdatingFeature(key);
        const updatedFeatures = {
            ...features,
            [key]: !features[key]
        };
        try {
            await api.patch(`/tenants/${tenant.id}/features`, updatedFeatures);
            setFeatures(updatedFeatures);
            onUpdate(); // refresh parent details
        } catch (err) {
            console.error('Failed to update tenant features:', err);
            alert('Failed to update tenant features');
        } finally {
            setUpdatingFeature(null);
        }
    };

    const handleLimitChange = async (limitKey, value) => {
        const intValue = parseInt(value, 10);
        if (isNaN(intValue) || intValue < 0) return;

        setUpdatingFeature(limitKey);
        const updatedFeatures = {
            ...features,
            [limitKey]: intValue
        };
        try {
            await api.patch(`/tenants/${tenant.id}/features`, { [limitKey]: intValue });
            setFeatures(updatedFeatures);
            onUpdate(); // refresh parent details
        } catch (err) {
            console.error('Failed to update tenant feature limit:', err);
            alert('Failed to update tenant feature limit');
        } finally {
            setUpdatingFeature(null);
        }
    };

    const FEATURE_ITEMS = [
        {
            key: 'ivrEnabled',
            limitKey: 'ivrLimit',
            title: 'Interactive Voice Response (IVR)',
            description: 'Enable multi-level auto-attendant phone menus and call routing prompts.',
            icon: Phone,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
        },
        {
            key: 'ringGroupEnabled',
            limitKey: 'ringGroupLimit',
            title: 'Ring Groups',
            description: 'Group extensions together to ring sequentially or simultaneously for incoming calls.',
            icon: Users,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        },
        {
            key: 'schedulerEnabled',
            limitKey: 'schedulerLimit',
            title: 'Operational Schedules (Scheduler)',
            description: 'Route calls automatically based on operational business hours, holidays, and times.',
            icon: Clock,
            color: 'text-amber-600 bg-amber-50 border-amber-100',
        },
        {
            key: 'didForwardEnabled',
            limitKey: 'didForwardLimit',
            title: 'DID Forwarding',
            description: 'Directly forward incoming phone numbers to external lines or specific destinations.',
            icon: Phone,
            color: 'text-sky-600 bg-sky-50 border-sky-100',
        },
        {
            key: 'monitorEnabled',
            limitKey: 'monitorLimit',
            title: 'Active Call Monitoring (Barge/Listen)',
            description: 'Allows administrators to view real-time calls, listen-in, whisper, or barge into active conversations.',
            icon: ShieldAlert,
            color: 'text-rose-600 bg-rose-50 border-rose-100',
        },
        {
            key: 'recordingAllowed',
            title: 'Call Recording Permission',
            description: 'Allow tenant administrators to toggle automatic call recording for extensions.',
            icon: Mic,
            color: 'text-violet-600 bg-violet-50 border-violet-100',
        },
    ];

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <div className="text-left">
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Feature Controller</h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">Control active features and set creation limits for this tenant.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {FEATURE_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isEnabled = features[item.key];
                    const isUpdating = updatingFeature === item.key || updatingFeature === item.limitKey;
                    const limitVal = features[item.limitKey] ?? 10;

                    return (
                        <div
                            key={item.key}
                            className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-sm ${isEnabled
                                ? 'bg-white border-gray-200'
                                : 'bg-gray-50/50 border-gray-100 opacity-75'
                                }`}
                        >
                            <div className="flex items-start gap-4 flex-1">
                                <div className={`p-3 rounded-xl border shrink-0 ${item.color}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div className="text-left flex-1">
                                    <h4 className="font-extrabold text-gray-900 text-sm tracking-tight">{item.title}</h4>
                                    <p className="text-xs font-medium text-gray-500 mt-1 leading-relaxed max-w-xl">{item.description}</p>

                                    {isEnabled && item.limitKey && (
                                        <div className="mt-3 flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100 inline-flex">
                                            <span className="text-xs font-bold text-gray-700">Creation Limit:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={limitVal}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFeatures(prev => ({
                                                        ...prev,
                                                        [item.limitKey]: val === '' ? '' : parseInt(val, 10)
                                                    }));
                                                }}
                                                onBlur={(e) => {
                                                    const val = e.target.value;
                                                    const intVal = val === '' ? 10 : parseInt(val, 10);
                                                    handleLimitChange(item.limitKey, intVal);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = e.target.value;
                                                        const intVal = val === '' ? 10 : parseInt(val, 10);
                                                        handleLimitChange(item.limitKey, intVal);
                                                        e.target.blur();
                                                    }
                                                }}
                                                disabled={isUpdating}
                                                className="w-16 px-2 py-1 text-xs font-extrabold text-gray-800 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center shadow-sm"
                                            />
                                            <span className="text-[10px] text-gray-400 font-bold">resources</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center shrink-0 justify-end">
                                <button
                                    onClick={() => !isUpdating && handleToggle(item.key)}
                                    disabled={isUpdating}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${isEnabled ? 'bg-primary-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${isEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                    >
                                        {isUpdating && <Loader className="animate-spin h-3 w-3 text-primary-600" />}
                                    </span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CarrierTab = ({ tenant, onUpdate }) => {
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEndpointId, setSelectedEndpointId] = useState(tenant.outboundEndpointId || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/carriers').then(res => {
            setCarriers(res.data);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            if (selectedEndpointId) {
                await api.put(`/tenants/${tenant.id}/outbound-endpoint`, { endpointId: Number(selectedEndpointId) });
            } else {
                await api.delete(`/tenants/${tenant.id}/outbound-endpoint`);
            }
            onUpdate();
            alert('Carrier routing updated successfully.');
        } catch (error) {
            alert('Failed to update carrier routing');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading carriers...</div>;

    return (
        <div className="space-y-8 max-w-4xl">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <div className="text-left">
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Outbound Carrier Routing</h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">Select the default outbound carrier endpoint for this tenant's calls.</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <label className="block text-sm font-bold text-gray-700 mb-2">Select Endpoint</label>
                <select
                    className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-3 border"
                    value={selectedEndpointId}
                    onChange={(e) => setSelectedEndpointId(e.target.value)}
                >
                    <option value="">-- No Carrier Assigned (Uses Default/Local) --</option>
                    {carriers.map(c => (
                        <optgroup key={c.id} label={c.name}>
                            {c.endpoints.map(ep => (
                                <option key={ep.id} value={ep.id}>
                                    {ep.name} ({ep.sipHost}:{ep.sipPort})
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>

                <div className="mt-6">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary-600 text-white px-4 py-2 rounded-xl font-bold disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AddonsTab = ({ tenant, onUpdate }) => {
    const { addToast } = useToast();
    const [catalog, setCatalog] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [quantityMap, setQuantityMap] = useState({});
    const [quotingAddonId, setQuotingAddonId] = useState(null);
    const [quoteData, setQuoteData] = useState(null);
    const [addonModalOpen, setAddonModalOpen] = useState(false);

    useEffect(() => {
        loadCatalog();
    }, [tenant?.id]);

    const loadCatalog = async () => {
        setCatalogLoading(true);
        try {
            const addonsData = await subscriptionService.getCatalog();
            setCatalog(addonsData || []);
        } catch (err) {
            console.error('Failed to load add-on catalog:', err);
            if (addToast) addToast('error', 'Failed to load add-ons');
        } finally {
            setCatalogLoading(false);
        }
    };

    const getQuantity = (addonId) => quantityMap[addonId] || 1;

    const handleQuantityChange = (addonId, val) => {
        const q = Math.max(1, parseInt(val, 10) || 1);
        setQuantityMap((prev) => ({ ...prev, [addonId]: q }));
    };

    const getAddonIcon = (addonType = '') => {
        const type = String(addonType).toLowerCase();
        const iconClasses = "h-5 w-5 text-indigo-600";
        switch (type) {
            case 'ext':
            case 'extension':
                return <Radio className={iconClasses} />;
            case 'tfn':
            case 'did':
                return <Phone className={iconClasses} />;
            case 'storage':
                return <HardDrive className={iconClasses} />;
            case 'mon':
                return <Activity className={iconClasses} />;
            default:
                return <Package className={iconClasses} />;
        }
    };

    const handleGetQuote = async (addon) => {
        const qty = getQuantity(addon.addon_id);
        setQuotingAddonId(addon.addon_id);
        try {
            const quote = await subscriptionService.getQuote(
                tenant?.id,
                addon.addon_id,
                qty
            );
            setQuoteData(quote);
            setAddonModalOpen(true);
        } catch (err) {
            console.error('Failed to calculate quote:', err);
            if (addToast) addToast('error', err.response?.data?.message || 'Failed to calculate quote');
        } finally {
            setQuotingAddonId(null);
        }
    };

    const handleRefreshAll = () => {
        loadCatalog();
        if (onUpdate) onUpdate();
    };

    return (
        <div className="space-y-8 max-w-5xl">
            {/* Catalog Section Header */}
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                        Mid-Cycle Add-ons Catalog
                    </h3>
                </div>
                <p className="text-sm font-medium text-gray-500">
                    Select capacity add-ons to upgrade your tenant resources with instant prorated billing
                </p>
            </div>

            {/* Catalog Grid */}
            {catalogLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {catalog.map((addon) => (
                        <div
                            key={addon.addon_id}
                            className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                                        {getAddonIcon(addon.resource_type || addon.addon_type)}
                                    </div>
                                    <span className="text-lg font-extrabold font-mono text-gray-900">
                                        ${Number(addon.unit_price || addon.price || 0).toFixed(2)}
                                        <span className="text-xs text-gray-400 font-sans font-normal"> / mo</span>
                                    </span>
                                </div>

                                <h4 className="text-base font-bold text-gray-900 tracking-tight">
                                    {addon.name}
                                </h4>
                                <p className="text-xs font-medium text-gray-500 mt-1.5 leading-relaxed min-h-[36px]">
                                    {addon.description || `Resource type: ${addon.resource_type || 'addon'}`}
                                </p>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
                                {/* Quantity Selector */}
                                <div className="w-24">
                                    <label className="sr-only">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={getQuantity(addon.addon_id)}
                                        onChange={(e) => handleQuantityChange(addon.addon_id, e.target.value)}
                                        className="w-full text-center font-mono font-bold text-sm rounded-xl border border-gray-200 bg-gray-50 py-2 text-gray-900 focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                {/* Trigger Quote & Purchase Button */}
                                <button
                                    type="button"
                                    onClick={() => handleGetQuote(addon)}
                                    disabled={quotingAddonId === addon.addon_id}
                                    className="flex-1 inline-flex justify-center items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    {quotingAddonId === addon.addon_id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                    Purchase Add-on
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Prorated Add-on Quote & Purchase Modal */}
            <AddonPurchaseModal
                isOpen={addonModalOpen}
                onClose={() => setAddonModalOpen(false)}
                quote={quoteData}
                customerId={tenant?.id}
                onSuccess={handleRefreshAll}
            />
        </div>
    );
};

export default TenantManager;
