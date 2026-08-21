import React, { useState, useEffect } from 'react';
import {
    X,
    Building2,
    User,
    Mail,
    Lock,
    Wallet,
    Phone,
    Users,
    Check,
    ChevronRight,
    ChevronLeft,
    Loader,
    Eye,
    EyeOff,
    CreditCard,
    ShieldCheck,
    CheckCircle2,
    Plus,
    Minus,
    Package,
    Radio,
    HardDrive,
    Activity,
    Zap,
    Sparkles
} from 'lucide-react';
import api from '../../../services/api';
import { subscriptionService } from '../../../services/subscription.service';

const STEPS = [
    { number: 1, title: 'Company Info', icon: Building2 },
    { number: 2, title: 'Wallet Funding', icon: Wallet },
    { number: 3, title: 'Subscription Plan', icon: CreditCard },
    { number: 4, title: 'Assign TFNs', icon: Phone },
    { number: 5, title: 'Assign DIDs', icon: Phone },
];

const TenantWizard = ({ onClose, onSuccess }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [createdTenantId, setCreatedTenantId] = useState(null);
    const [tenantName, setTenantName] = useState('');
    const [customerCode, setCustomerCode] = useState(null);

    // Step 1: Basic Info
    const [basicInfo, setBasicInfo] = useState({
        customerType: 'company',
        firstName: '',
        lastName: '',
        companyName: '',
        companyTaxId: '',
        adminEmail: '',
        adminPassword: '',
        confirmPassword: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: 'USA',
        creditLimit: ''
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Step 2: Wallet
    const [walletAmount, setWalletAmount] = useState(10); // Default $10
    const [walletDescription, setWalletDescription] = useState('Initial Funding');

    // Step 3: Subscription Plan & Add-ons
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [catalog, setCatalog] = useState([]);
    const [addonQuantities, setAddonQuantities] = useState({});

    // Step 4: TFNs
    const [availableTfns, setAvailableTfns] = useState([]);
    const [selectedTfns, setSelectedTfns] = useState([]);

    // Step 5: DIDs
    const [availableDids, setAvailableDids] = useState([]);
    const [selectedDids, setSelectedDids] = useState([]);

    // Load subscription plans and add-on catalog when step 3 is active
    useEffect(() => {
        if (currentStep === 3 && plans.length === 0) {
            loadSubscriptionData();
        }
        if ((currentStep === 4 || currentStep === 5) && availableTfns.length === 0 && availableDids.length === 0) {
            fetchAvailableTfnsAndDids();
        }
    }, [currentStep]);

    const loadSubscriptionData = async () => {
        setPlansLoading(true);
        try {
            const [plansData, catalogData] = await Promise.all([
                subscriptionService.getPlans(),
                subscriptionService.getCatalog()
            ]);
            const availablePlans = plansData || [];
            setPlans(availablePlans);
            if (availablePlans.length > 0 && !selectedPlanId) {
                setSelectedPlanId(availablePlans[0].plan_id || availablePlans[0].id || availablePlans[0].name);
            }
            setCatalog(catalogData || []);
        } catch (err) {
            console.error('Failed to load subscription data:', err);
        } finally {
            setPlansLoading(false);
        }
    };

    const handleAddonQtyChange = (addonId, delta) => {
        setAddonQuantities(prev => {
            const current = prev[addonId] || 0;
            const next = Math.max(0, current + delta);
            if (next === 0) {
                const updated = { ...prev };
                delete updated[addonId];
                return updated;
            }
            return { ...prev, [addonId]: next };
        });
    };

    const handleAddonQtyInput = (addonId, val) => {
        const parsed = parseInt(val, 10);
        const qty = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
        setAddonQuantities(prev => {
            if (qty === 0) {
                const updated = { ...prev };
                delete updated[addonId];
                return updated;
            }
            return { ...prev, [addonId]: qty };
        });
    };

    const getAddonIcon = (addonType = '') => {
        const type = String(addonType).toLowerCase();
        const iconClasses = "h-4 w-4 text-indigo-600 dark:text-indigo-400";
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

    // --- Step Actions ---

    const isStep1Valid = () => {
        if (!basicInfo.firstName || !basicInfo.lastName || !basicInfo.adminEmail || !basicInfo.adminPassword || !basicInfo.confirmPassword || !basicInfo.phone || !basicInfo.address || basicInfo.address.length < 10 || !basicInfo.city || !basicInfo.state || !basicInfo.country) {
            return false;
        }
        if (basicInfo.customerType === 'company') {
            if (!basicInfo.companyName || !basicInfo.companyTaxId) {
                return false;
            }
        }
        return true;
    };

    const handleCreateTenant = async () => {
        if (basicInfo.adminPassword !== basicInfo.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (basicInfo.customerType === 'company') {
            if (!basicInfo.companyName) {
                setError('Company Name is required');
                return;
            }
            if (!basicInfo.companyTaxId) {
                setError('Company Tax ID is required');
                return;
            }
        }

        if (!basicInfo.firstName) {
            setError('First Name is required');
            return;
        }

        if (!basicInfo.lastName) {
            setError('Last Name is required');
            return;
        }

        if (!basicInfo.address || basicInfo.address.length < 10) {
            setError('Address is required and must be at least 10 characters');
            return;
        }

        if (!basicInfo.city) {
            setError('City is required');
            return;
        }

        if (!basicInfo.state) {
            setError('State is required');
            return;
        }

        if (!basicInfo.country) {
            setError('Country is required');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { confirmPassword, ...data } = basicInfo;
            if (data.customerType === 'individual') {
                delete data.companyName;
                delete data.companyTaxId;
            }
            const res = await api.post('/tenants', data);
            setCreatedTenantId(res.data.tenant.id);
            setTenantName(res.data.tenant.name);
            setCustomerCode(res.data.tenant.customerCode);
            setCurrentStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create tenant');
        } finally {
            setLoading(false);
        }
    };

    const handleFundWallet = async () => {
        if (!walletAmount || walletAmount <= 0) {
            setCurrentStep(3); // Skip if 0
            return;
        }
        setLoading(true);
        try {
            await api.post('/wallet/internal-adjust', {
                targetTenantId: createdTenantId,
                amount: Number(walletAmount),
                type: 'CREDIT',
                description: walletDescription || 'Initial Funding'
            });
            setCurrentStep(3);
        } catch (err) {
            setError('Failed to fund wallet: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableTfnsAndDids = async () => {
        try {
            const resTfn = await api.get('/telecom/tfns/available');
            setAvailableTfns(resTfn.data || []);
            const resDid = await api.get('/telecom/dids/available');
            setAvailableDids(resDid.data || []);
        } catch (err) {
            console.error('Failed to fetch numbers', err);
        }
    };

    const handleConfigureSubscription = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Assign Subscription Plan
            if (selectedPlanId) {
                await subscriptionService.switchPlan(createdTenantId, selectedPlanId, true);
            }

            // 2. Purchase / Provision selected add-ons
            for (const [addonId, qty] of Object.entries(addonQuantities)) {
                if (qty > 0) {
                    await subscriptionService.purchaseAddon(createdTenantId, addonId, qty);
                }
            }

            await fetchAvailableTfnsAndDids();
            setCurrentStep(4);
        } catch (err) {
            console.error('Failed to configure subscription:', err);
            setError('Failed to configure subscription: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleAssignTfns = async () => {
        setLoading(true);
        try {
            if (selectedTfns.length > 0) {
                for (const tfnId of selectedTfns) {
                    await api.post(`/telecom/tfns/${tfnId}/assign`, { tenantId: createdTenantId });
                }
            }
            setCurrentStep(5);
        } catch (err) {
            setError('Failed to assign TFNs: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleAssignDids = async () => {
        setLoading(true);
        try {
            if (selectedDids.length > 0) {
                for (const didId of selectedDids) {
                    await api.post(`/telecom/dids/${didId}/assign`, { tenantId: createdTenantId });
                }
            }
            onSuccess({ id: createdTenantId, name: tenantName });
        } catch (err) {
            setError('Failed to assign DIDs: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Common input styling for dark mode consistency
    const inputClass = "w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-all";

    // --- Renderers ---

    const renderStep1 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tenant & Admin Details</h3>
            <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Tenant Type *</label>
                        <select
                            className={inputClass}
                            value={basicInfo.customerType}
                            onChange={e => setBasicInfo({ ...basicInfo, customerType: e.target.value })}
                        >
                            <option value="company">Company</option>
                            <option value="individual">Individual</option>
                        </select>
                    </div>
                </div>

                {basicInfo.customerType === 'company' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Company Name *</label>
                            <input type="text" className={inputClass} value={basicInfo.companyName} onChange={e => setBasicInfo({ ...basicInfo, companyName: e.target.value })} placeholder="Acme Inc" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Company Tax ID *</label>
                            <input type="text" className={inputClass} value={basicInfo.companyTaxId} onChange={e => setBasicInfo({ ...basicInfo, companyTaxId: e.target.value })} placeholder="TAX-123456" />
                        </div>
                    </div>
                )}

                <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                    <p className="text-xs text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Personal Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">First Name *</label>
                            <input type="text" className={inputClass} value={basicInfo.firstName} onChange={e => setBasicInfo({ ...basicInfo, firstName: e.target.value })} placeholder="First Name" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Last Name *</label>
                            <input type="text" className={inputClass} value={basicInfo.lastName} onChange={e => setBasicInfo({ ...basicInfo, lastName: e.target.value })} placeholder="Last Name" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Email *</label>
                        <input type="email" className={inputClass} value={basicInfo.adminEmail} onChange={e => setBasicInfo({ ...basicInfo, adminEmail: e.target.value })} placeholder="admin@domain.com" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Password *</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className={`${inputClass} pr-10`}
                                    value={basicInfo.adminPassword}
                                    onChange={e => setBasicInfo({ ...basicInfo, adminPassword: e.target.value })}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Confirm Password *</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    className={`${inputClass} pr-10`}
                                    value={basicInfo.confirmPassword}
                                    onChange={e => setBasicInfo({ ...basicInfo, confirmPassword: e.target.value })}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                    <p className="text-xs text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Billing & Limits</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Credit Limit ($)</label>
                            <input
                                type="number"
                                className={inputClass}
                                value={basicInfo.creditLimit}
                                onChange={e => setBasicInfo({ ...basicInfo, creditLimit: e.target.value })}
                                placeholder="0.00"
                                min="0"
                                step="any"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Phone *</label>
                            <input type="tel" className={inputClass} value={basicInfo.phone} onChange={e => setBasicInfo({ ...basicInfo, phone: e.target.value })} placeholder="1234567890" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Country *</label>
                            <select
                                className={inputClass}
                                value={basicInfo.country}
                                onChange={e => setBasicInfo({ ...basicInfo, country: e.target.value })}
                            >
                                <option value="USA">USA</option>
                                <option value="CAD">Canada</option>
                                <option value="IND">India</option>
                                <option value="PAK">Pakistan</option>
                                <option value="PHI">Philippines</option>
                                <option value="BNG">Bangladesh</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Address (min 10 chars) *</label>
                            <input type="text" className={inputClass} value={basicInfo.address} onChange={e => setBasicInfo({ ...basicInfo, address: e.target.value })} placeholder="123 Main St, Suite 100" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">City *</label>
                            <input type="text" className={inputClass} value={basicInfo.city} onChange={e => setBasicInfo({ ...basicInfo, city: e.target.value })} placeholder="San Francisco" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">State *</label>
                            <input type="text" className={inputClass} value={basicInfo.state} onChange={e => setBasicInfo({ ...basicInfo, state: e.target.value })} placeholder="CA" />
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                    onClick={handleCreateTenant}
                    disabled={!isStep1Valid() || loading}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-primary-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                    {loading ? <Loader className="animate-spin mr-1.5" size={16} /> : null} Create & Continue
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Fund Wallet (Optional)</h3>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">Add initial credits to the tenant's wallet.</p>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Amount ($)</label>
                <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 font-bold">$</span>
                    <input
                        type="number"
                        className={`${inputClass} pl-8 text-base font-semibold`}
                        value={walletAmount}
                        onChange={e => setWalletAmount(e.target.value)}
                        placeholder="0.00"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Description / Note</label>
                <input
                    type="text"
                    className={inputClass}
                    value={walletDescription}
                    onChange={e => setWalletDescription(e.target.value)}
                    placeholder="e.g. Initial Funding, Promo Credits"
                />
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-slate-800">
                <button onClick={() => setCurrentStep(3)} className="text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Skip</button>
                <button
                    onClick={handleFundWallet}
                    disabled={loading}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-primary-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                    {loading ? <Loader className="animate-spin mr-1.5" size={16} /> : null} Next: Subscription Plan
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => {
        const selectedPlan = plans.find(p => (p.plan_id || p.id || p.name) === selectedPlanId) || plans[0];
        const planPrice = Number(selectedPlan?.amount || selectedPlan?.price || 0);

        const addonsTotal = Object.entries(addonQuantities).reduce((sum, [addonId, qty]) => {
            const item = catalog.find(c => c.addon_id === addonId);
            const price = Number(item?.unit_price || item?.price || 0);
            return sum + (price * qty);
        }, 0);

        const totalMonthlyCost = planPrice + addonsTotal;

        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        Select Subscription Plan & Add-ons
                    </h3>
                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">
                        Choose the base billing plan and any starting resource add-ons for this tenant.
                    </p>
                </div>

                {plansLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader className="h-6 w-6 animate-spin text-primary-600 dark:text-primary-400" />
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Section A: Base Subscription Plans */}
                        <div>
                            <label className="text-xs font-extrabold text-gray-700 dark:text-slate-300 uppercase tracking-wider block mb-2.5">
                                Available Subscription Plans *
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {plans.map((p) => {
                                    const pId = p.plan_id || p.id || p.name;
                                    const isSelected = selectedPlanId === pId;
                                    return (
                                        <div
                                            key={pId}
                                            onClick={() => setSelectedPlanId(pId)}
                                            className={`cursor-pointer rounded-xl p-3.5 border transition-all flex flex-col justify-between ${isSelected
                                                ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/20 dark:ring-indigo-500/30 shadow-xs'
                                                : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-slate-700 hover:bg-gray-50/50 dark:hover:bg-slate-800/40'
                                                }`}
                                        >
                                            <div>
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                                        {p.name}
                                                    </h4>
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-600 dark:bg-indigo-500 text-white' : 'border-gray-300 dark:border-slate-700'}`}>
                                                        {isSelected && <Check size={10} strokeWidth={3} />}
                                                    </div>
                                                </div>

                                                <div className="text-base font-extrabold font-mono text-gray-900 dark:text-white mb-2">
                                                    ${Number(p.amount || p.price || 0).toFixed(2)}
                                                    <span className="text-[10px] text-gray-500 dark:text-slate-400 font-normal font-sans"> / mo</span>
                                                </div>

                                                <ul className="space-y-1 text-[11px] text-gray-600 dark:text-slate-300">
                                                    <li className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                                        <span><strong>{p.extensions || 1}</strong> SIP Extensions</span>
                                                    </li>
                                                    <li className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                                        <span><strong>{p.free_mins || 0}</strong> Free Inbound Mins</span>
                                                    </li>
                                                    <li className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                                                        <span><strong>{p.tfns || 0}</strong> TFNs included</span>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Section B: Capacity Add-ons */}
                        {catalog.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-extrabold text-gray-700 dark:text-slate-300 uppercase tracking-wider block">
                                        Capacity Add-ons (Optional)
                                    </label>
                                    <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">Add instant resources to this tenant</span>
                                </div>

                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 border border-gray-100 dark:border-slate-800 rounded-xl p-2 bg-gray-50/50 dark:bg-slate-800/30">
                                    {catalog.map((addon) => {
                                        const qty = addonQuantities[addon.addon_id] || 0;
                                        const isChecked = qty > 0;
                                        return (
                                            <div
                                                key={addon.addon_id}
                                                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${isChecked
                                                    ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800/70 shadow-xs'
                                                    : 'bg-white/80 dark:bg-slate-900/60 border-gray-200/80 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 flex-shrink-0">
                                                        {getAddonIcon(addon.resource_type || addon.addon_type)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h5 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                                            {addon.name}
                                                        </h5>
                                                        <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">
                                                            {addon.description || `Type: ${addon.resource_type || 'addon'}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <span className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                                                        ${Number(addon.unit_price || addon.price || 0).toFixed(2)}
                                                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal font-sans">/mo</span>
                                                    </span>

                                                    {/* Stepper */}
                                                    <div className="flex items-center border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-slate-800">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddonQtyChange(addon.addon_id, -1)}
                                                            disabled={qty <= 0}
                                                            className="px-2 py-1 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                                                        >
                                                            <Minus size={12} />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="50"
                                                            value={qty}
                                                            onChange={(e) => handleAddonQtyInput(addon.addon_id, e.target.value)}
                                                            className="w-10 text-center text-xs font-mono font-bold py-0.5 bg-white dark:bg-slate-900 text-gray-900 dark:text-white border-x border-gray-200 dark:border-slate-700"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddonQtyChange(addon.addon_id, 1)}
                                                            className="px-2 py-1 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Section C: Summary Footer */}
                        <div className="p-3.5 rounded-xl bg-gray-900 dark:bg-slate-950 border border-transparent dark:border-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider block">
                                    Configured Plan & Add-ons Summary
                                </span>
                                <div className="text-xs font-medium text-gray-200 dark:text-slate-200 mt-0.5">
                                    {selectedPlan?.name || 'Selected Plan'}
                                    {addonsTotal > 0 && ` + ${Object.values(addonQuantities).reduce((a, b) => a + b, 0)} add-on resource(s)`}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-gray-400 dark:text-slate-400 block">Total Monthly Cost</span>
                                <span className="text-lg font-mono font-extrabold text-emerald-400">
                                    ${totalMonthlyCost.toFixed(2)}
                                    <span className="text-xs text-gray-300 dark:text-slate-400 font-sans font-normal"> / month</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => { fetchAvailableTfnsAndDids(); setCurrentStep(4); }}
                        className="text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                    >
                        Skip Subscription
                    </button>
                    <button
                        type="button"
                        onClick={handleConfigureSubscription}
                        disabled={loading || plansLoading}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-primary-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                    >
                        {loading ? <Loader className="animate-spin" size={14} /> : null}
                        Next: Assign TFNs
                    </button>
                </div>
            </div>
        );
    };

    const renderStep4 = () => (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Select Toll-Free Numbers (Optional)</h3>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">Select available numbers from inventory to assign to this tenant.</p>
            </div>

            <div className="border border-gray-200 dark:border-slate-800 rounded-xl max-h-60 overflow-y-auto bg-white dark:bg-slate-900">
                {availableTfns.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">No available TFNs found in inventory.</div>
                ) : (
                    <table className="w-full text-left bg-white dark:bg-slate-900">
                        <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0 border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="p-3 w-10"></th>
                                <th className="p-3 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Number</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {availableTfns.map(tfn => (
                                <tr key={tfn.id} className={selectedTfns.includes(tfn.id) ? 'bg-primary-50/60 dark:bg-primary-950/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/40'}>
                                    <td className="p-3">
                                        <input
                                             type="checkbox"
                                            className="rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 dark:bg-slate-800"
                                            checked={selectedTfns.includes(tfn.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedTfns([...selectedTfns, tfn.id]);
                                                else setSelectedTfns(selectedTfns.filter(id => id !== tfn.id));
                                            }}
                                        />
                                    </td>
                                    <td className="p-3 font-mono font-bold text-sm text-gray-900 dark:text-white">{tfn.number}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-slate-800">
                <button onClick={() => setCurrentStep(5)} className="text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Skip</button>
                <button
                    onClick={handleAssignTfns}
                    disabled={loading}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-primary-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                    {loading ? <Loader className="animate-spin mr-1.5" size={16} /> : null} Next: Assign DIDs
                </button>
            </div>
        </div>
    );

    const renderStep5 = () => (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assign Standard Phone Numbers (DIDs)</h3>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-1">Select available standard numbers for this tenant.</p>
            </div>

            <div className="border border-gray-200 dark:border-slate-800 rounded-xl max-h-64 overflow-y-auto bg-white dark:bg-slate-900">
                {availableDids.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 dark:text-slate-500 text-sm">No available DIDs in inventory.</div>
                ) : (
                    <table className="w-full text-sm text-left bg-white dark:bg-slate-900">
                        <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0 border-b border-gray-100 dark:border-slate-700">
                            <tr>
                                <th className="p-3 w-10"></th>
                                <th className="p-3 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Number</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {availableDids.map(did => (
                                <tr key={did.id} className={selectedDids.includes(did.id) ? 'bg-primary-50/60 dark:bg-primary-950/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/40'}>
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 dark:bg-slate-800"
                                            checked={selectedDids.includes(did.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedDids([...selectedDids, did.id]);
                                                else setSelectedDids(selectedDids.filter(id => id !== did.id));
                                            }}
                                        />
                                    </td>
                                    <td className="p-3 font-mono font-bold text-sm text-gray-900 dark:text-white">{did.number}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-slate-800">
                <button onClick={() => onSuccess({ id: createdTenantId, name: tenantName })} className="text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">Skip</button>
                <button
                    onClick={handleAssignDids}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5 transition-all"
                >
                    {loading ? <Loader className="animate-spin" size={14} /> : <Check size={14} />} Finish & Complete Setup
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-gray-200 dark:ring-slate-800">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/80 flex justify-between items-center">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-900/40">
                            <Building2 size={18} />
                        </div>
                        <div>
                            <h2 className="font-extrabold text-gray-900 dark:text-white text-base">New Tenant Wizard</h2>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Create tenant, assign numbers, and configure subscription</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"><X size={18} /></button>
                </div>

                {/* Progress */}
                <div className="px-6 py-3.5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/50 flex justify-between">
                    {STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isActive = currentStep === step.number;
                        const isCompleted = currentStep > step.number;
                        return (
                            <div key={step.number} className={`flex flex-col items-center flex-1 relative ${idx !== STEPS.length - 1 ? 'after:content-[""] after:h-[2px] after:w-1/2 after:bg-gray-200 dark:after:bg-slate-700 after:absolute after:top-4 after:-right-1/4 after:z-0' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors text-xs font-bold ${isActive ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20' :
                                    isCompleted ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700'
                                    }`}>
                                    {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                                </div>
                                <span className={`text-[11px] mt-1.5 font-bold transition-colors ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-slate-400'}`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto bg-white dark:bg-slate-900">
                    {error && (
                        <div className="mb-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold p-3 rounded-xl border border-red-200 dark:border-red-900/40 flex justify-between items-start">
                            <span>{error}</span>
                            <button onClick={() => setError(null)}><X size={14} /></button>
                        </div>
                    )}
                    {currentStep === 1 && renderStep1()}
                    {currentStep === 2 && renderStep2()}
                    {currentStep === 3 && renderStep3()}
                    {currentStep === 4 && renderStep4()}
                    {currentStep === 5 && renderStep5()}
                </div>
            </div>
        </div>
    );
};

export default TenantWizard;
