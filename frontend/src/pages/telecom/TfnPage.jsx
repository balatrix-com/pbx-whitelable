import React, { useState, useEffect } from 'react';
import { telecomService } from '../../services/telecom.service';
import { walletService } from '../../services/wallet.service';
import { usageService } from '../../services/usage.service';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Settings } from 'lucide-react';
import RoutingModal from '../../components/telecom/RoutingModal';

const TfnPage = () => {
    const { user } = useAuth();
    const { addToast } = useToast();

    const [myNumbers, setMyNumbers] = useState([]);
    const [walletBalance, setWalletBalance] = useState(0);
    const [serviceState, setServiceState] = useState('SERVICE_ACTIVE');

    // Routing Modal State
    const [routingModalOpen, setRoutingModalOpen] = useState(false);
    const [selectedTfn, setSelectedTfn] = useState(null);

    const formatPhoneNumber = (numberString) => {
        if (!numberString) return '';
        const cleaned = ('' + numberString).replace(/\D/g, '');
        
        // Handle 11 digits (with 1 prefix)
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
            const match = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/);
            if (match) {
                return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
            }
        }
        
        // Handle 10 digits
        if (cleaned.length === 10) {
            const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
            if (match) {
                return `(${match[1]}) ${match[2]}-${match[3]}`;
            }
        }

        return numberString;
    };

    useEffect(() => {
        // Fetch wallet balance and service state
        const loadData = async () => {
            try {
                const [w, state, myTfns] = await Promise.all([
                    walletService.getWallet(user.tenantId),
                    usageService.getServiceState(),
                    telecomService.getMyTfns()
                ]);
                setWalletBalance(w.balance);
                setServiceState(state);
                setMyNumbers(myTfns || []);
            } catch (e) {
                console.error(e);
            }
        };
        loadData();
    }, [user]);


    const openRouting = (tfn) => {
        setSelectedTfn(tfn);
        setRoutingModalOpen(true);
    };

    const handleRoutingUpdate = (updatedTfn) => {
        setMyNumbers(myNumbers.map(n => n.id === updatedTfn.id ? updatedTfn : n));
    };



    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Phone Numbers (TFN)</h1>
                    <p className="text-gray-500 mt-1.5 font-medium">Manage your toll-free numbers and inbound routing.</p>
                </div>
                {/* Wallet Context */}
                <div className="flex justify-start sm:justify-end">
                    <span className="text-sm text-gray-700 font-mono bg-white border border-transparent ring-1 ring-inset ring-gray-200 px-3 py-1.5 rounded-lg shadow-sm">
                        Available Balance: <span className="font-bold text-primary-600 ml-1">${Number(walletBalance).toFixed(2)}</span>
                    </span>
                </div>
            </div>



            {/* My Numbers */}
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                    <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Your Numbers</h3>
                </div>
                {myNumbers.length === 0 ? (
                    <div className="p-6">
                        <p className="text-sm text-gray-500 font-medium">You don't have any numbers yet.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {myNumbers.map(n => (
                            <li key={n.number} className="p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center group hover:bg-gray-50/80 transition-colors">
                                <div className="mb-4 sm:mb-0">
                                    <span className="block text-2xl font-mono font-extrabold text-slate-900 tracking-tight">{formatPhoneNumber(n.number)}</span>
                                    <span className="text-xs text-gray-700 mt-2 inline-block bg-gray-50 px-2.5 py-1 rounded-md ring-1 ring-inset ring-gray-200/50 font-bold shadow-sm">
                                        Route: <span className="text-gray-500 font-medium">{n.routeType ? `${n.routeType} ${n.forwardNumber || ''}` : 'Not configured'}</span>
                                    </span>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end space-x-4">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-green-50 text-green-700 ring-1 ring-inset ring-green-200/50 shadow-sm">
                                        Active
                                    </span>
                                    <button
                                        onClick={() => openRouting(n)}
                                        className="text-gray-400 hover:text-primary-600 transition-all p-2 rounded-xl bg-white ring-1 ring-inset ring-gray-200 hover:ring-primary-300 hover:bg-primary-50 shadow-sm focus:outline-none"
                                        title="Configure Routing"
                                    >
                                        <Settings className="h-5 w-5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <RoutingModal
                isOpen={routingModalOpen}
                onClose={() => setRoutingModalOpen(false)}
                tfn={selectedTfn}
                onSave={handleRoutingUpdate}
            />
        </div>
    );
};

export default TfnPage;
