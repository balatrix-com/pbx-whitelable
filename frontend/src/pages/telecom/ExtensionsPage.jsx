import React, { useEffect, useState } from 'react';
import { telecomService } from '../../services/telecom.service';
import { useAuth } from '../../context/AuthContext';
import { Users, Phone, Eye, EyeOff, Edit2, Check, AlertTriangle, Lock } from 'lucide-react';

const ExtensionsPage = () => {
    const { user } = useAuth();
    const [extensions, setExtensions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [extsData] = await Promise.all([
                    telecomService.listExtensions(user.tenantId)
                ]);
                setExtensions(extsData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    const handleEdit = (ext) => {
        setEditingId(ext.id);
        setEditName(ext.name);
    };

    const handleSave = async (extId) => {
        // Mock save
        setExtensions(extensions.map(e => e.id === extId ? { ...e, name: editName } : e));
        setEditingId(null);
    };

    const togglePassword = (extId) => {
        // Toggle view
        setExtensions(extensions.map(e => {
            if (e.id === extId) {
                return { ...e, showPass: !e.showPass };
            }
            return e;
        }));
    };

    const isLimitReached = false;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Extensions</h1>
                    <p className="text-gray-500 mt-1.5 font-medium">Manage user extensions and device configurations.</p>
                </div>
                <button className="inline-flex justify-center items-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500">
                    Add Extension
                </button>
            </div>

            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <span className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">
                        Extensions
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 ring-1 ring-inset ring-green-200/50 shadow-sm">
                        {extensions.length} Active
                    </span>
                </div>
                <ul className="divide-y divide-gray-100">
                    {extensions.map((ext) => (
                        <li key={ext.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-gray-50/80 transition-colors">
                            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                                <div className="h-12 w-12 bg-primary-50 text-primary-700 ring-1 ring-primary-100 rounded-full flex items-center justify-center font-extrabold text-lg shadow-sm">
                                    {ext.extensionNumber}
                                </div>
                                <div className="min-w-0">
                                    {editingId === ext.id ? (
                                        <div className="flex items-center space-x-2">
                                            <input
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 font-medium bg-white"
                                                autoFocus
                                            />
                                            <button onClick={() => handleSave(ext.id)} className="text-green-600 hover:text-green-700 bg-white hover:bg-green-50 p-1.5 rounded-md ring-1 ring-gray-200 transition-all shadow-sm">
                                                <Check className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-2 group/edit cursor-pointer" onClick={() => handleEdit(ext)}>
                                            <p className="text-sm font-bold text-gray-900 truncate">{ext.name}</p>
                                            <button className="text-gray-400 hover:text-primary-600 opacity-0 group-hover/edit:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded">
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center mt-1.5">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold leading-4 tracking-wide ${ext.status === 'ONLINE' ? 'bg-green-50 text-green-700 ring-1 ring-green-200/50' : ext.status === 'BUSY' ? 'bg-red-50 text-red-700 ring-1 ring-red-200/50' : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/50'}`}>
                                            <div className={`mr-1.5 h-1.5 w-1.5 rounded-full ${ext.status === 'ONLINE' ? 'bg-green-500' : ext.status === 'BUSY' ? 'bg-red-500' : 'bg-gray-400'}`} />
                                            {ext.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end sm:space-x-6 sm:pl-4">
                                <div className="flex flex-col items-start sm:items-end">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Password</span>
                                    <div className="flex items-center space-x-2">
                                        <code className="text-xs bg-gray-50 ring-1 ring-gray-200/60 rounded px-2 py-1 font-mono font-bold tracking-widest text-gray-700 shadow-sm w-24 text-center">
                                            {ext.showPass ? 'Secr3t!' : '•••••••'}
                                        </code>
                                        <button onClick={() => togglePassword(ext.id)} className="text-gray-400 hover:text-primary-600 transition-colors p-1.5 hover:bg-primary-50 rounded-md">
                                            {ext.showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {/* Mock locked slot */}
                    {extensions.length < 5 && (
                        <li className="bg-gray-50/40 p-5 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="h-12 w-12 bg-gray-100 text-gray-400 ring-1 ring-gray-200/60 rounded-full flex items-center justify-center shadow-sm">
                                    <Lock className="h-5 w-5" />
                                </div>
                                <span className="text-sm font-bold text-gray-400 italic">Available Slot</span>
                            </div>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default ExtensionsPage;
