import React, { useState } from 'react';
import { plansService } from '../../services/plans.service';
import { Save, Plus, DollarSign, Clock, Hash, Users, Server, Globe } from 'lucide-react';

const PlanBuilder = ({ onPlanSaved, onClose }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        billingCycle: 'MONTHLY', // MONTHLY or YEARLY
        tier: 'BASIC', // BASIC, STANDARD, PREMIUM, ENTERPRISE
        price: '',
        freeMinutes: 0,
        initialCredit: 0,
        maxDIDs: 1,
        maxExtensions: 5,
        maxRingGroups: 0,
        maxIVRs: 0,
        allowVoicemail: true,
        allowCallRecording: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Convert numbers
            const payload = {
                ...formData,
                price: parseFloat(formData.price),
                freeMinutes: parseInt(formData.freeMinutes),
                initialCredit: parseFloat(formData.initialCredit),
                maxDIDs: parseInt(formData.maxDIDs),
                maxTFNs: parseInt(formData.maxTFNs),
                maxExtensions: parseInt(formData.maxExtensions),
                maxRingGroups: parseInt(formData.maxRingGroups),
                maxIVRs: parseInt(formData.maxIVRs)
            };

            await plansService.createCustom(payload);

            if (onPlanSaved) onPlanSaved();
            if (onClose) onClose();
            else {
                // If used as standalone page, maybe redirect?
                // But typically this component is used in a modal or sidebar.
                alert('Plan saved successfully!');
                // Reset form?
                setFormData({ ...formData, name: '' });
            }

        } catch (err) {
            console.error(err);
            setError('Failed to save plan. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Plus size={24} className="text-green-600" />
                Build Custom Plan
            </h3>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="e.g. Startup Special"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                            type="text"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Optional description"
                        />
                    </div>
                </div>

                {/* Pricing & Cycle */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <DollarSign size={14} /> Price
                        </label>
                        <input
                            type="number"
                            name="price"
                            value={formData.price}
                            onChange={handleChange}
                            required
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                        <select
                            name="billingCycle"
                            value={formData.billingCycle}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                            <option value="MONTHLY">Monthly</option>
                            <option value="YEARLY">Yearly</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tier Base</label>
                        <select
                            name="tier"
                            value={formData.tier}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                            <option value="BASIC">Basic</option>
                            <option value="STANDARD">Standard</option>
                            <option value="PREMIUM">Premium</option>
                            <option value="ENTERPRISE">Enterprise</option>
                        </select>
                    </div>
                </div>

                {/* Inclusions */}
                <h4 className="font-semibold text-gray-900 border-b pb-2">Inclusions & Limits</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <DollarSign size={14} className="text-green-600" /> Initial Wallet Credit
                        </label>
                        <input
                            type="number"
                            name="initialCredit"
                            value={formData.initialCredit}
                            onChange={handleChange}
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Amount credited to wallet"
                        />
                        <p className="text-xs text-gray-500 mt-1">Free balance given on signup.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                            <Clock size={14} className="text-blue-600" /> Free Minutes
                        </label>
                        <input
                            type="number"
                            name="freeMinutes"
                            value={formData.freeMinutes}
                            onChange={handleChange}
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max DIDs</label>
                        <input
                            type="number"
                            name="maxDIDs"
                            value={formData.maxDIDs}
                            onChange={handleChange}
                            min="0"
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max TFNs</label>
                        <input
                            type="number"
                            name="maxTFNs"
                            value={formData.maxTFNs || 0}
                            onChange={handleChange}
                            min="0"
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max Extensions</label>
                        <input
                            type="number"
                            name="maxExtensions"
                            value={formData.maxExtensions}
                            onChange={handleChange}
                            min="0"
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max Ring Groups</label>
                        <input
                            type="number"
                            name="maxRingGroups"
                            value={formData.maxRingGroups}
                            onChange={handleChange}
                            min="0"
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Max IVRs</label>
                        <input
                            type="number"
                            name="maxIVRs"
                            value={formData.maxIVRs}
                            onChange={handleChange}
                            min="0"
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                    </div>
                </div>

                {/* Features */}
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            name="allowVoicemail"
                            checked={formData.allowVoicemail}
                            onChange={handleChange}
                            className="rounded text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">Voicemail</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            name="allowCallRecording"
                            checked={formData.allowCallRecording}
                            onChange={handleChange}
                            className="rounded text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">Call Recording</span>
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {loading ? 'Saving...' : 'Save Custom Plan'}
                    </button>
                </div>
            </form >
        </div >
    );
};

export default PlanBuilder;
