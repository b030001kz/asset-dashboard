import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    Wallet, TrendingUp, Activity, Plus, RefreshCw,
    LayoutDashboard, Target, BarChart3, ShieldCheck,
    CircleDot, X, Landmark, ArrowDownCircle,
    Calendar, LineChart, PieChart as PieChartIcon, ExternalLink,
    FolderKanban
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    BarChart, Bar, Legend, ComposedChart, Line
} from 'recharts'
import './App.css'

const GAS_URL = import.meta.env.VITE_GAS_URL

// ================================================
// 型定義
// ================================================
interface RawAsset {
    month: string; category: string; label: string; balance: number; memo?: string
}
interface SummaryAsset { category: string; balance: number }
interface Goal { name: string; category: string; target: number; deadline: string }
interface NormaItem { name: string; amount: number; norma: number }
interface MonthlyPlanRow {
    label: string; lastMonth: number; thisMonth: number;
    nextMonth: number; yearEnd: number; nextFiscalYear: number
}
interface AssetHistoryRow {
    period: string; actual: number | null; projected: number | null; retirement: number | null
}
interface InvestmentRow {
    year: string; cumulative: number; dividendExpected: number; dividendActual: number
}
interface CategoryRow {
    period: string; cash: number; shortTerm: number;
    midDividend: number; midIndex: number; retirementLock: number
}

interface GasResponse {
    raw: RawAsset[]; latestData: RawAsset[]; summary: SummaryAsset[]
    goals: Goal[]; latestMonth: string
    liabilities?: number; insurance?: number; spreadsheetUrl?: string
    monthlyPlan?: MonthlyPlanRow[]
    assetHistory?: AssetHistoryRow[]
    investmentHistory?: InvestmentRow[]
    categoryHistory?: CategoryRow[]
    norma?: NormaItem[]
}

// ================================================
// モックデータ（26/02/28時点）
// ================================================
const MOCK_MONTHLY_PLAN: MonthlyPlanRow[] = [
    { label: '楽天', lastMonth: 603973, thisMonth: 537020, nextMonth: 497020, yearEnd: 137020, nextFiscalYear: 17020 },
    { label: 'みずほ', lastMonth: 145549, thisMonth: 145549, nextMonth: 145549, yearEnd: 145549, nextFiscalYear: 145624 },
    { label: 'SBI', lastMonth: 3718613, thisMonth: 4617969, nextMonth: 5235969, yearEnd: 8677214, nextFiscalYear: 10233554 },
    { label: '住友', lastMonth: 1451559, thisMonth: 1409540, nextMonth: 1367521, yearEnd: 63282, nextFiscalYear: 132986 },
]

const MOCK_ASSET_HISTORY: AssetHistoryRow[] = [
    { period: '2012/12', actual: 457, projected: null, retirement: -94 },
    { period: '2013/12', actual: 487, projected: null, retirement: 111 },
    { period: '2014/12', actual: 497, projected: null, retirement: 128 },
    { period: '2015/12', actual: 594, projected: null, retirement: 145 },
    { period: '2016/12', actual: 689, projected: null, retirement: 163 },
    { period: '2017/12', actual: 732, projected: null, retirement: 180 },
    { period: '2018/12', actual: 730, projected: null, retirement: 197 },
    { period: '2019/12', actual: 759, projected: null, retirement: 214 },
    { period: '2020/12', actual: 781, projected: null, retirement: 231 },
    { period: '2021/12', actual: 821, projected: null, retirement: 248 },
    { period: '2022/12', actual: 901, projected: null, retirement: 265 },
    { period: '2023/12', actual: 908, projected: null, retirement: 282 },
    { period: '2024/12', actual: 1386, projected: null, retirement: 626 },
    { period: '2025/12', actual: null, projected: 1951, retirement: 1087 },
    { period: '2026/12', actual: null, projected: 2521, retirement: 316 },
    { period: '2027/12', actual: null, projected: 3147, retirement: 351 },
    { period: '2028/12', actual: null, projected: 3753, retirement: 368 },
    { period: '2029/12', actual: null, projected: 4358, retirement: 385 },
    { period: '2030/12', actual: null, projected: 4964, retirement: 402 },
    { period: '2031/12', actual: null, projected: 5570, retirement: 419 },
]

const MOCK_INVESTMENT: InvestmentRow[] = [
    { year: '2023', cumulative: 96, dividendExpected: 2, dividendActual: 2 },
    { year: '2024', cumulative: 336, dividendExpected: 6, dividendActual: 6 },
    { year: '2025', cumulative: 576, dividendExpected: 28, dividendActual: 0 },
    { year: '2026', cumulative: 816, dividendExpected: 16, dividendActual: 0 },
    { year: '2027', cumulative: 1056, dividendExpected: 21, dividendActual: 0 },
    { year: '2028', cumulative: 1296, dividendExpected: 26, dividendActual: 0 },
    { year: '2029', cumulative: 1296, dividendExpected: 26, dividendActual: 0 },
    { year: '2030', cumulative: 1296, dividendExpected: 26, dividendActual: 0 },
    { year: '2031', cumulative: 1296, dividendExpected: 26, dividendActual: 0 },
    { year: '2032', cumulative: 1296, dividendExpected: 26, dividendActual: 0 },
    { year: '2033', cumulative: 1296, dividendExpected: 26, dividendActual: 0 },
    { year: '2034', cumulative: 1296, dividendExpected: 26, dividendActual: 0 },
    { year: '2035', cumulative: 1296, dividendExpected: 26, dividendActual: 0 },
]

const MOCK_CATEGORY: CategoryRow[] = [
    { period: '目標値', cash: 250, shortTerm: 100, midDividend: 600, midIndex: 1200, retirementLock: 1000 },
    { period: '2024/12', cash: 465, shortTerm: 48, midDividend: 90, midIndex: 360, retirementLock: 487 },
    { period: '2025/12', cash: 723, shortTerm: 48, midDividend: 210, midIndex: 600, retirementLock: 615 },
    { period: '2026/12', cash: 926, shortTerm: 48, midDividend: 330, midIndex: 840, retirementLock: 749 },
    { period: '2027/12', cash: 1080, shortTerm: 48, midDividend: 450, midIndex: 1414, retirementLock: 883 },
    { period: '2028/12', cash: 1214, shortTerm: 48, midDividend: 570, midIndex: 2320, retirementLock: 1017 },
    { period: '2029/12', cash: 1588, shortTerm: 48, midDividend: 690, midIndex: 3227, retirementLock: 1151 },
    { period: '2030/12', cash: 1962, shortTerm: 48, midDividend: 810, midIndex: 3800, retirementLock: 1277 },
]

const MOCK_NORMA: NormaItem[] = [
    { name: '小規模共済', amount: 840000, norma: 840000 },
    { name: 'iDeCo', amount: 276000, norma: 253000 },
    { name: '積立NISA', amount: 1200000, norma: 1100000 },
    { name: '個別NISA', amount: 2400000, norma: 0 },
]

const MOCK_DATA: GasResponse = {
    latestMonth: '2026/02',
    summary: [
        { category: '預金', balance: 6710078 },
        { category: '証券', balance: 10556200 },
        { category: '暗号資産', balance: 300000 },
        { category: '保険・年金', balance: 3026000 },
    ],
    latestData: [
        { month: '2026/02', category: '預金', label: '楽天銀行', balance: 537020 },
        { month: '2026/02', category: '預金', label: 'みずほ銀行', balance: 145549 },
        { month: '2026/02', category: '預金', label: 'SBI銀行', balance: 4617969 },
        { month: '2026/02', category: '預金', label: '住友銀行', balance: 1409540 },
        { month: '2026/02', category: '暗号資産', label: '暗号資産', balance: 300000 },
        { month: '2026/02', category: '証券', label: 'SBI/みずほ証券', balance: 8156200 },
        { month: '2026/02', category: '保険・年金', label: '小規模共済&iDeCo', balance: 3026000 },
        { month: '2026/02', category: '証券', label: 'SBI証券(積立)', balance: 2400000 },
    ],
    raw: [],
    goals: [
        { name: '金融資産3,150万円', category: '全体', target: 31500000, deadline: '2030-12-31' },
        { name: '年間ノルマ達成', category: '積立', target: 5993000, deadline: '2026-12-31' },
    ],
    liabilities: 483892,
    insurance: 1966200,
    spreadsheetUrl: '',
    monthlyPlan: MOCK_MONTHLY_PLAN,
    assetHistory: MOCK_ASSET_HISTORY,
    investmentHistory: MOCK_INVESTMENT,
    categoryHistory: MOCK_CATEGORY,
    norma: MOCK_NORMA,
}

// ================================================
// 定数
// ================================================
const CATEGORIES = ['預金', '証券', '暗号資産', '保険・年金', 'その他']
const ACCOUNTS = ['楽天銀行', 'みずほ銀行', 'SBI銀行', '住友銀行', 'SBI/みずほ証券', 'SBI証券(積立)', '暗号資産', '小規模共済&iDeCo']

const CATEGORY_STYLES: Record<string, { color: string, icon: typeof Wallet }> = {
    '預金': { color: '#3b82f6', icon: Landmark },
    '証券': { color: '#8b5cf6', icon: TrendingUp },
    '暗号資産': { color: '#f59e0b', icon: Activity },
    '保険・年金': { color: '#10b981', icon: ShieldCheck },
    'その他': { color: '#64748b', icon: CircleDot },
}
const getCategoryStyle = (cat: string) => CATEGORY_STYLES[cat] || CATEGORY_STYLES['その他']
const formatYen = (n: number) => `¥${n.toLocaleString()}`
const formatMan = (n: number) => `${Math.round(n / 10000).toLocaleString()}万`

// ビュー定義（7ページ）
type ViewId = 'dashboard' | 'monthly' | 'history' | 'investment' | 'category' | 'simulator' | 'goals'
const VIEWS: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'monthly', label: '月次管理', icon: Calendar },
    { id: 'history', label: '資産推移', icon: LineChart },
    { id: 'investment', label: '投資分析', icon: TrendingUp },
    { id: 'category', label: 'カテゴリ別', icon: FolderKanban },
    { id: 'simulator', label: 'シミュレーター', icon: BarChart3 },
    { id: 'goals', label: '目標管理', icon: Target },
]
// モバイルボトムナビに表示するビュー（5つまで）
const MOBILE_VIEWS = VIEWS.filter(v => ['dashboard', 'monthly', 'history', 'investment', 'goals'].includes(v.id))

// チャートカラー
const CHART_COLORS = {
    blue: '#3b82f6', purple: '#8b5cf6', green: '#10b981',
    amber: '#f59e0b', red: '#ef4444', gray: '#94a3b8',
    indigo: '#6366f1', teal: '#14b8a6',
}
const TOOLTIP_STYLE = { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }

// ================================================
// App
// ================================================
function App() {
    const queryClient = useQueryClient()
    const [activeView, setActiveView] = useState<ViewId>('dashboard')
    const [showModal, setShowModal] = useState(false)
    const [useMock, setUseMock] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const [formData, setFormData] = useState({
        month: new Date().toISOString().substring(0, 7).replace('-', '/'),
        category: CATEGORIES[0], label: ACCOUNTS[0], amount: '', memo: '',
    })
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
        retry: 1,
    })

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true)
        await refetch()
        setTimeout(() => setIsRefreshing(false), 600)
    }, [refetch])

    const mutation = useMutation({
        mutationFn: async (newData: typeof formData) => {
            if (useMock) return new Promise(r => setTimeout(r, 500))
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newData),
            })
            return res.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] })
            setShowModal(false)
            setFormData(prev => ({ ...prev, amount: '', memo: '' }))
        },
    })

    useEffect(() => { if (error) setUseMock(true) }, [error])

    // --- 計算値 ---
    const d = useMock || !data?.summary ? MOCK_DATA : data
    const totalAssets = useMemo(() => (d.summary || []).reduce((s, i) => s + (Number(i.balance) || 0), 0), [d])
    const liabilities = d.liabilities ?? 0
    const insurance = d.insurance ?? 0
    const netAssets = totalAssets - liabilities
    const spreadsheetUrl = d.spreadsheetUrl || ''

    const pieData = useMemo(() => (d.summary || []).map(s => ({
        name: s.category, value: s.balance, color: getCategoryStyle(s.category).color,
    })), [d])

    const healthScore = useMemo(() => {
        const sm = d.summary || []
        if (!sm.length) return 0
        const maxW = Math.max(...sm.map(s => s.balance / (totalAssets || 1)))
        let sc = 50
        if (sm.length >= 4) sc += 20
        if (maxW < 0.4) sc += 30
        if (maxW > 0.7) sc -= 30
        return Math.max(0, Math.min(100, sc))
    }, [d, totalAssets])

    const norma = d.norma || MOCK_NORMA
    const normaTotal = norma.reduce((s, n) => s + n.amount, 0)
    const normaTarget = norma.reduce((s, n) => s + n.norma, 0)
    const normaRemaining = Math.max(0, normaTarget - normaTotal)

    const monthlyPlan = d.monthlyPlan || MOCK_MONTHLY_PLAN
    const assetHistory = d.assetHistory || MOCK_ASSET_HISTORY
    const investmentHistory = d.investmentHistory || MOCK_INVESTMENT
    const categoryHistory = d.categoryHistory || MOCK_CATEGORY

    const simData = useMemo(() => {
        const rate = simReturn / 100, vol = 0.15, results = []
        for (let y = 0; y <= simYears; y++) {
            const base = totalAssets * Math.pow(1 + rate, y)
            const sav = simSavings * 12 * (rate === 0 ? y : (Math.pow(1 + rate, y) - 1) / rate)
            const p50 = Math.floor(base + sav)
            const drift = (rate - 0.5 * vol * vol) * y, sq = vol * Math.sqrt(y)
            results.push({
                year: `${new Date().getFullYear() + y}`,
                楽観: Math.floor((totalAssets + simSavings * 12 * y) * Math.exp(drift + sq * 1.28)),
                中央: p50,
                悲観: Math.floor((totalAssets + simSavings * 12 * y) * Math.exp(drift - sq * 1.28)),
            })
        }
        return results
    }, [totalAssets, simSavings, simReturn, simYears])

    const viewTitle = VIEWS.find(v => v.id === activeView)?.label || ''
    const depositTotal = monthlyPlan.reduce((s, r) => s + r.thisMonth, 0)

    return (
        <div className="app-root">
            {/* ===== サイドバー（PC） ===== */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <div className="sidebar-logo"><BarChart3 size={18} /></div>
                        <div>
                            <div className="sidebar-title">資産管理</div>
                            <div className="sidebar-subtitle">Personal Finance</div>
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
                        <div className="sidebar-stats-value">{formatMan(netAssets)}</div>
                    </div>
                    {spreadsheetUrl && (
                        <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="sidebar-link">
                            <ExternalLink size={14} />スプレッドシートを開く
                        </a>
                    )}
                </div>
            </aside>

            {/* ===== メイン ===== */}
            <main className="main-content">
                {/* モバイルヘッダー */}
                <div className="mobile-header">
                    <h1 className="mobile-header-title">{viewTitle}</h1>
                    <div className="mobile-header-actions">
                        <button className="btn-icon" onClick={handleRefresh} disabled={isRefreshing}>
                            <RefreshCw size={18} className={isRefreshing ? 'spin' : ''} />
                        </button>
                        <button className="btn-icon" onClick={() => setShowModal(true)}>
                            <Plus size={18} />
                        </button>
                        {spreadsheetUrl && (
                            <a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="btn-icon">
                                <ExternalLink size={18} />
                            </a>
                        )}
                    </div>
                </div>

                {/* PCヘッダー */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{viewTitle}</h1>
                        <div className="page-subtitle">{d.latestMonth} 時点{useMock ? '（デモデータ）' : ''}</div>
                    </div>
                    <div className="page-header-actions">
                        <button className="btn-icon" onClick={handleRefresh} disabled={isRefreshing}>
                            <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* ==================== 1. ダッシュボード ==================== */}
                {activeView === 'dashboard' && (
                    <div className="fade-in">
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
                                <div className="card-value card-value-sm">{healthScore}<span className="score-max"> / 100</span></div>
                            </div>
                        </div>

                        <div className="chart-section">
                            <div className="chart-card">
                                <div className="chart-card-title">カテゴリ別構成比</div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                                            paddingAngle={2} dataKey="value" stroke="none">
                                            {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number) => formatYen(v)} contentStyle={TOOLTIP_STYLE} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="pie-legend">
                                    {pieData.map((p, i) => (
                                        <div key={i} className="pie-legend-item">
                                            <span className="pie-legend-label">
                                                <span className="pie-legend-dot" style={{ background: p.color }}></span>{p.name}
                                            </span>
                                            <span className="pie-legend-value">{formatYen(p.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="chart-card">
                                <div className="chart-card-title">月次積立ノルマ</div>
                                <table className="norma-table">
                                    <thead><tr><th>項目</th><th>金額</th><th>ノルマ</th></tr></thead>
                                    <tbody>
                                        {norma.map((n, i) => (
                                            <tr key={i}><td>{n.name}</td>
                                                <td className="mono-num">{formatYen(n.amount)}</td>
                                                <td className="mono-num">{formatYen(n.norma)}</td></tr>
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
                                    <span className={`mono-num ${normaRemaining === 0 ? 'text-positive' : ''}`}>{formatYen(normaRemaining)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="info-bar mb-24">
                            <div className="info-bar-item"><ShieldCheck size={14} /><span>保険</span><strong>{formatYen(insurance)}</strong></div>
                            <div className="info-bar-item"><ArrowDownCircle size={14} /><span>借入残高</span><strong className="text-negative">{formatYen(liabilities)}</strong></div>
                        </div>

                        <div className="section-header">
                            <h2 className="section-title">資産一覧</h2>
                            <button className="btn-text" onClick={() => setShowModal(true)}>＋ 新規登録</button>
                        </div>
                        <table className="asset-table mb-24">
                            <thead><tr><th>口座名</th><th>カテゴリ</th><th>残高</th></tr></thead>
                            <tbody>
                                {(d.latestData || []).map((a, i) => {
                                    const st = getCategoryStyle(a.category); const Ic = st.icon
                                    return (<tr key={i}>
                                        <td><div className="asset-name-cell">
                                            <div className="asset-icon" style={{ background: st.color + '18', color: st.color }}><Ic size={16} /></div>
                                            <div className="asset-label">{a.label}</div>
                                        </div></td>
                                        <td><span className="asset-category">{a.category}</span></td>
                                        <td><span className="asset-balance">{formatYen(a.balance)}</span></td>
                                    </tr>)
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ==================== 2. 月次管理 ==================== */}
                {activeView === 'monthly' && (
                    <div className="fade-in">
                        <div className="card mb-24" style={{ maxWidth: 1200, overflowX: 'auto' }}>
                            <div className="chart-card-title">預金口座 月次推移</div>
                            <table className="monthly-table">
                                <thead>
                                    <tr>
                                        <th>口座</th><th>先月</th><th className="col-highlight">当月</th>
                                        <th>翌月</th><th>年末</th><th>来年度末</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyPlan.map((r, i) => (
                                        <tr key={i}>
                                            <td className="fw-600">{r.label}</td>
                                            <td className="mono-num">{r.lastMonth.toLocaleString()}</td>
                                            <td className="mono-num col-highlight fw-700">{r.thisMonth.toLocaleString()}</td>
                                            <td className="mono-num">{r.nextMonth.toLocaleString()}</td>
                                            <td className="mono-num">{r.yearEnd.toLocaleString()}</td>
                                            <td className="mono-num">{r.nextFiscalYear.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    <tr className="monthly-total-row">
                                        <td className="fw-700">預金合計</td>
                                        <td className="mono-num fw-700">{monthlyPlan.reduce((s, r) => s + r.lastMonth, 0).toLocaleString()}</td>
                                        <td className="mono-num col-highlight fw-700">{depositTotal.toLocaleString()}</td>
                                        <td className="mono-num fw-700">{monthlyPlan.reduce((s, r) => s + r.nextMonth, 0).toLocaleString()}</td>
                                        <td className="mono-num fw-700">{monthlyPlan.reduce((s, r) => s + r.yearEnd, 0).toLocaleString()}</td>
                                        <td className="mono-num fw-700">{monthlyPlan.reduce((s, r) => s + r.nextFiscalYear, 0).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="card mb-24" style={{ maxWidth: 1200 }}>
                            <div className="chart-card-title">積立ノルマ進捗</div>
                            <table className="norma-table">
                                <thead><tr><th>項目</th><th>金額</th><th>ノルマ</th><th>残</th></tr></thead>
                                <tbody>
                                    {norma.map((n, i) => (
                                        <tr key={i}>
                                            <td>{n.name}</td>
                                            <td className="mono-num">{formatYen(n.amount)}</td>
                                            <td className="mono-num">{formatYen(n.norma)}</td>
                                            <td className={`mono-num ${n.norma - n.amount <= 0 ? 'text-positive' : 'text-negative'}`}>
                                                {formatYen(Math.max(0, n.norma - n.amount))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="norma-remaining">
                                <span>残ノルマ合計</span>
                                <span className={`mono-num ${normaRemaining === 0 ? 'text-positive' : 'text-negative'}`}>{formatYen(normaRemaining)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== 3. 資産推移 ==================== */}
                {activeView === 'history' && (
                    <div className="fade-in">
                        <div className="card mb-24" style={{ maxWidth: 1200 }}>
                            <div className="chart-card-title">金融資産推移（万円）</div>
                            <div className="chart-legend-row">
                                <span className="chart-legend-chip" style={{ background: CHART_COLORS.blue }}>実績</span>
                                <span className="chart-legend-chip" style={{ background: CHART_COLORS.red }}>見込み</span>
                                <span className="chart-legend-chip" style={{ background: CHART_COLORS.amber }}>老後資金</span>
                            </div>
                            <ResponsiveContainer width="100%" height={350}>
                                <ComposedChart data={assetHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                    <Bar dataKey="actual" name="実績" fill={CHART_COLORS.blue} radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="projected" name="見込み" fill={CHART_COLORS.red} radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="retirement" name="老後資金" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ==================== 4. 投資分析 ==================== */}
                {activeView === 'investment' && (
                    <div className="fade-in">
                        <div className="card mb-24" style={{ maxWidth: 1200 }}>
                            <div className="chart-card-title">投資推移（2%計算・万円）</div>
                            <div className="chart-legend-row">
                                <span className="chart-legend-chip" style={{ background: CHART_COLORS.blue }}>投資額累計</span>
                                <span className="chart-legend-chip" style={{ background: CHART_COLORS.amber }}>配当見込み</span>
                                <span className="chart-legend-chip" style={{ background: CHART_COLORS.red }}>配当金</span>
                            </div>
                            <ResponsiveContainer width="100%" height={350}>
                                <ComposedChart data={investmentHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                    <Bar yAxisId="right" dataKey="dividendExpected" name="配当見込み" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} />
                                    <Bar yAxisId="right" dataKey="dividendActual" name="配当金" fill={CHART_COLORS.red} radius={[3, 3, 0, 0]} />
                                    <Line yAxisId="left" type="monotone" dataKey="cumulative" name="投資額累計" stroke={CHART_COLORS.blue} strokeWidth={2.5} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ==================== 5. カテゴリ別推移 ==================== */}
                {activeView === 'category' && (
                    <div className="fade-in">
                        <div className="card mb-24" style={{ maxWidth: 1200 }}>
                            <div className="chart-card-title">金融資産推移：カテゴリ別（万円）</div>
                            <div className="chart-legend-row">
                                <span className="chart-legend-chip" style={{ background: '#f59e0b' }}>現金</span>
                                <span className="chart-legend-chip" style={{ background: '#a3e635' }}>短期資産</span>
                                <span className="chart-legend-chip" style={{ background: '#67e8f9' }}>中期(配当)</span>
                                <span className="chart-legend-chip" style={{ background: '#818cf8' }}>中期(index)</span>
                                <span className="chart-legend-chip" style={{ background: '#a78bfa' }}>老後ロック</span>
                            </div>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart data={categoryHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                                    <Bar dataKey="cash" name="現金" stackId="a" fill="#f59e0b" />
                                    <Bar dataKey="shortTerm" name="短期資産" stackId="a" fill="#a3e635" />
                                    <Bar dataKey="midDividend" name="中期(配当)" stackId="a" fill="#67e8f9" />
                                    <Bar dataKey="midIndex" name="中期(index)" stackId="a" fill="#818cf8" />
                                    <Bar dataKey="retirementLock" name="老後ロック" stackId="a" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ==================== 6. シミュレーター ==================== */}
                {activeView === 'simulator' && (
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
                                <div className="sim-legend-item"><span className="sim-legend-dot" style={{ background: CHART_COLORS.blue }}></span>楽観</div>
                                <div className="sim-legend-item"><span className="sim-legend-dot" style={{ background: CHART_COLORS.gray }}></span>中央値</div>
                                <div className="sim-legend-item"><span className="sim-legend-dot" style={{ background: CHART_COLORS.red }}></span>悲観</div>
                            </div>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={simData}>
                                    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.08} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }}
                                        tickFormatter={v => `${(v / 10000).toFixed(0)}万`} />
                                    <Tooltip formatter={(v: number) => formatYen(v)} contentStyle={TOOLTIP_STYLE} />
                                    <Area type="monotone" dataKey="楽観" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#sg)" />
                                    <Area type="monotone" dataKey="中央" stroke={CHART_COLORS.gray} strokeWidth={1.5} fill="none" />
                                    <Area type="monotone" dataKey="悲観" stroke={CHART_COLORS.red} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ==================== 7. 目標管理 ==================== */}
                {activeView === 'goals' && (
                    <div className="fade-in">
                        <div className="goals-grid">
                            {(d.goals || []).map((g, i) => {
                                const pct = Math.min(100, Math.floor((totalAssets / g.target) * 100))
                                return (
                                    <div key={i} className="goal-card">
                                        <div className="goal-name">{g.name}</div>
                                        <div className="goal-deadline">期限: {g.deadline}</div>
                                        <div className="goal-numbers">
                                            <span className="goal-current">{formatYen(totalAssets)}</span>
                                            <span className="goal-target">{formatYen(g.target)}</span>
                                        </div>
                                        <div className="goal-bar-bg"><div className="goal-bar-fill" style={{ width: `${pct}%` }}></div></div>
                                        <div className="goal-percent">{pct}%</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </main>

            {/* ===== モバイルボトムナビ ===== */}
            <nav className="mobile-nav">
                <div className="mobile-nav-inner">
                    {MOBILE_VIEWS.map(v => (
                        <button key={v.id} className={`mobile-nav-btn ${activeView === v.id ? 'active' : ''}`}
                            onClick={() => setActiveView(v.id)}>
                            <v.icon size={20} /><span>{v.label}</span>
                        </button>
                    ))}
                </div>
            </nav>

            {/* ===== モーダル ===== */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-bg" onClick={() => setShowModal(false)}></div>
                    <div className="modal-panel fade-in">
                        <div className="modal-header">
                            <h3 className="modal-title">資産を記録</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); mutation.mutate(formData) }}>
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
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })} required placeholder="0" />
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
