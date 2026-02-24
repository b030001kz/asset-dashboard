import { useState, useEffect, useMemo } from 'react'
import {
    Wallet, TrendingUp, Activity, Plus, RefreshCw,
    LayoutDashboard, Target, BarChart3, ShieldCheck,
    CircleDot, X
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts'
import './App.css'

const GAS_URL = import.meta.env.VITE_GAS_URL

// --- 型定義 ---
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

// --- モックデータ（API未接続時のフォールバック） ---
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
        { name: '資産1000万円達成', category: '全体', target: 10000000, deadline: '2025-12-31' },
        { name: '新車購入資金', category: '貯蓄', target: 3000000, deadline: '2024-06-30' }
    ]
}

// --- 定数 ---
const CATEGORIES = ['現預金', '証券口座', '仮想通貨', '保険・年金', 'その他']
const ACCOUNTS = ['楽天銀行', '三菱UFJ', '三井住友', 'SBI証券', 'マネックス証券', 'ビットフライヤー', '積立生保', '小規模共済']

// --- カテゴリの色とアイコンの対応表 ---
const CATEGORY_STYLES: Record<string, { color: string, icon: typeof Wallet }> = {
    '現預金': { color: '#3b82f6', icon: Wallet },
    '証券口座': { color: '#8b5cf6', icon: TrendingUp },
    '仮想通貨': { color: '#f59e0b', icon: Activity },
    '保険・年金': { color: '#10b981', icon: ShieldCheck },
    'その他': { color: '#64748b', icon: CircleDot }
}

const getCategoryStyle = (cat: string) => CATEGORY_STYLES[cat] || CATEGORY_STYLES['その他']

// --- 金額フォーマット ---
const formatYen = (n: number) => `¥${n.toLocaleString()}`

// --- ビュー定義 ---
type ViewId = 'dashboard' | 'analytics' | 'goals'
const VIEWS: { id: ViewId, label: string, icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'analytics', label: 'シミュレーター', icon: BarChart3 },
    { id: 'goals', label: '目標管理', icon: Target }
]

function App() {
    const queryClient = useQueryClient()
    const [activeView, setActiveView] = useState<ViewId>('dashboard')
    const [showModal, setShowModal] = useState(false)
    const [useMock, setUseMock] = useState(false)

    // フォーム
    const [formData, setFormData] = useState({
        month: new Date().toISOString().substring(0, 7).replace('-', '/'),
        category: CATEGORIES[0],
        label: ACCOUNTS[0],
        amount: '',
        memo: ''
    })

    // シミュレーター
    const [simSavings, setSimSavings] = useState(100000)
    const [simReturn, setSimReturn] = useState(5)
    const [simYears, setSimYears] = useState(20)

    // --- データ取得 ---
    const { data, error, refetch } = useQuery<GasResponse>({
        queryKey: ['assets'],
        queryFn: async () => {
            if (!GAS_URL) throw new Error('API未設定')
            const res = await fetch(GAS_URL)
            const json = await res.json()
            if (!json || !json.summary) throw new Error('不正な形式')
            setUseMock(false)
            return json
        },
        retry: 1
    })

    // --- データ登録 ---
    const mutation = useMutation({
        mutationFn: async (newData: typeof formData) => {
            if (useMock) return new Promise(r => setTimeout(r, 500))
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData)
            })
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] })
            setShowModal(false)
            setFormData(prev => ({ ...prev, amount: '', memo: '' }))
        }
    })

    useEffect(() => {
        if (error) setUseMock(true)
    }, [error])

    // --- 計算値 ---
    const effectiveData = useMock || !data?.summary ? MOCK_DATA : data
    const totalAssets = useMemo(() =>
        (effectiveData.summary || []).reduce((s, item) => s + (Number(item.balance) || 0), 0),
        [effectiveData]
    )

    // 円グラフ用データ
    const pieData = useMemo(() =>
        (effectiveData.summary || []).map(s => ({
            name: s.category,
            value: s.balance,
            color: getCategoryStyle(s.category).color
        })),
        [effectiveData]
    )

    // ポートフォリオ健全性
    const healthScore = useMemo(() => {
        const summary = effectiveData.summary || []
        if (summary.length === 0) return 0
        const maxWeight = Math.max(...summary.map(s => s.balance / (totalAssets || 1)))
        let score = 50
        if (summary.length >= 4) score += 20
        if (maxWeight < 0.4) score += 30
        if (maxWeight > 0.7) score -= 30
        return Math.max(0, Math.min(100, score))
    }, [effectiveData, totalAssets])

    // シミュレーションデータ
    const simData = useMemo(() => {
        const rate = simReturn / 100
        const vol = 0.15
        const results = []
        for (let y = 0; y <= simYears; y++) {
            const base = totalAssets * Math.pow(1 + rate, y)
            const savings = simSavings * 12 * (rate === 0 ? y : (Math.pow(1 + rate, y) - 1) / rate)
            const p50 = Math.floor(base + savings)
            const drift = (rate - 0.5 * vol * vol) * y
            const sq = vol * Math.sqrt(y)
            results.push({
                year: `${new Date().getFullYear() + y}`,
                楽観: Math.floor((totalAssets + simSavings * 12 * y) * Math.exp(drift + sq * 1.28)),
                中央: p50,
                悲観: Math.floor((totalAssets + simSavings * 12 * y) * Math.exp(drift - sq * 1.28))
            })
        }
        return results
    }, [totalAssets, simSavings, simReturn, simYears])

    // --- ビューごとのタイトル ---
    const viewTitle = VIEWS.find(v => v.id === activeView)?.label || ''

    return (
        <div className="app-root">
            {/* サイドバー */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <div className="sidebar-logo"><BarChart3 size={18} /></div>
                        <div>
                            <div className="sidebar-title">資産管理</div>
                            <div className="sidebar-subtitle">Asset Dashboard</div>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {VIEWS.map(v => (
                        <button
                            key={v.id}
                            className={`nav-btn ${activeView === v.id ? 'active' : ''}`}
                            onClick={() => setActiveView(v.id)}
                        >
                            <v.icon size={18} />
                            {v.label}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-stats">
                        <div className="sidebar-stats-label">総資産</div>
                        <div className="sidebar-stats-value">{formatYen(totalAssets)}</div>
                    </div>
                </div>
            </aside>

            {/* メインコンテンツ */}
            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{viewTitle}</h1>
                        <div className="page-subtitle">{effectiveData.latestMonth} 時点{useMock ? '（デモデータ）' : ''}</div>
                    </div>
                    <button className="btn-icon" onClick={() => refetch()} title="データ更新">
                        <RefreshCw size={16} />
                    </button>
                </div>

                {/* ========== ダッシュボード ========== */}
                {activeView === 'dashboard' && (
                    <div className="fade-in">
                        {/* サマリーカード */}
                        <div className="summary-cards">
                            <div className="summary-card">
                                <div className="card-label">総資産額</div>
                                <div className="card-value">{formatYen(totalAssets)}</div>
                            </div>
                            <div className="summary-card">
                                <div className="card-label">資産カテゴリ数</div>
                                <div className="card-value card-value-sm">{effectiveData.summary?.length || 0} カテゴリ</div>
                            </div>
                            <div className="summary-card">
                                <div className="card-label">口座数</div>
                                <div className="card-value card-value-sm">{effectiveData.latestData?.length || 0} 件</div>
                            </div>
                            <div className="summary-card">
                                <div className="card-label">分散スコア</div>
                                <div className="card-value card-value-sm">{healthScore}<span style={{ fontSize: 14, color: '#64748b' }}> / 100</span></div>
                            </div>
                        </div>

                        {/* 円グラフ + 推移 */}
                        <div className="chart-section">
                            <div className="chart-card">
                                <div className="chart-card-title">カテゴリ別構成比</div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={85}
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {pieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number) => formatYen(value)}
                                            contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pie-legend">
                                    {pieData.map((d, i) => (
                                        <div key={i} className="pie-legend-item">
                                            <span className="pie-legend-label">
                                                <span className="pie-legend-dot" style={{ background: d.color }}></span>
                                                {d.name}
                                            </span>
                                            <span className="pie-legend-value">{formatYen(d.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="chart-card">
                                <div className="chart-card-title">資産推移（直近6ヶ月）</div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={[
                                        { month: '9月', amount: 6200000 },
                                        { month: '10月', amount: 6450000 },
                                        { month: '11月', amount: 6300000 },
                                        { month: '12月', amount: 7800000 },
                                        { month: '1月', amount: 8100000 },
                                        { month: '2月', amount: 9530000 }
                                    ]}>
                                        <defs>
                                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                                        <Tooltip
                                            formatter={(v: number) => formatYen(v)}
                                            contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                                        />
                                        <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fill="url(#areaGrad)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 資産一覧 */}
                        <div className="section-header">
                            <h2 className="section-title">資産一覧</h2>
                            <button className="btn-text" onClick={() => setShowModal(true)}>＋ 新規登録</button>
                        </div>
                        <table className="asset-table">
                            <thead>
                                <tr>
                                    <th>口座名</th>
                                    <th>カテゴリ</th>
                                    <th>残高</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(effectiveData.latestData || []).map((asset, i) => {
                                    const style = getCategoryStyle(asset.category)
                                    const Icon = style.icon
                                    return (
                                        <tr key={i}>
                                            <td>
                                                <div className="asset-name-cell">
                                                    <div className="asset-icon" style={{ background: style.color + '18', color: style.color }}>
                                                        <Icon size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="asset-label">{asset.label}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className="asset-category">{asset.category}</span></td>
                                            <td><span className="asset-balance">{formatYen(asset.balance)}</span></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ========== シミュレーター ========== */}
                {activeView === 'analytics' && (
                    <div className="fade-in">
                        <div className="card mb-24" style={{ maxWidth: 1200 }}>
                            <div className="chart-card-title" style={{ marginBottom: 20 }}>将来資産シミュレーション</div>
                            <div className="sim-controls">
                                <div className="sim-group">
                                    <label>毎月の積立額</label>
                                    <div className="sim-value">{formatYen(simSavings)}</div>
                                    <input type="range" min="0" max="1000000" step="10000" value={simSavings}
                                        onChange={e => setSimSavings(Number(e.target.value))} className="sim-slider" />
                                </div>
                                <div className="sim-group">
                                    <label>想定年利回り</label>
                                    <div className="sim-value text-accent">{simReturn}%</div>
                                    <input type="range" min="0" max="20" step="0.5" value={simReturn}
                                        onChange={e => setSimReturn(Number(e.target.value))} className="sim-slider" />
                                </div>
                                <div className="sim-group">
                                    <label>運用期間</label>
                                    <div className="sim-value">{simYears}年</div>
                                    <input type="range" min="1" max="50" step="1" value={simYears}
                                        onChange={e => setSimYears(Number(e.target.value))} className="sim-slider" />
                                </div>
                            </div>
                            <div className="sim-legend">
                                <div className="sim-legend-item"><span className="sim-legend-dot" style={{ background: '#3b82f6' }}></span>楽観</div>
                                <div className="sim-legend-item"><span className="sim-legend-dot" style={{ background: '#94a3b8' }}></span>中央値</div>
                                <div className="sim-legend-item"><span className="sim-legend-dot" style={{ background: '#ef4444' }}></span>悲観</div>
                            </div>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={simData}>
                                    <defs>
                                        <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.08} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }}
                                        tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
                                    <Tooltip
                                        formatter={(v: number) => formatYen(v)}
                                        contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                                    />
                                    <Area type="monotone" dataKey="楽観" stroke="#3b82f6" strokeWidth={2} fill="url(#simGrad)" />
                                    <Area type="monotone" dataKey="中央" stroke="#94a3b8" strokeWidth={1.5} fill="none" />
                                    <Area type="monotone" dataKey="悲観" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ========== 目標管理 ========== */}
                {activeView === 'goals' && (
                    <div className="fade-in">
                        <div className="goals-grid">
                            {(effectiveData.goals || []).map((goal, i) => {
                                const percent = Math.min(100, Math.floor((totalAssets / goal.target) * 100))
                                return (
                                    <div key={i} className="goal-card">
                                        <div className="goal-name">{goal.name}</div>
                                        <div className="goal-deadline">期限: {goal.deadline}</div>
                                        <div className="goal-numbers">
                                            <span className="goal-current">{formatYen(totalAssets)}</span>
                                            <span className="goal-target">{formatYen(goal.target)}</span>
                                        </div>
                                        <div className="goal-bar-bg">
                                            <div className="goal-bar-fill" style={{ width: `${percent}%` }}></div>
                                        </div>
                                        <div className="goal-percent">{percent}%</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </main>

            {/* モバイルナビ */}
            <nav className="mobile-nav">
                <div className="mobile-nav-inner">
                    {VIEWS.map(v => (
                        <button
                            key={v.id}
                            className={`mobile-nav-btn ${activeView === v.id ? 'active' : ''}`}
                            onClick={() => setActiveView(v.id)}
                        >
                            <v.icon size={20} />
                            <span>{v.label}</span>
                        </button>
                    ))}
                    <button className="mobile-fab" onClick={() => setShowModal(true)}>
                        <Plus size={20} />
                    </button>
                </div>
            </nav>

            {/* モーダル: 資産登録 */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-bg" onClick={() => setShowModal(false)}></div>
                    <div className="modal-panel fade-in">
                        <div className="modal-header">
                            <h3 className="modal-title">資産を記録</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); mutation.mutate(formData); }}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">対象月</label>
                                    <input className="form-input" value={formData.month}
                                        onChange={e => setFormData({ ...formData, month: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">カテゴリ</label>
                                    <select className="form-select" value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">口座名</label>
                                <select className="form-select" value={formData.label}
                                    onChange={e => setFormData({ ...formData, label: e.target.value })}>
                                    {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">残高（円）</label>
                                <input type="number" className="form-input form-input-lg" value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })} required
                                    placeholder="0" />
                            </div>
                            <button type="submit" className="btn-primary" disabled={mutation.isPending}>
                                {mutation.isPending ? '送信中...' : '登録する'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
