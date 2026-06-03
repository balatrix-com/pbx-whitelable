import api from './api';

export const plansService = {
    // Get all plans (standard + custom created by user)
    getAll: async () => {
        const response = await api.get('/plans');
        return response.data;
    },

    // Create a new custom plan
    createCustom: async (planData) => {
        const response = await api.post('/plans', planData);
        return response.data;
    }
};
