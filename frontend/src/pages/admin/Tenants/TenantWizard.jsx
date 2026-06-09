import React, { useState, useEffect } from 'react';
import { X, Building2, User, Mail, Lock, Wallet, Phone, Users, Check, ChevronRight, ChevronLeft, Loader, Eye, EyeOff } from 'lucide-react';
import api from '../../../services/api';

const STEPS = [
    { number: 1, title: 'Company Info', icon: Building2 },
    { number: 2, title: 'Wallet Funding', icon: Wallet },
    { number: 3, title: 'Assign TFNs', icon: Phone },
    { number: 4, title: 'Assign DIDs', icon: Phone },
    { number: 5, title: 'Add Extensions', icon: Users },
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
        planId: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: 'USA'
    });

    const [packages, setPackages] = useState([]);

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                const res = await api.get('/admin/packages');
                setPackages(res.data?.data || (Array.isArray(res.data) ? res.data : []));
            } catch (err) {
                console.error('Failed to fetch packages:', err);
            }
        };
        fetchPackages();
    }, []);

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Step 2: Wallet
    const [walletAmount, setWalletAmount] = useState(10); // Default $10

    // Step 3: TFNs
    const [availableTfns, setAvailableTfns] = useState([]);
    const [selectedTfns, setSelectedTfns] = useState([]);

    // Step 4: DIDs
    const [didInput, setDidInput] = useState('');

    // Step 5: Extensions
    const [extensions, setExtensions] = useState([
        { name: 'Reception', email: '', password: '' }, // Initial one
    ]);

    // --- Step Actions ---

    const isStep1Valid = () => {
        if (!basicInfo.firstName || !basicInfo.lastName || !basicInfo.adminEmail || !basicInfo.adminPassword || !basicInfo.confirmPassword || !basicInfo.planId || !basicInfo.phone || !basicInfo.address || basicInfo.address.length < 10 || !basicInfo.city || !basicInfo.state || !basicInfo.country) {
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

        if (!basicInfo.planId) {
            setError('Please select a billing plan');
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
                description: 'Initial Funding'
            });
            await fetchAvailableTfns();
            setCurrentStep(3);
        } catch (err) {
            setError('Failed to fund wallet: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableTfns = async () => {
        try {
            const res = await api.get('/telecom/tfns/available');
            setAvailableTfns(res.data || []);
        } catch (err) {
            console.error('Failed to fetch TFNs', err);
        }
    };

    const handleAssignTfns = async () => {
        setLoading(true);
        try {
            if (selectedTfns.length > 0) {
                // Sequential assignment
                for (const tfnId of selectedTfns) {
                    await api.post(`/telecom/tfns/${tfnId}/assign`, { tenantId: createdTenantId });
                }
            }
            setCurrentStep(4);
        } catch (err) {
            setError('Failed to assign TFNs: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleAssignDids = async () => {
        const didsToCreate = didInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        if (didsToCreate.length === 0) {
            setCurrentStep(5);
            return;
        }

        setLoading(true);
        try {
            for (const didNumber of didsToCreate) {
                // Formatting: Ensure it starts with + if not present? Backend might handle it or we should strict format.
                // For now, passing as-is or ensuring minimal format.
                const formattedNumber = didNumber.startsWith('+') ? didNumber : `+${didNumber}`;

                await api.post('/telecom/dids', {
                    targetTenantId: createdTenantId,
                    didNumber: formattedNumber
                    // routeType optional now
                });
            }
            setCurrentStep(5);
        } catch (err) {
            setError('Failed to assign DIDs: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateExtensions = async () => {
        setLoading(true);
        try {
            let createdCount = 0;
            for (const ext of extensions) {
                if (!ext.name || !ext.password) continue; // Skip incomplete
                await api.post('/telecom/extensions', {
                    targetTenantId: createdTenantId,
                    name: ext.name,
                    email: ext.email, // Optional? DTO says name/password required, email might be optional or for user? 
                    // Wait, Extension creation DTO usually asks for Name, Password. 
                    // Does it Create a User too? No, Extension is SIP entity.
                    // But we might want to assign it to a user later. 
                    // DTO only requires `name` and `password`. Email is not on Extension model usually? 
                    // Let's check DTO. Assuming Name + Password is enough.
                    password: ext.password
                });
                createdCount++;
            }
            onSuccess({ id: createdTenantId, name: tenantName }); // Finish
        } catch (err) {
            setError('Failed to create extensions: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    // --- Renderers ---

    const renderStep1 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Tenant & Admin Details</h3>
            <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 font-semibold">Tenant Type *</label>
                        <select
                            className="w-full border rounded p-2 bg-gray-50 focus:bg-white"
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
                            <label className="block text-sm font-medium text-gray-700">Company Name *</label>
                            <input type="text" className="w-full border rounded p-2" value={basicInfo.companyName} onChange={e => setBasicInfo({ ...basicInfo, companyName: e.target.value })} placeholder="Acme Inc" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Company Tax ID *</label>
                            <input type="text" className="w-full border rounded p-2" value={basicInfo.companyTaxId} onChange={e => setBasicInfo({ ...basicInfo, companyTaxId: e.target.value })} placeholder="TAX-123456" />
                        </div>
                    </div>
                )}

                <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Personal Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">First Name *</label>
                            <input type="text" className="w-full border rounded p-2" value={basicInfo.firstName} onChange={e => setBasicInfo({ ...basicInfo, firstName: e.target.value })} placeholder="First Name" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                            <input type="text" className="w-full border rounded p-2" value={basicInfo.lastName} onChange={e => setBasicInfo({ ...basicInfo, lastName: e.target.value })} placeholder="Last Name" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700">Email *</label>
                        <input type="email" className="w-full border rounded p-2" value={basicInfo.adminEmail} onChange={e => setBasicInfo({ ...basicInfo, adminEmail: e.target.value })} placeholder="admin@domain.com" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Password *</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="w-full border rounded p-2 pr-10"
                                    value={basicInfo.adminPassword}
                                    onChange={e => setBasicInfo({ ...basicInfo, adminPassword: e.target.value })}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Confirm Password *</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    className="w-full border rounded p-2 pr-10"
                                    value={basicInfo.confirmPassword}
                                    onChange={e => setBasicInfo({ ...basicInfo, confirmPassword: e.target.value })}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Billing & Subscription</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 font-semibold">Billing Plan *</label>
                        <select 
                            className="w-full border rounded p-2" 
                            value={basicInfo.planId} 
                            onChange={e => setBasicInfo({ ...basicInfo, planId: e.target.value })}
                        >
                            <option value="">Select Plan</option>
                            {packages.map(pkg => (
                                <option key={pkg.plan_id} value={pkg.plan_id}>
                                    {pkg.name} (${parseFloat(pkg.amount).toFixed(2)})
                                </option>
                            ))}
                        </select>
                    </div>
                    {basicInfo.planId && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phone *</label>
                                <input type="tel" className="w-full border rounded p-2" value={basicInfo.phone} onChange={e => setBasicInfo({ ...basicInfo, phone: e.target.value })} placeholder="1234567890" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Country *</label>
                                <select 
                                    className="w-full border rounded p-2" 
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
                                <label className="block text-sm font-medium text-gray-700">Address (min 10 chars) *</label>
                                <input type="text" className="w-full border rounded p-2" value={basicInfo.address} onChange={e => setBasicInfo({ ...basicInfo, address: e.target.value })} placeholder="123 Main St, Suite 100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">City *</label>
                                <input type="text" className="w-full border rounded p-2" value={basicInfo.city} onChange={e => setBasicInfo({ ...basicInfo, city: e.target.value })} placeholder="San Francisco" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">State *</label>
                                <input type="text" className="w-full border rounded p-2" value={basicInfo.state} onChange={e => setBasicInfo({ ...basicInfo, state: e.target.value })} placeholder="CA" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <button
                    onClick={handleCreateTenant}
                    disabled={!isStep1Valid() || loading}
                    className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 disabled:opacity-50 flex items-center shadow-sm transition-colors"
                >
                    {loading ? <Loader className="animate-spin mr-2" size={16} /> : null} Create & Continue
                </button>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">Fund Wallet (Optional)</h3>
            <p className="text-sm text-gray-500">Add initial credits to the tenant's wallet.</p>
            <div>
                <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
                <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                        type="number"
                        className="w-full border rounded p-2 pl-7 text-lg font-semibold"
                        value={walletAmount}
                        onChange={e => setWalletAmount(e.target.value)}
                        placeholder="0.00"
                    />
                </div>
            </div>
            <div className="flex justify-between pt-4">
                <button onClick={() => setCurrentStep(3)} className="text-gray-500 hover:text-gray-700">Skip</button>
                <button
                    onClick={handleFundWallet}
                    disabled={loading}
                    className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 disabled:opacity-50 flex items-center"
                >
                    {loading ? <Loader className="animate-spin mr-2" size={16} /> : null} Next: Assign Numbers
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Select Toll-Free Numbers (Optional)</h3>
            <p className="text-sm text-gray-500">Select available numbers from inventory to assign to this tenant.</p>

            <div className="border rounded-lg max-h-60 overflow-y-auto">
                {availableTfns.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No available TFNs found in inventory.</div>
                ) : (
                    <table className="w-full text-left bg-white">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="p-3 w-10"><input type="checkbox" /></th>
                                <th className="p-3 text-xs font-semibold text-gray-500 uppercase">Number</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {availableTfns.map(tfn => (
                                <tr key={tfn.id} className={selectedTfns.includes(tfn.id) ? 'bg-blue-50' : ''}>
                                    <td className="p-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedTfns.includes(tfn.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedTfns([...selectedTfns, tfn.id]);
                                                else setSelectedTfns(selectedTfns.filter(id => id !== tfn.id));
                                            }}
                                        />
                                    </td>
                                    <td className="p-3 font-mono">{tfn.number}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="flex justify-between pt-4">
                <button onClick={() => setCurrentStep(4)} className="text-gray-500 hover:text-gray-700">Skip</button>
                <button
                    onClick={handleAssignTfns}
                    disabled={loading}
                    className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 disabled:opacity-50 flex items-center"
                >
                    {loading ? <Loader className="animate-spin mr-2" size={16} /> : null} Next: Assign DIDs
                </button>
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Assign Standard Phone Numbers (DIDs)</h3>
            <p className="text-sm text-gray-500">Enter phone numbers to assign to this tenant. These will be created as "Unassigned" DIDs.</p>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Numbers (one per line)</label>
                <textarea
                    className="w-full h-32 border rounded p-2 font-mono text-sm"
                    placeholder="+15550001234&#10;+15550005678"
                    value={didInput}
                    onChange={e => setDidInput(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                    Enter numbers in E.164 format (e.g. +14155552671). Supports list separated by newlines or commas.
                </p>
            </div>

            <div className="flex justify-between pt-4">
                <button onClick={() => setCurrentStep(5)} className="text-gray-500 hover:text-gray-700">Skip</button>
                <button
                    onClick={handleAssignDids}
                    disabled={loading}
                    className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 disabled:opacity-50 flex items-center"
                >
                    {loading ? <Loader className="animate-spin mr-2" size={16} /> : null} Next: Extensions
                </button>
            </div>
        </div>
    );

    const renderStep5 = () => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Configure Extensions</h3>
                <button
                    onClick={() => setExtensions([...extensions, { name: '', password: '' }])}
                    className="text-primary-600 text-sm font-medium hover:text-primary-700"
                >
                    + Add Another
                </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {extensions.map((ext, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg border">
                        <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                                {/* Extension Number Preview */}
                                <div className="w-16 flex-shrink-0">
                                    <input
                                        disabled
                                        className="w-full text-sm border rounded p-1.5 bg-gray-100 text-gray-500 text-center"
                                        value={customerCode ? `${customerCode}${String(idx + 1).padStart(2, '0')}` : '...'}
                                        title="Assigned Extension Number"
                                    />
                                </div>
                                <input
                                    placeholder="Name (e.g. Sales, John)"
                                    className="flex-1 text-sm border rounded p-1.5"
                                    value={ext.name}
                                    onChange={e => {
                                        const newExts = [...extensions];
                                        newExts[idx].name = e.target.value;
                                        setExtensions(newExts);
                                    }}
                                />
                            </div>
                            <div className="flex gap-2">
                                {/* Email field removed if not in DTO, or we treat "password" as the main creds. 
                                    Using password field for Web/SIP password.
                                */}
                                <input
                                    type="text" // Visible for admin creation convenience? Or password type?
                                    // User asked for Detailed. Let's make it easy.
                                    placeholder="Password"
                                    className="flex-1 text-sm border rounded p-1.5"
                                    value={ext.password}
                                    onChange={e => {
                                        const newExts = [...extensions];
                                        newExts[idx].password = e.target.value;
                                        setExtensions(newExts);
                                    }}
                                />
                            </div>
                        </div>
                        {extensions.length > 1 && (
                            <button
                                onClick={() => setExtensions(extensions.filter((_, i) => i !== idx))}
                                className="text-gray-400 hover:text-red-500 mt-1"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex justify-between pt-4">
                <button onClick={() => onSuccess({ id: createdTenantId, name: tenantName })} className="text-gray-500 hover:text-gray-700">Skip Extensions</button>
                <button
                    onClick={handleCreateExtensions}
                    disabled={loading}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                    {loading ? <Loader className="animate-spin mr-2" size={16} /> : null} Finish
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-900">New Tenant Wizard</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                {/* Progress */}
                <div className="px-6 py-4 border-b flex justify-between">
                    {STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isActive = currentStep === step.number;
                        const isCompleted = currentStep > step.number;
                        return (
                            <div key={step.number} className={`flex flex-col items-center flex-1 relative ${idx !== STEPS.length - 1 ? 'after:content-[""] after:h-[2px] after:w-1/2 after:bg-gray-200 after:absolute after:top-5 after:-right-1/4 after:z-0' : ''}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-colors ${isActive ? 'bg-primary-600 text-white' :
                                    isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                                    }`}>
                                    {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                                </div>
                                <span className={`text-xs mt-2 font-medium ${isActive ? 'text-primary-600' : 'text-gray-500'}`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex justify-between items-start">
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
