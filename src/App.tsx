import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    Wallet, TrendingUp, Activity, Plus, RefreshCw,
    LayoutDashboard, Target, BarChart3, ShieldCheck,
    CircleDot, X, CreditCard, Landmark, ArrowDownCircle
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

interface NormaItem {
    name: string
    amount: number
    norma: number
}

interface GasResponse {
    raw: RawAsset[]
    latestData: RawAsset[]
    summary: SummaryAsset[]
    goals: Goal[]
    latestMonth: string
    liabilities?: number
    insurance?: number
}

// --- モックデータ（26/02/28時点の実データ構造） ---
const MOCK_DATA: GasResponse = {
    latestMonth: '2026/02',
    summary: [
        { category: '預金', balance: 6710078 },
        { category: '証券', balance: 10556200 },
        { category: '暗号資産', balance: 300000 },
        { category: '保険・年金', balance: 3026000 }
    ],
    latestData: [
        { month: '2026/02', category: '預金', label: '楽天銀行', balance: 537020 },
        { month: '2026/02', category: '預金', label: 'みずほ銀行', balance: 145549 },
        { month: '2026/02', category: '預金', label: 'SBI銀行', balance: 4617969 },
        { month: '2026/02', category: '預金', label: '住友銀行', balance: 1409540 },
        { month: '2026/02', category: '暗号資産', label: '暗号資産', balance: 300000 },
        { month: '2026/02', category: '証券', label: 'SBI/みずほ証券', balance: 8156200 },
        { month: '2026/02', category: '保険・年金', label: '小規模共済&iDeCo', balance: 3026000 },
        { month: '2026/02', category: '証券', label: 'SBI証券(積立)', balance: 2400000 }
    ],
    raw: [],
    goals: [
        { name: '金融資産3,150万円', category: '全体', target: 31500000, deadline: '2030-12-31' },
        { name: '年間ノルマ達成', category: '積立', target: 5993000, deadline: '2026-12-31' }
    ],
    liabilities: 483892,
    insurance: 1966200
}

// --- ノルマデータ ---
const MOCK_NORMA: NormaItem[] = [
    { name: '小規模共済', amount: 840000, norma: 840000 },
    { name: 'iDeCo', amount: 276000, norma: 253000 },
    { name: '積立NISA', amount: 1200000, norma: 1100000 },
    { name: '個別NISA', amount: 2400000, norma: 0 }
]

// --- 定数 ---
const CATEGORIES = ['預金', '証券', '暗号資産', '保険・年金', 'その他']
const ACCOUNTS = [
    '楽天銀行', 'みずほ銀行', 'SBI銀行', '住友銀行',
    'SBI/みずほ証券', 'SBI証券(積立)',
    '暗号資産', '小規模共済&iDeCo'
]

// --- カテゴリの色とアイコン ---
const CATEGORY_STYLES: Record<string, { color: string, icon: typeof Wallet }> = {
    '預金': { color: '#3b82f6', icon: Landmark },
    '証券': { color: '#8b5cf6', icon: TrendingUp },
    '暗号資産': { color: '#f59e0b', icon: Activity },
    '保険・年金': { color: '#10b981', icon: ShieldCheck },
    '借入': { color: '#ef4444', icon: CreditCard },
    'その他': { color: '#64748b', icon: CircleDot }
}

const getCategoryStyle = (cat: string) => CATEGORY_STYLES[cat] || CATEGORY_STYLES['その他']

// --- 金額フォーマット ---
const formatYen = (n: number) => `¥${n.toLocaleString()}`
const formatMan = (n: number) => `${(n / 10000).toFixed(0)}万`

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
    const [isRefreshing, setIsRefreshing] = useState(false)

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

    // --- 更新ボタン処理 ---
    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true)
        await refetch()
        setTimeout(() => setIsRefreshing(false), 600)
    }, [refetch])

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
    const liabilities = effectiveData.liabilities ?? MOCK_DATA.liabilities ?? 0
    const insurance = effectiveData.insurance ?? MOCK_DATA.insurance ?? 0
    const netAssets = totalAssets - liabilities

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

    // ノルマ計算
    const normaTotal = MOCK_NORMA.reduce((s, n) => s + n.amount, 0)
    const normaTarget = MOCK_NORMA.reduce((s, n) => s + n.norma, 0)
    const normaRemaining = Math.max(0, normaTarget - normaTotal)

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

    const viewTitle = VIEWS.find(v => v.id === activeView)?.label || ''

    return (
        <div className="app-root">
            {/* サイドバー（PC） */}
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
                        <button key={v.id} className={`nav-btn ${activeView === v.id ? 'active' : ''}`}
                            onClick={() => setActiveView(v.id)}>
                            <v.icon size={18} />{v.label}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="sidebar-stats">
                        <div className="sidebar-stats-label">純資産</div>
                        <div className="sidebar-stats-value">{formatYen(netAssets)}</div>
                    </div>
                </div>
            </aside>

            {/* メインコンテンツ */}
            <main className="main-content">
                {/* モバイルヘッダー */}
                <div className="mobile-header">
                    <h1 className="mobile-header-title">{viewTitle}</h1>
                    <div className="mobile-header-actions">
                        <button className="btn-icon" onClick={handleRefresh} title="データ更新" disabled={isRefreshing}>
                            <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
                        </button>
                        <button className="btn-icon" onClick={() => setShowModal(true)} title="新規登録">
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* PCヘッダー */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{viewTitle}</h1>
                        <div className="page-subtitle">{effectiveData.latestMonth} 時点{useMock ? '（デモデータ）' : ''}</div>
                    </div>
                    <div className="page-header-actions">
                        <button className="btn-icon" onClick={handleRefresh} title="データ更新" disabled={isRefreshing}>
                            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* ========== ダッシュボード ========== */}
                {activeView === 'dashboard' && (
                    <div className="fade-in">
                        {/* サマリーカード */}
                        <div className="summary-cards">
                            <div className="summary-card">
                                <div className="card-label">金融資産合計</div>
                                <div className="card-value">{formatMan(totalAssets)}</div>
                            </div>
                            <div className="summary-card">
                                <div className="card-label">借入</div>
                                <div className="card-value card-value-sm text-negative">{formatYen(liabilities)}</div>
                            </div>
                            <div className="summary-card">
                                <div className="card-label">純資産</div>
                                <div className="card-value card-value-sm">{formatMan(netAssets)}</div>
                            </div>
                            <div className="summary-card">
                                <div className="card-label">分散スコア</div>
                                <div className="card-value card-value-sm">{healthScore}<span style={{ fontSize: 14, color: '#64748b' }}> / 100</span></div>
                            </div>
                        </div>

                        {/* 円グラフ + ノルマ */}
                        <div className="chart-section">
                            <div className="chart-card">
                                <div className="chart-card-title">カテゴリ別構成比</div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                                            paddingAngle={2} dataKey="value" stroke="none">
                                            {pieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatYen(value)}
                                            contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
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

                            {/* 月次ノルマ */}
                            <div className="chart-card">
                                <div className="chart-card-title">月次積立ノルマ</div>
                                <table className="norma-table">
                                    <thead>
                                        <tr>
                                            <th>項目</th>
                                            <th>金額</th>
                                            <th>ノルマ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {MOCK_NORMA.map((n, i) => (
                                            <tr key={i}>
                                                <td>{n.name}</td>
                                                <td className="mono-num">{formatYen(n.amount)}</td>
                                                <td className="mono-num">{formatYen(n.norma)}</td>
                                            </tr>
                                        ))}
                                        <tr className="norma-total-row">
                                            <td>合計</td>
                                            <td className="mono-num">{formatYen(normaTotal)}</td>
                                            <td className="mono-num">{formatYen(normaTarget)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div className="norma-remaining">
                                    <span>残ノルマ</span>
                                    <span className={`mono-num ${normaRemaining === 0 ? 'text-positive' : 'text-negative'}`}>
                                        {formatYen(normaRemaining)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 保険・その他 */}
                        <div className="info-bar mb-24">
                            <div className="info-bar-item">
                                <ShieldCheck size={14} />
                                <span>保険</span>
                                <strong>{formatYen(insurance)}</strong>
                            </div>
                            <div className="info-bar-item">
                                <ArrowDownCircle size={14} />
                                <span>借入残高</span>
                                <strong className="text-negative">{formatYen(liabilities)}</strong>
                            </div>
                        </div>

                        {/* 資産一覧 */}
                        <div className="section-header">
                            <h2 className="section-title">資産一覧</h2>
                            <button className="btn-text" onClick={() => setShowModal(true)}>＋ 新規登録</button>
                        </div>
                        <table className="asset-table mb-24">
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
                                                    <div className="asset-label">{asset.label}</div>
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
                                    <Tooltip formatter={(v: number) => formatYen(v)}
                                        contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
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

            {/* モバイルボトムナビ */}
            <nav className="mobile-nav">
                <div className="mobile-nav-inner">
                    {VIEWS.map(v => (
                        <button key={v.id} className={`mobile-nav-btn ${activeView === v.id ? 'active' : ''}`}
                            onClick={() => setActiveView(v.id)}>
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
