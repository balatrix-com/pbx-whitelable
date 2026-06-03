import React, { useState, useEffect } from 'react';
import { plansService } from '../../services/plans.service';
import PlanBuilder from './PlanBuilder';
import { Plus, Edit, Trash2, CheckCircle, Package, Smartphone, Users, Globe, Clock, DollarSign } from 'lucide-react';

const CustomPlansPage = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showBuilder, setShowBuilder] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const allPlans = await plansService.getAll();
            // Filter only custom plans for this view
            const customPlans = allPlans.filter(p => p.isCustom);
            setPlans(customPlans);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePlanSaved = () => {
        setShowBuilder(false);
        fetchPlans();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Custom Plans</h1>
                        <p className="text-gray-500">Manage your tailored pricing plans for sales quotes.</p>
                    </div>
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Create New Plan
                    </button>
                </div>

                {showBuilder && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                            <div className="p-2">
                                <PlanBuilder
                                    onPlanSaved={handlePlanSaved}
                                    onClose={() => setShowBuilder(false)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading plans...</div>
                ) : plans.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                        <Package size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">No Custom Plans Yet</h3>
                        <p className="text-gray-500 mb-6">Create your first custom plan to get started.</p>
                        <button
                            onClick={() => setShowBuilder(true)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Create Plan
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map(plan => (
                            <div key={plan.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                                            <p className="text-sm text-gray-500">{plan.description || 'No description'}</p>
                                        </div>
                                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold uppercase">
                                            {plan.billingCycle}
                                        </span>
                                    </div>

                                    <div className="text-3xl font-bold text-gray-900 mb-6">
                                        ${Number(plan.price).toFixed(2)}
                                        <span className="text-sm font-normal text-gray-500">/{plan.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
                                    </div>

                                    <div className="space-y-3 text-sm text-gray-600 mb-6">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} className="text-blue-500" />
                                            <span>{plan.freeMinutes} Free Minutes</span>
                                        </div>
                                        {Number(plan.initialCredit) > 0 && (
                                            <div className="flex items-center gap-2">
                                                <DollarSign size={16} className="text-green-500" />
                                                <span>${Number(plan.initialCredit)} Initial Credit</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <Smartphone size={16} className="text-gray-400" />
                                            <span>{plan.maxDIDs === 0 ? 'Unmetered' : plan.maxDIDs} DIDs</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Globe size={16} className="text-gray-400" />
                                            <span>{plan.maxTFNs || 0} Toll-Free Numbers</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users size={16} className="text-gray-400" />
                                            <span>{plan.maxExtensions === 0 ? 'Unmetered' : plan.maxExtensions} Extensions</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t flex justify-between items-center text-xs text-gray-400">
                                        <span>Tier: {plan.tier}</span>
                                        {/* Future: Add Edit/Delete buttons here */}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomPlansPage;
