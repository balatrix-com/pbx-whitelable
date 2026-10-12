import React from 'react';
import { Package, RefreshCw } from 'lucide-react';
import AddonCatalogManagement from '../../components/subscription/AddonCatalogManagement';

const AddonsPage = () => {
    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
                        <Package className="h-8 w-8 text-primary-600" />
                        Add-ons Catalog
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400 mt-1 font-medium text-sm md:text-base">
                        Browse, configure, and manage add-on catalog packages and standalone resources
                    </p>
                </div>
            </div>

            {/* Addon Catalog View */}
            <AddonCatalogManagement />
        </div>
    );
};

export default AddonsPage;
