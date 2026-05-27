import { useState, useEffect, useCallback, useRef } from 'react'

async function t212(path, method = 'GET', body = null) {
  const res = await fetch('/api/t212', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, method, body }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `T212 error ${res.status}`)
  return data
}

function fmt(n, sym = '£') {
  if (n == null || isNaN(n)) return '—'
  return sym + Number(Math.abs(n)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPnl(n) {
  if (n == null || isNaN(n)) return { str: '—', cls: 'neu' }
  return { str: (n >= 0 ? '+' : '-') + '£' + Math.abs(n).toFixed(2), cls: n >= 0 ? 'pos' : 'neg' }
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

const WATCHLIST = ['AAPL_US_EQ','NVDA_US_EQ','MSFT_US_EQ','META_US_EQ','GOOGL_US_EQ','AMZN_US_EQ','TSLA_US_EQ','AMD_US_EQ','NFLX_US_EQ','CRM_US_EQ']

const RISK_CONFIG = [
  { key: 'STRONG_BUY size',  val: '8% of portfolio (max £2,000)' },
  { key: 'BUY size',         val: '5% of portfolio (max £2,000)' },
  { key: 'Max positions',    val: '5 concurrent' },
  { key: 'Stop-loss',        val: '6–8% below entry' },
  { key: 'Daily loss limit', val: '-15% → halt all trading', warn: true },
  { key: 'Cash reserve',     val: 'Min 20% always available' },
  { key: 'Trading hours',    val: 'Mon–Fri 14:30–21:00 UTC' },
]

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',    icon: '◈' },
  { id: 'agent',        label: 'AI Agent',     icon: '⬡' },
  { id: 'positions',    label: 'Positions',    icon: '◎' },
  { id: 'transactions', label: 'Orders',       icon: '↕' },
  { id: 'risk',         label: 'Risk',         icon: '⊿' },
  { id: 'alerts',       label: 'Alerts',       icon: '◉' },
]

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap');

  :root {
    --bg:     #080c10;
    --bg1:    #0d1117;
    --bg2:    #111820;
    --bg3:    #161e28;
    --bg4:    #1c2532;
    --bdr:    rgba(255,255,255,.06);
    --bdr2:   rgba(255,255,255,.11);
    --txt:    #e8edf2;
    --txt2:   #7a8a9a;
    --txt3:   #3d4d5c;
    --accent: #00d4a8;
    --acc2:   #00a882;
    --acc-bg: rgba(0,212,168,.08);
    --acc-bd: rgba(0,212,168,.2);
    --red:    #ff5252;
    --red-bg: rgba(255,82,82,.08);
    --amber:  #ffc14d;
    --amb-bg: rgba(255,193,77,.08);
    --blue:   #5b9cf6;
    --blu-bg: rgba(91,156,246,.08);
    --mono:   'JetBrains Mono', monospace;
    --sans:   'Syne', sans-serif;
    --r:      8px;
    --r2:     12px;
    --r3:     16px;
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  html, body, #root { height: 100%; overflow: hidden }
  body { background: var(--bg); color: var(--txt); font-family: var(--sans); -webkit-font-smoothing: antialiased }

  .hub { display: flex; height: 100vh }

  /* ── Sidebar ── */
  .sb {
    width: 220px; min-width: 220px;
    background: var(--bg1);
    border-right: 1px solid var(--bdr);
    display: flex; flex-direction: column;
    padding: 0 0 16px;
  }
  .sb-logo {
    padding: 24px 20px 20px;
    border-bottom: 1px solid var(--bdr);
    margin-bottom: 8px;
  }
  .logo-mark {
    display: flex; align-items: center; gap: 10px; margin-bottom: 4px;
  }
  .logo-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, var(--accent), #007a60);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 800; color: #000; font-family: var(--sans);
    flex-shrink: 0;
  }
  .logo-name { font-size: 15px; font-weight: 700; color: var(--txt); letter-spacing: .02em }
  .logo-sub  { font-size: 10px; color: var(--txt3); font-family: var(--mono); letter-spacing: .1em; margin-top: 2px }

  .sb-section { padding: 4px 12px; margin-bottom: 2px }
  .sb-label { font-size: 9px; color: var(--txt3); font-family: var(--mono); letter-spacing: .12em; text-transform: uppercase; padding: 6px 8px 4px }
  .sb-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: var(--r); cursor: pointer;
    font-size: 13px; font-weight: 500; color: var(--txt2);
    transition: all .15s; border: 1px solid transparent;
  }
  .sb-item:hover { color: var(--txt); background: var(--bg3) }
  .sb-item.active {
    color: var(--accent); background: var(--acc-bg);
    border-color: var(--acc-bd);
  }
  .sb-icon { width: 18px; text-align: center; font-size: 13px; flex-shrink: 0 }

  .sb-footer { margin: auto 12px 0; }
  .agent-pill {
    background: var(--bg3); border: 1px solid var(--bdr2);
    border-radius: var(--r2); padding: 12px 14px;
  }
  .agent-pill-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px }
  .agent-pill-name { font-size: 12px; font-weight: 600; color: var(--txt) }
  .ap-status { display: flex; align-items: center; gap: 6px; font-size: 10px; font-family: var(--mono) }
  .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0 }
  .dot-green { background: var(--accent); box-shadow: 0 0 8px var(--accent); animation: pulse 2s infinite }
  .dot-gray  { background: var(--txt3) }
  .dot-amber { background: var(--amber); box-shadow: 0 0 8px var(--amber) }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

  .toggle-wrap { display: flex; align-items: center; gap: 8px }
  .toggle {
    width: 38px; height: 21px; border-radius: 11px;
    border: none; cursor: pointer; position: relative;
    transition: background .2s; flex-shrink: 0;
  }
  .toggle.on  { background: var(--acc2) }
  .toggle.off { background: var(--bg4); border: 1px solid var(--bdr2) }
  .t-k {
    width: 15px; height: 15px; background: #fff; border-radius: 50%;
    position: absolute; top: 3px; transition: left .2s;
  }
  .toggle.on .t-k  { left: 20px }
  .toggle.off .t-k { left: 3px }
  .toggle-label { font-size: 10px; font-family: var(--mono); color: var(--txt3) }

  /* ── Main ── */
  .main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; background: var(--bg) }

  .topbar {
    background: var(--bg1); border-bottom: 1px solid var(--bdr);
    padding: 14px 24px; display: flex; align-items: center;
    justify-content: space-between; position: sticky; top: 0; z-index: 10;
  }
  .tb-left { display: flex; align-items: center; gap: 16px }
  .tb-title { font-size: 16px; font-weight: 700; color: var(--txt) }
  .tb-badge {
    font-size: 10px; font-family: var(--mono); padding: 3px 8px;
    border-radius: 4px; letter-spacing: .04em;
  }
  .badge-live  { background: var(--acc-bg); color: var(--accent); border: 1px solid var(--acc-bd) }
  .badge-demo  { background: var(--amb-bg); color: var(--amber);  border: 1px solid rgba(255,193,77,.25) }
  .badge-conn  { background: var(--blu-bg); color: var(--blue);   border: 1px solid rgba(91,156,246,.2) }

  .tb-right { display: flex; align-items: center; gap: 8px }
  .btn {
    font-family: var(--mono); font-size: 11px; padding: 7px 14px;
    border-radius: var(--r); border: 1px solid var(--bdr2);
    background: transparent; color: var(--txt2); cursor: pointer;
    display: flex; align-items: center; gap: 6px; transition: all .15s;
    white-space: nowrap;
  }
  .btn:hover   { color: var(--txt); background: var(--bg3) }
  .btn:disabled{ opacity: .4; cursor: not-allowed }
  .btn-accent  { border-color: var(--acc2); color: var(--accent) }
  .btn-accent:hover { background: var(--acc-bg) }
  .btn-danger  { border-color: rgba(255,82,82,.35); color: var(--red) }
  .btn-danger:hover { background: var(--red-bg) }

  /* ── Content ── */
  .content { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px }

  /* ── Metric hero ── */
  .hero-card {
    background: var(--bg1); border: 1px solid var(--bdr);
    border-radius: var(--r3); padding: 28px 32px;
    position: relative; overflow: hidden;
  }
  .hero-glow {
    position: absolute; top: -60px; right: -60px;
    width: 240px; height: 240px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,212,168,.1) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 6px }
  .hero-label { font-size: 11px; font-family: var(--mono); color: var(--txt3); letter-spacing: .12em; text-transform: uppercase }
  .period-tabs { display: flex; gap: 2px; background: var(--bg2); border-radius: 6px; padding: 3px }
  .period-tab {
    font-size: 10px; font-family: var(--mono); padding: 4px 10px;
    border-radius: 4px; cursor: pointer; color: var(--txt3); transition: all .15s;
  }
  .period-tab.active { background: var(--bg4); color: var(--txt) }

  .hero-value {
    font-size: 52px; font-weight: 800; color: var(--txt);
    letter-spacing: -.02em; line-height: 1; margin: 8px 0 10px;
    font-family: var(--sans);
  }
  .hero-change {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 14px; font-weight: 600; font-family: var(--mono);
  }
  .hero-change.up   { color: var(--accent) }
  .hero-change.down { color: var(--red) }
  .hero-sub { font-size: 11px; color: var(--txt3); font-family: var(--mono); margin-top: 4px }

  .hero-metrics {
    display: grid; grid-template-columns: repeat(4,1fr);
    gap: 1px; background: var(--bdr);
    border-top: 1px solid var(--bdr); margin-top: 24px;
  }
  .hm {
    background: var(--bg1); padding: 16px 20px;
  }
  .hm:first-child { border-radius: 0 0 0 var(--r3) }
  .hm:last-child  { border-radius: 0 0 var(--r3) 0 }
  .hm-label { font-size: 9px; font-family: var(--mono); color: var(--txt3); letter-spacing: .12em; text-transform: uppercase; margin-bottom: 6px }
  .hm-val   { font-size: 18px; font-weight: 700; color: var(--txt) }
  .hm-val.g { color: var(--accent) }
  .hm-val.r { color: var(--red) }

  /* ── Grid layouts ── */
  .grid-2   { display: grid; grid-template-columns: 1fr 320px; gap: 16px }
  .grid-2b  { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
  .col      { display: flex; flex-direction: column; gap: 16px }

  /* ── Panel ── */
  .panel { background: var(--bg1); border: 1px solid var(--bdr); border-radius: var(--r2); overflow: hidden }
  .panel-header {
    padding: 14px 18px; border-bottom: 1px solid var(--bdr);
    display: flex; align-items: center; justify-content: space-between;
  }
  .panel-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 600; color: var(--txt); letter-spacing: .02em;
  }
  .panel-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent) }
  .panel-dot.amber { background: var(--amber) }
  .panel-dot.blue  { background: var(--blue) }
  .panel-dot.red   { background: var(--red) }

  /* ── Table ── */
  .tbl-wrap { overflow-x: auto }
  table { width: 100%; border-collapse: collapse; font-family: var(--mono) }
  th {
    text-align: left; padding: 9px 16px; color: var(--txt3);
    font-size: 9px; font-weight: 400; letter-spacing: .12em;
    border-bottom: 1px solid var(--bdr); text-transform: uppercase;
  }
  td { padding: 11px 16px; border-bottom: 1px solid var(--bdr); color: var(--txt2); font-size: 11px }
  tr:last-child td { border-bottom: none }
  tr:hover td { background: var(--bg2) }
  .tk { color: var(--txt); font-weight: 500 }

  .tag {
    font-size: 9px; padding: 3px 7px; border-radius: 4px;
    letter-spacing: .05em; font-family: var(--mono); font-weight: 500;
    display: inline-block;
  }
  .tag-buy  { background: var(--acc-bg); color: var(--accent); border: 1px solid var(--acc-bd) }
  .tag-sell { background: var(--red-bg); color: var(--red);    border: 1px solid rgba(255,82,82,.2) }
  .tag-open { background: var(--blu-bg); color: var(--blue);   border: 1px solid rgba(91,156,246,.2) }
  .tag-done { background: var(--bg3);    color: var(--txt3);   border: 1px solid var(--bdr2) }

  .pos  { color: var(--accent) }
  .neg  { color: var(--red) }
  .neu  { color: var(--txt3) }

  /* ── Positions ── */
  .pos-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 18px; border-bottom: 1px solid var(--bdr);
    transition: background .1s;
  }
  .pos-item:last-child { border-bottom: none }
  .pos-item:hover { background: var(--bg2) }
  .pos-left {}
  .pos-ticker { font-size: 13px; font-weight: 700; color: var(--txt); font-family: var(--sans) }
  .pos-detail { font-size: 10px; font-family: var(--mono); color: var(--txt3); margin-top: 2px }
  .pos-right  { text-align: right }
  .pos-pnl    { font-size: 13px; font-weight: 700; font-family: var(--mono) }
  .pos-pct    { font-size: 10px; font-family: var(--mono); margin-top: 2px }

  /* ── Sparkline bar ── */
  .spark-wrap { display: flex; align-items: flex-end; gap: 3px; height: 36px; padding: 12px 18px 4px }
  .spark-bar  { flex: 1; border-radius: 2px 2px 0 0; min-height: 4px; opacity: .8 }

  /* ── Agent chat ── */
  .agent-layout { display: grid; grid-template-columns: 1fr 300px; gap: 16px }

  .chat-box {
    height: 400px; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .chat-msg {
    padding: 10px 14px; border-radius: 10px;
    font-size: 12px; line-height: 1.65; max-width: 88%;
  }
  .chat-msg.user  {
    background: var(--acc-bg); color: var(--accent);
    border: 1px solid var(--acc-bd); align-self: flex-end;
    font-family: var(--mono); font-size: 11px; border-radius: 10px 10px 2px 10px;
  }
  .chat-msg.agent {
    background: var(--bg2); color: var(--txt2);
    border: 1px solid var(--bdr2); align-self: flex-start;
    white-space: pre-wrap; border-radius: 2px 10px 10px 10px;
  }
  .chat-msg.tool  {
    background: var(--blu-bg); color: var(--blue);
    border: 1px solid rgba(91,156,246,.15); align-self: flex-start;
    font-family: var(--mono); font-size: 10px;
  }
  .chat-msg.trade {
    background: var(--acc-bg); color: var(--accent);
    border: 1px solid var(--acc-bd); align-self: flex-start;
    font-family: var(--mono); font-size: 10px; font-weight: 600;
  }
  .chat-msg.err {
    background: var(--red-bg); color: var(--red);
    border: 1px solid rgba(255,82,82,.15); align-self: flex-start;
    font-family: var(--mono); font-size: 10px;
  }

  .chat-footer { border-top: 1px solid var(--bdr); padding: 12px 16px; display: flex; flex-direction: column; gap: 8px }
  .chat-input-row { display: flex; gap: 8px }
  .chat-input {
    flex: 1; background: var(--bg2); border: 1px solid var(--bdr2);
    border-radius: var(--r); padding: 9px 14px; font-size: 12px;
    color: var(--txt); font-family: var(--sans); outline: none; transition: border-color .15s;
  }
  .chat-input:focus { border-color: var(--acc2) }
  .dryrun-row {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--mono); font-size: 10px; color: var(--txt3);
  }

  /* ── Strategy prompt ── */
  .strategy-section { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px }
  .strategy-header { font-size: 12px; font-weight: 600; color: var(--txt) }
  .strategy-hint { font-size: 11px; color: var(--txt3); font-family: var(--mono); line-height: 1.6 }
  .strategy-textarea {
    width: 100%; background: var(--bg2); border: 1px solid var(--bdr2);
    border-radius: var(--r); padding: 12px 14px; font-size: 11px;
    color: var(--txt); font-family: var(--mono); outline: none;
    resize: vertical; min-height: 120px; line-height: 1.7; transition: border-color .15s;
  }
  .strategy-textarea:focus { border-color: var(--acc2) }
  .preset-chips { display: flex; flex-wrap: wrap; gap: 6px }
  .preset-chip {
    font-size: 10px; font-family: var(--mono); padding: 4px 10px;
    border-radius: 20px; border: 1px solid var(--bdr2); background: var(--bg2);
    color: var(--txt3); cursor: pointer; transition: all .15s;
  }
  .preset-chip:hover { color: var(--accent); border-color: var(--acc-bd); background: var(--acc-bg) }

  /* ── Agent stats sidebar ── */
  .agent-stats { display: flex; flex-direction: column; gap: 12px }
  .stat-card {
    background: var(--bg2); border: 1px solid var(--bdr);
    border-radius: var(--r2); padding: 14px 16px;
  }
  .stat-label { font-size: 9px; font-family: var(--mono); color: var(--txt3); letter-spacing: .12em; text-transform: uppercase; margin-bottom: 6px }
  .stat-value { font-size: 22px; font-weight: 700; color: var(--txt); font-family: var(--sans) }
  .stat-sub   { font-size: 10px; font-family: var(--mono); color: var(--txt3); margin-top: 4px }

  /* ── Watchlist ── */
  .wl-signal {
    font-size: 9px; padding: 3px 7px; border-radius: 4px;
    font-family: var(--mono); font-weight: 600;
  }
  .sig-buy    { background: var(--acc-bg); color: var(--accent); border: 1px solid var(--acc-bd) }
  .sig-strong { background: var(--acc2); color: #000 }
  .sig-hold   { background: var(--bg3); color: var(--txt3); border: 1px solid var(--bdr2) }
  .sig-sell   { background: var(--red-bg); color: var(--red); border: 1px solid rgba(255,82,82,.2) }

  /* ── Log ── */
  .log-body { max-height: 110px; overflow-y: auto; padding: 8px 16px }
  .log-line { display: flex; gap: 12px; padding: 3px 0; font-family: var(--mono); font-size: 10px }
  .log-t    { color: var(--txt3); min-width: 40px; flex-shrink: 0 }
  .log-g    { color: var(--accent) }
  .log-r    { color: var(--red) }
  .log-a    { color: var(--amber) }
  .log-b    { color: var(--blue) }

  /* ── Risk ── */
  .info-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 11px 18px; border-bottom: 1px solid var(--bdr);
    font-family: var(--mono); font-size: 11px;
  }
  .info-row:last-child { border-bottom: none }
  .info-key { color: var(--txt3); font-size: 10px }
  .info-val { color: var(--txt) }
  .info-warn { color: var(--amber) }

  /* ── Alerts ── */
  .alerts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
  .inp-label { font-size: 10px; font-family: var(--mono); color: var(--txt3); letter-spacing: .08em; margin-bottom: 4px }
  .inp {
    width: 100%; background: var(--bg2); border: 1px solid var(--bdr2);
    border-radius: var(--r); padding: 9px 12px; font-size: 11px;
    color: var(--txt); font-family: var(--mono); outline: none; transition: border-color .15s;
  }
  .inp:focus { border-color: var(--acc2) }

  /* ── Misc ── */
  .empty {
    padding: 32px; text-align: center; font-family: var(--mono);
    font-size: 11px; color: var(--txt3); line-height: 2;
  }
  .spin-wrap { display: flex; align-items: center; gap: 8px; padding: 16px; font-family: var(--mono); font-size: 10px; color: var(--txt3) }
  .spin { width: 12px; height: 12px; border: 1.5px solid var(--bdr2); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite }
  @keyframes spin { to { transform: rotate(360deg) } }
  .err-bar {
    padding: 10px 16px; background: var(--red-bg); border: 1px solid rgba(255,82,82,.2);
    border-radius: var(--r); font-size: 11px; color: var(--red); font-family: var(--mono);
  }

  ::-webkit-scrollbar { width: 4px }
  ::-webkit-scrollbar-track { background: transparent }
  ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 2px }
`

const DEFAULT_STRATEGY_PROMPT = `You are an aggressive day trader. Your goal is to maximise returns on a £5,000 portfolio using the following approach:

- Scan the full watchlist (AAPL, NVDA, MSFT, META, GOOGL, AMZN, TSLA, AMD, NFLX, CRM)
- Buy on strong momentum signals: price above SMA20, RSI between 45-65, positive MACD
- Apply mean reversion for oversold dips: RSI below 35
- Set stop-losses at 6-8% below entry price on every position
- Never hold more than 5 positions simultaneously
- Keep at least 20% cash reserve at all times
- Prioritise risk management — preserve capital first, profit second`

const PRESET_PROMPTS = [
  { label: 'Conservative',    text: 'Focus on capital preservation. Only buy on very strong signals (RSI < 30, confirmed momentum). Keep 40% cash. Max 3 positions. Tight stop-losses at 4%.' },
  { label: 'Aggressive',      text: 'Maximise returns. Buy on moderate signals, use 8% position sizes. Accept higher risk. React quickly to momentum shifts.' },
  { label: 'Momentum only',   text: 'Only trade momentum signals: price above SMA5, SMA20, SMA50 in alignment. MACD positive. Ignore RSI. Ride trends.' },
  { label: 'Mean reversion',  text: 'Buy extreme oversold dips only: RSI below 30. Sell when RSI recovers above 55. Ignore trend direction.' },
  { label: 'News sentiment',  text: 'Prioritise stocks with positive news sentiment. Buy on bullish headlines combined with any positive technical signal.' },
]

export default function App() {
  const [page,           setPage]           = useState('dashboard')
  const [agentOn,        setAgentOn]        = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [connected,      setConnected]      = useState(false)
  const [account,        setAccount]        = useState(null)
  const [positions,      setPositions]      = useState([])
  const [orders,         setOrders]         = useState([])
  const [orderHistory,   setOrderHistory]   = useState([])
  const [period,         setPeriod]         = useState('W')
  const [chatDisplay,    setChatDisplay]    = useState([])
  const [chatHistory,    setChatHistory]    = useState([])
  const [instruction,    setInstruction]    = useState('')
  const [dryRun,         setDryRun]         = useState(true)
  const [agentLoading,   setAgentLoading]   = useState(false)
  const [lastRun,        setLastRun]        = useState(null)
  const [tradesTotal,    setTradesTotal]    = useState(0)
  const [strategyPrompt, setStrategyPrompt] = useState(DEFAULT_STRATEGY_PROMPT)
  const [logs,           setLogs]           = useState([
    { time: '—', msg: 'PDT-1 initialised', cls: 'g' },
    { time: '—', msg: 'Waiting for T212 sync', cls: 'a' },
  ])
  const logRef  = useRef(null)
  const chatRef = useRef(null)

  const addLog = useCallback((msg, cls = '') => {
    const t = new Date().toTimeString().slice(0, 5)
    setLogs(l => [...l.slice(-99), { time: t, msg, cls }])
  }, [])

  useEffect(() => {
    if (logRef.current)  logRef.current.scrollTop  = logRef.current.scrollHeight
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [logs, chatDisplay])

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [summary, pos, ords, hist] = await Promise.all([
        t212('/equity/account/summary'),
        t212('/equity/positions'),
        t212('/equity/orders'),
        t212('/equity/history/orders?limit=30'),
      ])
      setAccount(summary)
      setPositions(Array.isArray(pos) ? pos : [])
      setOrders(Array.isArray(ords) ? ords : [])
      setOrderHistory(Array.isArray(hist?.items) ? hist.items : [])
      setConnected(true)
      addLog(`Synced — ${(Array.isArray(pos) ? pos : []).length} positions, ${(Array.isArray(ords) ? ords : []).length} orders`, 'g')
    } catch (e) {
      setError(e.message); addLog('Sync failed: ' + e.message, 'r'); setConnected(false)
    } finally { setLoading(false) }
  }, [addLog])

  const cancelOrder = async id => {
    try {
      await t212(`/equity/orders/${id}`, 'DELETE')
      addLog(`Order ${id} cancelled`, 'a'); fetchAll()
    } catch (e) { addLog('Cancel failed: ' + e.message, 'r') }
  }

  const runAgent = async () => {
    const msg = instruction.trim()
    setInstruction('')
    const fullMsg = msg
      ? `${msg}\n\nUse this trading strategy:\n${strategyPrompt}`
      : `Run your full trading session.\n\nUse this trading strategy:\n${strategyPrompt}`
    if (msg) setChatDisplay(d => [...d, { role: 'user', content: msg }])
    setAgentLoading(true)
    try {
      const res = await fetch('/api/external-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: fullMsg, history: chatHistory, dryRun }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Agent error')
      data.agentLog?.forEach(l => {
        if (l.type === 'call') {
          setChatDisplay(d => [...d, { role: 'tool', content: `⟳ ${l.tool}(${JSON.stringify(l.input ?? {}).slice(0, 60)})` }])
        }
      })
      data.trades?.forEach(t => {
        const qty = t.input?.quantity ?? 0
        setChatDisplay(d => [...d, {
          role: 'trade',
          content: `${qty > 0 ? '▲ BUY' : '▼ SELL'} ${Math.abs(qty)} × ${t.input?.ticker} — ${t.input?.reason ?? t.tool}`,
        }])
      })
      setChatDisplay(d => [...d, { role: 'agent', content: data.reply }])
      setChatHistory(data.updatedHistory ?? [])
      setLastRun(new Date().toTimeString().slice(0, 5))
      setTradesTotal(t => t + (data.trades?.length ?? 0))
      addLog(`Agent run complete — ${data.trades?.length ?? 0} trades, ${data.iterations} iterations`, 'g')
      if (!dryRun) fetchAll()
    } catch (e) {
      setChatDisplay(d => [...d, { role: 'err', content: '✗ ' + e.message }])
      addLog('Agent error: ' + e.message, 'r')
    } finally { setAgentLoading(false) }
  }

  const totalValue  = account?.totalValue ?? null
  const available   = account?.cash?.availableToTrade ?? null
  const invested    = account?.investments?.currentValue ?? null
  const unrealised  = account?.investments?.unrealizedProfitLoss ?? null
  const pctChange   = totalValue && invested ? ((unrealised / (totalValue - unrealised)) * 100) : null
  const isUp        = unrealised != null ? unrealised >= 0 : true

  const allOrders = [...orders, ...orderHistory]

  return (
    <>
      <style>{CSS}</style>
      <div className="hub">

        {/* ── SIDEBAR ── */}
        <div className="sb">
          <div className="sb-logo">
            <div className="logo-mark">
              <div className="logo-icon">P</div>
              <div>
                <div className="logo-name">PDT-1</div>
              </div>
            </div>
            <div className="logo-sub">DAY TRADER HUB</div>
          </div>

          <div className="sb-section">
            <div className="sb-label">Navigation</div>
            {NAV.map(n => (
              <div
                key={n.id}
                className={`sb-item ${page === n.id ? 'active' : ''}`}
                onClick={() => setPage(n.id)}
              >
                <span className="sb-icon">{n.icon}</span>
                {n.label}
              </div>
            ))}
          </div>

          <div className="sb-footer">
            <div className="agent-pill">
              <div className="agent-pill-top">
                <span className="agent-pill-name">Agent PDT-1</span>
                <div className="ap-status">
                  <div className={`dot ${agentOn ? 'dot-green' : 'dot-gray'}`}/>
                  <span style={{ color: agentOn ? 'var(--accent)' : 'var(--txt3)', fontFamily: 'var(--mono)', fontSize: 10 }}>
                    {agentOn ? (dryRun ? 'DRY RUN' : 'LIVE') : 'OFFLINE'}
                  </span>
                </div>
              </div>
              <div className="toggle-wrap">
                <button
                  className={`toggle ${agentOn ? 'on' : 'off'}`}
                  onClick={() => { setAgentOn(a => !a); addLog(`Agent ${agentOn ? 'stopped' : 'started'}`, agentOn ? 'a' : 'g') }}
                >
                  <div className="t-k"/>
                </button>
                <span className="toggle-label">{agentOn ? 'Running' : 'Start agent'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div className="main">
          <div className="topbar">
            <div className="tb-left">
              <span className="tb-title">{NAV.find(n => n.id === page)?.label}</span>
              <span className={`tb-badge ${dryRun ? 'badge-demo' : 'badge-live'}`}>
                {dryRun ? 'Demo Mode' : '● Live Trading'}
              </span>
              {connected && <span className="tb-badge badge-conn">✓ T212 Connected</span>}
              {lastRun && <span style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>Last run {lastRun}</span>}
            </div>
            <div className="tb-right">
              <button className="btn" onClick={fetchAll} disabled={loading}>
                {loading ? <><div className="spin"/>Syncing</> : '⟳ Sync'}
              </button>
              <button className="btn btn-accent" onClick={() => { setPage('agent'); runAgent() }} disabled={agentLoading}>
                {agentLoading ? '...' : '⬡ Run Agent'}
              </button>
              <button
                className={`btn ${agentOn ? 'btn-danger' : 'btn-accent'}`}
                onClick={() => { setAgentOn(a => !a); addLog(`Agent ${agentOn ? 'stopped' : 'started'}`, agentOn ? 'a' : 'g') }}
              >
                {agentOn ? '■ Stop' : '▶ Start'}
              </button>
            </div>
          </div>

          {error && <div className="content"><div className="err-bar">⚠ {error}</div></div>}

          {/* ══ DASHBOARD ══ */}
          {page === 'dashboard' && (
            <div className="content">

              {/* Hero card */}
              <div className="hero-card">
                <div className="hero-glow"/>
                <div className="hero-top">
                  <div className="hero-label">Total Portfolio Value</div>
                  <div className="period-tabs">
                    {['W','M','Y'].map(p => (
                      <div key={p} className={`period-tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                        {p === 'W' ? 'Week' : p === 'M' ? 'Month' : 'Year'}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hero-value">{connected && totalValue != null ? fmt(totalValue) : '£—'}</div>
                <div className={`hero-change ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '▲' : '▼'}
                  {connected && unrealised != null ? fmt(Math.abs(unrealised)) : '—'}
                  <span style={{ opacity: .6, fontSize: 12 }}>
                    {connected && pctChange != null ? `(${fmtPct(pctChange)})` : ''}
                  </span>
                </div>
                <div className="hero-sub">
                  {period === 'W' ? 'This week' : period === 'M' ? 'This month' : 'This year'} · Unrealised P&L
                </div>

                <div className="hero-metrics">
                  <div className="hm">
                    <div className="hm-label">Available Cash</div>
                    <div className="hm-val">{connected && available != null ? fmt(available) : '—'}</div>
                  </div>
                  <div className="hm">
                    <div className="hm-label">Invested</div>
                    <div className="hm-val">{connected && invested != null ? fmt(invested) : '—'}</div>
                  </div>
                  <div className="hm">
                    <div className="hm-label">Open Positions</div>
                    <div className="hm-val">{connected ? positions.length : '—'}</div>
                  </div>
                  <div className="hm">
                    <div className="hm-label">Agent Trades</div>
                    <div className={`hm-val ${tradesTotal > 0 ? 'g' : ''}`}>{tradesTotal}</div>
                  </div>
                </div>
              </div>

              <div className="grid-2">
                {/* Positions */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title"><div className="panel-dot"/>Open Positions</div>
                    <span style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>{positions.length} active</span>
                  </div>
                  {loading ? <div className="spin-wrap"><div className="spin"/>Loading…</div>
                  : positions.length === 0
                    ? <div className="empty">{connected ? 'No open positions' : 'Sync to load data'}</div>
                    : positions.slice(0, 6).map((p, i) => {
                        const pnl   = p.ppl ?? p.unrealizedProfitLoss ?? 0
                        const pnlPct = p.averagePrice ? (pnl / (p.averagePrice * p.quantity)) * 100 : 0
                        return (
                          <div className="pos-item" key={i}>
                            <div className="pos-left">
                              <div className="pos-ticker">{(p.ticker ?? '').replace('_US_EQ', '')}</div>
                              <div className="pos-detail">{p.quantity} shares · avg {fmt(p.averagePrice)}</div>
                            </div>
                            <div className="pos-right">
                              <div className={`pos-pnl ${pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPnl(pnl).str}</div>
                              <div className={`pos-pct ${pnl >= 0 ? 'pos' : 'neg'}`}>{fmtPct(pnlPct)}</div>
                            </div>
                          </div>
                        )
                      })
                  }
                </div>

                {/* Right col */}
                <div className="col">
                  {/* Recent orders */}
                  <div className="panel">
                    <div className="panel-header">
                      <div className="panel-title"><div className="panel-dot amber"/>Recent Orders</div>
                      <button className="btn" style={{ fontSize: 9, padding: '3px 8px' }} onClick={() => setPage('transactions')}>View all</button>
                    </div>
                    {allOrders.length === 0
                      ? <div className="empty" style={{ padding: 16 }}>{connected ? 'No orders' : 'Sync first'}</div>
                      : allOrders.slice(0, 4).map((tx, i) => {
                          const qty  = tx.quantity ?? tx.filledQuantity ?? 0
                          const side = qty < 0 ? 'sell' : 'buy'
                          const price = tx.limitPrice ?? tx.fillPrice ?? null
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: i < 3 ? '1px solid var(--bdr)' : 'none' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', fontFamily: 'var(--sans)' }}>{(tx.ticker ?? '').replace('_US_EQ', '')}</div>
                                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--txt3)', marginTop: 2 }}>{Math.abs(qty)} shares</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span className={`tag tag-${side}`}>{side.toUpperCase()}</span>
                                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--txt3)', marginTop: 4 }}>{price ? fmt(price) : 'MKT'}</div>
                              </div>
                            </div>
                          )
                        })
                    }
                  </div>

                  {/* Agent log */}
                  <div className="panel">
                    <div className="panel-header">
                      <div className="panel-title"><div className="panel-dot blue"/>Agent Log</div>
                      <button className="btn" style={{ fontSize: 9, padding: '3px 8px' }} onClick={() => setLogs([])}>Clear</button>
                    </div>
                    <div className="log-body" ref={logRef}>
                      {logs.map((l, i) => (
                        <div className="log-line" key={i}>
                          <span className="log-t">{l.time}</span>
                          <span className={`log-${l.cls || 'txt2'}`} style={{ color: !l.cls ? 'var(--txt2)' : undefined }}>{l.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ AI AGENT ══ */}
          {page === 'agent' && (
            <div className="content">
              <div className="agent-layout">
                {/* Chat panel */}
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title"><div className="panel-dot"/>AI Agent — PDT-1</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, color: dryRun ? 'var(--amber)' : 'var(--accent)', fontFamily: 'var(--mono)' }}>
                        {dryRun ? '◯ Dry Run' : '● Live'}
                      </span>
                      <button className="btn" style={{ fontSize: 9, padding: '3px 8px' }} onClick={() => { setChatDisplay([]); setChatHistory([]) }}>Clear</button>
                    </div>
                  </div>

                  <div className="chat-box" ref={chatRef}>
                    {chatDisplay.length === 0 && (
                      <div className="empty" style={{ marginTop: 40 }}>
                        Agent ready. Try asking:<br/>
                        <span style={{ color: 'var(--acc2)', fontFamily: 'var(--mono)', fontSize: 10 }}>
                          "Run a full trading session"<br/>
                          "What signals do you see right now?"<br/>
                          "Review my positions and adjust stop-losses"<br/>
                          "Close anything down more than 5%"
                        </span>
                      </div>
                    )}
                    {chatDisplay.map((m, i) => (
                      <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
                    ))}
                    {agentLoading && (
                      <div className="chat-msg agent">
                        <div className="spin-wrap" style={{ padding: 0 }}><div className="spin"/>Analysing market…</div>
                      </div>
                    )}
                  </div>

                  <div className="chat-footer">
                    <div className="dryrun-row">
                      <button className={`toggle ${!dryRun ? 'on' : 'off'}`} style={{ width: 32, height: 18 }} onClick={() => setDryRun(d => !d)}>
                        <div className="t-k" style={{ width: 12, height: 12 }}/>
                      </button>
                      <span>{dryRun ? 'Dry run — no real orders will be placed' : '⚠ Live — agent WILL place real orders'}</span>
                    </div>
                    <div className="chat-input-row">
                      <input
                        className="chat-input"
                        placeholder="Instruction to the agent, or press Run for a full session…"
                        value={instruction}
                        onChange={e => setInstruction(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !agentLoading && runAgent()}
                      />
                      <button className="btn btn-accent" onClick={runAgent} disabled={agentLoading}>
                        {agentLoading ? '…' : '▶ Run'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right stats */}
                <div className="agent-stats">
                  <div className="stat-card">
                    <div className="stat-label">Trades This Session</div>
                    <div className="stat-value">{tradesTotal}</div>
                    <div className="stat-sub">{dryRun ? 'dry run mode' : 'live execution'}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Watchlist</div>
                    <div className="stat-value">{WATCHLIST.length}</div>
                    <div className="stat-sub">tickers monitored</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Last Run</div>
                    <div className="stat-value" style={{ fontSize: 18 }}>{lastRun ?? '—'}</div>
                    <div className="stat-sub">today</div>
                  </div>

                  {/* Strategy prompt preview */}
                  <div className="panel">
                    <div className="panel-header">
                      <div className="panel-title"><div className="panel-dot"/>Strategy</div>
                      <button className="btn" style={{ fontSize: 9, padding: '3px 8px' }} onClick={() => setPage('strategies')}>Edit</button>
                    </div>
                    <div style={{ padding: '12px 16px', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--txt3)', lineHeight: 1.7, maxHeight: 120, overflow: 'hidden', position: 'relative' }}>
                      {strategyPrompt.slice(0, 160)}…
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, background: 'linear-gradient(transparent, var(--bg1))' }}/>
                    </div>
                  </div>

                  {/* Watchlist */}
                  <div className="panel">
                    <div className="panel-header">
                      <div className="panel-title"><div className="panel-dot blue"/>Watchlist</div>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                      {WATCHLIST.map((tk, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt)', fontFamily: 'var(--sans)' }}>{tk.replace('_US_EQ', '')}</span>
                          <span className="wl-signal sig-hold">—</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ STRATEGIES (now a prompt editor) ══ */}
          {page === 'strategies' && (
            <div className="content">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><div className="panel-dot"/>Trading Strategy Prompt</div>
                  <button className="btn btn-accent" style={{ fontSize: 10 }} onClick={() => addLog('Strategy saved', 'g')}>Save</button>
                </div>
                <div className="strategy-section">
                  <div className="strategy-hint">
                    Write plain English instructions describing how the agent should trade. This prompt is sent with every agent run and shapes all trading decisions.
                  </div>
                  <textarea
                    className="strategy-textarea"
                    value={strategyPrompt}
                    onChange={e => setStrategyPrompt(e.target.value)}
                    rows={10}
                  />
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--txt3)', marginBottom: 8, letterSpacing: '.08em' }}>QUICK PRESETS</div>
                    <div className="preset-chips">
                      {PRESET_PROMPTS.map((p, i) => (
                        <div
                          key={i}
                          className="preset-chip"
                          onClick={() => setStrategyPrompt(p.text)}
                        >
                          {p.label}
                        </div>
                      ))}
                      <div className="preset-chip" onClick={() => setStrategyPrompt(DEFAULT_STRATEGY_PROMPT)}>
                        ↺ Reset default
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><div className="panel-dot blue"/>Tips for writing a good strategy</div>
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['Be specific about entry conditions', 'Mention indicators like RSI, MACD, SMA crossovers, or news sentiment rather than vague terms like "good signals".'],
                    ['Set position sizing rules', 'Tell the agent what % of portfolio to use per trade, and the maximum number of concurrent positions.'],
                    ['Always include a stop-loss rule', 'Without one, the agent may hold losing positions indefinitely. E.g. "set stop-loss at 6% below entry".'],
                    ['Specify risk tolerance', 'Mention how much total portfolio loss should trigger a halt. E.g. "stop all trading if daily loss exceeds 15%".'],
                    ['State cash reserve requirements', 'E.g. "always keep at least 20% cash available" prevents the agent from being fully invested.'],
                  ].map(([title, desc], i) => (
                    <div key={i} style={{ borderLeft: '2px solid var(--bdr2)', paddingLeft: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--mono)', lineHeight: 1.6 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ POSITIONS ══ */}
          {page === 'positions' && (
            <div className="content">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><div className="panel-dot"/>Open Positions</div>
                  <span style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>{positions.length} active</span>
                </div>
                {loading
                  ? <div className="spin-wrap"><div className="spin"/>Loading…</div>
                  : positions.length === 0
                    ? <div className="empty">{connected ? 'No open positions' : 'Run Sync to load data'}</div>
                    : <div className="tbl-wrap">
                        <table>
                          <thead>
                            <tr><th>Ticker</th><th>Qty</th><th>Avg Price</th><th>Current</th><th>P&L</th><th>P&L %</th></tr>
                          </thead>
                          <tbody>
                            {positions.map((p, i) => {
                              const pnl = p.ppl ?? p.unrealizedProfitLoss ?? 0
                              const pnlPct = p.averagePrice ? (pnl / (p.averagePrice * p.quantity)) * 100 : 0
                              return (
                                <tr key={i}>
                                  <td><span className="tk">{(p.ticker ?? '').replace('_US_EQ', '')}</span></td>
                                  <td>{p.quantity}</td>
                                  <td>{fmt(p.averagePrice)}</td>
                                  <td>{fmt(p.currentPrice)}</td>
                                  <td><span className={pnl >= 0 ? 'pos' : 'neg'}>{fmtPnl(pnl).str}</span></td>
                                  <td><span className={pnl >= 0 ? 'pos' : 'neg'}>{fmtPct(pnlPct)}</span></td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                }
              </div>
            </div>
          )}

          {/* ══ TRANSACTIONS ══ */}
          {page === 'transactions' && (
            <div className="content">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><div className="panel-dot"/>Orders</div>
                  <span style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>{allOrders.length} total</span>
                </div>
                <div className="tbl-wrap">
                  {loading
                    ? <div className="spin-wrap"><div className="spin"/>Loading…</div>
                    : allOrders.length === 0
                      ? <div className="empty">{connected ? 'No orders found' : 'Run Sync to load data'}</div>
                      : <table>
                          <thead>
                            <tr><th>Ticker</th><th>Side</th><th>Qty</th><th>Price</th><th>Status</th><th>Date</th><th></th></tr>
                          </thead>
                          <tbody>
                            {allOrders.map((tx, i) => {
                              const qty    = tx.quantity ?? tx.filledQuantity ?? 0
                              const price  = tx.limitPrice ?? tx.fillPrice ?? tx.stopPrice ?? null
                              const side   = qty < 0 ? 'sell' : 'buy'
                              const time   = tx.dateCreated ? new Date(tx.dateCreated).toLocaleString('en-GB') : '—'
                              const isOpen = !tx.dateExecuted && !tx.dateModified
                              return (
                                <tr key={i}>
                                  <td><span className="tk">{(tx.ticker ?? '').replace('_US_EQ', '')}</span></td>
                                  <td><span className={`tag tag-${side}`}>{side.toUpperCase()}</span></td>
                                  <td>{Math.abs(qty)}</td>
                                  <td>{price ? fmt(price) : 'MKT'}</td>
                                  <td><span className={`tag ${isOpen ? 'tag-open' : 'tag-done'}`}>{isOpen ? 'OPEN' : 'FILLED'}</span></td>
                                  <td style={{ color: 'var(--txt3)', fontSize: 10 }}>{time}</td>
                                  <td>
                                    {isOpen && (
                                      <button className="btn btn-danger" style={{ fontSize: 9, padding: '2px 7px' }} onClick={() => cancelOrder(tx.id)}>
                                        Cancel
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                  }
                </div>
              </div>
            </div>
          )}

          {/* ══ RISK ══ */}
          {page === 'risk' && (
            <div className="content">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><div className="panel-dot amber"/>Risk Controls</div>
                </div>
                {RISK_CONFIG.map((r, i) => (
                  <div className="info-row" key={i}>
                    <span className="info-key">{r.key}</span>
                    <span className={r.warn ? 'info-warn' : 'info-val'}>{r.val}</span>
                  </div>
                ))}
              </div>
              <div className="panel" style={{ border: '1px solid rgba(255,82,82,.2)', background: 'var(--red-bg)' }}>
                <div className="panel-header">
                  <div className="panel-title"><div className="panel-dot red"/>Disclaimer</div>
                </div>
                <div style={{ padding: '14px 18px', fontSize: 12, color: 'var(--red)', lineHeight: 1.7 }}>
                  This agent uses real money on your Trading 212 account. Automated trading carries significant risk of loss. Always test in Dry Run mode first. Risk controls are enforced via AI instructions — not hard technical limits. You are responsible for all trades placed.
                </div>
              </div>
            </div>
          )}

          {/* ══ ALERTS ══ */}
          {page === 'alerts' && (
            <div className="content">
              <div className="alerts-grid">
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title"><div className="panel-dot"/>Email Alerts — Resend</div>
                  </div>
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div><div className="inp-label">RESEND_API_KEY</div><input className="inp" type="password" placeholder="re_xxxxxxxxxxxx" readOnly/></div>
                    <div><div className="inp-label">ALERT_EMAIL</div><input className="inp" type="email" placeholder="you@email.com" readOnly/></div>
                    <div><div className="inp-label">ALERT_FROM_EMAIL</div><input className="inp" placeholder="alerts@yourdomain.com" readOnly/></div>
                    <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--mono)' }}>
                      Sign up free at resend.com → get API key → add to Vercel env vars
                    </div>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title"><div className="panel-dot blue"/>SMS Alerts — Twilio</div>
                  </div>
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div><div className="inp-label">TWILIO_ACCOUNT_SID</div><input className="inp" type="password" placeholder="ACxxxxxxxxxxxxxxxxx" readOnly/></div>
                    <div><div className="inp-label">TWILIO_AUTH_TOKEN</div><input className="inp" type="password" placeholder="your auth token" readOnly/></div>
                    <div><div className="inp-label">TWILIO_FROM_PHONE</div><input className="inp" placeholder="+14155551234" readOnly/></div>
                    <div><div className="inp-label">ALERT_PHONE</div><input className="inp" placeholder="+447700900000" readOnly/></div>
                  </div>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title"><div className="panel-dot"/>Alert Triggers</div>
                </div>
                {[
                  ['Every trade placed',       'Immediate — BUY/SELL with ticker, qty, price, reason'],
                  ['Stop-loss triggered',       'Immediate — which position, loss amount'],
                  ['Daily loss > 10%',          'Warning alert — agent continues'],
                  ['Daily loss > 15%',          'Critical — agent halts all trading'],
                  ['End of session summary',    'Full P&L, trades placed, watchlist scores'],
                  ['Cron run complete',         'Every 15 min during market hours'],
                ].map(([k, v], i) => (
                  <div className="info-row" key={i}>
                    <span className="info-key">{k}</span>
                    <span style={{ fontSize: 10, color: 'var(--txt2)', textAlign: 'right', maxWidth: 260, fontFamily: 'var(--mono)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
