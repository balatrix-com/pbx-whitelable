import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import api from '../../services/api';
import { 
    Palette, 
    Globe, 
    Building2, 
    Mail, 
    Phone, 
    Save, 
    Trash2, 
    Plus, 
    Edit2, 
    Check, 
    X, 
    Info, 
    Layout, 
    Loader2, 
    Settings,
    HelpCircle
} from 'lucide-react';
import clsx from 'clsx';

const BrandingSettingsPage = () => {
    const { isSuperAdmin } = useAuth();
    const { branding: globalBranding, refreshBranding } = useBranding();
    
    // Tabs
    const [activeTab, setActiveTab] = useState('current'); // 'current' | 'partners'
    
    // States for current domain settings
    const [currentBranding, setCurrentBranding] = useState({
        name: '',
        primaryColor: '#3d52a0',
        accentColor: '#ed8f55',
        logoMain: '',
        logoSidebar: '',
        favicon: '',
        supportEmail: '',
        supportPhone: '',
    });
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [savingCurrent, setSavingCurrent] = useState(false);
    const [currentDomain, setCurrentDomain] = useState(window.location.hostname);
    
    // States for partner list
    const [partners, setPartners] = useState([]);
    const [loadingPartners, setLoadingPartners] = useState(false);
    
    // Modal states for creating/editing resellers
    const [showModal, setShowModal] = useState(false);
    const [editingPartner, setEditingPartner] = useState(null);
    const [partnerForm, setPartnerForm] = useState({
        domain: '',
        name: '',
        primaryColor: '#3d52a0',
        accentColor: '#ed8f55',
        logoMain: '',
        logoSidebar: '',
        favicon: '',
        supportEmail: '',
        supportPhone: '',
    });
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        if (isSuperAdmin) {
            fetchCurrentBranding();
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        if (isSuperAdmin && activeTab === 'partners') {
            fetchPartners();
        }
    }, [isSuperAdmin, activeTab]);

    const fetchCurrentBranding = async () => {
        try {
            setLoadingCurrent(true);
            const response = await api.get('/admin/branding/current');
            if (response.data) {
                setCurrentBranding({
                    name: response.data.name || '',
                    primaryColor: response.data.primaryColor || '#3d52a0',
                    accentColor: response.data.accentColor || '#ed8f55',
                    logoMain: response.data.logoMain || '',
                    logoSidebar: response.data.logoSidebar || '',
                    favicon: response.data.favicon || '',
                    supportEmail: response.data.supportEmail || '',
                    supportPhone: response.data.supportPhone || '',
                });
            }
        } catch (error) {
            console.error('Failed to fetch current domain branding:', error);
        } finally {
            setLoadingCurrent(false);
        }
    };

    const fetchPartners = async () => {
        try {
            setLoadingPartners(true);
            const response = await api.get('/admin/partners');
            setPartners(response.data || []);
        } catch (error) {
            console.error('Failed to fetch partners:', error);
        } finally {
            setLoadingPartners(false);
        }
    };

    const handleSaveCurrent = async (e) => {
        e.preventDefault();
        try {
            setSavingCurrent(true);
            await api.put('/admin/branding/current', currentBranding);
            // Refresh branding context instantly to update UI colors & logos dynamically
            await refreshBranding();
            alert('Branding updated successfully for the current domain!');
        } catch (error) {
            console.error('Failed to save branding:', error);
            alert('Failed to save branding: ' + (error.response?.data?.message || error.message));
        } finally {
            setSavingCurrent(false);
        }
    };

    const handleOpenAddPartner = () => {
        setEditingPartner(null);
        setPartnerForm({
            domain: '',
            name: '',
            primaryColor: '#3d52a0',
            accentColor: '#ed8f55',
            logoMain: '',
            logoSidebar: '',
            favicon: '',
            supportEmail: '',
            supportPhone: '',
        });
        setShowModal(true);
    };

    const handleOpenEditPartner = (partner) => {
        setEditingPartner(partner);
        setPartnerForm({
            domain: partner.domain || '',
            name: partner.name || '',
            primaryColor: partner.primaryColor || '#3d52a0',
            accentColor: partner.accentColor || '#ed8f55',
            logoMain: partner.logoMain || '',
            logoSidebar: partner.logoSidebar || '',
            favicon: partner.favicon || '',
            supportEmail: partner.supportEmail || '',
            supportPhone: partner.supportPhone || '',
        });
        setShowModal(true);
    };

    const handleSavePartner = async (e) => {
        e.preventDefault();
        try {
            setModalLoading(true);
            if (editingPartner) {
                await api.put(`/admin/partners/${editingPartner.id}`, partnerForm);
            } else {
                await api.post('/admin/partners', partnerForm);
            }
            setShowModal(false);
            fetchPartners();
            // If the edited partner happens to be the current domain, refresh layout branding
            if (partnerForm.domain.toLowerCase() === currentDomain.toLowerCase()) {
                refreshBranding();
            }
        } catch (error) {
            console.error('Failed to save reseller partner:', error);
            alert('Failed to save partner: ' + (error.response?.data?.message || error.message));
        } finally {
            setModalLoading(false);
        }
    };

    const handleDeletePartner = async (partner) => {
        if (!window.confirm(`Are you sure you want to delete the reseller branding configuration for "${partner.domain}"?`)) {
            return;
        }
        try {
            await api.delete(`/admin/partners/${partner.id}`);
            fetchPartners();
            if (partner.domain.toLowerCase() === currentDomain.toLowerCase()) {
                refreshBranding();
            }
        } catch (error) {
            console.error('Failed to delete partner:', error);
            alert('Failed to delete partner: ' + (error.response?.data?.message || error.message));
        }
    };

    if (!isSuperAdmin) {
        return <div className="p-8 text-center text-red-600 font-bold">Access Denied</div>;
    }

    return (
        <div className="max-w-7xl mx-auto pb-12 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <header className="px-4 sm:px-0">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
                    <Palette className="text-primary-600 h-6 w-6 md:h-8 md:w-8" />
                    White-label & Branding Settings
                </h1>
                <p className="text-gray-500 mt-1 font-medium text-sm md:text-base">
                    Customize your platform theme colors, name, logos, and configure third-party reseller domains.
                </p>
            </header>

            {/* Navigation Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-4 sm:px-0" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('current')}
                        className={clsx(
                            activeTab === 'current'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                            'border-b-2 py-4 px-1 text-sm font-bold flex items-center gap-2 transition-all duration-200 focus:outline-none'
                        )}
                    >
                        <Globe size={18} />
                        Current Portal Branding
                    </button>
                    <button
                        onClick={() => setActiveTab('partners')}
                        className={clsx(
                            activeTab === 'partners'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                            'border-b-2 py-4 px-1 text-sm font-bold flex items-center gap-2 transition-all duration-200 focus:outline-none'
                        )}
                    >
                        <Building2 size={18} />
                        Partner Resellers ({partners.length})
                    </button>
                </nav>
            </div>

            {/* Tab Contents */}
            {activeTab === 'current' ? (
                loadingCurrent ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="animate-spin text-primary-600 h-8 w-8" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Settings Form */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                                <Settings className="text-slate-400 h-5 w-5" />
                                <h2 className="text-lg font-bold text-gray-900">Customization Fields</h2>
                            </div>

                            <form onSubmit={handleSaveCurrent} className="space-y-6">
                                <div className="p-4 bg-primary-50/50 border border-primary-100 rounded-xl text-primary-800 text-xs font-semibold flex items-center gap-2.5">
                                    <Info className="h-4 w-4 text-primary-600 flex-shrink-0" />
                                    <span>You are currently configuring branding for: <strong className="underline">{currentDomain}</strong></span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* App Name */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Platform Name</label>
                                        <input
                                            type="text"
                                            value={currentBranding.name}
                                            onChange={(e) => setCurrentBranding({...currentBranding, name: e.target.value})}
                                            placeholder="Cloud PBX"
                                            className="w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50"
                                            required
                                        />
                                    </div>

                                    {/* Favicon */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Favicon Path/URL</label>
                                        <input
                                            type="text"
                                            value={currentBranding.favicon}
                                            onChange={(e) => setCurrentBranding({...currentBranding, favicon: e.target.value})}
                                            placeholder="/svg logo/favicon.svg"
                                            className="w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50"
                                        />
                                    </div>

                                    {/* Logo Main */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Main Logo URL</label>
                                        <input
                                            type="text"
                                            value={currentBranding.logoMain}
                                            onChange={(e) => setCurrentBranding({...currentBranding, logoMain: e.target.value})}
                                            placeholder="/svg logo/logo-main.svg"
                                            className="w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50"
                                        />
                                    </div>

                                    {/* Logo Sidebar */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Sidebar Logo URL</label>
                                        <input
                                            type="text"
                                            value={currentBranding.logoSidebar}
                                            onChange={(e) => setCurrentBranding({...currentBranding, logoSidebar: e.target.value})}
                                            placeholder="/svg logo/logo-main.svg"
                                            className="w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50"
                                        />
                                    </div>

                                    {/* Primary Color */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Primary Brand Color</label>
                                        <div className="flex gap-3">
                                            <input
                                                type="color"
                                                value={currentBranding.primaryColor}
                                                onChange={(e) => setCurrentBranding({...currentBranding, primaryColor: e.target.value})}
                                                className="h-10 w-10 border border-gray-200 rounded-xl cursor-pointer p-0.5"
                                            />
                                            <input
                                                type="text"
                                                value={currentBranding.primaryColor}
                                                onChange={(e) => setCurrentBranding({...currentBranding, primaryColor: e.target.value})}
                                                className="flex-1 rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50 uppercase"
                                                maxLength={7}
                                            />
                                        </div>
                                    </div>

                                    {/* Accent Color */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Accent Color</label>
                                        <div className="flex gap-3">
                                            <input
                                                type="color"
                                                value={currentBranding.accentColor}
                                                onChange={(e) => setCurrentBranding({...currentBranding, accentColor: e.target.value})}
                                                className="h-10 w-10 border border-gray-200 rounded-xl cursor-pointer p-0.5"
                                            />
                                            <input
                                                type="text"
                                                value={currentBranding.accentColor}
                                                onChange={(e) => setCurrentBranding({...currentBranding, accentColor: e.target.value})}
                                                className="flex-1 rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50 uppercase"
                                                maxLength={7}
                                            />
                                        </div>
                                    </div>

                                    {/* Support Email */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <Mail size={14} className="text-gray-400" />
                                            Support Email
                                        </label>
                                        <input
                                            type="email"
                                            value={currentBranding.supportEmail}
                                            onChange={(e) => setCurrentBranding({...currentBranding, supportEmail: e.target.value})}
                                            placeholder="support@domain.com"
                                            className="w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50"
                                        />
                                    </div>

                                    {/* Support Phone */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <Phone size={14} className="text-gray-400" />
                                            Support Phone
                                        </label>
                                        <input
                                            type="text"
                                            value={currentBranding.supportPhone}
                                            onChange={(e) => setCurrentBranding({...currentBranding, supportPhone: e.target.value})}
                                            placeholder="+1-800-555-0199"
                                            className="w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-gray-100">
                                    <button
                                        type="submit"
                                        disabled={savingCurrent}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all disabled:opacity-50"
                                    >
                                        {savingCurrent ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                        Save Branding
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Brand Preview Box */}
                        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-6 space-y-6">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
                                <Layout className="text-slate-400 h-5 w-5" />
                                <h2 className="text-lg font-bold text-gray-900">Live Preview</h2>
                            </div>

                            <p className="text-xs font-medium text-gray-400">
                                See how your customization fields look rendered in the sidebar layout:
                            </p>

                            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner bg-slate-100 p-4">
                                {/* Simulated Sidebar Sidebar Header */}
                                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
                                    <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                                        <div className="h-8 w-28 bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 rounded overflow-hidden p-1 border">
                                            {currentBranding.logoSidebar || currentBranding.logoMain ? (
                                                <img 
                                                    src={currentBranding.logoSidebar || currentBranding.logoMain} 
                                                    alt="Brand Logo" 
                                                    className="h-full w-full object-contain"
                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                currentBranding.name || 'Cloud PBX'
                                            )}
                                        </div>
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-extrabold">PREVIEW</span>
                                    </div>

                                    {/* Simulated Navigation Links */}
                                    <div className="space-y-2">
                                        <div 
                                            className="rounded-lg p-2 flex items-center text-xs font-bold text-white shadow-sm"
                                            style={{ backgroundColor: currentBranding.primaryColor }}
                                        >
                                            <div className="h-4 w-4 rounded-md bg-white/20 mr-2" />
                                            Active Page
                                        </div>
                                        <div className="rounded-lg p-2 flex items-center text-xs font-bold text-gray-400 hover:bg-gray-50">
                                            <div className="h-4 w-4 rounded-md bg-gray-200 mr-2" style={{ backgroundColor: currentBranding.accentColor + '33' }} />
                                            Dashboard
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Help Desk info */}
                            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-xs font-medium text-slate-600 space-y-2">
                                <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                    <HelpCircle size={15} className="text-slate-400" />
                                    Support Settings Preview
                                </div>
                                <p>Email: <span className="font-bold text-slate-700">{currentBranding.supportEmail || 'support@telecom-platform.com'}</span></p>
                                <p>Phone: <span className="font-bold text-slate-700">{currentBranding.supportPhone || '+1-800-555-0199'}</span></p>
                            </div>
                        </div>
                    </div>
                )
            ) : (
                /* Partner Resellers Tab */
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            Reseller Sub-domains
                            <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{partners.length}</span>
                        </h2>
                        <button
                            onClick={handleOpenAddPartner}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all"
                        >
                            <Plus size={18} />
                            Add Partner Reseller
                        </button>
                    </div>

                    {loadingPartners ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-primary-600 h-8 w-8" />
                        </div>
                    ) : partners.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 font-medium">
                            No reseller custom domains configured. Click "Add Partner Reseller" to register a new domain.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Reseller Domain</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Company / Brand Name</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Primary Color</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Support Email</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">Support Phone</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-700">
                                    {partners.map((partner) => (
                                        <tr key={partner.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-4 font-extrabold text-slate-900 select-all">{partner.domain}</td>
                                            <td className="px-6 py-4">{partner.name}</td>
                                            <td className="px-6 py-4 flex items-center gap-2">
                                                <div 
                                                    className="h-5 w-5 rounded-md border border-gray-200"
                                                    style={{ backgroundColor: partner.primaryColor || '#3d52a0' }}
                                                />
                                                <span className="font-mono text-xs uppercase">{partner.primaryColor || '#3D52A0'}</span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-500">{partner.supportEmail || 'N/A'}</td>
                                            <td className="px-6 py-4 font-medium text-slate-500">{partner.supportPhone || 'N/A'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <button
                                                        onClick={() => handleOpenEditPartner(partner)}
                                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
                                                        title="Edit Reseller"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePartner(partner)}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                                                        title="Delete Reseller"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Dialog for Partner creation/editing */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden transform scale-100 transition-transform">
                        {/* Modal Header */}
                        <header className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingPartner ? 'Edit Reseller Partner' : 'Create Reseller Partner'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </header>

                        {/* Modal Form */}
                        <form onSubmit={handleSavePartner} className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Domain */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Custom Reseller Domain (host only)</label>
                                <input
                                    type="text"
                                    value={partnerForm.domain}
                                    onChange={(e) => setPartnerForm({...partnerForm, domain: e.target.value})}
                                    placeholder="app.partnerdomain.com"
                                    className="w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50"
                                    required
                                    disabled={editingPartner !== null}
                                />
                                <p className="text-[10px] text-gray-400 font-medium">Do not include http:// or ports. Users landing on this domain will load this custom brand.</p>
                            </div>

                            {/* Name */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Company/Brand Name</label>
                                <input
                                    type="text"
                                    value={partnerForm.name}
                                    onChange={(e) => setPartnerForm({...partnerForm, name: e.target.value})}
                                    placeholder="Partner Telecom Inc."
                                    className="w-full rounded-xl border-gray-200 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium bg-gray-50/50"
                                    required
                                />
                            </div>

                            {/* Colors */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Primary Color</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={partnerForm.primaryColor}
                                            onChange={(e) => setPartnerForm({...partnerForm, primaryColor: e.target.value})}
                                            className="h-10 w-10 border border-gray-200 rounded-xl cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={partnerForm.primaryColor}
                                            onChange={(e) => setPartnerForm({...partnerForm, primaryColor: e.target.value})}
                                            className="flex-1 rounded-xl border-gray-200 text-xs font-semibold uppercase bg-gray-50"
                                            maxLength={7}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Accent Color</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={partnerForm.accentColor}
                                            onChange={(e) => setPartnerForm({...partnerForm, accentColor: e.target.value})}
                                            className="h-10 w-10 border border-gray-200 rounded-xl cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={partnerForm.accentColor}
                                            onChange={(e) => setPartnerForm({...partnerForm, accentColor: e.target.value})}
                                            className="flex-1 rounded-xl border-gray-200 text-xs font-semibold uppercase bg-gray-50"
                                            maxLength={7}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Logos */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Main Logo URL</label>
                                    <input
                                        type="text"
                                        value={partnerForm.logoMain}
                                        onChange={(e) => setPartnerForm({...partnerForm, logoMain: e.target.value})}
                                        placeholder="/svg logo/logo-main.svg"
                                        className="w-full rounded-xl border-gray-200 text-xs bg-gray-50"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Sidebar Logo URL</label>
                                    <input
                                        type="text"
                                        value={partnerForm.logoSidebar}
                                        onChange={(e) => setPartnerForm({...partnerForm, logoSidebar: e.target.value})}
                                        placeholder="/svg logo/logo-main.svg"
                                        className="w-full rounded-xl border-gray-200 text-xs bg-gray-50"
                                    />
                                </div>
                            </div>

                            {/* Favicon */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Favicon Path/URL</label>
                                <input
                                    type="text"
                                    value={partnerForm.favicon}
                                    onChange={(e) => setPartnerForm({...partnerForm, favicon: e.target.value})}
                                    placeholder="/svg logo/favicon.svg"
                                    className="w-full rounded-xl border-gray-200 text-xs bg-gray-50"
                                />
                            </div>

                            {/* Support contact info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Support Email</label>
                                    <input
                                        type="email"
                                        value={partnerForm.supportEmail}
                                        onChange={(e) => setPartnerForm({...partnerForm, supportEmail: e.target.value})}
                                        placeholder="support@partner.com"
                                        className="w-full rounded-xl border-gray-200 text-xs bg-gray-50"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Support Phone</label>
                                    <input
                                        type="text"
                                        value={partnerForm.supportPhone}
                                        onChange={(e) => setPartnerForm({...partnerForm, supportPhone: e.target.value})}
                                        placeholder="+1-800-555-0100"
                                        className="w-full rounded-xl border-gray-200 text-xs bg-gray-50"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalLoading}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all disabled:opacity-50"
                                >
                                    {modalLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                    Save Reseller
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrandingSettingsPage;
