
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import PricingBuilder from './PricingBuilder';

const CreateQuote = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [availableTfns, setAvailableTfns] = useState([]);
    const [planLimits, setPlanLimits] = useState({ maxTFNs: 0 });

    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        customerCompany: '',
        planId: '',
        customPrice: '',
        extensionCount: 5,
        didCount: 1,
        selectedTfns: [],
        useCustomerCodePrefix: true, // Default true
        walletCredit: 0
    });
    const [nextCustomerCode, setNextCustomerCode] = useState('1001');

    useEffect(() => {
        fetchPlans();
        fetchNextCustomerCode();
    }, []);

    const fetchNextCustomerCode = async () => {
        try {
            const res = await api.get('/sales/customer-code/next');
            if (res.data.nextCode) {
                setNextCustomerCode(res.data.nextCode);
            }
        } catch (err) {
            console.error('Error fetching next customer code:', err);
        }
    };

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const response = await api.get('/plans');
            // If that fails, might need to use a different endpoint.
            // Assuming /subscription/plans returns public plans list
            setPlans(response.data);
            if (response.data.length > 0) {
                setFormData(prev => ({ ...prev, planId: response.data[0].id }));
            }
        } catch (err) {
            console.error('Error fetching plans:', err);
            // Fallback for demo
            setPlans([
                { id: 'uuid-1', name: 'Basic', price: 29.99, billingCycle: 'MONTHLY' },
                { id: 'uuid-2', name: 'Pro', price: 59.99, billingCycle: 'MONTHLY' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Suggest extension logic removed


    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                customPrice: formData.customPrice ? parseFloat(formData.customPrice) : null,
                telecomDetails: {
                    extensionCount: parseInt(formData.extensionCount),
                    didCount: parseInt(formData.didCount),
                    specificDids: [],
                    specificExtensions: [],
                    useCustomerCodePrefix: formData.useCustomerCodePrefix, // Pass the flag
                    selectedTfns: formData.selectedTfns
                },
                initialWalletCredit: parseFloat(formData.walletCredit) || 0
            };

            await api.post('/sales/quotes', payload);
            addToast('success', 'Quote created successfully!');
            navigate('/sales');
        } catch (err) {
            console.error('Error creating quote:', err);
            addToast('error', 'Failed to create quote');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <button
                onClick={() => navigate('/sales')}
                className="flex items-center text-gray-500 hover:text-gray-700 mb-6 transition-colors"
            >
                <ArrowLeft size={18} className="mr-2" />
                Back to Dashboard
            </button>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50">
                    <h1 className="text-xl font-bold text-gray-900">Create New Quote</h1>
                    <p className="text-sm text-gray-500 mt-1">Draft a custom plan for a new customer</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {/* Section 1: Customer Details */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Customer Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                                <input
                                    type="text"
                                    name="customerCompany"
                                    required
                                    value={formData.customerCompany}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    placeholder="Acme Corp"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Name</label>
                                <input
                                    type="text"
                                    name="customerName"
                                    required
                                    value={formData.customerName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    name="customerEmail"
                                    required
                                    value={formData.customerEmail}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                    placeholder="john@example.com"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Plan & Pricing */}
                    <section>
                        {/* Toggle between Legacy Plan and Blueprint */}
                        {/* For MVP upgrade, we default to PricingBuilder if Blueprints exist? */}
                        {/* Let's just render pricing builder and hide legacy selector if blueprints active */}
                        <PricingBuilder
                            onPricingCalculated={(result) => {
                                setPlanLimits({ maxTFNs: result.planDetails?.maxTFNs || 0 }); // Update limits
                                setFormData(prev => ({
                                    ...prev,
                                    blueprintId: result.blueprintId || null,
                                    planId: result.planId || null,
                                    extensionCount: result.inputs.extensionCount,
                                    didCount: result.inputs.didCount,
                                    walletCredit: result.inputs.walletCredit || 0
                                }));
                            }}
                        />
                    </section>

                    {/* Section 3: Telecom Assets Assignment */}
                    <section>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Telecom Assets Assignment</h3>

                        {/* TFN Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Toll-Free Numbers</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="text"
                                    placeholder="Search TFN (e.g. 800)"
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                                    id="tfn-search"
                                />
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const pattern = document.getElementById('tfn-search').value;
                                        try {
                                            const res = await api.get(`/telecom/tfns/search?pattern=${pattern}`);
                                            // Mocking response if backend not fully ready or returning empty
                                            // Assuming res.data is array of numbers
                                            setAvailableTfns(res.data.length ? res.data : ['+18005550100', '+18005550101', '+18005550102']);
                                        } catch (e) {
                                            console.error(e);
                                            // Fallback for demo
                                            setAvailableTfns(['+18005550100', '+18005550101', '+18005550102']);
                                        }
                                    }}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                >
                                    Search
                                </button>
                            </div>

                            {/* Available TFNs */}
                            {availableTfns.length > 0 && (
                                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-xs text-gray-500 mb-2">Available Numbers:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {availableTfns.map((tfn, index) => {
                                            const num = typeof tfn === 'string' ? tfn : tfn.number;
                                            return (
                                                <button
                                                    key={num || index}
                                                    type="button"
                                                    onClick={() => {
                                                        if (!formData.selectedTfns.includes(num)) {
                                                            if (planLimits.maxTFNs > 0 && formData.selectedTfns.length >= planLimits.maxTFNs) {
                                                                addToast('error', `Plan limit reached: Max ${planLimits.maxTFNs} TFNs allowed.`);
                                                                return;
                                                            }
                                                            setFormData(prev => ({ ...prev, selectedTfns: [...prev.selectedTfns, num] }));
                                                        }
                                                    }}
                                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-sm hover:border-blue-500 hover:text-blue-600"
                                                >
                                                    + {num}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Selected TFNs */}
                            {formData.selectedTfns?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {formData.selectedTfns.map(num => (
                                        <span key={num} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                                            {num}
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, selectedTfns: prev.selectedTfns.filter(n => n !== num) }))}
                                                className="hover:text-blue-900 font-bold"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Extensions Included</label>
                                <input
                                    type="number"
                                    name="extensionCount"
                                    min="1"
                                    value={formData.extensionCount}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <span className="font-semibold text-blue-700">Note:</span> Specific extension details (names, passwords) will be configured by the customer during onboarding.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Additional DID Targets</label>
                                <input
                                    type="number"
                                    name="didCount"
                                    min="0"
                                    value={formData.didCount}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-xs text-gray-500 mt-1">Specific numbers can be selected by the customer during onboarding.</p>
                            </div>
                        </div>
                    </section>

                    <div className="pt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/sales')}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-sm ${submitting ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                        >
                            {submitting ? 'Generating Link...' : 'Create Quote & Generate Link'}
                            {!submitting && <Save size={18} />}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateQuote;
