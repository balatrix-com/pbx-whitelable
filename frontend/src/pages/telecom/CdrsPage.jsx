import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Search, Filter, DollarSign, PhoneOff, ArrowDownRight, ArrowUpRight, History, Calendar, Play, Pause, Loader2, Users, Wallet, Info, Volume2, VolumeX, MoreVertical } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { telecomService } from '../../services/telecom.service';
import api from '../../services/api';
import { useWalletQuery, useSubscriptionQuery } from '../../hooks/useBillingQueries';
import { useBillingIntelligence } from '../../hooks/useBillingIntelligence';
import { useAuth } from '../../context/AuthContext';


const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const PlaybackButton = ({ uuid, cdr }) => {
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'playing' | 'none'
    const [audioUrl, setAudioUrl] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showMenu, setShowMenu] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [menuPlacement, setMenuPlacement] = useState('bottom'); // 'top' or 'bottom'
    const audioRef = useRef(null);
    const menuRef = useRef(null);
    const volumeRef = useRef(null);
    const menuBtnRef = useRef(null);

    // Strictly check if has_recording / hasRecording in the CDR payload is true
    const hasRecording = Boolean(
        cdr?.hasRecording === true ||
        cdr?.has_recording === true ||
        cdr?.has_recording === 'true' ||
        cdr?.has_recording === 1
    );

    // Close menus on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target) && (!menuBtnRef.current || !menuBtnRef.current.contains(e.target))) {
                setShowMenu(false);
            }
            if (volumeRef.current && !volumeRef.current.contains(e.target)) {
                setShowVolumeSlider(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (!hasRecording || status === 'none') {
        return <span className="text-gray-300 font-medium text-xs">—</span>;
    }

    const fmt = (sec) => {
        const s = Math.floor(sec);
        const m = Math.floor(s / 60);
        return `${m}:${String(s % 60).padStart(2, '0')}`;
    };

    const handlePlay = async () => {
        if (status === 'playing') {
            audioRef.current?.pause();
            setStatus('idle');
            return;
        }
        if (audioUrl) {
            audioRef.current?.play();
            setStatus('playing');
            return;
        }

        setStatus('loading');
        try {
            const blob = await telecomService.playRecording(uuid);
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            setStatus('playing');
        } catch (e) {
            setStatus('none');
        }
    };

    const handleDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        setShowMenu(false);
        try {
            let downloadUrl = audioUrl;
            if (!downloadUrl) {
                const blob = await telecomService.playRecording(uuid);
                downloadUrl = URL.createObjectURL(blob);
                setAudioUrl(downloadUrl);
            }
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `recording_${uuid}.mp3`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('Failed to download recording:', e);
        } finally {
            setDownloading(false);
        }
    };

    const handleSeek = (e) => {
        const val = Number(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = val;
            setCurrentTime(val);
        }
    };

    const handleVolumeChange = (e) => {
        const val = Number(e.target.value);
        setVolume(val);
        if (audioRef.current) audioRef.current.volume = val;
        if (val === 0) setMuted(true);
        else setMuted(false);
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        const next = !muted;
        setMuted(next);
        audioRef.current.muted = next;
    };

    const applySpeed = (speed) => {
        setPlaybackSpeed(speed);
        if (audioRef.current) audioRef.current.playbackRate = speed;
        setShowMenu(false);
    };

    const toggleMenu = () => {
        if (!showMenu && menuBtnRef.current) {
            const rect = menuBtnRef.current.getBoundingClientRect();
            // If there's less than 240px below the button, position menu above
            if (window.innerHeight - rect.bottom < 240) {
                setMenuPlacement('top');
            } else {
                setMenuPlacement('bottom');
            }
        }
        setShowMenu(v => !v);
        setShowVolumeSlider(false);
    };

    useEffect(() => {
        if (audioUrl && audioRef.current && status === 'playing') {
            audioRef.current.play();
        }
    }, [audioUrl, status]);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex items-center gap-2">
            {/* Player bar */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 shadow-sm min-w-[200px]">
                {/* Play / Pause */}
                <button
                    onClick={handlePlay}
                    disabled={status === 'loading'}
                    className="w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                    title={status === 'playing' ? 'Pause' : 'Play'}
                >
                    {status === 'loading' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                    ) : status === 'playing' ? (
                        <Pause className="w-3 h-3 fill-gray-700 text-gray-700" />
                    ) : (
                        <Play className="w-3 h-3 fill-gray-700 text-gray-700 ml-0.5" />
                    )}
                </button>

                {/* Time + Seek */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-gray-500 tabular-nums shrink-0">{fmt(currentTime)}</span>
                    <div className="relative flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                        />
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={currentTime}
                            onChange={handleSeek}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 tabular-nums shrink-0">{fmt(duration)}</span>
                </div>

                {/* Volume */}
                <div className="relative shrink-0" ref={volumeRef}>
                    <button
                        onClick={() => { setShowVolumeSlider(v => !v); setShowMenu(false); }}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                        title="Volume"
                    >
                        {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    {showVolumeSlider && (
                        <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 shadow-xl rounded-xl px-3 py-2.5 z-50 flex flex-col items-center gap-1.5" style={{ width: 40 }}>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={muted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="h-20 cursor-pointer accent-indigo-500"
                                style={{ writingMode: 'vertical-lr', direction: 'rtl', WebkitAppearance: 'slider-vertical' }}
                            />
                            <span className="text-[9px] font-bold text-gray-400">{muted ? 0 : Math.round(volume * 100)}%</span>
                        </div>
                    )}
                </div>

                {/* Three-dot Menu */}
                <div className="relative shrink-0" ref={menuRef}>
                    <button
                        ref={menuBtnRef}
                        onClick={toggleMenu}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
                        title="More options"
                    >
                        <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {showMenu && (
                        <div className={`absolute ${menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 bg-white border border-gray-200 shadow-2xl rounded-2xl py-2 z-50 min-w-[160px]`}>
                            {/* Divider + Speed */}
                            <div className="px-4 pt-2 pb-1">
                                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Playback Speed</p>
                            </div>
                            {PLAYBACK_SPEEDS.map((speed) => (
                                <button
                                    key={speed}
                                    onClick={() => applySpeed(speed)}
                                    className={`w-full text-left px-4 py-2 text-sm font-semibold transition-colors ${playbackSpeed === speed
                                            ? 'bg-indigo-50 text-indigo-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    {speed}×
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Dedicated Download Button */}
            <button
                onClick={handleDownload}
                disabled={downloading}
                title="Download Recording"
                className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 shrink-0 shadow-sm"
            >
                {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                ) : (
                    <Download className="w-4 h-4 text-emerald-600" />
                )}
            </button>

            {/* Hidden audio element */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setStatus('idle')}
                    onPause={() => { if (status === 'playing') setStatus('idle'); }}
                    onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                    onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                    onDurationChange={() => setDuration(audioRef.current?.duration || 0)}
                    className="hidden"
                />
            )}
        </div>
    );
};

const CdrsPage = () => {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const [cdrs, setCdrs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [preset, setPreset] = useState('30days');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const pageSize = 50;

    // Super Admin Customer Filter
    const [tenantList, setTenantList] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('ALL');

    const { data: wallet } = useWalletQuery();
    const { data: subscription } = useSubscriptionQuery();
    const intelligence = useBillingIntelligence(wallet, subscription);

    useEffect(() => {
        if (isSuperAdmin) {
            api.get('/tenants?limit=100')
                .then(res => setTenantList(res.data?.data || []))
                .catch(err => console.error('Failed to fetch tenants for CDR filter:', err));
        }
    }, [isSuperAdmin]);

    const fetchCDRs = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const offset = (page - 1) * pageSize;
            const result = await telecomService.getCDRs({
                startDate: dateRange.start ? `${dateRange.start} 00:00:00` : undefined,
                endDate: dateRange.end ? `${dateRange.end} 23:59:59` : undefined,
                search: searchTerm || undefined,
                customerId: (isSuperAdmin && selectedCustomer !== 'ALL') ? selectedCustomer : undefined,
                limit: pageSize,
                offset: offset
            });

            const rawList = Array.isArray(result) ? result : (result?.data || []);
            const mapped = rawList.map((cdr, idx) => ({
                id: offset + idx,
                uuid: cdr.call_uuid || cdr.uuid || cdr.id || idx,
                timestamp: cdr.created_at || cdr.timestamp || new Date().toISOString(),
                from: cdr.caller || cdr.from || '-',
                to: cdr.callee || cdr.to || '-',
                direction: (cdr.call_type || cdr.direction || 'OUTBOUND').toUpperCase(),
                duration: cdr.duration_sec ?? cdr.duration ?? 0,
                billsec: cdr.billsec ?? 0,
                cost: cdr.bill_amount ?? cdr.cost ?? 0,
                callCost: cdr.call_cost ?? cdr.call_charge ?? cdr.bill_amount ?? cdr.cost ?? 0,
                recordingCost: cdr.recording_amount ?? cdr.recording_cost ?? cdr.recording_charge ?? 0,
                totalCost: cdr.total_cost ?? cdr.total_amount ?? ((Number(cdr.call_cost ?? cdr.call_charge ?? cdr.bill_amount ?? cdr.cost ?? 0)) + (Number(cdr.recording_amount ?? cdr.recording_cost ?? cdr.recording_charge ?? 0))),
                status: cdr.status || 'answered',
                destType: cdr.dest_type || cdr.destType,
                destValue: cdr.dest_value || cdr.destValue,
                has_recording: cdr.has_recording,
                hasRecording: Boolean(cdr.has_recording === true || cdr.has_recording === 'true' || cdr.has_recording === 1 || cdr.hasRecording === true)
            }));

            setCdrs(mapped);
            setTotalRecords(Array.isArray(result) ? result.length : (result?.total || mapped.length));
            setCurrentPage(page);
        } catch (err) {
            console.error('Failed to fetch CDRs:', err);
        } finally {
            setLoading(false);
        }
    }, [dateRange, searchTerm, selectedCustomer, isSuperAdmin]);

    useEffect(() => {
        fetchCDRs(1);
    }, [fetchCDRs]);

    const handlePresetChange = (key) => {
        setPreset(key);
        const today = new Date();
        let start = today;
        let end = today;

        switch (key) {
            case 'today':
                start = today;
                break;
            case 'yesterday':
                start = subDays(today, 1);
                end = start;
                break;
            case '7days':
                start = subDays(today, 6);
                break;
            case '30days':
                start = subDays(today, 29);
                break;
            case 'month':
                start = startOfMonth(today);
                break;
            default:
                return;
        }

        setDateRange({
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd')
        });
    };

    const handleExportCSV = async () => {
        if (totalRecords === 0) return;

        try {
            const result = await telecomService.getCDRs({
                startDate: dateRange.start ? `${dateRange.start} 00:00:00` : undefined,
                endDate: dateRange.end ? `${dateRange.end} 23:59:59` : undefined,
                search: searchTerm || undefined,
                customerId: (isSuperAdmin && selectedCustomer !== 'ALL') ? selectedCustomer : undefined,
                limit: 'all'
            });

            const allCdrs = Array.isArray(result) ? result : (result?.data || []);
            const headers = ['Date', 'From', 'To', 'Direction', 'Duration (sec)', 'Billsec (sec)', 'Cost ($)', 'Status', 'Dest Type', 'Dest Value'];
            const rows = allCdrs.map(c => [
                format(new Date(c.created_at || c.timestamp || new Date()), 'yyyy-MM-dd HH:mm:ss'),
                c.caller || c.from || '-',
                c.callee || c.to || '-',
                (c.call_type || c.direction || 'OUTBOUND').toUpperCase(),
                c.duration_sec ?? c.duration ?? 0,
                c.billsec ?? 0,
                c.bill_amount || c.cost || '0.00',
                c.status || 'answered',
                c.dest_type || c.destType || '-',
                c.dest_value || c.destValue || '-'
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `call_records_${dateRange.start}_to_${dateRange.end}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    const filteredCdrs = cdrs.filter(cdr =>
        (cdr.from || '').includes(searchTerm) ||
        (cdr.to || '').includes(searchTerm)
    );

    const totalPages = Math.ceil(totalRecords / pageSize);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Call Records (CDRs)</h1>
                    <p className="text-gray-500 mt-1 font-medium">Manage and analyze your communication history</p>
                </div>

                {/* Free Minutes Summary Widget */}
                {intelligence.usage.totalMins > 0 && !isSuperAdmin && (
                    <div className="bg-white px-4 py-3 rounded-2xl shadow-sm ring-1 ring-gray-200 flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <div className="bg-purple-50 p-2 rounded-xl ring-1 ring-purple-100">
                            <Wallet className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest leading-none mb-1">Free Minutes Used</div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-gray-900 leading-none">{intelligence.usage.usedMins} <span className="text-xs text-gray-400 font-medium">/ {intelligence.usage.totalMins}</span></span>
                                <div className="w-20 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-600 transition-all duration-1000"
                                        style={{ width: `${intelligence.usage.usedPercent}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                        <div className="ml-2 pl-4 border-l border-gray-100">
                            <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest leading-none mb-1">Balance</div>
                            <span className="text-lg font-mono font-bold text-gray-900 leading-none">${Number(wallet?.balance || 0).toFixed(2)}</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-1">
                        {['today', '7days', '30days', 'month'].map((p) => (
                            <button
                                key={p}
                                onClick={() => handlePresetChange(p)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${preset === p
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                {p.charAt(0).toUpperCase() + p.slice(1).replace('days', ' Days')}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleExportCSV}
                        disabled={totalRecords === 0}
                        className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="mr-2 h-4 w-4 text-gray-500" />
                        Export
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-6">
                <div className={`grid grid-cols-1 md:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6`}>
                    {isSuperAdmin && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider ml-1">Customer / User</label>
                            <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <select
                                    className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm font-bold bg-white"
                                    value={selectedCustomer}
                                    onChange={e => setSelectedCustomer(e.target.value)}
                                >
                                    <option value="ALL">All Customers / Users</option>
                                    {tenantList.map(t => (
                                        <option key={t.id} value={t.customerCode || t.subBillingCustomerId || t.id}>
                                            {t.name} ({t.customerCode || t.id})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider ml-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Number..."
                                className="block w-full rounded-xl border-0 py-2.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider ml-1">From Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                className="block w-full rounded-xl border-0 py-2.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium"
                                value={dateRange.start}
                                onChange={e => {
                                    setDateRange(prev => ({ ...prev, start: e.target.value }));
                                    setPreset('custom');
                                }}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-extrabold text-gray-500 uppercase tracking-wider ml-1">To Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                className="block w-full rounded-xl border-0 py-2.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm font-medium"
                                value={dateRange.end}
                                onChange={e => {
                                    setDateRange(prev => ({ ...prev, end: e.target.value }));
                                    setPreset('custom');
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => fetchCDRs(1)}
                            className="w-full bg-primary-600 text-white font-bold py-2.5 rounded-xl shadow-sm hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Filter className="h-4 w-4" />
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4"></div>
                        <p className="text-gray-500 font-bold tracking-tight">Syncing call records...</p>
                    </div>
                ) : filteredCdrs.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50/30">
                        <div className="mx-auto h-16 w-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                            <History className="h-8 w-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No calls in this period</h3>
                        <p className="text-gray-500 mt-2 font-medium max-w-xs mx-auto">Try adjusting your filters or date range to find the records you're looking for.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto pb-4">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50/50">
                                    <tr>
                                        <th scope="col" className="py-4 pl-4 md:pl-6 pr-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Time</th>
                                        <th scope="col" className="px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Caller</th>
                                        <th scope="col" className="px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Recipient</th>
                                        <th scope="col" className="hidden lg:table-cell px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Dest</th>
                                        <th scope="col" className="hidden sm:table-cell px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Type</th>
                                        <th scope="col" className="px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Dur</th>
                                        <th scope="col" className="px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Billsec</th>
                                        <th scope="col" className="px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Call Charge</th>
                                        <th scope="col" className="px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Recording Charge</th>
                                        <th scope="col" className="hidden md:table-cell px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Total Amount</th>
                                        <th scope="col" className="px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Status</th>
                                        <th scope="col" className="px-3 py-4 text-left text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Recording</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCdrs.map((cdr) => (
                                        <tr key={cdr.id} className="hover:bg-gray-50/80 transition-all group">
                                            <td className="whitespace-nowrap py-4 pl-4 md:pl-6 pr-3">
                                                <div className="text-sm font-bold text-gray-900">{format(new Date(cdr.timestamp), 'MMM d')}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(cdr.timestamp), 'HH:mm')}</div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-700">{cdr.from}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-700">{cdr.to}</td>
                                            <td className="hidden lg:table-cell whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-700">
                                                <div className="text-sm font-bold text-gray-700">{cdr.destValue || '-'}</div>
                                                <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-tighter">{cdr.destType || '-'}</div>
                                            </td>
                                            <td className="hidden sm:table-cell whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-700">
                                                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-extrabold tracking-tight ${cdr.direction === 'INBOUND'
                                                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20'
                                                    : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                                                    }`}>
                                                    {cdr.direction === 'INBOUND' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                                    {cdr.direction}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-600">
                                                <div className="text-gray-900">{Math.floor(cdr.duration / 60)}m {cdr.duration % 60}s</div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-600">
                                                <div className="text-gray-900">{Math.floor(cdr.billsec / 60)}m {cdr.billsec % 60}s</div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-600">
                                                ${Number(cdr.callCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-600">
                                                ${Number(cdr.recordingCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                            </td>
                                            <td className="hidden md:table-cell whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-600">
                                                ${Number(cdr.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2.5 w-2.5 rounded-full ${['answered', 'completed'].includes((cdr.status || '').toLowerCase())
                                                        ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                                                        : 'bg-rose-500'
                                                        }`}></div>
                                                    <span className="text-xs font-bold text-gray-600 capitalize md:text-sm">{cdr.status}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-4">
                                                <PlaybackButton uuid={cdr.uuid} cdr={cdr} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Page <span className="text-primary-600">{currentPage}</span> of {totalPages || 1} — {totalRecords} total records
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => fetchCDRs(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg ring-1 ring-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => fetchCDRs(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg ring-1 ring-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CdrsPage;
