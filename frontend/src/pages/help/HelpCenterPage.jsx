import React, { useState, useMemo } from 'react';
import {
    Search,
    X,
    LifeBuoy,
    ChevronsUpDown,
    CheckCircle,
    RotateCcw
} from 'lucide-react';
import { HELP_CATEGORIES, HELP_ARTICLES } from './helpData';
import HelpAccordionItem from './components/HelpAccordionItem';
import HelpCategoryFilter from './components/HelpCategoryFilter';
import HelpContactCard from './components/HelpContactCard';

const HelpCenterPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [openItems, setOpenItems] = useState({});

    // Filter articles based on search query and selected category
    const filteredArticles = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return HELP_ARTICLES.filter((article) => {
            const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
            if (!matchesCategory) return false;

            if (!query) return true;

            const inTitle = article.title.toLowerCase().includes(query);
            const inSummary = article.summary?.toLowerCase().includes(query);
            const inTags = article.tags?.some((tag) => tag.toLowerCase().includes(query));
            const inSteps = article.steps?.some((step) => step.toLowerCase().includes(query));

            return inTitle || inSummary || inTags || inSteps;
        });
    }, [searchQuery, selectedCategory]);

    // Count articles per category (matching active search)
    const categoryCounts = useMemo(() => {
        const counts = { all: 0 };
        HELP_CATEGORIES.forEach((cat) => {
            if (cat.id !== 'all') counts[cat.id] = 0;
        });

        const query = searchQuery.trim().toLowerCase();

        HELP_ARTICLES.forEach((article) => {
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
    }, [searchQuery]);

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
        <div className="min-h-full space-y-6 max-w-6xl mx-auto pb-10">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-xs font-bold ring-1 ring-inset ring-indigo-600/10 mb-2">
                        <LifeBuoy className="w-3.5 h-3.5" />
                        <span>Self-Service Help Center</span>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        Troubleshooting & Solutions
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1.5 font-medium text-sm">
                        Quick solutions for softphone registration, call routing, audio configuration, and wallet management.
                    </p>
                </div>
            </div>

            {/* Hero Search Box */}
            <div className="bg-white dark:bg-[#0d0e13] border border-gray-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-6 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search issues, error messages, or topics (e.g., 'offline', 'one-way audio', 'zoiper', 'balance')..."
                        className="w-full pl-12 pr-10 py-3.5 bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition"
                            title="Clear search"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Categories */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.06]">
                    <HelpCategoryFilter
                        categories={HELP_CATEGORIES}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                        counts={categoryCounts}
                    />
                </div>
            </div>

            {/* Actions Bar (Result count + Expand/Collapse all) */}
            <div className="flex items-center justify-between px-1">
                <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                    Showing <span className="font-bold text-gray-900 dark:text-white">{filteredArticles.length}</span> troubleshooting guides
                    {selectedCategory !== 'all' && (
                        <span> in <span className="text-indigo-600 dark:text-indigo-400 font-bold">{HELP_CATEGORIES.find((c) => c.id === selectedCategory)?.label}</span></span>
                    )}
                </div>

                {filteredArticles.length > 0 && (
                    <button
                        type="button"
                        onClick={handleToggleAll}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                    >
                        <ChevronsUpDown className="w-3.5 h-3.5" />
                        <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
                    </button>
                )}
            </div>

            {/* Articles Accordion List */}
            {filteredArticles.length > 0 ? (
                <div className="space-y-3">
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
                <div className="bg-white dark:bg-[#0d0e13] border border-gray-200/80 dark:border-white/[0.08] rounded-2xl p-10 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/[0.04] text-gray-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                        <Search className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">
                            No troubleshooting guides found
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
                            We could not find any guides matching "{searchQuery}". Try searching with a different keyword or view all topics.
                        </p>
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200/60 dark:border-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Filters</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Escalation Contact Card */}
            <div className="pt-4">
                <HelpContactCard />
            </div>
        </div>
    );
};

export default HelpCenterPage;
