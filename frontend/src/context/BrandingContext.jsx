import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BrandingContext = createContext(null);

export const BrandingProvider = ({ children }) => {
    const [branding, setBranding] = useState({
        name: 'Cloud PBX',
        logoMain: '/svg logo/logo-main.svg',
        logoSidebar: '/svg logo/logo-main.svg',
        favicon: '/svg logo/favicon.svg',
        primaryColor: '#3d52a0',
        accentColor: '#ed8f55',
        supportEmail: 'support@telecom-platform.com',
        supportPhone: '+1-800-555-0199',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBranding = async () => {
            try {
                const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const domain = window.location.hostname;
                const response = await axios.get(`${apiBaseUrl}/branding`, {
                    params: { domain }
                });

                if (response.data) {
                    const data = response.data;
                    setBranding(data);

                    // Inject CSS custom variables into root element
                    const root = document.documentElement;
                    if (data.primaryColor) {
                        root.style.setProperty('--color-primary', data.primaryColor);
                    }
                    if (data.accentColor) {
                        root.style.setProperty('--color-accent', data.accentColor);
                        // Map secondary to accent for design compatibility
                        root.style.setProperty('--color-secondary', data.accentColor);
                    }

                    // Dynamically set title and favicon
                    if (data.name) {
                        document.title = data.name;
                    }
                    if (data.favicon) {
                        let link = document.querySelector("link[rel~='icon']");
                        if (!link) {
                            link = document.createElement('link');
                            link.rel = 'icon';
                            document.getElementsByTagName('head')[0].appendChild(link);
                        }
                        link.href = data.favicon;
                    }
                }
            } catch (error) {
                console.error('Failed to load branding:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBranding();
    }, []);

    return (
        <BrandingContext.Provider value={{ branding, loading, refreshBranding: fetchBranding }}>
            {!loading && children}
        </BrandingContext.Provider>
    );
};

export const useBranding = () => {
    const context = useContext(BrandingContext);
    if (!context) {
        throw new Error('useBranding must be used within a BrandingProvider');
    }
    return context;
};
