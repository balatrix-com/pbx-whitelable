import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { walletService } from '../services/wallet.service';
import telecomService from '../services/telecom.service';
import { useWalletQuery } from '../hooks/useBillingQueries';

const GlobalMetricsContext = createContext(null);

export const GlobalMetricsProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();

    // Metrics State
    const { data: walletData } = useWalletQuery();
    const balance = walletData?.balance || 0;
    const [activeCalls, setActiveCalls] = useState([]);
    // The live-call updater has no queue membership data yet.
    const queueDepth = null;

    // Connection State
    const [socket, setSocket] = useState(null);

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const isImpersonating = Boolean(user?.isImpersonating || user?.impersonation || localStorage.getItem('originalToken'));
    const isPlatformAdmin = isSuperAdmin && !isImpersonating;

    const targetTenantId = isPlatformAdmin ? 'all' : (user?.tenant?.id || user?.tenantId);
    const canMonitor = isPlatformAdmin || user?.role === 'ADMIN' || user?.role === 'SUPPORT';

    useEffect(() => {
        if (!isAuthenticated || !targetTenantId) {
            // Cleanup on logout or missing tenant context
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            setActiveCalls([]);
            return;
        }

        if (!canMonitor) {
            setActiveCalls([]);
            return;
        }

        let isMounted = true;

        // 1. Initial Data Fetch (Telecom only)
        const fetchInitialData = async () => {
            try {
                // The monitor API reads the current customer call hashes from Redis.
                try {
                    const callsData = await telecomService.getActiveCalls(targetTenantId);
                    const callList = callsData?.data?.calls || callsData?.calls || [];
                    if (isMounted) setActiveCalls(callList);
                } catch (err) {
                    console.debug('Detailed monitoring access restricted', err);
                }

            } catch (err) {
                console.error('Failed to fetch initial global metrics', err);
            }
        };

        fetchInitialData();

        // 2. Setup Socket.io for Real-time Call Updates
        const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
        if (token && canMonitor) {
            const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/api\/?$/, '');
            const socketUrl = `${baseUrl.replace(/\/$/, '')}/monitor`;
            const socketPath = '/api/socket.io';

            const newSocket = io(socketUrl, {
                path: socketPath,
                transports: ['websocket', 'polling'],
                auth: { token },
                reconnection: true,
                reconnectionAttempts: 5
            });

            newSocket.on('connect', () => {
                newSocket.emit('join_room', targetTenantId);
            });

            newSocket.on('call_update', (callData) => {
                if (!isMounted) return;

                setActiveCalls(prevCalls => {
                    const index = prevCalls.findIndex(c => c.uuid === callData.uuid);
                    let status = callData.status || callData.call_status;
                    if (status === 'connected') status = 'answered';

                    if (['hangup', 'failed', 'busy', 'no_answer', 'declined'].includes(status)) {
                        return prevCalls.filter(c => c.uuid !== callData.uuid);
                    }

                    if (index >= 0) {
                        const updated = [...prevCalls];
                        updated[index] = { ...updated[index], ...callData, status };
                        return updated;
                    } else {
                        return [{ ...callData, status }, ...prevCalls];
                    }
                });
            });

            setSocket(newSocket);

            return () => {
                isMounted = false;
                newSocket.disconnect();
            };
        }

        return () => {
            isMounted = false;
        };
    }, [isAuthenticated, targetTenantId, canMonitor]);

    const value = useMemo(() => ({
        balance,
        activeCallsCount: activeCalls.length,
        queueDepth,
        socketStatus: socket?.connected ? 'connected' : 'disconnected'
    }), [balance, activeCalls.length, queueDepth, socket?.connected]);

    return (
        <GlobalMetricsContext.Provider value={value}>
            {children}
        </GlobalMetricsContext.Provider>
    );
};

export const useGlobalMetrics = () => useContext(GlobalMetricsContext);
