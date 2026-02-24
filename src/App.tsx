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

    const [selectedDetail, setSelectedDetail] = useState<{ category?: string, label?: string } | null>(null)

    // Simulator States (Version 7.0)
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

    // Intelligence: Portfolio Health Assessment
    const portfolioHealth = useMemo(() => {
        const summary = effectiveData.summary || []
        if (summary.length === 0) return { score: 0, advice: 'データ収集中...', statusColor: '#64748b' }

        const count = summary.length
        const maxWeight = Math.max(...summary.map(s => (s.balance / (totalAssets || 1))))

        let score = 50
        if (count >= 4) score += 20 // 分散されている
        if (maxWeight < 0.4) score += 30 // 特定資産に偏りすぎない
        if (maxWeight > 0.7) score -= 30 // 集中しすぎ

        score = Math.max(0, Math.min(100, score))

        const advice = score > 80 ? '理想的な分散状態です' :
            score > 60 ? '概ね良好ですが、少し偏りがあります' :
                '特定資産への集中リスクがあります';

        return {
            score,
            advice,
            statusColor: score > 75 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444'
        }
    }, [effectiveData, totalAssets])

    // Intelligence: Dividend & Cash Flow Prediction (Version 5.0)
    const cashFlowAnalysis = useMemo(() => {
        // 想定利回り (年利 % )
        const yields: Record<string, number> = {
            '現預金': 0.001,
            '証券口座': 0.045, // 高配当株/ETF想定
            '仮想通貨': 0.0,
            '保険・年金': 0.015,
            'その他': 0.02
        }

        const annualIncome = (effectiveData.summary || []).reduce((sum, item) => {
            const yieldRate = yields[item.category] || 0
            return sum + (item.balance * yieldRate)
        }, 0)

        return {
            annual: Math.floor(annualIncome),
            monthly: Math.floor(annualIncome / 12),
            daily: Math.floor(annualIncome / 365)
        }
    }, [effectiveData])

    // Intelligence: Rebalancing & Target Allocation
    const rebalanceAnalysis = useMemo(() => {
        const targets: Record<string, number> = {
            '現預金': 0.20,
            '証券口座': 0.60,
            '仮想通貨': 0.05,
            '保険・年金': 0.10,
            'その他': 0.05
        }

        return (effectiveData.summary || []).map(item => {
            const currentWeight = item.balance / (totalAssets || 1)
            const targetWeight = targets[item.category] || 0
            const diffPercent = (currentWeight - targetWeight) * 100
            const diffAmount = (targetWeight * totalAssets) - item.balance

            return {
                category: item.category,
                diffPercent,
                diffAmount,
                status: Math.abs(diffPercent) < 3 ? 'Perfect' : diffPercent > 0 ? 'Over' : 'Under'
            }
        })
    }, [effectiveData, totalAssets])

    // Intelligence: 3-Month Cash Flow Forecast (Version 5.5)
    const forecastAnalysis = useMemo(() => {
        const today = new Date()
        const currentMonthStr = today.toISOString().substring(0, 7).replace('-', '/')

        // 直近3ヶ月の月リスト生成
        const nextMonths = []
        for (let i = 0; i <= 3; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
            nextMonths.push(d.toISOString().substring(0, 7).replace('-', '/'))
        }

        // 月ごとの合計を算出 (実績 or 見込み)
        return nextMonths.map(m => {
            const isFuture = m > currentMonthStr
            const monthData = (effectiveData.raw || []).filter(d => d.month === m)
            const balance = monthData.reduce((sum, d) => sum + (Number(d.balance) || 0), 0)

            // 実績がない(未来)の場合は、前月の実績 + 入力された見込み差分でシミュレートする簡易モデルも検討可能だが、
            // ユーザーは「見込みを入れている」とのことなので、その月の純粋な合計を表示する。
            return {
                month: m.substring(5) + '月',
                amount: balance || (m === currentMonthStr ? totalAssets : 0),
                type: isFuture ? '見込み' : '実績'
            }
        }).filter(d => d.amount > 0)
    }, [effectiveData, totalAssets])

    // Intelligence: Monte Carlo Future Simulation (Interactive v7.0)
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
            {/* Dynamic Sidebar */}
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

                    <div className="nav-divider"></div>

                    <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noreferrer" className="nav-link external">
                        <ExternalLink size={20} /> <span>スプレッドシート</span>
                    </a>
                    <button className="nav-link"><Settings size={20} /> <span>アプリ設定</span></button>
                </nav>

                <div className="sidebar-bottom">
                    <div className="sidebar-widgets px-4 mb-6">
                        <div className="widget-row mb-4">
                            <div className="widget-item">
                                <span className="label text-[10px] uppercase text-slate-500 font-bold block mb-1">Total Assets</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-white font-mono">¥{totalAssets.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="widget-row mb-4">
                            <div className="widget-item">
                                <span className="label text-[10px] uppercase text-slate-500 font-bold block mb-1">Goal Progress</span>
                                <div className="progress-mini-bar">
                                    <div className="fill shadow-glow" style={{ width: `${mainGoalProgress}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}></div>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-slate-400 font-mono">{mainGoalProgress}%</span>
                                    <span className="text-[10px] text-slate-400">FINANCE PRO</span>
                                </div>
                            </div>
                        </div>

                        <div className="widget-row mb-4">
                            <div className="widget-item bg-blue-500/10 border border-blue-500/20 p-2 rounded-xl">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="label text-[10px] uppercase text-blue-400 font-bold">Health Score</span>
                                    <ShieldCheck size={12} className="text-blue-400" />
                                </div>
                                <div className="text-lg font-black text-white font-mono">{portfolioHealth.score}<span className="text-xs text-slate-500 ml-0.5">/100</span></div>
                            </div>
                        </div>

                        <div className="insight-pill-sidebar mb-4">
                            <div className="label">予測配当 (1日)</div>
                            <div className="value">¥{cashFlowAnalysis.daily.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="profile-mini ml-4">
                        <div className="avatar shadow-glow">JP</div>
                        <div className="profile-info">
                            <p className="name">Asset Manager</p>
                            <p className="status">Online</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Primary Workspace */}
            <div className="workspace">
                <header className="workspace-header">
                    <div className="header-left">
                        <h2>{activeView === 'dashboard' ? 'Dashboard' : activeView === 'analytics' ? 'Analytics' : 'Goals'}</h2>
                        <p className="subtitle">{effectiveData.latestMonth} のデータを表示中</p>
                    </div>
                    <div className="header-actions">
                        {useMock && <div className="demo-badge">Demo Mode</div>}
                        <button className="btn-refresh" onClick={() => refetch()}><RefreshCw size={18} /></button>
                        <div className="user-notif"><Bell size={18} /></div>
                    </div>
                </header>

                <div className="view-container">
                    {activeView === 'dashboard' && (
                        <div className="view-dashboard animate-fade-in">
                            <div className="top-row">
                                {/* Net Worth Card */}
                                <div className="card hero-card">
                                    <div className="card-top">
                                        <span className="label">総資産残高</span>
                                        <h3>¥{totalAssets.toLocaleString()}</h3>
                                        <div className="trend positive"><TrendingUp size={14} /> +3.2% from last month</div>
                                    </div>
                                    <div className="card-viz">
                                        <ResponsiveContainer width="100%" height={100}>
                                            <AreaChart data={TREND_DATA}>
                                                <defs>
                                                    <linearGradient id="glowArea" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fill="url(#glowArea)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Progress Card */}
                                <div className="card goal-preview-card">
                                    <div className="card-header">
                                        <span className="label">ポートフォリオ診断</span>
                                        <div className="status-dot" style={{ backgroundColor: portfolioHealth.statusColor }}></div>
                                    </div>
                                    <div className="health-visual">
                                        <div className="score-box">
                                            <span className="score-num">{portfolioHealth.score}</span>
                                            <span className="score-unit">pt</span>
                                        </div>
                                        <div className="health-info">
                                            <p className="health-advice">{portfolioHealth.advice}</p>
                                            <div className="progress-bar-thin">
                                                <div className="p-bar-fill" style={{ width: `${portfolioHealth.score}%`, backgroundColor: portfolioHealth.statusColor }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="middle-row grid-2-1">
                                {/* Category Summary Table */}
                                <div className="card table-card table-responsive">
                                    <div className="card-header">
                                        <h4>カテゴリ別集計</h4>
                                        <button className="text-btn" onClick={() => setActiveView('analytics')}>推移を見る <ChevronRight size={14} /></button>
                                    </div>
                                    <table className="modern-table">
                                        <thead>
                                            <tr>
                                                <th>資産カテゴリ</th>
                                                <th className="text-right">合計残高</th>
                                                <th className="text-right">構成比</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(effectiveData.summary || []).map((summary, i) => {
                                                const style = getCategoryStyle(summary.category);
                                                const Icon = style.icon;
                                                const ratio = ((summary.balance / totalAssets) * 100).toFixed(1);
                                                return (
                                                    <tr key={i} className="asset-row clickable" onClick={() => { setSelectedDetail({ category: summary.category }); setActiveView('analytics'); }}>
                                                        <td className="font-bold flex items-center gap-3">
                                                            <div className="icon-pill" style={{ backgroundColor: style.color + '20', color: style.color }}><Icon size={14} /></div>
                                                            {summary.category}
                                                        </td>
                                                        <td className="font-mono font-bold text-right">¥{summary.balance.toLocaleString()}</td>
                                                        <td className="text-right font-bold text-slate-400">{ratio}%</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Allocation Pie */}
                                <div className="card pie-card">
                                    <div className="card-header"><h4>カテゴリ比率</h4></div>
                                    <div className="pie-container">
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={effectiveData.summary}
                                                    innerRadius={60} outerRadius={80}
                                                    paddingAngle={5} dataKey="balance"
                                                    onClick={(data) => { setSelectedDetail({ category: data.category }); setActiveView('analytics'); }}
                                                    style={{ cursor: 'pointer' }}
                                                    label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                                                    labelLine={false}
                                                >
                                                    {(effectiveData.summary || []).map((entry, i) => (
                                                        <Cell key={i} fill={getCategoryStyle(entry.category).color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                                                    formatter={(value: number) => `¥${value.toLocaleString()}`}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Assets DB-View (Dashboard Bottom) */}
                            <div className="bottom-row mt-6">
                                <div className="card full-width-card db-card">
                                    <div className="card-header">
                                        <div className="flex items-center gap-3">
                                            <div className="icon-pill bg-blue-500/20 text-blue-400"><LayoutDashboard size={18} /></div>
                                            <h4>全ての資産明細 (全 {effectiveData.latestData.length} 件)</h4>
                                        </div>
                                        <button className="btn-accent" onClick={() => setActiveModal('Entry')}><Plus size={16} /> 新規登録</button>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="modern-table db-style">
                                            <thead>
                                                <tr>
                                                    <th>ステータス</th>
                                                    <th>カテゴリ</th>
                                                    <th>項目 / 口座名</th>
                                                    <th className="text-right">現在の残高</th>
                                                    <th>メモ / 備考</th>
                                                    <th className="text-center">操作</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(effectiveData.latestData || []).map((asset, i) => {
                                                    const style = getCategoryStyle(asset.category);
                                                    const Icon = style.icon;
                                                    return (
                                                        <tr key={i} className="db-row">
                                                            <td><div className="status-indicator online"></div></td>
                                                            <td>
                                                                <div className="cat-badge" style={{ backgroundColor: style.color + '15', color: style.color, borderColor: style.color + '30' }}>
                                                                    <Icon size={12} /> {asset.category}
                                                                </div>
                                                            </td>
                                                            <td className="font-bold">{asset.label}</td>
                                                            <td className="font-mono font-bold text-right text-accent-light">¥{asset.balance.toLocaleString()}</td>
                                                            <td className="text-slate-500 text-sm">{asset.memo || '-'}</td>
                                                            <td className="text-center">
                                                                <div className="flex justify-center gap-2">
                                                                    <button className="icon-btn-sub" onClick={() => setActiveModal('Edit')}><History size={14} /></button>
                                                                    <button className="icon-btn-danger"><Trash2 size={14} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'analytics' && (
                        <div className="view-analytics animate-fade-in">
                            <div className="forecast-header-row mb-6">
                                <div className="card forecast-card">
                                    <div className="card-header">
                                        <div className="flex items-center gap-3">
                                            <div className="icon-pill bg-purple-500/20 text-purple-400"><Banknote size={18} /></div>
                                            <h4>資金繰り予測 (向こう3ヶ月)</h4>
                                        </div>
                                        <div className="legend-p">
                                            <span className="p-dot actual"></span> 実績
                                            <span className="p-dot forecast"></span> 見込み
                                        </div>
                                    </div>
                                    <div className="viz-container">
                                        <ResponsiveContainer width="100%" height={220}>
                                            <BarChart data={forecastAnalysis}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                <Tooltip
                                                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px' }}
                                                    formatter={(v: any) => `¥${Number(v).toLocaleString()}`}
                                                />
                                                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                                                    {forecastAnalysis.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.type === '実績' ? '#3b82f6' : '#8b5cf6'} fillOpacity={entry.type === '実績' ? 1 : 0.6} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="forecast-summary p-2">
                                        <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                                            <span className="text-sm text-slate-400">3ヶ月後の想定残高</span>
                                            <span className="text-lg font-bold text-accent-light">¥{(forecastAnalysis[forecastAnalysis.length - 1]?.amount || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="analytics-grid">
                                <div className="card large-viz-card interactive-viz">
                                    <div className="card-header">
                                        <div className="flex items-center gap-3">
                                            <div className="icon-pill bg-blue-500/20 text-blue-400"><TrendingUp size={18} /></div>
                                            <h4>資産成長シミュレーター (カスタム試算)</h4>
                                        </div>
                                    </div>

                                    {/* Simulator Controls */}
                                    <div className="simulator-controls mb-6 grid grid-cols-3 gap-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <div className="control-group">
                                            <div className="flex justify-between mb-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Monthly Savings</label>
                                                <span className="text-xs font-bold text-blue-400">¥{(simSavings / 10000).toFixed(1)}万</span>
                                            </div>
                                            <input type="range" min="0" max="1000000" step="10000" value={simSavings} onChange={e => setSimSavings(Number(e.target.value))} className="slider-pro" />
                                        </div>
                                        <div className="control-group">
                                            <div className="flex justify-between mb-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Annual Return</label>
                                                <span className="text-xs font-bold text-emerald-400">{simReturn}%</span>
                                            </div>
                                            <input type="range" min="0" max="15" step="0.5" value={simReturn} onChange={e => setSimReturn(Number(e.target.value))} className="slider-pro" />
                                        </div>
                                        <div className="control-group">
                                            <div className="flex justify-between mb-2">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Duration (Years)</label>
                                                <span className="text-xs font-bold text-purple-400">{simYears}Y</span>
                                            </div>
                                            <input type="range" min="1" max="40" step="1" value={simYears} onChange={e => setSimYears(Number(e.target.value))} className="slider-pro" />
                                        </div>
                                    </div>

                                    <div className="viz-container relative">
                                        <div className="legend-p absolute top-0 right-0 z-10 p-2">
                                            <span className="p-dot p90"></span> ベスト
                                            <span className="p-dot p50"></span> 平均
                                            <span className="p-dot p10"></span> ワースト
                                        </div>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <AreaChart data={simulationData}>
                                                <defs>
                                                    <linearGradient id="p90Color" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px' }} formatter={(v: any) => `¥${Number(v).toLocaleString()}`} />
                                                <Area type="monotone" dataKey="p90" stroke="#10b981" strokeWidth={2} fill="url(#p90Color)" />
                                                <Area type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={3} fill="none" />
                                                <Area type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <p className="viz-note mt-4">※設定された利回りと積立額に基づく将来予測です。リスク係数は15%で固定されています。</p>
                                </div>

                                <div className="card middle-card">
                                    <div className="card-header"><h4>カテゴリ別・パフォーマンス</h4></div>
                                    <div className="viz-container">
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={effectiveData.summary}>
                                                <XAxis dataKey="category" hide />
                                                <YAxis hide />
                                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none' }} />
                                                <Bar dataKey="balance" radius={[10, 10, 10, 10]}>
                                                    {(effectiveData.summary || []).map((entry, i) => (
                                                        <Cell key={i} fill={getCategoryStyle(entry.category).color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="insight-row grid-3 mt-6">
                                <div className="card stat-card glow">
                                    <span className="label">年間予測配当 (Est.)</span>
                                    <div className="flex items-end gap-2">
                                        <span className="value text-accent-light">¥{cashFlowAnalysis.annual.toLocaleString()}</span>
                                        <span className="sub-value">/ year</span>
                                    </div>
                                    <div className="mini-chart-bar">
                                        <div className="bar-fill" style={{ width: '65%', background: 'linear-gradient(90deg, #3b82f6, #10b981)' }}></div>
                                    </div>
                                </div>
                                <div className="card stat-card">
                                    <span className="label">月間キャッシュフロー</span>
                                    <div className="flex items-end gap-2">
                                        <span className="value">¥{cashFlowAnalysis.monthly.toLocaleString()}</span>
                                        <span className="sub-value">/ month</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">資産の平均利回りを 4.5% と仮定</p>
                                </div>
                                <div className="card stat-card bg-highlight">
                                    <span className="label">リバランス必要額</span>
                                    <div className="flex items-end gap-2">
                                        <span className="value text-orange-400">¥{rebalanceAnalysis.reduce((sum, r) => sum + Math.max(0, r.diffAmount), 0).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">理想の資産配分まであと一歩です</p>
                                </div>
                            </div>

                            <div className="mt-6 grid-1-1">
                                <div className="card rebalance-card">
                                    <div className="card-header">
                                        <div className="flex items-center gap-2"><ArrowRightLeft size={18} /> <h4>AI リバランス提案</h4></div>
                                    </div>
                                    <div className="rebalance-list">
                                        {rebalanceAnalysis.map((r, i) => (
                                            <div key={i} className="rebalance-item">
                                                <div className="item-info">
                                                    <span className="cat-name">{r.category}</span>
                                                    <span className={`status-pill ${r.status.toLowerCase()}`}>{r.status}</span>
                                                </div>
                                                <div className="action-info">
                                                    <span className="amount">{r.diffAmount > 0 ? `+¥${r.diffAmount.toLocaleString()}` : `-¥${Math.abs(r.diffAmount).toLocaleString()}`}</span>
                                                    <span className="action-type">{r.diffAmount > 0 ? '追加投資' : '利益確定'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <div className="card full-width-card db-card">
                                    <div className="card-header">
                                        <h4>期間別・資産履歴データベース</h4>
                                        <div className="filter-set">
                                            <button className="filter-chip active">All</button>
                                            <button className="filter-chip">Last 6 Months</button>
                                        </div>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="modern-table db-style">
                                            <thead>
                                                <tr>
                                                    <th>年月</th>
                                                    <th>カテゴリ</th>
                                                    <th>項目</th>
                                                    <th className="text-right">残高</th>
                                                    <th>メモ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(effectiveData.latestData || []).map((asset, i) => (
                                                    <tr key={i} className="db-row">
                                                        <td>{asset.month}</td>
                                                        <td><span className="tag">{asset.category}</span></td>
                                                        <td className="font-bold">{asset.label}</td>
                                                        <td className="text-right font-mono text-blue-400">¥{asset.balance.toLocaleString()}</td>
                                                        <td className="text-xs text-slate-500">{asset.memo || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'goals' && (
                        <div className="view-goals animate-fade-in">
                            <div className="card full-width-card bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/20 mb-6">
                                <div className="flex items-center justify-between p-2">
                                    <div>
                                        <h3 className="text-xl font-bold">目標到達まで、あと ¥{((effectiveData.goals?.[0]?.target || 0) - totalAssets).toLocaleString()} です</h3>
                                        <p className="text-slate-400">現在のペースを維持すれば、予定通り達成できる見込みです。</p>
                                    </div>
                                    <button className="btn-submit-gold" onClick={() => setActiveModal('Entry')}>進捗を更新する</button>
                                </div>
                            </div>
                            <div className="goals-grid">
                                {(effectiveData.goals || []).map((goal, i) => {
                                    const percent = Math.min(100, Math.floor((totalAssets / goal.target) * 100))
                                    return (
                                        <div key={i} className="card goal-card">
                                            <div className="goal-head">
                                                <div className="goal-icon shadow-glow"><Target size={24} /></div>
                                                <div className="goal-title-box">
                                                    <h4>{goal.name}</h4>
                                                    <span className="goal-deadline">{goal.deadline} まで</span>
                                                </div>
                                            </div>
                                            <div className="goal-progress-section">
                                                <div className="progress-bar-bg">
                                                    <div className="progress-fill" style={{ width: `${percent}%`, backgroundColor: getCategoryStyle(goal.category).color }}></div>
                                                </div>
                                                <div className="progress-info">
                                                    <span>現在: ¥{totalAssets.toLocaleString()} / 目標: ¥{goal.target.toLocaleString()}</span>
                                                    <span className="percent-text">{percent}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Navigation (v7.0) */}
            <nav className="mobile-bottom-nav">
                <button className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
                    <LayoutDashboard size={20} />
                    <span>Home</span>
                </button>
                <button className={`nav-item ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => setActiveView('analytics')}>
                    <TrendingUp size={20} />
                    <span>Analysis</span>
                </button>
                <button className="nav-item fab" onClick={() => setActiveModal('Entry')}>
                    <div className="fab-inner shadow-gold"><Plus size={24} /></div>
                </button>
                <button className={`nav-item ${activeView === 'goals' ? 'active' : ''}`} onClick={() => setActiveView('goals')}>
                    <Target size={20} />
                    <span>Goals</span>
                </button>
                <button className="nav-item" onClick={() => setActiveModal('Entry')}>
                    <Settings size={20} />
                    <span>Settings</span>
                </button>
            </nav>

            {/* Entry Modal */}
            {activeModal && (
                <div className="modal-root">
                    <div className="modal-backdrop" onClick={() => setActiveModal(null)}></div>
                    <div className="modal-content glass-effect animate-slide-up">
                        <header className="modal-header">
                            <h3>残高の記録更新</h3>
                            <button className="btn-close" onClick={() => setActiveModal(null)}><X /></button>
                        </header>
                        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }}>
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label>対象年月</label>
                                    <div className="input-with-icon"><Calendar size={18} /> <input type="text" value={formData.month} onChange={e => setFormData({ ...formData, month: e.target.value })} /></div>
                                </div>
                                <div className="form-group flex-1">
                                    <label>カテゴリ</label>
                                    <div className="input-with-icon"><ChevronDown size={18} /> <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select></div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>項目 / 口座名</label>
                                <div className="input-with-icon"><Wallet size={18} /> <select value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })}>
                                    {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                                </select></div>
                            </div>
                            <div className="form-group">
                                <label>最新残高 (JPY)</label>
                                <div className="input-with-icon amount-box">
                                    <span className="currency">¥</span>
                                    <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required placeholder="0" />
                                </div>
                            </div>
                            <button type="submit" className="btn-submit-gold" disabled={mutation.isPending}>
                                {mutation.isPending ? '反映中...' : 'データを保存する'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
