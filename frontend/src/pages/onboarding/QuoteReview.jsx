
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { CheckCircle, AlertCircle } from 'lucide-react';

const QuoteReview = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchQuote();
    }, [token]);

    const fetchQuote = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/onboarding/${token}`);
            setQuote(response.data);
        } catch (err) {
            console.error('Error fetching quote:', err);
            const msg = err.response?.data?.message || err.message || 'Invalid or expired link';
            setError(Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'object' ? JSON.stringify(msg) : msg));
        } finally {
            setLoading(false);
        }
    };

    const handleProceed = () => {
        navigate(`/onboarding/${token}/payment`);
    };

    if (loading) return <div className="text-center py-8">Loading your plan...</div>;

    if (error) return (
        <div className="text-center py-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Unable to load quote</h3>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
    );

    const telecom = quote.telecomDetails || {};

    return (
        <div>
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Welcome, {quote.customerCompany || quote.customerName}!</h2>
                <p className="text-gray-500 mt-2">We have prepared a custom plan for you.</p>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 mb-8">
                {quote.pricingSnapshot ? (
                    <div>
                        <h3 className="font-bold text-lg text-blue-900 mb-4 border-b border-blue-200 pb-2">Custom Quote</h3>
                        <div className="space-y-3">
                            {quote.pricingSnapshot.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm text-blue-900">
                                    <span>{item.label} <span className="opacity-70">x{item.quantity || item.qty}</span></span>
                                    <span className="font-semibold">${item.total?.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="pt-3 mt-3 border-t border-blue-200 flex justify-between items-center font-bold text-lg text-blue-900">
                                <span>Total Recurring</span>
                                <span>${quote.pricingSnapshot.subtotal?.toFixed(2)} <span className="text-xs font-normal opacity-70">/mo</span></span>
                            </div>
                            {quote.pricingSnapshot.totalOneTime > 0 && (
                                <div className="flex justify-between items-center text-sm text-blue-800">
                                    <span>One-time Fees</span>
                                    <span>${quote.pricingSnapshot.totalOneTime?.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-blue-900">{quote.plan?.name} Plan</h3>
                            <span className="text-xl font-bold text-blue-700">
                                ${parseFloat(quote.customPrice || quote.plan?.price || 0).toFixed(2)}
                                <span className="text-sm font-normal text-blue-600">/{quote.plan?.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
                            </span>
                        </div>
                        <ul className="space-y-2 text-blue-800 text-sm">
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-blue-600" />
                                {quote.plan?.freeMinutes} Free Minutes Included
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-blue-600" />
                                {telecom.extensionCount || quote.plan?.maxExtensions} Extensions
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-blue-600" />
                                {telecom.didCount || quote.plan?.maxDIDs} Phone Numbers
                            </li>
                        </ul>
                    </>
                )}
            </div>

            <div className="border-t border-gray-100 pt-6">
                <button
                    onClick={handleProceed}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                    Proceed to Payment & Setup
                </button>
            </div>
        </div>
    );
};

export default QuoteReview;
