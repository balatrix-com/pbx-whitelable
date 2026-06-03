import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ShieldCheck, Loader2, CreditCard } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const PaymentSetup = () => {
    const { token } = useParams();
    const { addToast } = useToast();
    const [quote, setQuote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchQuote();
    }, [token]);

    const fetchQuote = async () => {
        try {
            const res = await api.get(`/onboarding/${token}`);
            setQuote(res.data);
        } catch (err) {
            console.error(err);
            addToast('error', 'Failed to load quote details');
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async () => {
        setProcessing(true);
        try {
            // Initiate Stripe Checkout via Onboarding Controller
            const res = await api.post(`/onboarding/${token}/checkout`);
            if (res.data.url) {
                window.location.href = res.data.url;
            } else {
                throw new Error("No payment URL returned");
            }
        } catch (err) {
            console.error(err);
            addToast('error', 'Failed to initiate payment');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!quote) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Quote Not Found</h2>
                    <p className="text-gray-500 mt-2">The quote you are looking for does not exist or has expired.</p>
                </div>
            </div>
        );
    }

    // Parse items if specific format, or use pricingSnapshot
    const lineItems = quote.pricingSnapshot?.items || [];
    const totalRecurring = quote.pricingSnapshot?.subtotal || 0;
    const totalOneTime = quote.pricingSnapshot?.totalOneTime || 0;
    const totalDue = totalRecurring + totalOneTime;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Complete Your Order</h1>
                    <p className="mt-2 text-lg text-gray-600">
                        Review your plan and proceed to secure payment.
                    </p>
                </div>

                <Card className="border-t-4 border-t-blue-600 shadow-lg">
                    <CardHeader className="bg-white border-b border-gray-100 pb-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl font-bold text-gray-900">Quote #{quote.quoteNumber}</CardTitle>
                                <CardDescription className="mt-1">
                                    Prepared for <span className="font-medium text-gray-900">{quote.customerCompany}</span>
                                </CardDescription>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-500">Total Due Today</div>
                                <div className="text-3xl font-bold text-blue-600">
                                    ${totalDue.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {/* Line Items Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Description</th>
                                        <th className="px-6 py-3 font-medium text-right">Qty</th>
                                        <th className="px-6 py-3 font-medium text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {lineItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {item.label}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">{item.quantity || item.qty}</td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">${Number(item.total).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 font-medium text-gray-900">
                                    <tr>
                                        <td className="px-6 py-4" colSpan="2">Recurring Charges (Monthly)</td>
                                        <td className="px-6 py-4 text-right">${Number(totalRecurring).toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-4" colSpan="2">One-Time Charges</td>
                                        <td className="px-6 py-4 text-right">${Number(totalOneTime).toFixed(2)}</td>
                                    </tr>
                                    <tr className="bg-gray-900 text-white text-lg">
                                        <td className="px-6 py-5 font-bold" colSpan="2">Total</td>
                                        <td className="px-6 py-5 text-right font-bold">
                                            ${totalDue.toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Payment Action */}
                        <div className="p-8 bg-gray-50 flex flex-col items-center justify-center space-y-4 border-t border-gray-100">
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                <ShieldCheck className="h-4 w-4 text-green-600" />
                                <span>Secure payment processing via Stripe</span>
                            </div>

                            <Button
                                size="lg"
                                onClick={handlePayment}
                                disabled={processing}
                                className="w-full max-w-md bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 text-lg shadow-xl shadow-blue-200 transition-all hover:scale-[1.02]"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Redirecting...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="mr-2 h-5 w-5" />
                                        Pay with Stripe
                                    </>
                                )}
                            </Button>

                            <p className="text-xs text-center text-gray-400 max-w-sm mt-4">
                                You will be redirected to Stripe's secure checkout page to complete your purchase.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PaymentSetup;
