
import React, { useState, useEffect } from 'react';
import { plansService } from '../../services/plans.service';
import PlanBuilder from './PlanBuilder';
import { Package, Smartphone, CheckCircle, Plus, Minus, Server, Globe, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// --- UI Components (Shadcn-like) ---

const Card = ({ className, children, ...props }) => (
    <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm bg-white", className)} {...props}>
        {children}
    </div>
);

const CardHeader = ({ className, children, ...props }) => (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props}>
        {children}
    </div>
);

const CardTitle = ({ className, children, ...props }) => (
    <div>
        <h3 className={cn("font-semibold leading-none tracking-tight", className)} {...props}>
            {children}
        </h3>
    </div>
);

const CardContent = ({ className, children, ...props }) => (
    <div className={cn("p-6 pt-0", className)} {...props}>
        {children}
    </div>
);

const Button = ({ className, variant = "default", size = "default", ...props }) => {
    const variants = {
        default: "bg-slate-900 text-white hover:bg-slate-800",
        outline: "border border-input bg-background hover:bg-slate-100 hover:text-accent-foreground",
        ghost: "hover:bg-slate-100 hover:text-accent-foreground",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    };
    const sizes = {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        get icon() { return "h-10 w-10" },
    };
    return (
        <button
            className={cn("inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)}
            {...props}
        />
    );
};

const Input = ({ className, ...props }) => (
    <input
        className={cn(
            "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            className
        )}
        {...props}
    />
);

const Badge = ({ className, variant = "default", ...props }) => {
    const variants = {
        default: "border-transparent bg-slate-900 text-white shadow hover:bg-slate-900/80",
        secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80",
        outline: "text-foreground",
        custom: "border-transparent bg-indigo-100 text-indigo-700 font-bold",
    };
    return (
        <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)} {...props} />
    );
};

const Label = ({ className, ...props }) => (
    <label className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
);


const PricingBuilder = ({ onPricingCalculated }) => {
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [inputs, setInputs] = useState({
        extensionCount: 5,
        didCount: 1,
        tfnCount: 0,
        monitoringCount: 0,
        walletCredit: 0.00
    });
    const [quoteResult, setQuoteResult] = useState(null);
    const [showBuilder, setShowBuilder] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const data = await plansService.getAll();
            setPlans(data);
            if (data.length > 0 && !selectedPlan) {
                // handleSelectPlan(data[0]); 
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectPlan = (plan) => {
        setSelectedPlan(plan);
        setInputs(prev => ({
            ...prev,
            tfnCount: prev.tfnCount || 0,
        }));
    };

    useEffect(() => {
        if (selectedPlan) {
            calculateQuote();
        }
    }, [inputs, selectedPlan]);

    const calculateQuote = () => {
        if (!selectedPlan) return;

        let totalRecurring = Number(selectedPlan.price);
        let totalOneTime = 0;
        const items = [
            {
                label: `Base Plan (${selectedPlan.name})`,
                qty: 1,
                unit: Number(selectedPlan.price),
                total: Number(selectedPlan.price)
            }
        ];

        // 1. Extensions
        const includedExtensions = selectedPlan.maxExtensions === 0 ? 999999 : selectedPlan.maxExtensions;
        const extraExtensions = Math.max(0, inputs.extensionCount - includedExtensions);
        if (extraExtensions > 0) {
            const price = Number(selectedPlan.extraExtensionPrice || 5);
            const total = price * extraExtensions;
            items.push({
                label: `Additional Extensions`,
                qty: extraExtensions,
                unit: price,
                total: total
            });
            totalRecurring += total;
        }

        // 2. DIDs
        const includedDids = selectedPlan.maxDIDs === 0 ? 999999 : selectedPlan.maxDIDs;
        const extraDids = Math.max(0, inputs.didCount - includedDids);
        if (extraDids > 0) {
            const price = Number(selectedPlan.extraDidPrice || 1);
            const total = price * extraDids;
            items.push({
                label: `Additional Numbers`,
                qty: extraDids,
                unit: price,
                total: total
            });
            totalRecurring += total;
        }

        // 3. TFNs
        const includedTfns = selectedPlan.maxTFNs === 0 ? 999999 : selectedPlan.maxTFNs;
        const extraTfns = Math.max(0, (inputs.tfnCount || 0) - includedTfns);
        if (extraTfns > 0) {
            const price = Number(selectedPlan.extraTfnPrice || 2);
            const total = price * extraTfns;
            items.push({
                label: `Additional TFNs`,
                qty: extraTfns,
                unit: price,
                total: total
            });
            totalRecurring += total;
        }

        // 4. Monitoring Users (New)
        if (inputs.monitoringCount > 0) {
            // Assuming a default price for monitoring if not in plan, e.g., $10 or similar to extensions?
            // Using a placeholder price of $5 for now, same as extra extensions, or we can make it a specific input.
            const price = 5.00;
            const total = price * inputs.monitoringCount;
            items.push({
                label: `Call Monitoring Users`,
                qty: inputs.monitoringCount,
                unit: price,
                total: total
            });
            totalRecurring += total;
        }

        // 5. Wallet Credit (One-Time)
        if (inputs.walletCredit > 0) {
            items.push({
                label: `Initial Wallet Credit`,
                qty: 1,
                unit: inputs.walletCredit,
                total: inputs.walletCredit
            });
            totalOneTime += inputs.walletCredit;
        }



        const result = {
            planId: selectedPlan.id,
            inputs: inputs,
            totalRecurring,
            totalOneTime,
            items,
            planName: selectedPlan.name,
            planDetails: selectedPlan
        };

        setQuoteResult(result);
        onPricingCalculated(result);
    };

    const handlePlanCreated = () => {
        fetchPlans();
        setShowBuilder(false);
    };



    return (
        <div className="space-y-8">
            {/* 1. Plan Selection - Full Width Top */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        Select Base Plan
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBuilder(!showBuilder)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                        {showBuilder ? 'Cancel' : '+ Create Custom Plan'}
                    </Button>
                </CardHeader>
                <CardContent>
                    {showBuilder && (
                        <div className="mb-6 p-4 border border-green-100 bg-green-50/50 rounded-xl relative animate-in zoom-in-95 duration-200">
                            <PlanBuilder onPlanSaved={handlePlanCreated} onClose={() => setShowBuilder(false)} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {plans.map(plan => {
                            const isSelected = selectedPlan?.id === plan.id;
                            return (
                                <div
                                    key={plan.id}
                                    onClick={() => handleSelectPlan(plan)}
                                    className={cn(
                                        "cursor-pointer rounded-xl border-2 p-5 transition-all relative hover:shadow-md",
                                        isSelected ? "border-blue-600 bg-blue-50/30 ring-2 ring-blue-600/20" : "border-gray-100 hover:border-blue-200 bg-white"
                                    )}
                                >
                                    {isSelected && (
                                        <div className="absolute -top-3 -right-3 bg-blue-600 text-white p-1 rounded-full shadow-lg">
                                            <CheckCircle size={16} />
                                        </div>
                                    )}

                                    {plan.isCustom && (
                                        <Badge variant="custom" className="absolute top-3 right-3">
                                            Custom
                                        </Badge>
                                    )}

                                    <div className="font-bold text-gray-900 text-lg mb-1">{plan.name}</div>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-3xl font-extrabold text-gray-900">${Number(plan.price).toFixed(2)}</span>
                                        <span className="text-sm text-gray-500 font-medium">/{plan.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}</span>
                                    </div>

                                    <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                                        <div className="flex items-center gap-2">
                                            <Smartphone size={14} className="text-gray-400" />
                                            <span>{plan.maxDIDs === 0 ? 'Unlimited' : plan.maxDIDs} Numbers</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Globe size={14} className="text-gray-400" />
                                            <span>{plan.maxTFNs === 0 ? 'No' : plan.maxTFNs} Toll-Free</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users size={14} className="text-gray-400" />
                                            <span>{plan.maxExtensions === 0 ? 'Unlimited' : plan.maxExtensions} Users</span>
                                        </div>
                                        {Number(plan.initialCredit) > 0 && (
                                            <div className="font-bold text-green-600 pt-1 flex items-center gap-1">
                                                <Plus size={12} /> ${Number(plan.initialCredit)} Credit
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Bottom Section: Add-ons & Invoice Preview */}
            {selectedPlan && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                    {/* LEFT: Add-ons & Configuration */}
                    <div className="w-full">
                        <Card className="h-full">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Plus className="h-5 w-5 text-blue-600" />
                                    Add-ons & Extras
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Telecom Assets */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Telecom Assets</h4>

                                    <div className="grid gap-4">
                                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-md border text-gray-500 shadow-sm">
                                                    <Users size={18} />
                                                </div>
                                                <div>
                                                    <Label className="text-base">Extensions / Users</Label>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        {selectedPlan.maxExtensions} Included
                                                        {inputs.extensionCount > selectedPlan.maxExtensions &&
                                                            <span className="text-blue-600 font-medium ml-1">(+{inputs.extensionCount - selectedPlan.maxExtensions} Extra)</span>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={inputs.extensionCount}
                                                onChange={(e) => setInputs(p => ({ ...p, extensionCount: parseInt(e.target.value) || 0 }))}
                                                className="w-24 text-center font-medium"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-md border text-gray-500 shadow-sm">
                                                    <Smartphone size={18} />
                                                </div>
                                                <div>
                                                    <Label className="text-base">Phone Numbers (DID)</Label>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        {selectedPlan.maxDIDs} Included
                                                        {inputs.didCount > selectedPlan.maxDIDs &&
                                                            <span className="text-blue-600 font-medium ml-1">(+{inputs.didCount - selectedPlan.maxDIDs} Extra)</span>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={inputs.didCount}
                                                onChange={(e) => setInputs(p => ({ ...p, didCount: parseInt(e.target.value) || 0 }))}
                                                className="w-24 text-center font-medium"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-md border text-gray-500 shadow-sm">
                                                    <Globe size={18} />
                                                </div>
                                                <div>
                                                    <Label className="text-base">Toll-Free Numbers</Label>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        {selectedPlan.maxTFNs} Included
                                                        {inputs.tfnCount > selectedPlan.maxTFNs &&
                                                            <span className="text-blue-600 font-medium ml-1">(+{inputs.tfnCount - selectedPlan.maxTFNs} Extra)</span>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={inputs.tfnCount}
                                                onChange={(e) => setInputs(p => ({ ...p, tfnCount: parseInt(e.target.value) || 0 }))}
                                                className="w-24 text-center font-medium"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-md border text-gray-500 shadow-sm">
                                                    <Server size={18} />
                                                </div>
                                                <div>
                                                    <Label className="text-base">Call Monitoring Users</Label>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        $5.00 / user (Not included in plan)
                                                    </div>
                                                </div>
                                            </div>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={inputs.monitoringCount}
                                                onChange={(e) => setInputs(p => ({ ...p, monitoringCount: parseInt(e.target.value) || 0 }))}
                                                className="w-24 text-center font-medium"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Items */}
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Additional Services</h4>

                                <div className="flex items-center justify-between p-3 rounded-lg border border-green-100 bg-green-50/30 hover:bg-green-50/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-md border border-green-200 text-green-600 shadow-sm">
                                            <Plus size={18} />
                                        </div>
                                        <div>
                                            <Label className="text-base text-gray-900">Additional Wallet Balance</Label>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                Funds to be added to customer's wallet
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-500">$</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={inputs.walletCredit}
                                            onChange={(e) => setInputs(p => ({ ...p, walletCredit: parseFloat(e.target.value) || 0 }))}
                                            className="w-28 text-right font-medium bg-white"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT: Sticky Invoice */}
                    <div className="w-full">
                        <div className="sticky top-24 space-y-4">
                            <div className="rounded-xl border border-gray-200 shadow-xl bg-white overflow-hidden ring-1 ring-gray-950/5">
                                <div className="bg-gray-50/80 border-b border-gray-100 p-6 backdrop-blur-sm">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg">PRO FORMA INVOICE</h3>
                                            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Live Preview</p>
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-gray-900 flex items-center justify-center text-white">
                                            <span className="font-bold text-xs">B</span>
                                        </div>
                                    </div>
                                </div>

                                {quoteResult && (
                                    <div className="p-0">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50/30 border-b border-gray-100">
                                                <tr>
                                                    <th className="px-5 py-3 font-medium">Item</th>
                                                    <th className="px-5 py-3 font-medium text-right">Qty</th>
                                                    <th className="px-5 py-3 font-medium text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {quoteResult.items.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-5 py-3 font-medium text-gray-900">
                                                            {item.label}
                                                            {item.unit > 0 && <span className="block text-xs text-muted-foreground font-normal">${Number(item.unit).toFixed(2)} / unit</span>}
                                                        </td>
                                                        <td className="px-5 py-3 text-right text-gray-600">{item.qty}</td>
                                                        <td className="px-5 py-3 text-right font-medium text-gray-900">${item.total.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50/50">
                                                <tr>
                                                    <td className="px-5 py-4 font-bold text-gray-900" colSpan="2">Recurring (Monthly)</td>
                                                    <td className="px-5 py-4 text-right font-bold text-gray-900">${quoteResult.totalRecurring.toFixed(2)}</td>
                                                </tr>
                                                {quoteResult.totalOneTime > 0 && (
                                                    <tr>
                                                        <td className="px-5 py-4 font-bold text-gray-900" colSpan="2">One-Time Charges</td>
                                                        <td className="px-5 py-4 text-right font-bold text-gray-900">${quoteResult.totalOneTime.toFixed(2)}</td>
                                                    </tr>
                                                )}
                                                <tr className="bg-gray-900 text-white">
                                                    <td className="px-5 py-5 text-lg font-bold" colSpan="2">Total Due</td>
                                                    <td className="px-5 py-5 text-right text-2xl font-bold">
                                                        ${(quoteResult.totalRecurring + quoteResult.totalOneTime).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 text-center">
                                <p className="text-xs text-muted-foreground">
                                    * Estimated pricing. Final invoice may vary based on actual usage.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PricingBuilder;
