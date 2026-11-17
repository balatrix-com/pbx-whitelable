import React, { useState, useMemo } from 'react';
import {
    Search,
    X,
    LifeBuoy,
    ChevronsUpDown,
    RotateCcw,
    ShieldAlert,
    Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { HELP_CATEGORIES, HELP_ARTICLES } from './helpData';
import HelpAccordionItem from './components/HelpAccordionItem';
import HelpCategoryFilter from './components/HelpCategoryFilter';

const HelpCenterPage = () => {
    const { user, isSuperAdmin, isImpersonating } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [openItems, setOpenItems] = useState({});

    // Super Admin platform mode vs Tenant / Admin mode
    const isPlatformAdmin = isSuperAdmin && !isImpersonating;

    // Available categories based on active user role
    const visibleCategories = useMemo(() => {
        return HELP_CATEGORIES.filter((cat) => {
            if (!cat.role) return true;
            if (cat.role === 'SUPER_ADMIN') {
                return isPlatformAdmin;
            }
            if (cat.role === 'TENANT') {
                return !isPlatformAdmin;
            }
            return true;
        });
    }, [isPlatformAdmin]);

    // Available articles based on user role
    const roleArticles = useMemo(() => {
        return HELP_ARTICLES.filter((article) => {
            if (!article.roles || article.roles.length === 0) return true;
            if (isPlatformAdmin) {
                // Super Admin sees platform operational troubleshooting guides
                return article.roles.includes('SUPER_ADMIN');
            }
            // Tenant Admins & Support see tenant-level PBX & softphone guides
            return article.roles.includes('ADMIN') || article.roles.includes('SUPPORT');
        });
    }, [isPlatformAdmin]);

    // Filter articles based on search query and selected category
    const filteredArticles = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return roleArticles.filter((article) => {
            const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
            if (!matchesCategory) return false;

            if (!query) return true;

            const inTitle = article.title.toLowerCase().includes(query);
            const inSummary = article.summary?.toLowerCase().includes(query);
            const inTags = article.tags?.some((tag) => tag.toLowerCase().includes(query));
            const inSteps = article.steps?.some((step) => step.toLowerCase().includes(query));

            return inTitle || inSummary || inTags || inSteps;
        });
    }, [roleArticles, searchQuery, selectedCategory]);

    // Count articles per category (matching active search)
    const categoryCounts = useMemo(() => {
        const counts = { all: 0 };
        visibleCategories.forEach((cat) => {
            if (cat.id !== 'all') counts[cat.id] = 0;
        });

        const query = searchQuery.trim().toLowerCase();

        roleArticles.forEach((article) => {
            const matchesQuery =
                !query ||
                article.title.toLowerCase().includes(query) ||
                article.summary?.toLowerCase().includes(query) ||
                article.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
                article.steps?.some((step) => step.toLowerCase().includes(query));

            if (matchesQuery) {
                counts.all += 1;
                if (counts[article.category] !== undefined) {
                    counts[article.category] += 1;
                }
            }
        });

        return counts;
    }, [visibleCategories, roleArticles, searchQuery]);

    // Toggle single item
    const toggleItem = (id) => {
        setOpenItems((prev) => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Expand all / Collapse all toggle
    const allExpanded = useMemo(() => {
        if (filteredArticles.length === 0) return false;
        return filteredArticles.every((art) => openItems[art.id]);
    }, [filteredArticles, openItems]);

    const handleToggleAll = () => {
        if (allExpanded) {
            setOpenItems({});
        } else {
            const newOpen = {};
            filteredArticles.forEach((art) => {
                newOpen[art.id] = true;
            });
            setOpenItems(newOpen);
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setSelectedCategory('all');
    };

    return (
        <div className="max-w-7xl mx-auto pb-12 space-y-6 px-4 sm:px-6 lg:px-8">
            {/* Page Header customized for Super Admin vs Tenant Admin */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        <div className="bg-primary-600 p-2 rounded-2xl shadow-lg shadow-primary-600/20">
                            {isPlatformAdmin ? (
                                <ShieldAlert className="text-white h-6 w-6 md:h-7 md:w-7" />
                            ) : (
                                <LifeBuoy className="text-white h-6 w-6 md:h-7 md:w-7" />
                            )}
                        </div>
                        {isPlatformAdmin ? 'Platform Diagnostics & Help Center' : 'Help Center & Troubleshooting'}
                    </h1>
                    <p className="mt-1.5 text-gray-500 font-medium text-sm md:text-base">
                        {isPlatformAdmin
                            ? 'Runbook guides for tenant service locks, upstream carrier interconnects, rate card billing, SIP signaling traces, and number provisioning.'
                            : 'Quick solutions for softphone registration, call routing, audio configuration, and wallet management.'}
                    </p>
                </div>
            </div>

            {/* Filter and Search Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                            isPlatformAdmin
                                ? "Search platform issues (e.g., 'carrier gateway', 'tenant blocked', 'rate card', 'SIP trace')..."
                                : "Search issues, error messages, or topics (e.g., 'offline', 'one-way audio', 'zoiper', 'balance')..."
                        }
                        className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 transition"
                            title="Clear search"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Categories */}
                <div className="pt-2 border-t border-slate-100">
                    <HelpCategoryFilter
                        categories={visibleCategories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                        counts={categoryCounts}
                    />
                </div>
            </div>

            {/* Actions Bar (Result count + Expand/Collapse all) */}
            <div className="flex items-center justify-between px-1">
                <div className="text-xs md:text-sm font-semibold text-gray-500">
                    Showing <span className="font-bold text-gray-900">{filteredArticles.length}</span>{' '}
                    {isPlatformAdmin ? (
                        <span>platform operations & diagnostic guides</span>
                    ) : (
                        <span>troubleshooting guides</span>
                    )}
                    {selectedCategory !== 'all' && (
                        <span>
                            {' '}
                            in{' '}
                            <span className="text-primary-600 font-bold">
                                {visibleCategories.find((c) => c.id === selectedCategory)?.label}
                            </span>
                        </span>
                    )}
                </div>

                {filteredArticles.length > 0 && (
                    <button
                        type="button"
                        onClick={handleToggleAll}
                        className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-gray-600 hover:text-primary-600 transition"
                    >
                        <ChevronsUpDown className="w-4 h-4" />
                        <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
                    </button>
                )}
            </div>

            {/* Articles Accordion List */}
            {filteredArticles.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    {filteredArticles.map((article) => (
                        <HelpAccordionItem
                            key={article.id}
                            article={article}
                            isOpen={!!openItems[article.id]}
                            onToggle={() => toggleItem(article.id)}
                        />
                    ))}
                </div>
            ) : (
                /* Empty Search State */
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-slate-50 text-gray-400 flex items-center justify-center mx-auto">
                        <Search className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-gray-900">
                            No guides found
                        </h3>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto">
                            We could not find any guides matching "{searchQuery}". Try searching with a different keyword or reset filters.
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-50 text-primary-600 text-xs font-bold border border-primary-200/60 hover:bg-primary-100 transition"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Filters</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpCenterPage;
