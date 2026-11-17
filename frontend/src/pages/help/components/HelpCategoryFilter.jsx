import React from 'react';
import {
    HelpCircle,
    Smartphone,
    PhoneCall,
    Headphones,
    ListTree,
    Wallet
} from 'lucide-react';

const ICON_MAP = {
    HelpCircle,
    Smartphone,
    PhoneCall,
    Headphones,
    ListTree,
    Wallet
};

const HelpCategoryFilter = ({ categories, selectedCategory, onSelectCategory, counts }) => {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => {
                const IconComponent = ICON_MAP[cat.icon] || HelpCircle;
                const isSelected = selectedCategory === cat.id;
                const count = counts[cat.id] ?? 0;

                return (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => onSelectCategory(cat.id)}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs ${
                            isSelected
                                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                                : 'bg-white dark:bg-[#0d0e13] text-gray-700 dark:text-slate-300 border border-gray-200/80 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                        }`}
                    >
                        <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`} />
                        <span>{cat.label}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            isSelected
                                ? 'bg-indigo-700 text-white'
                                : 'bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-slate-300'
                        }`}>
                            {count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default HelpCategoryFilter;
