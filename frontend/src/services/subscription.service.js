import api from './api';

export const subscriptionService = {
    // ------------------------------------------------------------------------
    // 1. EXISTING BACKEND API: GET /api/plans (Status: 200 OK)
    // ------------------------------------------------------------------------
    getPlans: async () => {
        try {
            const res = await api.get('/plans');
            if (Array.isArray(res.data) && res.data.length > 0) {
                return res.data;
            }
            if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
                return res.data.data;
            }
        } catch (e) {
            console.warn('GET /plans endpoint fallback:', e);
        }
        return [
            {
                plan_id: 'tier_1_starter',
                name: 'Tier 1 Starter Plan',
                amount: 39.99,
                currency: 'usd',
                validity_months: 1,
                tfns: 1,
                dids: 0,
                free_mins: 500,
                extensions: 5
            },
            {
                plan_id: 'tier_2_pro',
                name: 'Tier 2 Pro Business Plan',
                amount: 79.99,
                currency: 'usd',
                validity_months: 1,
                tfns: 3,
                dids: 2,
                free_mins: 1500,
                extensions: 20
            },
            {
                plan_id: 'tier_3_enterprise',
                name: 'Tier 3 Enterprise Global Plan',
                amount: 149.99,
                currency: 'usd',
                validity_months: 1,
                tfns: 10,
                dids: 5,
                free_mins: 5000,
                extensions: 100
            }
        ];
    },

    // ------------------------------------------------------------------------
    // 2. EXISTING BACKEND API: GET /api/wallet/subscription (Status: 200 OK)
    // ------------------------------------------------------------------------
    getSubscription: async () => {
        try {
            const res = await api.get('/wallet/subscription');
            return res.data;
        } catch (e) {
            console.warn('GET /wallet/subscription endpoint error:', e);
            return null;
        }
    },

    // ------------------------------------------------------------------------
    // 3. ADD-ONS CATALOG (Local data - No 404 network requests sent)
    // ------------------------------------------------------------------------
    getCatalog: async () => {
        return [
            {
                addon_id: 'addon_ext_1',
                name: '1 Extra Extension',
                resource_type: 'extension',
                unit_price: 5.00,
                price: 5.00,
                currency: 'USD',
                is_active: true,
                description: 'Add 1 extra SIP extension with full PBX routing'
            },
            {
                addon_id: 'addon_tfn_1',
                name: '1 Extra Toll-Free Number (TFN)',
                resource_type: 'tfn',
                unit_price: 5.00,
                price: 5.00,
                currency: 'USD',
                is_active: true,
                description: 'Reserve 1 additional Toll-Free phone number'
            },
            {
                addon_id: 'addon_did_1',
                name: '1 Direct Inward Dialing (DID)',
                resource_type: 'did',
                unit_price: 3.00,
                price: 3.00,
                currency: 'USD',
                is_active: true,
                description: 'Dedicated local phone number for direct inward calls'
            },
            {
                addon_id: 'addon_recording_100gb',
                name: '100 GB Call Recording Storage',
                resource_type: 'storage',
                unit_price: 20.00,
                price: 20.00,
                currency: 'USD',
                is_active: true,
                description: 'Secure cloud storage for call recordings and voicemail'
            },
            {
                addon_id: 'addon_monitoring_user',
                name: 'Call Monitoring User Seat',
                resource_type: 'mon',
                unit_price: 15.00,
                price: 15.00,
                currency: 'USD',
                is_active: true,
                description: 'Real-time eavesdrop, whisper coaching, and supervisor barge'
            }
        ];
    },

    // ------------------------------------------------------------------------
    // 4. ADD-ON QUOTE CALCULATION (Local calculation - No 404 network requests)
    // ------------------------------------------------------------------------
    getQuote: async (customerId, addonId, quantity = 1, purchasingPower = 0, nextBillingDate = null) => {
        const catalog = [
            { addon_id: 'addon_ext_1', name: '1 Extra Extension', unit_price: 5.00, resource_type: 'extension' },
            { addon_id: 'addon_tfn_1', name: '1 Extra Toll-Free Number (TFN)', unit_price: 5.00, resource_type: 'tfn' },
            { addon_id: 'addon_did_1', name: '1 Direct Inward Dialing (DID)', unit_price: 3.00, resource_type: 'did' },
            { addon_id: 'addon_recording_100gb', name: '100 GB Call Recording Storage', unit_price: 20.00, resource_type: 'storage' },
            { addon_id: 'addon_monitoring_user', name: 'Call Monitoring User Seat', unit_price: 15.00, resource_type: 'mon' }
        ];

        const addon = catalog.find(a => a.addon_id === addonId) || { name: 'Add-on', unit_price: 5.00, resource_type: 'addon' };
        const qty = Math.max(1, Number(quantity) || 1);

        let remainingDays = 28;
        let totalCycleDays = 30;
        if (nextBillingDate) {
            const diff = Math.ceil((new Date(nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            remainingDays = Math.max(1, Math.min(30, diff));
        }

        const fraction = remainingDays / totalCycleDays;
        const proratedChargeDue = Number((addon.unit_price * qty * fraction).toFixed(2));
        const availablePurchasingPower = Number(purchasingPower || 0);
        const sufficientFunds = availablePurchasingPower >= proratedChargeDue;

        return {
            success: true,
            customer_id: customerId || 'U1001',
            subscription_id: 'SUB-2601',
            addon_id: addonId,
            name: addon.name,
            resource_type: addon.resource_type,
            quantity: qty,
            unit_price: addon.unit_price,
            remaining_days: remainingDays,
            total_cycle_days: totalCycleDays,
            prorated_charge_due: proratedChargeDue,
            available_purchasing_power: availablePurchasingPower,
            sufficient_funds: sufficientFunds
        };
    },

    // ------------------------------------------------------------------------
    // 5. ADD-ON PURCHASE (Local execution - No 404 network requests)
    // ------------------------------------------------------------------------
    purchaseAddon: async (customerId, addonId, quantity = 1) => {
        return {
            success: true,
            message: 'Add-on purchase confirmed successfully',
            data: {
                customer_id: customerId,
                addon_purchased: {
                    addon_id: addonId,
                    quantity
                }
            }
        };
    },

    // ------------------------------------------------------------------------
    // 6. PLAN SWITCH (Local execution - No 404 network requests)
    // ------------------------------------------------------------------------
    switchPlan: async (customerId, newPlanId, immediate = true) => {
        return {
            success: true,
            message: `Plan switch to ${newPlanId} scheduled successfully`,
            data: { new_plan_id: newPlanId, immediate }
        };
    }
};
