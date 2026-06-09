import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Plus, Trash, Edit, Server, ChevronDown, ChevronUp } from 'lucide-react';

const CarriersGatewaysPage = () => {
    const { isSuperAdmin } = useAuth();
    const { addToast } = useToast();
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedCarrier, setExpandedCarrier] = useState(null);

    // Modal states
    const [showCarrierModal, setShowCarrierModal] = useState(false);
    const [showEndpointModal, setShowEndpointModal] = useState(false);
    const [editingCarrier, setEditingCarrier] = useState(null);
    const [editingEndpoint, setEditingEndpoint] = useState(null);
    const [selectedCarrierId, setSelectedCarrierId] = useState(null);

    // Form states
    const [carrierName, setCarrierName] = useState('');
    const [endpointForm, setEndpointForm] = useState({
        name: '', sipHost: '', sipPort: 5060, transport: 'udp', prefix: '', stripPlus: false, callerIdMode: 'extension', callerIdNumber: '', isActive: true
    });

    useEffect(() => {
        if (isSuperAdmin) {
            fetchCarriers();
        }
    }, [isSuperAdmin]);

    const fetchCarriers = async () => {
        try {
            const { data } = await api.get('/carriers');
            setCarriers(data || []);
        } catch (error) {
            addToast('error', 'Failed to load carriers');
        } finally {
            setLoading(false);
        }
    };

    // Carrier functions
    const handleSaveCarrier = async () => {
        try {
            if (editingCarrier) {
                await api.put(`/carriers/${editingCarrier.id}`, { name: carrierName });
                addToast('success', 'Carrier updated');
            } else {
                await api.post('/carriers', { name: carrierName });
                addToast('success', 'Carrier created');
            }
            setShowCarrierModal(false);
            fetchCarriers();
        } catch (error) {
            addToast('error', error.response?.data?.message || 'Failed to save carrier');
        }
    };

    const handleDeleteCarrier = async (id) => {
        if (!window.confirm('Delete this carrier? This will also delete all endpoints.')) return;
        try {
            await api.delete(`/carriers/${id}`);
            addToast('success', 'Carrier deleted');
            fetchCarriers();
        } catch (error) {
            addToast('error', 'Failed to delete carrier');
        }
    };

    // Endpoint functions
    const handleSaveEndpoint = async () => {
        try {
            if (editingEndpoint) {
                await api.put(`/carriers/${selectedCarrierId}/endpoints/${editingEndpoint.id}`, endpointForm);
                addToast('success', 'Endpoint updated');
            } else {
                await api.post(`/carriers/${selectedCarrierId}/endpoints`, endpointForm);
                addToast('success', 'Endpoint created');
            }
            setShowEndpointModal(false);
            fetchCarriers();
        } catch (error) {
            addToast('error', error.response?.data?.message || 'Failed to save endpoint');
        }
    };

    const handleDeleteEndpoint = async (carrierId, endpointId) => {
        if (!window.confirm('Delete this endpoint?')) return;
        try {
            await api.delete(`/carriers/${carrierId}/endpoints/${endpointId}`);
            addToast('success', 'Endpoint deleted');
            fetchCarriers();
        } catch (error) {
            addToast('error', 'Failed to delete endpoint');
        }
    };

    if (!isSuperAdmin) return <div className="p-8 text-red-500 font-bold">Access Denied</div>;
    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Carriers & Gateways</h1>
                <button
                    onClick={() => { setEditingCarrier(null); setCarrierName(''); setShowCarrierModal(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
                >
                    <Plus size={16} /> Add Carrier
                </button>
            </div>

            <div className="space-y-4">
                {carriers.map(carrier => (
                    <div key={carrier.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div className="p-4 flex items-center justify-between bg-gray-50 border-b">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setExpandedCarrier(expandedCarrier === carrier.id ? null : carrier.id)}>
                                    {expandedCarrier === carrier.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                                <span className="font-semibold text-lg">{carrier.name}</span>
                                <span className="text-sm text-gray-500">({carrier.endpoints.length} endpoints)</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setSelectedCarrierId(carrier.id);
                                        setEditingEndpoint(null);
                                        setEndpointForm({ name: '', sipHost: '', sipPort: 5060, transport: 'udp', prefix: '', stripPlus: false, callerIdMode: 'extension', callerIdNumber: '', isActive: true });
                                        setShowEndpointModal(true);
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                    <Server size={14} /> Add Endpoint
                                </button>
                                <button
                                    onClick={() => { setEditingCarrier(carrier); setCarrierName(carrier.name); setShowCarrierModal(true); }}
                                    className="text-gray-600 hover:text-blue-600 ml-3"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteCarrier(carrier.id)}
                                    className="text-gray-600 hover:text-red-600"
                                >
                                    <Trash size={16} />
                                </button>
                            </div>
                        </div>

                        {expandedCarrier === carrier.id && (
                            <div className="p-4">
                                {carrier.endpoints.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No endpoints configured.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500 border-b">
                                                <th className="pb-2">Name</th>
                                                <th className="pb-2">Host:Port</th>
                                                <th className="pb-2">Transport</th>
                                                <th className="pb-2">Status</th>
                                                <th className="pb-2 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {carrier.endpoints.map(ep => (
                                                <tr key={ep.id} className="border-b last:border-0">
                                                    <td className="py-2">{ep.name}</td>
                                                    <td className="py-2">{ep.sipHost}:{ep.sipPort}</td>
                                                    <td className="py-2 uppercase">{ep.transport}</td>
                                                    <td className="py-2">
                                                        <span className={`px-2 py-1 rounded text-xs ${ep.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                            {ep.isActive ? 'Active' : 'Disabled'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedCarrierId(carrier.id);
                                                                setEditingEndpoint(ep);
                                                                setEndpointForm({ ...ep });
                                                                setShowEndpointModal(true);
                                                            }}
                                                            className="text-blue-600 hover:underline mr-3"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button onClick={() => handleDeleteEndpoint(carrier.id, ep.id)} className="text-red-600 hover:underline">
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Carrier Modal */}
            {showCarrierModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-96">
                        <h2 className="text-xl font-bold mb-4">{editingCarrier ? 'Edit Carrier' : 'New Carrier'}</h2>
                        <input
                            type="text"
                            placeholder="Carrier Name (e.g. Telnyx)"
                            className="w-full border p-2 rounded mb-4"
                            value={carrierName}
                            onChange={(e) => setCarrierName(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowCarrierModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                            <button onClick={handleSaveCarrier} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Endpoint Modal */}
            {showEndpointModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-[500px] max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">{editingEndpoint ? 'Edit Endpoint' : 'New Endpoint'}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input type="text" className="w-full border p-2 rounded" value={endpointForm.name} onChange={e => setEndpointForm({ ...endpointForm, name: e.target.value })} />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1">SIP Host / IP</label>
                                    <input type="text" className="w-full border p-2 rounded" value={endpointForm.sipHost} onChange={e => setEndpointForm({ ...endpointForm, sipHost: e.target.value })} />
                                </div>
                                <div className="w-24">
                                    <label className="block text-sm font-medium mb-1">Port</label>
                                    <input type="number" className="w-full border p-2 rounded" value={endpointForm.sipPort} onChange={e => setEndpointForm({ ...endpointForm, sipPort: parseInt(e.target.value) })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Transport</label>
                                <select className="w-full border p-2 rounded" value={endpointForm.transport} onChange={e => setEndpointForm({ ...endpointForm, transport: e.target.value })}>
                                    <option value="udp">UDP</option>
                                    <option value="tcp">TCP</option>
                                    <option value="tls">TLS</option>
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1">Dial Prefix (Optional)</label>
                                    <input type="text" className="w-full border p-2 rounded" value={endpointForm.prefix} onChange={e => setEndpointForm({ ...endpointForm, prefix: e.target.value })} />
                                </div>
                                <div className="flex items-center mt-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={endpointForm.stripPlus} onChange={e => setEndpointForm({ ...endpointForm, stripPlus: e.target.checked })} />
                                        <span className="text-sm font-medium">Strip Leading +</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Caller ID Mode</label>
                                <select className="w-full border p-2 rounded mb-2" value={endpointForm.callerIdMode} onChange={e => setEndpointForm({ ...endpointForm, callerIdMode: e.target.value })}>
                                    <option value="extension">Use Extension Caller ID</option>
                                    <option value="override">Override (Force Number)</option>
                                </select>
                                {endpointForm.callerIdMode === 'override' && (
                                    <input type="text" placeholder="Caller ID Number" className="w-full border p-2 rounded" value={endpointForm.callerIdNumber || ''} onChange={e => setEndpointForm({ ...endpointForm, callerIdNumber: e.target.value })} />
                                )}
                            </div>
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={endpointForm.isActive} onChange={e => setEndpointForm({ ...endpointForm, isActive: e.target.checked })} />
                                    <span className="text-sm font-medium">Active (Synced to Kamailio IPs)</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowEndpointModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                            <button onClick={handleSaveEndpoint} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CarriersGatewaysPage;
