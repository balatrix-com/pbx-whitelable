import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Loader2, CheckCircle, ArrowRight, User, Phone, Server } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const OnboardingWizard = () => {
    const { token } = useParams();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [quote, setQuote] = useState(null);
    const [config, setConfig] = useState({
        adminPassword: '',
        confirmPassword: '',
        extensionNames: {}, // Map of index -> name
    });
    const [availableTfns, setAvailableTfns] = useState([]);
    const [selectedTfnId, setSelectedTfnId] = useState(null);

    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (token) {
            verifyTokenAndLoadQuote();
        }
    }, [token]);

    const verifyTokenAndLoadQuote = async () => {
        try {
            // In a real flow, we'd verify the token or session_id with the backend
            // For now, assuming token is quoteId and we just paid
            // Verify token and load quote via Onboarding endpoint
            const res = await api.get(`/onboarding/${token}`);
            setQuote(res.data);

            // Initialize extension names based on count
            const extCount = res.data.telecomDetails?.extensionCount || 0;
            const customerCode = res.data.predictedCustomerCode || '1001';

            const initialNames = {};
            for (let i = 0; i < extCount; i++) {
                const suffix = (i + 1).toString().padStart(2, '0');
                initialNames[i] = `Extension ${customerCode}${suffix}`;
            }
            setConfig(prev => ({ ...prev, extensionNames: initialNames }));

            // Load available TFNs if plan allows
            if (res.data.plan?.maxTFNs > 0) {
                const tfnsRes = await api.get(`/onboarding/${token}/available-tfns`);
                setAvailableTfns(tfnsRes.data);
            }

        } catch (err) {
            console.error(err);
            addToast('error', 'Failed to load onboarding session');
        } finally {
            setLoading(false);
        }
    };

    const handleExtensionNameChange = (idx, value) => {
        setConfig(prev => ({
            ...prev,
            extensionNames: {
                ...prev.extensionNames,
                [idx]: value
            }
        }));
    };

    const handleSubmit = async () => {
        if (processing) return;
        setProcessing(true);
        console.log('Submitting onboarding data...');
        if (config.adminPassword !== config.confirmPassword) {
            addToast('error', 'Passwords do not match');
            setProcessing(false);
            return;
        }
        
        console.log(`Payload: adminPassword: ${config.adminPassword}, extensionNames: ${Object.values(config.extensionNames).length}`);

        try {
            await api.post(`/onboarding/${token}/complete`, {
                adminPassword: config.adminPassword,
                extensionNames: Object.values(config.extensionNames),
                sessionId,
                selectedTfnId
            });

            addToast('success', 'Onboarding completed successfully!');
            console.log('Navigating to login...');
            navigate('/login');
        } catch (err) {
            console.error(err);
            addToast('error', 'Failed to complete onboarding');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Welcome to your new system!</h1>
                    <p className="mt-2 text-gray-600">Let's get your account and assets configured.</p>
                </div>

                {/* Steps Indicator */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${step >= 1 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <User className="h-6 w-6" />
                        </div>
                        <div className={`h-1 w-12 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        <div className={`p-2 rounded-full ${step >= 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Phone className="h-6 w-6" />
                        </div>
                        {quote?.plan?.maxTFNs > 0 && (
                            <>
                                <div className={`h-1 w-12 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                                <div className={`p-2 rounded-full ${step >= 3 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <Server className="h-6 w-6" />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <Card className="shadow-lg border-0">
                    <CardHeader>
                        <CardTitle>
                            {step === 1 ? 'Account Setup' : step === 2 ? 'Extension Configuration' : 'Choose your Number'}
                        </CardTitle>
                        <CardDescription>
                            {step === 1 ? 'Set up your admin access' : step === 2 ? 'Name your extensions' : 'Select a Toll-Free Number for your tenant'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Admin Email</Label>
                                    <Input value={quote?.customerEmail || ''} disabled className="bg-gray-50" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Create Password</Label>
                                    <Input
                                        type="password"
                                        value={config.adminPassword}
                                        onChange={(e) => setConfig({ ...config, adminPassword: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirm Password</Label>
                                    <Input
                                        type="password"
                                        value={config.confirmPassword}
                                        onChange={(e) => setConfig({ ...config, confirmPassword: e.target.value })}
                                    />
                                </div>
                                <Button
                                    className="w-full mt-4"
                                    onClick={() => setStep(2)}
                                    disabled={!config.adminPassword || !config.confirmPassword}
                                >
                                    Next: Configure Extensions <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500">
                                    You have <strong>{quote?.telecomDetails?.extensionCount}</strong> extensions included in your plan. Assign names to them to get started.
                                </p>

                                <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                                    {Array.from({ length: quote?.telecomDetails?.extensionCount || 0 }).map((_, idx) => (
                                        <div key={idx} className="flex gap-4 items-center">
                                            <div className="w-24 text-sm font-medium text-gray-500">
                                                Ext {quote?.predictedCustomerCode || '1001'}{(idx + 1).toString().padStart(2, '0')}
                                            </div>
                                            <Input
                                                placeholder="e.g. Sales, John Doe"
                                                value={config.extensionNames[idx] || ''}
                                                onChange={(e) => handleExtensionNameChange(idx, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-4 mt-6">
                                    <Button variant="outline" onClick={() => setStep(1)}>
                                        Back
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        onClick={() => {
                                            if (quote?.plan?.maxTFNs > 0) {
                                                setStep(3);
                                            } else {
                                                handleSubmit();
                                            }
                                        }}
                                    >
                                        {quote?.plan?.maxTFNs > 0 ? (
                                            <>Next: Choose TFN <ArrowRight className="ml-2 h-4 w-4" /></>
                                        ) : (
                                            <>Complete Setup <CheckCircle className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500">
                                    Your plan includes <strong>{quote?.plan?.maxTFNs}</strong> Toll-Free Number(s). Select one from the list below to activate it for your account.
                                </p>

                                {availableTfns.length === 0 ? (
                                    <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                        <p className="text-gray-500 italic">No available TFNs found in the pool. You can add one later from the dashboard.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                                        {availableTfns.map((tfn) => (
                                            <div
                                                key={tfn.id}
                                                onClick={() => setSelectedTfnId(selectedTfnId === tfn.id ? null : tfn.id)}
                                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                                    selectedTfnId === tfn.id 
                                                        ? 'border-blue-600 bg-blue-50' 
                                                        : 'border-gray-100 hover:border-blue-200'
                                                }`}
                                            >
                                                <div className="font-bold text-lg text-gray-800">{tfn.number}</div>
                                                <div className="text-xs text-gray-500 capitalize">{tfn.status.toLowerCase()}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-4 mt-6">
                                    <Button variant="outline" onClick={() => setStep(2)}>
                                        Back
                                    </Button>
                                    <Button
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                        onClick={handleSubmit}
                                        disabled={processing}
                                    >
                                        {processing ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Provisioning System...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                {selectedTfnId ? 'Complete with Selected Number' : 'Complete Setup'}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default OnboardingWizard;
