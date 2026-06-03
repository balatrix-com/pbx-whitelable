
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Plus, Copy, Check, ExternalLink, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const SalesDashboard = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchQuotes();
    }, []);

    const fetchQuotes = async () => {
        try {
            setLoading(true);
            const response = await api.get('/sales/quotes');
            setQuotes(response.data);
        } catch (err) {
            console.error('Error fetching quotes:', err);
            addToast('error', 'Failed to load quotes');
        } finally {
            setLoading(false);
        }
    };

    const copyLink = (token) => {
        const url = `${window.location.origin}/onboarding/${token}`;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(() => {
                addToast('success', 'Link copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy link:', err);
                addToast('error', 'Failed to copy link. Please copy manually.');
            });
        } else {
            // Fallback for non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = url;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    addToast('success', 'Link copied to clipboard');
                } else {
                    addToast('error', 'Failed to copy link. Please copy manually.');
                }
            } catch (err) {
                console.error('Fallback copy error', err);
                addToast('error', 'Failed to copy link. Please copy manually.');
            }
            document.body.removeChild(textArea);
        }
    };

    const handleDeleteQuote = async (id) => {
        if (!window.confirm('Are you sure you want to delete this quote?')) return;
        try {
            await api.delete(`/sales/quotes/${id}`);
            addToast('success', 'Quote deleted successfully');
            fetchQuotes();
        } catch (error) {
            console.error('Failed to delete quote:', error);
            addToast('error', 'Failed to delete quote');
        }
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            DRAFT: 'bg-gray-100 text-gray-800',
            SENT: 'bg-blue-100 text-blue-800',
            PAID: 'bg-green-100 text-green-800',
            CONVERTED: 'bg-purple-100 text-purple-800',
            EXPIRED: 'bg-red-100 text-red-800',
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.DRAFT}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">Sales Dashboard</h1>
                    <p className="text-gray-500 mt-1 font-medium text-sm md:text-base">Manage quotes and onboarding links</p>
                </div>
                <button
                    onClick={() => navigate('/sales/quotes/new')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 active:scale-[0.98]"
                >
                    <Plus size={20} />
                    Create Quote
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading quotes...</div>
            ) : quotes.length === 0 ? (
                <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-2xl">
                        💼
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No quotes yet</h3>
                    <p className="text-gray-500 mt-1 mb-6">Create your first quote to onboard a customer.</p>
                    <button
                        onClick={() => navigate('/sales/quotes/new')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Create Quote
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quotes.map((quote) => (
                        <div key={quote.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg text-gray-900">{quote.customerCompany || quote.customerName}</h3>
                                    <p className="text-sm text-gray-500">{quote.customerEmail}</p>
                                </div>
                                <StatusBadge status={quote.status} />
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Plan</span>
                                    <span className="font-medium text-gray-900">
                                        {quote.pricingSnapshot ? 'Custom Quote' : (quote.plan?.name || 'Unknown')}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Price</span>
                                    <span className="font-medium text-gray-900">
                                        {quote.pricingSnapshot
                                            ? `$${quote.pricingSnapshot.subtotal?.toFixed(2)} / mo`
                                            : `$${parseFloat(quote.customPrice || quote.plan?.price || 0).toFixed(2)} / ${quote.plan?.billingCycle}`}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Expires</span>
                                    <span className="text-gray-700">{new Date(quote.expiresAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => copyLink(quote.token)}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <Copy size={16} />
                                    Copy Link
                                </button>
                                {quote.status !== 'CONVERTED' && (
                                    <button
                                        onClick={() => handleDeleteQuote(quote.id)}
                                        className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                        title="Delete Draft"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                {quote.status === 'CONVERTED' && quote.tenantId && (
                                    <button
                                        onClick={() => navigate(`/admin/tenants/${quote.tenantId}`)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                        <ExternalLink size={16} />
                                        View Tenant
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SalesDashboard;
