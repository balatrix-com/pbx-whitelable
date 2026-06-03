import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { clsx } from 'clsx';
import { Users, Shield, UserPlus, Activity, Trash2, CheckCircle2, Ban, Eye, X, ShieldCheck, Mail, Calendar } from 'lucide-react';
import ActivityModal from '../../components/admin/ActivityModal';
import MonitoringExtensionModal from '../../components/admin/MonitoringExtensionModal';
import Pagination from '../../components/common/Pagination';

const UserManagement = () => {
    const { user, isSuperAdmin, isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [showMonitoringModal, setShowMonitoringModal] = useState(false);
    const [monitoringTarget, setMonitoringTarget] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1
    });

    useEffect(() => {
        fetchUsers();
    }, [pagination.page]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/users?page=${pagination.page}&limit=${pagination.limit}`);
            setUsers(response.data.data || []);
            setPagination(prev => ({
                ...prev,
                total: response.data.pagination?.total || 0,
                totalPages: response.data.pagination?.totalPages || 1
            }));
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    const handleInviteUser = async (email, name) => {
        try {
            const response = await api.post('/users/support/invite', { email, name });
            fetchUsers();
            return response.data;
        } catch (error) {
            console.error('Failed to invite user:', error);
            throw error;
        }
    };

    const handleUpdateStatus = async (userId, newStatus) => {
        const targetUser = users.find(u => u.id === userId);

        if (userId === user.id) {
            alert('You cannot modify your own account');
            return;
        }

        try {
            if (newStatus === 'DELETED') {
                await api.delete(`/users/${userId}`);
            } else {
                const action = newStatus === 'SUSPENDED' ? 'suspend' : 'activate';
                if (!window.confirm(`Are you sure you want to ${action} ${targetUser.email}?`)) {
                    return;
                }
                await api.patch(`/users/${userId}/status`, { status: newStatus });
            }
            fetchUsers();
        } catch (error) {
            console.error('Failed to update status:', error);
            alert('Failed to update user status');
        }
    };

    const handleToggleMonitoring = async (userId, currentValue) => {
        if (userId === user.id) {
            alert('You cannot modify your own account');
            return;
        }

        if (!currentValue) {
            setMonitoringTarget(userId);
            setShowMonitoringModal(true);
        } else {
            try {
                await api.patch(`/users/${userId}/permissions`, { monitoringEnabled: false });
                fetchUsers();
            } catch (error) {
                console.error('Failed to disable monitoring:', error);
            }
        }
    };

    const handleEnableMonitoring = async ({ monitoringExtension, monitoringSecret, name }) => {
        if (!monitoringTarget) return;
        try {
            await api.patch(`/users/${monitoringTarget}/permissions`, {
                monitoringEnabled: true,
                monitoringExtension,
                monitoringSecret,
                name
            });
            setShowMonitoringModal(false);
            setMonitoringTarget(null);
            fetchUsers();
        } catch (error) {
            console.error('Failed to enable monitoring:', error);
            alert('Failed to enable monitoring: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleViewActivity = async (user) => {
        setSelectedUser(user);
        setShowActivityModal(true);
    };

    if (!isAdmin && !isSuperAdmin) {
        return <div className="p-8 font-bold text-red-500">Access Denied</div>;
    }

    return (
        <div className="max-w-7xl mx-auto pb-12 space-y-8 px-4 sm:px-6 lg:px-8">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900 flex items-center gap-3">
                        <div className="bg-primary-600 p-2 rounded-2xl shadow-lg shadow-primary-600/20">
                            <ShieldCheck className="text-white h-7 w-7" />
                        </div>
                        Staff Management
                    </h1>
                    <p className="mt-2 text-gray-500 font-medium">Control internal access and monitor administrative operations.</p>
                </div>
                <button
                    className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-6 py-3 text-sm font-black text-white shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all active:scale-95 w-full md:w-auto"
                    onClick={() => setShowInviteModal(true)}
                >
                    <UserPlus size={20} />
                    Invite Staff
                </button>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm ring-1 ring-gray-100 flex items-center gap-5">
                    <div className="p-3 rounded-2xl bg-primary-50">
                        <Shield className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Admins</p>
                        <p className="text-2xl font-black text-gray-900">{users.filter(u => u.role === 'ADMIN').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm ring-1 ring-gray-100 flex items-center gap-5">
                    <div className="p-3 rounded-2xl bg-blue-50">
                        <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Support Team</p>
                        <p className="text-2xl font-black text-gray-900">{users.filter(u => u.role === 'SUPPORT').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm ring-1 ring-gray-100 flex items-center gap-5">
                    <div className="p-3 rounded-2xl bg-emerald-50">
                        <UserPlus className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Now</p>
                        <p className="text-2xl font-black text-gray-900">{users.filter(u => u.status === 'ACTIVE').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm ring-1 ring-gray-100 flex items-center gap-5">
                    <div className="p-3 rounded-2xl bg-red-50">
                        <Ban className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suspended</p>
                        <p className="text-2xl font-black text-gray-900">{users.filter(u => u.status === 'SUSPENDED').length}</p>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Team Member</th>
                                <th scope="col" className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Status</th>
                                <th scope="col" className="hidden lg:table-cell px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">System Role</th>
                                <th scope="col" className="hidden xl:table-cell px-6 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Monitor</th>
                                <th scope="col" className="px-6 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Control</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-8"><div className="h-4 bg-gray-100 rounded-full w-full"></div></td>
                                    </tr>
                                ))
                            ) : (
                                users.map(u => (
                                    <UserRow
                                        key={u.id}
                                        user={u}
                                        currentUserId={user.id}
                                        onUpdateStatus={handleUpdateStatus}
                                        onToggleMonitoring={handleToggleMonitoring}
                                        onViewActivity={handleViewActivity}
                                        isSuperAdmin={isSuperAdmin}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6">
                    <Pagination
                        pagination={pagination}
                        onPageChange={handlePageChange}
                    />
                </div>
            </div>

            {showInviteModal && (
                <InviteModal
                    onClose={() => setShowInviteModal(false)}
                    onInvite={handleInviteUser}
                />
            )}

            {showActivityModal && selectedUser && (
                <ActivityModal
                    userId={selectedUser.id}
                    email={selectedUser.email}
                    onClose={() => {
                        setShowActivityModal(false);
                        setSelectedUser(null);
                    }}
                />
            )}

            {showMonitoringModal && (
                <MonitoringExtensionModal
                    onClose={() => {
                        setShowMonitoringModal(false);
                        setMonitoringTarget(null);
                    }}
                    onSubmit={handleEnableMonitoring}
                    initialName={users.find(u => u.id === monitoringTarget)?.name || ''}
                />
            )}
        </div>
    );
};

const UserRow = ({ user, currentUserId, onUpdateStatus, onToggleMonitoring, onViewActivity, isSuperAdmin }) => {
    const isSelf = user.id === currentUserId;

    const getStatusStyles = (status) => {
        const styles = {
            ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
            INVITED: 'bg-blue-50 text-blue-700 ring-blue-600/10',
            SUSPENDED: 'bg-red-50 text-red-700 ring-red-600/10',
            DELETED: 'bg-gray-50 text-gray-700 ring-gray-600/10'
        };
        return styles[status] || 'bg-gray-50 text-gray-700';
    };

    return (
        <tr className={clsx(
            "hover:bg-gray-50/50 transition-all duration-200 group",
            isSelf && "bg-primary-50/30"
        )}>
            <td className="px-6 py-5 whitespace-nowrap">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center font-black text-sm text-gray-500 uppercase group-hover:bg-primary-600 group-hover:text-white transition-all">
                        {user.name ? user.name.substring(0, 2) : user.email.substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            {user.email}
                            {isSelf && <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter shadow-sm">You</span>}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{user.name || '-'}</span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-5 whitespace-nowrap">
                <span className={clsx(
                    "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm ring-1",
                    getStatusStyles(user.status)
                )}>
                    {user.status}
                </span>
            </td>
            <td className="hidden lg:table-cell px-6 py-5 whitespace-nowrap">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Shield size={14} className="text-gray-300" />
                    {user.role}
                </span>
            </td>
            <td className="hidden xl:table-cell px-6 py-5 whitespace-nowrap text-center">
                <button
                    onClick={() => onToggleMonitoring(user.id, user.monitoringEnabled)}
                    disabled={isSelf || !isSuperAdmin}
                    className={clsx(
                        "relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none ring-offset-2",
                        user.monitoringEnabled ? 'bg-primary-600 ring-primary-600' : 'bg-gray-200 ring-gray-100',
                        (isSelf || !isSuperAdmin) && 'opacity-30 cursor-not-allowed'
                    )}
                >
                    <span
                        className={clsx(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-300 ease-in-out",
                            user.monitoringEnabled ? 'translate-x-5' : 'translate-x-0'
                        )}
                    />
                </button>
            </td>
            <td className="px-6 py-5 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                    <button
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        onClick={() => onViewActivity(user)}
                        title="Audit Logs"
                    >
                        <Activity size={18} />
                    </button>
                    
                    {user.status === 'ACTIVE' ? (
                        <button
                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all disabled:opacity-20"
                            onClick={() => onUpdateStatus(user.id, 'SUSPENDED')}
                            disabled={isSelf}
                            title="Suspend"
                        >
                            <Ban size={18} />
                        </button>
                    ) : user.status === 'SUSPENDED' ? (
                        <button
                            className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-20"
                            onClick={() => onUpdateStatus(user.id, 'ACTIVE')}
                            disabled={isSelf}
                            title="Re-activate"
                        >
                            <CheckCircle2 size={18} />
                        </button>
                    ) : null}

                    <button
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-20"
                        onClick={() => {
                            if (window.confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
                                onUpdateStatus(user.id, 'DELETED');
                            }
                        }}
                        disabled={isSelf}
                        title="Permanently Delete"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

const InviteModal = ({ onClose, onInvite }) => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [inviteLink, setInviteLink] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await onInvite(email, name);
            const link = `${window.location.origin}/invite/accept?token=${data.inviteToken}`;
            setInviteLink(link);
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Failed to send invite';
            setError(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (e) => {
        if (e) e.preventDefault();
        navigator.clipboard.writeText(inviteLink).then(() => {
            alert('Link copied to clipboard!');
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/20">
                <header className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary-50 p-3 rounded-2xl">
                            <Mail className="text-primary-600 h-6 w-6" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">{inviteLink ? 'Invite Sent' : 'Team Invite'}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                        <X size={24} className="text-gray-400" />
                    </button>
                </header>

                <div className="p-10 bg-white">
                    {inviteLink ? (
                        <div className="space-y-8">
                            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl">
                                <p className="text-sm text-emerald-800 font-bold leading-relaxed text-center">
                                    Invitation generated successfully.<br/>Copy the link below to share.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="p-4 bg-gray-50 rounded-2xl ring-1 ring-gray-100 break-all text-xs font-mono font-bold text-gray-500">
                                    {inviteLink}
                                </div>
                                <button
                                    onClick={copyToClipboard}
                                    className="w-full py-4 bg-gray-900 text-white text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-gray-900/20 active:scale-95 transition-all"
                                >
                                    Copy Link
                                </button>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-600/20 active:scale-95 transition-all"
                            >
                                Done
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-4 h-5 w-5 text-gray-300" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-primary-600 font-bold transition-all"
                                        placeholder="user@balatrix.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                                <div className="relative">
                                    <Users className="absolute left-4 top-4 h-5 w-5 text-gray-300" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-primary-600 font-bold transition-all"
                                        placeholder="Full Name"
                                    />
                                </div>
                            </div>
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold">
                                    <Ban size={16} /> {error}
                                </div>
                            )}
                            <div className="flex flex-col gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-primary-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Processing...' : 'Send Invitation'}
                                    {!loading && <UserPlus size={18} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full py-4 bg-white text-gray-400 rounded-2xl font-bold text-sm border border-gray-100 hover:bg-gray-50 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
