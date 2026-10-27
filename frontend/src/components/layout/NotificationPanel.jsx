import React, { useState, useEffect } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Bell, Check, Info, AlertTriangle, AlertCircle, PhoneMissed, DollarSign, Activity, X } from 'lucide-react';
import { useGlobalMetrics } from '../../context/GlobalMetricsContext';
import { notificationService } from '../../services/notification.service';
import { formatDistanceToNow } from 'date-fns';

// Helper function to get the appropriate icon based on notification type
const getNotificationIcon = (type) => {
    switch (type) {
        case 'warning':
            return <AlertTriangle className="h-4 w-4 text-amber-500" />;
        case 'error':
            return <AlertCircle className="h-4 w-4 text-rose-500" />;
        case 'missed_call':
            return <PhoneMissed className="h-4 w-4 text-purple-500" />;
        case 'billing':
            return <DollarSign className="h-4 w-4 text-emerald-500" />;
        case 'system':
            return <Activity className="h-4 w-4 text-blue-500" />;
        default:
            return <Info className="h-4 w-4 text-gray-500 dark:text-slate-400" />;
    }
};

const NotificationPanel = () => {
    const { balance, queueDepth } = useGlobalMetrics();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const data = await notificationService.getNotifications(50);

            // Backend returns { notifications: [...] }
            const list = Array.isArray(data?.notifications) ? data.notifications : [];

            // Format timestamps for display
            const formattedData = list.map(n => ({
                ...n,
                time: n.createdAt ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true }) : 'Just now'
            }));

            setNotifications(formattedData);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        fetchNotifications();

        // Poll every 30 minutes
        const interval = setInterval(fetchNotifications, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Dynamic notifications based on global metrics (Overlaying active warnings on top of DB notifications)
    useEffect(() => {
        if (loading) return; // Wait until initial fetch is done

        setNotifications(prev => {
            let newNotifications = [...prev];
            let hasChanges = false;

            // Check low balance overlay
            if (balance !== undefined && balance < 50) {
                const lowBalanceExists = newNotifications.some(n => n.id === 'low_balance');
                if (!lowBalanceExists) {
                    newNotifications.unshift({
                        id: 'low_balance',
                        type: 'warning',
                        title: 'Low Balance Warning',
                        message: `Your wallet balance is running low ($${Number(balance).toFixed(2)}). Please recharge soon to avoid service interruption.`,
                        time: 'Now',
                        read: false,
                        isOverlay: true // Mark as not from DB
                    });
                    hasChanges = true;
                }
            } else {
                const index = newNotifications.findIndex(n => n.id === 'low_balance');
                if (index > -1) {
                    newNotifications.splice(index, 1);
                    hasChanges = true;
                }
            }

            // Check high queue depth overlay
            if (queueDepth !== undefined && queueDepth > 5) {
                const highQueueExists = newNotifications.some(n => n.id === 'high_queue');
                if (!highQueueExists) {
                    newNotifications.unshift({
                        id: 'high_queue',
                        type: 'error',
                        title: 'High Queue Depth',
                        message: `There are currently ${queueDepth} callers waiting in the queues.`,
                        time: 'Now',
                        read: false,
                        isOverlay: true
                    });
                    hasChanges = true;
                }
            } else {
                const index = newNotifications.findIndex(n => n.id === 'high_queue');
                if (index > -1) {
                    newNotifications.splice(index, 1);
                    hasChanges = true;
                }
            }

            return hasChanges ? newNotifications : prev;
        });
    }, [balance, queueDepth, loading]);


    const unreadCount = notifications.filter((item) => !item.read).length;

    const markAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(notifications.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const markAsRead = async (id) => {
        const notification = notifications.find(n => n.id === id);
        if (notification?.read) return;

        // Optimistic update
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));

        // Don't call API for overlay notifications
        if (notification?.isOverlay) return;

        try {
            await notificationService.markAsRead(id);
        } catch (error) {
            console.error('Failed to mark as read:', error);
            // Revert optimisitic update on error
            setNotifications(notifications.map(n => n.id === id ? { ...n, read: false } : n));
        }
    };

    const removeNotification = async (id, e) => {
        e.stopPropagation();

        const notification = notifications.find(n => n.id === id);

        // Optimistic UI Removal
        setNotifications(notifications.filter(n => n.id !== id));

        // Mark as read in DB so it doesn't show up again.
        // Or ideallly a delete endpoint, but marking read is fine for now to remove from "new"
        if (!notification?.isOverlay && !notification?.read) {
            try {
                await notificationService.markAsRead(id);
            } catch (error) {
                console.error('Failed to hide notification:', error);
            }
        }
    };

    return (
        <Popover className="relative">
            {({ open }) => (
                <>
                    <Popover.Button
                        className={`
                            relative rounded-xl p-2 transition-all shadow-xs focus:outline-none border
                            ${open
                                ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border-primary-300 dark:border-primary-700'
                                : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/60 dark:hover:bg-slate-800 border-gray-200 dark:border-slate-800'
                            }
                        `}
                    >
                        <span className="sr-only">View notifications</span>
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 ring-2 ring-white dark:ring-slate-900"></span>
                            </span>
                        )}
                    </Popover.Button>

                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-200"
                        enterFrom="opacity-0 translate-y-1"
                        enterTo="opacity-100 translate-y-0"
                        leave="transition ease-in duration-150"
                        leaveFrom="opacity-100 translate-y-0"
                        leaveTo="opacity-0 translate-y-1"
                    >
                        <Popover.Panel className="absolute right-0 z-50 mt-2 w-80 sm:w-96 transform px-4 sm:px-0">
                            <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800">
                                {/* Header */}
                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 px-4 py-3 bg-gray-50/80 dark:bg-slate-800/70">
                                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center">
                                        Notifications
                                        {unreadCount > 0 && (
                                            <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/50">
                                                {unreadCount} new
                                            </span>
                                        )}
                                    </h3>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllAsRead}
                                            className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors flex items-center"
                                        >
                                            <Check className="mr-1 h-3.5 w-3.5" />
                                            Mark all read
                                        </button>
                                    )}
                                </div>

                                {/* List */}
                                <div className="max-h-[400px] overflow-y-auto w-full">
                                    {notifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                            <div className="rounded-full bg-gray-50 dark:bg-slate-800 p-3 mb-3 border border-gray-100 dark:border-slate-700">
                                                <Bell className="h-6 w-6 text-gray-400 dark:text-slate-500" />
                                            </div>
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">No notifications</h4>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">You're all caught up! Check back later.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100 dark:divide-slate-800">
                                            {notifications.map((notification) => (
                                                <div
                                                    key={notification.id}
                                                    onClick={() => markAsRead(notification.id)}
                                                    className={`
                                                        relative flex items-start gap-3.5 p-4 transition-colors cursor-pointer w-full group
                                                        ${notification.read
                                                            ? 'bg-white dark:bg-slate-900 hover:bg-gray-50/80 dark:hover:bg-slate-800/50'
                                                            : 'bg-blue-50/30 dark:bg-slate-800/40 hover:bg-blue-50/60 dark:hover:bg-slate-800/70'
                                                        }
                                                    `}
                                                >
                                                    {/* Left Icon Container */}
                                                    <div className="flex-shrink-0 mt-0.5">
                                                        <div className={`p-2.5 rounded-xl border shadow-xs transition-colors ${notification.read
                                                            ? 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                                                            : 'bg-white dark:bg-slate-800 border-blue-200/80 dark:border-blue-800/60 shadow-blue-500/10'
                                                            }`}>
                                                            {getNotificationIcon(notification.type)}
                                                        </div>
                                                    </div>

                                                    {/* Content & Top Action Bar */}
                                                    <div className="flex-1 min-w-0 pr-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <p className={`text-sm font-bold truncate ${notification.read
                                                                    ? 'text-gray-700 dark:text-slate-300'
                                                                    : 'text-gray-900 dark:text-white'
                                                                    }`}>
                                                                    {notification.title}
                                                                </p>
                                                                {!notification.read && (
                                                                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100/90 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                                                        New
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Right Actions: Time + Remove Button side-by-side */}
                                                            <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                                                <span className="text-[11px] font-medium text-gray-400 dark:text-slate-400 whitespace-nowrap">
                                                                    {notification.time}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => removeNotification(notification.id, e)}
                                                                    className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all focus:outline-none"
                                                                    title="Dismiss notification"
                                                                    aria-label="Dismiss notification"
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <p className={`mt-1 text-xs line-clamp-2 leading-relaxed ${notification.read
                                                            ? 'text-gray-500 dark:text-slate-400'
                                                            : 'text-gray-700 dark:text-slate-300 font-medium'
                                                            }`}>
                                                            {notification.message}
                                                        </p>
                                                    </div>

                                                    {/* Active / Unread indicator bar */}
                                                    {!notification.read && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full"></div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                {notifications.length > 0 && (
                                    <div className="p-3 bg-gray-50/80 dark:bg-slate-800/70 border-t border-gray-100 dark:border-slate-800 text-center">
                                        <button className="text-xs font-bold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors w-full p-2 outline-none focus:ring-2 focus:ring-primary-500/20 rounded-lg">
                                            View all notifications
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Popover.Panel>
                    </Transition>
                </>
            )}
        </Popover>
    );
};

export default NotificationPanel;
