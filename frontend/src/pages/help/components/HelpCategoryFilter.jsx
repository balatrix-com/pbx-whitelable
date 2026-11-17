import React from 'react';
import {
    HelpCircle,
    Smartphone,
    PhoneCall,
    Headphones,
    ListTree,
    Wallet,
    Building2,
    RadioTower,
    CreditCard
} from 'lucide-react';

const ICON_MAP = {
    HelpCircle,
    Smartphone,
    PhoneCall,
    Headphones,
    ListTree,
    Wallet,
    Building2,
    RadioTower,
    CreditCard
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
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            isSelected
                                ? 'bg-primary-600 text-white shadow-sm ring-1 ring-primary-600'
                                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
                        }`}
                    >
                        <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
                        <span>{cat.label}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isSelected
                                ? 'bg-primary-700 text-white'
                                : 'bg-white text-slate-600 border border-slate-200/60'
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
