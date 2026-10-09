import api from './api';

export const addonsService = {
    // List all active catalog items: GET /addons/catalog
    getAddonCatalog: async () => {
        const response = await api.get('/addons/catalog');
        return response.data;
    },

    // Create a new addon catalog item: POST /addons/catalog
    createAddonCatalogItem: async (data) => {
        // data = { addon_id, name, resource_type, unit_price, currency, is_active }
        const response = await api.post('/addons/catalog', data);
        return response.data;
    },

    // Delete (deactivate) addon catalog item: DELETE /addons/catalog/:addonId
    deleteAddonCatalogItem: async (addonId) => {
        const response = await api.delete(`/addons/catalog/${addonId}`);
        return response.data;
    },

    // Get active addons for a subscription: GET /addons/subscription/:subscriptionId
    getSubscriptionAddons: async (subscriptionId) => {
        const response = await api.get(`/addons/subscription/${subscriptionId}`);
        return response.data?.data || response.data || [];
    },

    // Toggle auto-renew for an addon subscription: PATCH /addons/subscriptions/:subscriptionAddonId/auto-renew
    toggleAutoRenew: async (subscriptionAddonId, auto_renew) => {
        const response = await api.patch(`/addons/subscriptions/${subscriptionAddonId}/auto-renew`, { auto_renew });
        return response.data;
    },

    // Cancel an addon subscription: DELETE /addons/subscription/:subscriptionAddonId
    cancelSubscriptionAddon: async (subscriptionAddonId) => {
        const response = await api.delete(`/addons/subscription/${subscriptionAddonId}`);
        return response.data;
    }
};

export default addonsService;
