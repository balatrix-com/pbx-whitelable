import { useEffect, useState } from 'react';
import { RefreshCw, Search, ShieldAlert, ArrowDownRight, ArrowUpRight, Radio, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../services/api';
import SipTraceDetail from './SipTraceDetail';
import { formatCustomerId } from '../../utils/billing.utils';

const localInput = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function SipTracesPage({ tenantMode = false }) {
    const [from, setFrom] = useState(() => localInput(new Date(Date.now() - 86400000)));
    const [to, setTo] = useState(() => localInput(new Date()));
    const [customerId, setCustomerId] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const endpoint = tenantMode ? '/tenant/sip-traces' : '/sip-traces';

    const load = async (nextPage = page) => {
        setLoading(true);
        setError('');
        try {
            const params = tenantMode
                ? { search: search.trim(), page: nextPage, limit: 25 }
                : { from: new Date(from).toISOString(), to: new Date(to).toISOString(),
                    customerId: customerId.trim(), search: search.trim(), page: nextPage, limit: 25 };
            const result = await api.get(endpoint, { params, skipRetry: true, timeout: 15000 });
            setRows(result.data.data);
            setHasMore(result.data.hasMore);
            setPage(nextPage);
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to load SIP traces.');
        } finally { setLoading(false); }
    };

    useEffect(() => { load(1); }, []); // Initial bounded history query only.

    const time = (value) => value ? new Date(value).toLocaleString() : '—';

    return <div className="max-w-7xl mx-auto pb-12 space-y-6 px-4 sm:px-6 lg:px-8">
        {/* Header section matching platform pages */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                    <div className="bg-primary-600 p-2 rounded-2xl shadow-lg shadow-primary-600/20">
                        <Radio className="text-white h-6 w-6 md:h-7 md:w-7" />
                    </div>
                    SIP Traces
                </h1>
                <p className="mt-1.5 text-gray-500 font-medium text-sm md:text-base">
                    {tenantMode
                        ? 'Your latest 100 completed calls. Inspect live signaling and SIP ladder flows.'
                        : 'Super Admin diagnostics · Inspect SIP ladder, message headers, and RTP packet flow.'}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => load(page)}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                    title="Refresh traces"
                >
                    <RefreshCw className={clsx("w-4 h-4 text-primary-600", loading && "animate-spin")} />
                    <span>Refresh</span>
                </button>
            </div>
        </div>

        {/* Info banner */}
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3.5 text-xs md:text-sm text-amber-900 flex items-start sm:items-center gap-3 shadow-xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <span>
                SIP signaling contains sensitive data. Authentication headers are redacted; Homer retention or packet loss may leave a trace incomplete.
            </span>
        </div>

        {/* Filter Card */}
        <form onSubmit={(event) => { event.preventDefault(); load(1); }} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm ring-1 ring-gray-200 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-end">
            {!tenantMode && <>
                <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider ml-1">From</label>
                    <input
                        aria-label="From"
                        type="datetime-local"
                        required
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                        className="block w-full rounded-2xl border-0 py-2.5 px-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-gray-50/50"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider ml-1">To</label>
                    <input
                        aria-label="To"
                        type="datetime-local"
                        required
                        value={to}
                        onChange={e => setTo(e.target.value)}
                        className="block w-full rounded-2xl border-0 py-2.5 px-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-gray-50/50"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider ml-1">Customer ID</label>
                    <input
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                        placeholder="e.g. U1001"
                        className="block w-full rounded-2xl border-0 py-2.5 px-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-gray-50/50"
                    />
                </div>
            </>}
            <div className={clsx("space-y-1.5", tenantMode ? "sm:col-span-4" : "")}>
                <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider ml-1">Number / Call-ID</label>
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search number or session UUID..."
                        className="block w-full rounded-2xl border-0 py-2.5 pl-10 pr-3.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm font-medium bg-gray-50/50"
                    />
                </div>
            </div>
            <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-2xl py-2.5 px-4 font-bold flex items-center justify-center gap-2 shadow-sm shadow-primary-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
                <Search className="w-4 h-4" />
                Search
            </button>
        </form>

        {error && <div role="alert" className="rounded-2xl bg-red-50 text-red-800 p-4 border border-red-200 font-medium text-sm">{error}</div>}

        {/* Calls Table Section structured same as Tenants table */}
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            {/* Table Top Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-extrabold text-gray-900 tracking-tight">Calls</h2>
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-extrabold text-indigo-700 ring-1 ring-indigo-500/10">
                        {rows.length} {rows.length === 1 ? 'record' : 'records'}
                    </span>
                </div>
                <button
                    aria-label="Refresh traces"
                    title="Refresh"
                    onClick={() => load(page)}
                    disabled={loading}
                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Started</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                            <th className="hidden sm:table-cell px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Direction</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Caller → Callee</th>
                            <th className="hidden md:table-cell px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">CDR Status</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Trace</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan="6" className="px-6 py-6"><div className="h-4 bg-gray-100 rounded-full w-full"></div></td>
                                </tr>
                            ))
                        ) : !rows.length ? (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-gray-400 font-bold italic">
                                    {tenantMode ? 'No completed calls match your search.' : 'No call events match this time window.'}
                                </td>
                            </tr>
                        ) : (
                            rows.map(row => {
                                const isExported = row.cdr_export_status === 'COMPLETED' || row.cdr_export_status === 'EXPORTED';
                                const isFailed = row.cdr_export_status === 'FAILED';
                                const isPending = row.cdr_export_status === 'PENDING';
                                const isNotice = row.cdr_export_status === 'NOTICE_SENT';

                                return (
                                    <tr key={row.session_uuid} className="hover:bg-gray-50/50 transition-all group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900">
                                                    {time(row.started_at || row.first_leg_received_at)}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-mono font-bold tracking-tight truncate max-w-[140px] md:max-w-[200px]" title={row.session_uuid}>
                                                    {row.session_uuid}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {row.customer_id ? (
                                                <span className="inline-flex items-center rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-mono font-bold text-gray-700 ring-1 ring-inset ring-gray-200">
                                                    {formatCustomerId(row.customer_id)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 font-medium">—</span>
                                            )}
                                        </td>
                                        <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap">
                                            <span className={clsx(
                                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-xs ring-1",
                                                row.direction === 'INBOUND'
                                                    ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20'
                                                    : row.direction === 'OUTBOUND'
                                                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                                                        : 'bg-gray-50 text-gray-600 ring-gray-400/20'
                                            )}>
                                                {row.direction === 'INBOUND' ? <ArrowDownRight className="w-3 h-3" /> : row.direction === 'OUTBOUND' ? <ArrowUpRight className="w-3 h-3" /> : null}
                                                {row.direction || 'UNKNOWN'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-extrabold text-gray-900">{row.caller_number || '—'}</span>
                                                <span className="text-xs text-gray-400">→</span>
                                                <span className="text-sm font-extrabold text-gray-900">{row.destination_number || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                                            <span className={clsx(
                                                "inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-xs ring-1",
                                                isExported ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' :
                                                isFailed ? 'bg-rose-50 text-rose-700 ring-rose-600/20' :
                                                isPending ? 'bg-amber-50 text-amber-700 ring-amber-600/20' :
                                                isNotice ? 'bg-blue-50 text-blue-700 ring-blue-600/20' :
                                                'bg-gray-100 text-gray-600 ring-gray-400/20'
                                            )}>
                                                {row.cdr_export_status || 'NONE'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                disabled={!row.traceAvailable}
                                                onClick={() => setSelected(row)}
                                                className={clsx(
                                                    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black shadow-sm ring-1 ring-inset transition-all active:scale-95",
                                                    row.traceAvailable
                                                        ? "bg-white text-primary-600 ring-primary-200 hover:bg-primary-50"
                                                        : "bg-gray-50 text-gray-400 ring-gray-200 cursor-not-allowed opacity-60"
                                                )}
                                            >
                                                <span>{row.traceAvailable ? 'Open trace' : 'No Call-ID'}</span>
                                                {row.traceAvailable && <ExternalLink size={12} />}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer matching tenants table */}
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Page <span className="text-primary-600">{page}</span>
                </div>
                <div className="flex gap-2">
                    <button
                        disabled={page <= 1 || loading}
                        onClick={() => load(page - 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg ring-1 ring-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Previous
                    </button>
                    <button
                        disabled={!hasMore || loading}
                        onClick={() => load(page + 1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg ring-1 ring-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
                    >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>

        {selected && <SipTraceDetail row={selected} endpoint={endpoint} onClose={() => setSelected(null)} />}
    </div>;
}
