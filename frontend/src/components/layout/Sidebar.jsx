import React from 'react';
import { clsx } from 'clsx';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import {
    LayoutDashboard,
    CreditCard,
    Wallet,
    Phone,
    Users,
    BarChart3,
    Settings,
    Activity,
    PhoneCall,
    Globe,
    Shield,
    Briefcase,
    Music,
    LogOut,
    User,
    PhoneForwarded,
    ScrollText,
    Building2,
    Server
} from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment, useState } from 'react';
import { UserProfileModal } from '../profile';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const { user, logout } = useAuth();
    const { branding } = useBranding();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const location = useLocation();
    const role = user?.role;
    
    // Resolve branding (User's tenant partner or domain-resolved fallback)
    const currentBranding = user?.partner || branding;


    // ... existing nav items logic ...
    const getNavItems = (role) => {
        const canMonitor = user?.role === 'SUPER_ADMIN' || user?.monitoringEnabled;

        let items = [];
        switch (role) {
            case 'SUPER_ADMIN':
                items = [
                    { name: 'Platform Dashboard', href: '/platform', icon: LayoutDashboard },
                    { name: 'Tenants', href: '/tenants', icon: Building2 },
                    { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield },
                    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
                    { name: 'Revenue', href: '/revenue', icon: BarChart3 },
                    { name: 'Rate Cards', href: '/super-admin/rate-cards', icon: CreditCard },
                    { name: 'Packages', href: '/super-admin/packages', icon: Briefcase },
                    { name: 'Manage Numbers', href: '/super-admin/numbers', icon: Phone },
                    { name: 'Carriers & Gateways', href: '/super-admin/carriers', icon: Server },
                    { name: 'User Management', href: '/super-admin/users', icon: Users },
                    { name: 'System Settings', href: '/settings', icon: Settings },
                ];
                break;
            case 'ADMIN':
                items = [
                    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
                    { name: 'Wallet', href: '/wallet', icon: Wallet },
                    { name: 'Phone Numbers', href: '/tfn', icon: Phone },
                    { name: 'Extensions', href: '/extensions', icon: Users },
                    { name: 'Ring Groups', href: '/telecom/ring-groups', icon: Users },
                    { name: 'IVR Menus', href: '/telecom/ivrs', icon: PhoneCall },
                    { name: 'Audio Library', href: '/telecom/audio', icon: Music },
                    { name: 'DIDs', href: '/telecom/dids', icon: Phone },
                    { name: 'DID Forwards', href: '/telecom/did-forwards', icon: PhoneForwarded },
                    { name: 'Schedules', href: '/telecom/schedules', icon: Activity },
                    { name: 'Call Monitoring', href: '/monitoring', icon: Activity },
                    { name: 'Call Records', href: '/cdrs', icon: PhoneCall },
                    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
                    { name: 'User Management', href: '/users', icon: Settings },
                ];
                break;

            case 'SUPPORT':
                items = [
                    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
                    { name: 'Wallet', href: '/wallet', icon: Wallet },
                    { name: 'Phone Numbers', href: '/tfn', icon: Phone },
                    { name: 'Extensions', href: '/telecom/extensions', icon: Users },
                    { name: 'Ring Groups', href: '/telecom/ring-groups', icon: Users },
                    { name: 'IVR Menus', href: '/telecom/ivrs', icon: PhoneCall },
                    { name: 'Audio Library', href: '/telecom/audio', icon: Music },
                    { name: 'DIDs', href: '/telecom/dids', icon: Phone },
                    { name: 'DID Forwards', href: '/telecom/did-forwards', icon: PhoneForwarded },
                    { name: 'Schedules', href: '/telecom/schedules', icon: Activity },
                    { name: 'Call Monitoring', href: '/monitoring', icon: Activity },
                    { name: 'Call Records', href: '/cdrs', icon: PhoneCall },
                ];
                break;
            default:
                items = [];
        }

        if (!canMonitor) {
            items = items.filter(item => item.name !== 'Call Monitoring');
        }

        // Apply tenant feature controls if the user is not a global SUPER_ADMIN
        if (role !== 'SUPER_ADMIN') {
            const features = user?.tenant?.tenantFeatures || {
                ivrEnabled: true,
                ringGroupEnabled: true,
                schedulerEnabled: true,
                didForwardEnabled: true,
                monitorEnabled: true,
            };

            if (!features.ivrEnabled) {
                items = items.filter(item => item.name !== 'IVR Menus');
            }
            if (!features.ringGroupEnabled) {
                items = items.filter(item => item.name !== 'Ring Groups');
            }
            if (!features.schedulerEnabled) {
                items = items.filter(item => item.name !== 'Schedules');
            }
            if (!features.didForwardEnabled) {
                items = items.filter(item => item.name !== 'DID Forwards');
            }
            if (!features.monitorEnabled) {
                items = items.filter(item => item.name !== 'Call Monitoring');
            }
        }

        return items;
    };

    const navItems = getNavItems(role);

    return (
        <div className={clsx(
            "fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out lg:static lg:flex lg:translate-x-0 shadow-2xl lg:shadow-none",
            isOpen ? "translate-x-0" : "-translate-x-full"
        )}>
            {/* Brand Header */}
            <div className="flex h-16 shrink-0 items-center justify-between px-6">
                <Link to="/dashboard" className="flex items-center outline-none">
                    <img
                        src={currentBranding.logoSidebar || currentBranding.logoMain}
                        alt={currentBranding.name}
                        className="h-8 w-auto object-contain"
                    />
                </Link>
                {/* Mobile Close Button */}
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 -mr-2 text-gray-500 hover:text-gray-900 lg:hidden focus:outline-none"
                >
                    <LogOut className="h-5 w-5 rotate-180" /> {/* Using LogOut icon as a back arrow for simplicity or just an X */}
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                <nav className="space-y-1.5">
                    {navItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.href) && (item.href !== '/dashboard' || location.pathname === '/dashboard');
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => setIsOpen(false)} // Close sidebar on link click (mobile)
                                className={clsx(
                                    isActive
                                        ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                                    'group flex items-center rounded-xl px-3 py-2.5 text-[14px] font-bold transition-all duration-200 ease-in-out'
                                )}
                            >
                                <Icon
                                    className={clsx(
                                        isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600',
                                        'mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200'
                                    )}
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>
            <div className="border-t border-gray-100 p-4 shrink-0 bg-white">
                <Menu as="div" className="relative">
                    <Menu.Button className="group flex w-full items-center rounded-xl p-2.5 text-left focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 hover:bg-gray-50 transition-all duration-200 border border-transparent hover:border-gray-200 hover:shadow-sm">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-extrabold shadow-sm ring-1 ring-primary-200 group-hover:bg-primary-600 group-hover:text-white transition-colors duration-200">
                            {user?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                            <p className="text-sm font-extrabold text-gray-900 truncate">{user?.name}</p>
                            <p className="text-xs font-medium text-gray-500 truncate">{user?.tenant?.name || 'No Company'}</p>
                        </div>
                    </Menu.Button>
                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95 translate-y-2"
                        enterTo="transform opacity-100 scale-100 translate-y-0"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100 translate-y-0"
                        leaveTo="transform opacity-0 scale-95 translate-y-2"
                    >
                        <Menu.Items className="absolute bottom-[calc(100%+0.5rem)] left-0 w-full origin-bottom rounded-xl bg-white shadow-xl ring-1 ring-black/5 focus:outline-none overflow-hidden z-50 p-1">
                            <div className="py-1">
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => {
                                                setIsProfileOpen(true);
                                                setIsOpen(false);
                                            }}
                                            className={clsx(
                                                active ? 'bg-gray-50 text-gray-900' : 'text-gray-700',
                                                'group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-bold transition-colors'
                                            )}
                                        >
                                            <User className={clsx(
                                                active ? "text-primary-600" : "text-gray-400",
                                                "mr-3 h-4 w-4"
                                            )} aria-hidden="true" />
                                            My Profile
                                        </button>
                                    )}
                                </Menu.Item>
                                <Menu.Item>
                                    {({ active }) => (
                                        <button
                                            onClick={() => {
                                                if (window.confirm("Are you sure you want to sign out?")) {
                                                    logout();
                                                }
                                            }}
                                            className={clsx(
                                                active ? 'bg-red-50 text-red-700' : 'text-gray-700',
                                                'group flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-bold transition-colors mt-1'
                                            )}
                                        >
                                            <LogOut className={clsx(
                                                active ? "text-red-600" : "text-gray-400",
                                                "mr-3 h-4 w-4"
                                            )} aria-hidden="true" />
                                            Sign out
                                        </button>
                                    )}
                                </Menu.Item>
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>
            </div>
            <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
        </div>
    );
};

export default Sidebar;
