import React, { useState, useEffect, useMemo } from 'react'
import {
    Wallet,
    CreditCard,
    ArrowRightLeft,
    Banknote,
    Plus,
    RefreshCw,
    TrendingUp,
    PieChart as PieChartIcon,
    X,
    ChevronRight,
    Calendar,
    History,
    Activity,
    LayoutDashboard,
    Menu,
    Bell,
    Settings,
    HelpCircle,
    ChevronDown,
    Target,
    BarChart3,
    ExternalLink,
    Trash2,
    ShieldCheck,
    CircleDot
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    BarChart, Bar
} from 'recharts'
import './App.css'

const GAS_URL = import.meta.env.VITE_GAS_URL

// --- Types ---
interface RawAsset {
    month: string
    category: string
    label: string
    balance: number
    memo?: string
}

interface SummaryAsset {
    category: string
    balance: number
}

interface Goal {
    name: string
    category: string
    target: number
    deadline: string
}

interface GasResponse {
    raw: RawAsset[]
    latestData: RawAsset[]
    summary: SummaryAsset[]
    goals: Goal[]
    latestMonth: string
}

// --- High-Quality Mock fallback ---
const MOCK_DATA: GasResponse = {
    latestMonth: '2024/02',
    summary: [
        { category: '現預金', balance: 1850000 },
        { category: '証券口座', balance: 4650000 },
        { category: '仮想通貨', balance: 920000 },
        { category: '保険・年金', balance: 2110000 }
    ],
    latestData: [
        { month: '2024/02', category: '現預金', label: '楽天銀行', balance: 1350000 },
        { month: '2024/02', category: '現預金', label: '三菱UFJ', balance: 500000 },
        { month: '2024/02', category: '証券口座', label: 'SBI証券', balance: 3250000 },
        { month: '2024/02', category: '証券口座', label: 'マネックス', balance: 1400000 },
        { month: '2024/02', category: '仮想通貨', label: 'ビットコイン', balance: 920000 },
        { month: '2024/02', category: '保険・年金', label: '積立生保', balance: 1100000 },
        { month: '2024/02', category: '保険・年金', label: '小規模共済', balance: 1010000 }
    ],
    raw: [],
    goals: [
        { name: '資産1000万', category: '全体', target: 10000000, deadline: '2025-12-31' },
        { name: '新車貯金', category: '貯蓄', target: 3000000, deadline: '2024-06-30' }
    ]
}

const TREND_DATA = [
    { month: '23/09', amount: 6200000 },
    { month: '23/10', amount: 6450000 },
    { month: '23/11', amount: 6300000 },
    { month: '23/12', amount: 7800000 },
    { month: '24/01', amount: 8100000 },
    { month: '24/02', amount: 9530000 }
]

const CATEGORIES = ['現預金', '証券口座', '仮想通貨', '保険・年金', 'その他']
const ACCOUNTS = ['楽天銀行', '三菱UFJ', '三井住友', 'SBI証券', 'マネックス証券', 'ビットフライヤー', '積立生保', '小規模共済']

const CATEGORY_MAP: Record<string, { color: string, icon: any }> = {
    '現預金': { color: '#3b82f6', icon: Wallet },
    '証券口座': { color: '#8b5cf6', icon: TrendingUp },
    '仮想通貨': { color: '#f59e0b', icon: Activity },
    '保険・年金': { color: '#10b981', icon: ShieldCheck },
    'その他': { color: '#64748b', icon: CircleDot }
}

const getCategoryStyle = (cat: string) => CATEGORY_MAP[cat] || CATEGORY_MAP['その他']

function App() {
    const queryClient = useQueryClient()
    const [activeView, setActiveView] = useState<'dashboard' | 'analytics' | 'goals'>('dashboard')
    const [activeModal, setActiveModal] = useState<string | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [useMock, setUseMock] = useState(false)

    const [formData, setFormData] = useState({
        month: new Date().toISOString().substring(0, 7).replace('-', '/'),
        category: CATEGORIES[0],
        label: ACCOUNTS[0],
        amount: '',
        memo: ''
    })

    // Simulator States
    const [simSavings, setSimSavings] = useState(100000)
    const [simReturn, setSimReturn] = useState(5)
    const [simYears, setSimYears] = useState(20)

    // Data Fetching
    const { data, isLoading, error, refetch } = useQuery<GasResponse>({
        queryKey: ['assets'],
        queryFn: async () => {
            if (!GAS_URL) throw new Error('API URL not configured')
            const res = await fetch(GAS_URL)
            const json = await res.json()
            if (!json || !json.summary) throw new Error('Invalid format')
            setUseMock(false)
            return json
        },
        retry: 1
    })

    // Mutations
    const mutation = useMutation({
        mutationFn: async (newData: any) => {
            if (useMock) return new Promise(r => setTimeout(r, 800))
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            })
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] })
            setActiveModal(null)
            alert('情報を更新しました')
        }
    })

    useEffect(() => {
        if (error) setUseMock(true)
    }, [error])

    const effectiveData = useMemo(() => {
        if (useMock || !data || !data.summary) return MOCK_DATA
        return data
    }, [useMock, data])

    const totalAssets = useMemo(() => {
        return (effectiveData.summary || []).reduce((sum, item) => sum + (Number(item.balance) || 0), 0)
    }, [effectiveData])

    const mainGoalProgress = useMemo(() => {
        const mainGoal = effectiveData.goals?.[0]
        if (!mainGoal) return 0
        return Math.min(100, Math.floor((totalAssets / mainGoal.target) * 100))
    }, [totalAssets, effectiveData])

    const portfolioHealth = useMemo(() => {
        const summary = effectiveData.summary || []
        if (summary.length === 0) return { score: 0, advice: 'データ収集中...', statusColor: '#64748b' }
        const count = summary.length
        const maxWeight = Math.max(...summary.map(s => (s.balance / (totalAssets || 1))))
        let score = 50
        if (count >= 4) score += 20
        if (maxWeight < 0.4) score += 30
        if (maxWeight > 0.7) score -= 30
        score = Math.max(0, Math.min(100, score))
        const advice = score > 80 ? '理想的な分散状態です' :
            score > 60 ? '概ね良好ですが、少し偏りがあります' :
                '特定資産への集中リスクがあります';
        return { score, advice, statusColor: score > 75 ? '#3b82f6' : score > 50 ? '#f59e0b' : '#ef4444' }
    }, [effectiveData, totalAssets])

    const simulationData = useMemo(() => {
        const monthlySavings = simSavings
        const expectedReturn = simReturn / 100
        const volatility = 0.15
        const results = []
        for (let y = 0; y <= simYears; y++) {
            const time = y
            const baseAmount = totalAssets * Math.pow(1 + expectedReturn, time)
            const savingsAmount = monthlySavings * 12 * (expectedReturn === 0 ? time : ((Math.pow(1 + expectedReturn, time) - 1) / expectedReturn))
            const p50 = Math.floor(baseAmount + savingsAmount)
            const drift = (expectedReturn - 0.5 * Math.pow(volatility, 2)) * time
            const shockP90 = Math.exp(drift + volatility * Math.sqrt(time) * 1.28)
            const shockP10 = Math.exp(drift - volatility * Math.sqrt(time) * 1.28)
            results.push({
                year: `${new Date().getFullYear() + y}`,
                p50,
                p90: Math.floor((totalAssets + monthlySavings * 12 * time) * shockP90),
                p10: Math.floor((totalAssets + monthlySavings * 12 * time) * shockP10)
            })
        }
        return results
    }, [totalAssets, simSavings, simReturn, simYears])

    return (
        <div className={`app-root ${isSidebarOpen ? 'sb-open' : 'sb-closed'}`}>
            <aside className="sidebar">
                <div className="sidebar-top">
                    <div className="brand">
                        <div className="logo-neon"><BarChart3 size={24} /></div>
                        <span className="brand-name">FinancePro</span>
                    </div>
                    <button className="menu-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        <Menu size={20} />
                    </button>
                </div>
                <nav className="nav-menu">
                    <button className={`nav-link ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
                        <LayoutDashboard size={20} /> <span>ダッシュボード</span>
                    </button>
                    <button className={`nav-link ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => setActiveView('analytics')}>
                        <TrendingUp size={20} /> <span>資産推移分析</span>
                    </button>
                    <button className={`nav-link ${activeView === 'goals' ? 'active' : ''}`} onClick={() => setActiveView('goals')}>
                        <Target size={20} /> <span>目標トラッキング</span>
                    </button>
                </nav>
                <div className="sidebar-bottom">
                    <div className="sidebar-widgets px-4 mb-6">
                        <div className="widget-row mb-4">
                            <div className="widget-item">
                                <span className="label text-[10px] uppercase text-slate-500 font-bold block mb-1">Portfolio</span>
                                <div className="text-xl font-black text-white font-mono">¥{totalAssets.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="widget-row mb-4">
                            <div className="widget-item bg-blue-500/10 border border-blue-500/20 p-2 rounded-xl">
                                <span className="label text-[10px] uppercase text-blue-400 font-bold block mb-1">Health Score</span>
                                <div className="text-lg font-black text-white font-mono">{portfolioHealth.score}</div>
                            </div>
                        </div>
                    </div>
                    <div className="profile-mini ml-4">
                        <div className="avatar">JP</div>
                        <div className="profile-info">
                            <p className="name">Asset Manager</p>
                            <p className="status">Online</p>
                        </div>
                    </div>
                </div>
            </aside>

            <div className="workspace">
                <header className="workspace-header">
                    <div className="header-left">
                        <h2>{activeView === 'dashboard' ? 'Insight Dashboard' : activeView === 'analytics' ? 'Pro Forecasting' : 'Wealth Goals'}</h2>
                        <p className="subtitle">LATEST UPDATE: {effectiveData.latestMonth}</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn-refresh" onClick={() => refetch()}><RefreshCw size={20} /></button>
                    </div>
                </header>

                <div className="view-container max-w-[1400px] mx-auto">
                    {activeView === 'dashboard' && (
                        <div className="view-dashboard animate-fade-in">
                            <div className="re-grid grid-cols-2">
                                <div className="card hero-card">
                                    <span className="label">PORTFOLIO VALUE</span>
                                    <h3>¥{totalAssets.toLocaleString()}</h3>
                                    <div className="flex items-center gap-3 mt-4">
                                        <div className="trend positive flex items-center gap-1 text-emerald-400 font-bold">
                                            <TrendingUp size={16} /> +3.2%
                                        </div>
                                        <span className="text-slate-500 text-sm font-bold">VS LAST MONTH</span>
                                    </div>
                                    <div className="card-viz">
                                        <ResponsiveContainer width="100%" height={120}>
                                            <AreaChart data={TREND_DATA}>
                                                <defs>
                                                    <linearGradient id="glowArea" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={4} fill="url(#glowArea)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="card luxury-health-card">
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <span className="label text-slate-500 font-bold uppercase tracking-widest text-[10px]">Security Score</span>
                                            <h4 className="text-xl font-black mt-1">Portfolio Health</h4>
                                        </div>
                                        <ShieldCheck size={32} className="text-blue-400" />
                                    </div>
                                    <div className="health-box-luxury">
                                        <div className="health-score-huge">{portfolioHealth.score}</div>
                                        <div className="health-info">
                                            <p className="text-lg font-bold text-white mb-2">{portfolioHealth.advice}</p>
                                            <div className="flex gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <div key={i} className={`h-2 flex-1 rounded-full ${i < portfolioHealth.score / 20 ? 'bg-blue-400' : 'bg-white/10'}`}></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-xl font-black uppercase tracking-tight">Active Assets</h4>
                                    <button className="text-sm font-bold text-blue-400" onClick={() => setActiveModal('Entry')}>+ ADD NEW</button>
                                </div>
                                <div className="asset-cards-list">
                                    {(effectiveData.latestData || []).map((asset, i) => {
                                        const style = getCategoryStyle(asset.category);
                                        const Icon = style.icon;
                                        return (
                                            <div key={i} className="asset-rich-card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                                                <div className="arc-left">
                                                    <div className="arc-icon-box" style={{ backgroundColor: style.color + '15', color: style.color }}>
                                                        <Icon size={22} />
                                                    </div>
                                                    <div className="arc-info">
                                                        <h4>{asset.label}</h4>
                                                        <span className="cat">{asset.category}</span>
                                                    </div>
                                                </div>
                                                <div className="arc-right">
                                                    <span className="arc-balance">¥{asset.balance.toLocaleString()}</span>
                                                    <span className="arc-trend text-slate-500 font-mono">STABLE</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeView === 'analytics' && (
                        <div className="view-analytics animate-fade-in">
                            <div className="card giant-simulator mb-8">
                                <div className="flex justify-between items-start mb-12">
                                    <div>
                                        <h2 className="text-3xl font-black mb-2">Future Engine</h2>
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Wealth Projection</p>
                                    </div>
                                    <div className="viz-legend flex gap-6">
                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-400"><span className="w-3 h-3 rounded-full bg-blue-400"></span> BEST CASE</div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><span className="w-3 h-3 rounded-full bg-slate-400"></span> MEDIAN</div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-rose-500"><span className="w-3 h-3 rounded-full bg-rose-500"></span> RISK CASE</div>
                                    </div>
                                </div>
                                <div className="sim-controls-panel">
                                    <div className="pro-slider-group">
                                        <label>MONTHLY SAVINGS</label>
                                        <span className="pro-slider-val">¥{(simSavings / 10000).toFixed(0)}万</span>
                                        <input type="range" min="0" max="1000000" step="10000" value={simSavings} onChange={e => setSimSavings(Number(e.target.value))} className="slider-pro" />
                                    </div>
                                    <div className="pro-slider-group">
                                        <label>ANNUAL RETURN</label>
                                        <span className="pro-slider-val text-blue-400">{simReturn}%</span>
                                        <input type="range" min="0" max="20" step="0.5" value={simReturn} onChange={e => setSimReturn(Number(e.target.value))} className="slider-pro" />
                                    </div>
                                    <div className="pro-slider-group">
                                        <label>TIME HORIZON</label>
                                        <span className="pro-slider-val text-blue-300">{simYears}Y</span>
                                        <input type="range" min="1" max="50" step="1" value={simYears} onChange={e => setSimYears(Number(e.target.value))} className="slider-pro" />
                                    </div>
                                </div>
                                <div className="viz-stage">
                                    <ResponsiveContainer width="100%" height={320}>
                                        <AreaChart data={simulationData}>
                                            <defs>
                                                <linearGradient id="proGlow" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="10 10" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} dy={20} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} dx={-20} />
                                            <Tooltip
                                                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}
                                                itemStyle={{ fontWeight: 800, color: '#fff' }}
                                                formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '']}
                                            />
                                            <Area type="monotone" dataKey="p90" stroke="#3b82f6" strokeWidth={3} fill="url(#proGlow)" />
                                            <Area type="monotone" dataKey="p50" stroke="#94a3b8" strokeWidth={2} fill="none" />
                                            <Area type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeView === 'goals' && (
                        <div className="view-goals animate-fade-in">
                            <div className="goals-grid">
                                {(effectiveData.goals || []).map((goal, i) => {
                                    const percent = Math.min(100, Math.floor((totalAssets / goal.target) * 100))
                                    return (
                                        <div key={i} className="card goal-card">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="arc-icon-box" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                                    <Target size={28} />
                                                </div>
                                                <span className="text-2xl font-black text-white">{percent}%</span>
                                            </div>
                                            <h4 className="text-xl font-black mb-1">{goal.name}</h4>
                                            <p className="text-slate-500 font-bold mb-4">{goal.deadline} TARGET</p>
                                            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500" style={{ width: `${percent}%` }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <nav className="mobile-bottom-nav">
                <button className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
                    <LayoutDashboard size={24} />
                    <span>DASHBOARD</span>
                </button>
                <div className="fab-container">
                    <button className="fab-btn-luxury" onClick={() => setActiveModal('Entry')}>
                        <Plus size={32} />
                    </button>
                </div>
                <button className={`nav-item ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => setActiveView('analytics')}>
                    <TrendingUp size={24} />
                    <span>INSIGHTS</span>
                </button>
                <button className={`nav-item ${activeView === 'goals' ? 'active' : ''}`} onClick={() => setActiveView('goals')}>
                    <Target size={24} />
                    <span>GOALS</span>
                </button>
            </nav>

            {activeModal && (
                <div className="modal-root">
                    <div className="modal-backdrop" onClick={() => setActiveModal(null)}></div>
                    <div className="modal-content animate-fade-in">
                        <header className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black uppercase tracking-tight">Record Assets</h3>
                            <button onClick={() => setActiveModal(null)} className="text-slate-500 hover:text-white"><X size={28} /></button>
                        </header>
                        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }}>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="text-xs font-bold text-slate-500 block mb-2">MONTH</label>
                                    <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl p-3" value={formData.month} onChange={e => setFormData({ ...formData, month: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="text-xs font-bold text-slate-500 block mb-2">CATEGORY</label>
                                    <select className="w-full bg-white/5 border border-white/10 rounded-xl p-3" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="text-xs font-bold text-slate-500 block mb-2">ACCOUNT</label>
                                <select className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-bold" value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })}>
                                    {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="text-xs font-bold text-slate-500 block mb-2">BALANCE (JPY)</label>
                                <input type="number" className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-3xl font-black text-blue-400" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required />
                            </div>
                            <button type="submit" className="btn-submit-gold mt-4">
                                UPDATE PORTFOLIO
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
