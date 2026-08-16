"""
Quick mockup HTML viewer for precomputed discovery hubs.

Served directly from FastAPI so the team can browse every pre-researched hub
before the real Next.js canvas is rebuilt. Routes:
  GET /view              -> index of all hubs (searchable / filterable)
  GET /view/{hub_id}     -> full article-style page (dossier + branches +
                            follow-up Q&A + live deep research)
"""

import html
import os
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

from app.services.precompute import get_precomputed_hub, list_precomputed_hubs
from app.services.research_agent import get_dossier

router = APIRouter(tags=["Mockup Viewer"])

CF_PROXY_URL = os.getenv("NEXT_PUBLIC_CF_PROXY_URL", "").rstrip("/")


def _asset(url: str | None) -> str:
    """Route visual assets through the Cloudflare edge proxy when configured."""
    if not url:
        return ""
    if CF_PROXY_URL:
        return f"{CF_PROXY_URL}/media?url={quote(url, safe='')}"
    return url


def _page(title: str, body: str) -> HTMLResponse:
    return HTMLResponse(
        f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · TDILEARNED</title>
<style>
  :root {{ color-scheme: dark; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ background: #0b0f17; color: #e5e7eb; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.55; }}
  a {{ color: #7dd3fc; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  .wrap {{ max-width: 980px; margin: 0 auto; padding: 24px 20px 100px; }}
  header.top {{ display: flex; align-items: baseline; gap: 16px; padding: 20px 0 24px; border-bottom: 1px solid #1f2937; }}
  header.top h1 {{ font-size: 22px; font-weight: 800; letter-spacing: 0.02em; }}
  header.top h1 span {{ color: #22d3ee; }}
  header.top .count {{ color: #94a3b8; font-size: 13px; }}
  .crumb {{ color: #94a3b8; font-size: 13px; margin-bottom: 10px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; margin-top: 20px; }}
  .card {{ background: #111827; border: 1px solid #1f2937; border-radius: 14px; overflow: hidden; transition: border-color .15s, transform .15s; }}
  .card:hover {{ border-color: #22d3ee; transform: translateY(-2px); }}
  .card img {{ width: 100%; height: 145px; object-fit: cover; background: #1f2937; }}
  .card .body {{ padding: 14px 16px 16px; }}
  .card h3 {{ font-size: 15px; margin-bottom: 6px; line-height: 1.3; }}
  .card p {{ color: #94a3b8; font-size: 13px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }}
  .tag {{ display: inline-block; background: #164e63; color: #67e8f9; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; margin-bottom: 8px; }}
  .cat-nav {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }}
  .cat-nav a {{ font-size: 12px; background: #1f2937; color: #cbd5e1; padding: 4px 10px; border-radius: 999px; }}
  .cat-nav a.on {{ background: #22d3ee; color: #083344; font-weight: 700; }}
  .search {{ width: 100%; background: #111827; border: 1px solid #374151; color: #e5e7eb; padding: 10px 14px; border-radius: 10px; font-size: 14px; margin-top: 16px; }}
  .search:focus {{ outline: none; border-color: #22d3ee; }}
  .hero {{ display: grid; grid-template-columns: 340px 1fr; gap: 26px; margin-top: 20px; align-items: start; }}
  @media (max-width: 820px) {{ .hero {{ grid-template-columns: 1fr; }} }}
  .hero img {{ width: 100%; height: 260px; object-fit: cover; border-radius: 16px; border: 1px solid #1f2937; }}
  .hero h2 {{ font-size: 27px; line-height: 1.15; margin-bottom: 6px; }}
  .hero .meta {{ color: #94a3b8; font-size: 13px; margin-bottom: 12px; }}
  .hero p.lead {{ color: #d1d5db; font-size: 15px; }}
  .wow {{ background: linear-gradient(135deg, #0f172a, #172554); border: 1px solid #1e3a8a; border-radius: 12px; padding: 12px 16px; margin-top: 14px; font-size: 13.5px; color: #c7d2fe; }}
  .wow b {{ color: #a5b4fc; }}
  .section {{ margin-top: 36px; }}
  .section h3 {{ font-size: 18px; margin-bottom: 14px; color: #f1f5f9; border-left: 3px solid #22d3ee; padding-left: 10px; }}
  .branch {{ background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 16px 18px; margin-bottom: 14px; display: flex; gap: 18px; }}
  .branch img {{ width: 150px; height: 110px; object-fit: cover; border-radius: 10px; flex-shrink: 0; }}
  .branch h4 {{ font-size: 15px; margin-bottom: 6px; }}
  .branch p {{ color: #94a3b8; font-size: 13px; }}
  .branch .meta {{ color: #64748b; font-size: 12px; margin-top: 8px; }}
  .holes {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }}
  .holes span {{ background: #1e293b; color: #a5b4fc; font-size: 11px; padding: 3px 9px; border-radius: 999px; }}
  .btn {{ display: inline-block; background: #22d3ee; color: #083344; font-weight: 700; font-size: 13px; padding: 8px 16px; border-radius: 10px; margin: 4px 6px 4px 0; border: none; cursor: pointer; }}
  .btn.ghost {{ background: #1e293b; color: #cbd5e1; }}
  .btn:hover {{ background: #67e8f9; }}
  .btn:disabled {{ opacity: .5; cursor: wait; }}
  .dossier {{ background: #0f172a; border: 1px solid #334155; border-radius: 14px; padding: 18px 22px; }}
  .dossier h4 {{ color: #67e8f9; font-size: 15px; margin-bottom: 10px; }}
  .dossier p {{ color: #cbd5e1; font-size: 14px; margin-bottom: 10px; }}
  .kicker {{ color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px; }}
  .tl {{ border-left: 2px solid #1e3a8a; margin: 14px 0; padding-left: 16px; }}
  .tl .ev {{ margin-bottom: 14px; }}
  .tl .dt {{ color: #67e8f9; font-weight: 700; font-size: 13px; }}
  .tl .hd {{ font-weight: 600; font-size: 14px; margin-top: 2px; }}
  .tl .ds {{ color: #94a3b8; font-size: 13px; }}
  .mech {{ background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }}
  .mech h5 {{ font-size: 14px; color: #fbbf24; margin-bottom: 6px; }}
  .mech p {{ color: #cbd5e1; font-size: 13px; margin-bottom: 6px; }}
  .mech ul {{ color: #94a3b8; font-size: 12.5px; padding-left: 18px; }}
  .gal {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }}
  .gal figure {{ border-radius: 10px; overflow: hidden; background: #111827; border: 1px solid #1f2937; }}
  .gal img {{ width: 100%; height: 110px; object-fit: cover; }}
  .gal figcaption {{ font-size: 11px; color: #94a3b8; padding: 6px 8px; }}
  .src {{ background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }}
  .src .t {{ font-weight: 600; font-size: 13.5px; }}
  .src .p {{ color: #64748b; font-size: 12px; }}
  .src p {{ color: #94a3b8; font-size: 12.5px; margin-top: 4px; }}
  .geo {{ background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 14px 16px; font-size: 13.5px; }}
  .geo b {{ color: #67e8f9; }}
  .qa {{ margin-top: 18px; }}
  .qa textarea {{ width: 100%; background: #111827; border: 1px solid #374151; color: #e5e7eb; border-radius: 12px; padding: 12px 14px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 60px; }}
  .qa textarea:focus {{ outline: none; border-color: #22d3ee; }}
  .chatlog {{ margin-top: 14px; }}
  .msg {{ background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; font-size: 14px; color: #d1d5db; white-space: pre-wrap; }}
  .msg .hint {{ color: #64748b; font-size: 12px; }}
  .msg .cite {{ color: #7dd3fc; font-size: 12px; display: block; margin-top: 6px; }}
  .trace {{ font-size: 12px; color: #64748b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 4px 0; }}
  .trace.tool {{ color: #fbbf24; }}
  .trace.src {{ color: #86efac; }}
  .live {{ font-size: 12px; color: #f472b6; font-family: ui-monospace, monospace; }}
  .spinner {{ display: inline-block; width: 11px; height: 11px; border: 2px solid #334155; border-top-color: #22d3ee; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: middle; }}
  @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
  .empty {{ color: #64748b; text-align: center; padding: 60px 0; }}
</style>
</head>
<body>
  <div class="wrap">
    {body}
  </div>
</body>
</html>"""
    )


def _hub_card(h: dict) -> str:
    img = (
        f'<img src="{html.escape(_asset(h.get("imageUrl")))}" alt="" loading="lazy">'
        if h.get("imageUrl")
        else '<div style="height:145px;background:#1f2937"></div>'
    )
    return f"""<a class="card" href="/view/{html.escape(h["id"])}">
      {img}
      <div class="body">
        <span class="tag">{html.escape(h.get("category") or "")}</span>
        <h3>{html.escape(h.get("topic") or "")}</h3>
        <p>{html.escape(h.get("summary") or "")}</p>
      </div>
    </a>"""


@router.get("/view", response_class=HTMLResponse)
async def view_index(
    category: str = Query("", description="Filter hubs by category"),
    q: str = Query("", description="Search hubs by title"),
):
    hubs = list_precomputed_hubs()

    cats = sorted({h.get("category", "") for h in hubs})
    if category and category not in cats:
        raise HTTPException(status_code=404, detail="Category not found")

    filtered = hubs
    if category:
        filtered = [h for h in hubs if h.get("category") == category]
    if q:
        needle = q.lower()
        filtered = [h for h in filtered if needle in (h.get("topic") or "").lower()]

    cat_links = "".join(
        f'<a href="/view?category={quote(c)}" class="{"on" if c == category else ""}">{html.escape(c)}</a>'
        for c in cats
    )
    all_link = (
        '<a href="/view" class="on" style="background:#22d3ee;color:#083344">All</a>'
        if not category
        else '<a href="/view">All</a>'
    )
    cards = "".join(_hub_card(h) for h in filtered) or '<div class="empty">No hubs match that filter.</div>'

    body = f"""<header class="top">
      <h1>TDILEARNED <span>Hub Browser</span></h1>
      <div class="count">{len(hubs)} pre-researched hubs · cached locally</div>
    </header>
    <form method="get" action="/view">
      <input class="search" type="search" name="q" placeholder="Search hubs…" value="{html.escape(q)}">
    </form>
    <div class="cat-nav">{all_link}{cat_links}</div>
    <div class="grid">{cards}</div>"""

    return _page("Hub Browser", body)


def _timeline_html(d: dict) -> str:
    events = d.get("timeline") or []
    if not events:
        return ""
    items = "".join(
        f"""<div class="ev"><div class="dt">{html.escape(e.get("date", ""))}</div>
        <div class="hd">{html.escape(e.get("headline", ""))}</div>
        <div class="ds">{html.escape(e.get("description", ""))}</div></div>"""
        for e in events
    )
    return f"""<div class="section"><h3>Timeline</h3><div class="tl">{items}</div></div>"""


def _mechanisms_html(d: dict) -> str:
    mechs = d.get("mechanisms") or []
    if not mechs:
        return ""
    items = "".join(
        f"""<div class="mech"><h5>{html.escape(m.get("title", ""))}</h5>
        <p>{html.escape(m.get("explanation", ""))}</p>
        <ul>{"".join(f"<li>{html.escape(b)}</li>" for b in (m.get("bulletPoints") or []))}</ul></div>"""
        for m in mechs
    )
    return f"""<div class="section"><h3>How it Works</h3>{items}</div>"""


def _gallery_html(d: dict) -> str:
    items = d.get("gallery") or []
    if not items:
        return ""
    figs = "".join(
        f"""<figure><img src="{html.escape(_asset(i.get("imageUrl")))}" loading="lazy" alt="">
        <figcaption>{html.escape(i.get("caption", "")[:90])}</figcaption></figure>"""
        for i in items
    )
    return f"""<div class="section"><h3>Gallery</h3><div class="gal">{figs}</div></div>"""


def _sources_html(d: dict) -> str:
    sources = d.get("sources") or []
    if not sources:
        return ""
    items = "".join(
        f"""<div class="src"><div class="t"><a href="{html.escape(s.get("url", "#"))}" target="_blank" rel="noopener">{html.escape(s.get("title", "Untitled"))}</a></div>
        <div class="p">{html.escape(s.get("publisher") or "")} · reliability {html.escape(str(s.get("reliabilityScore", "")))}</div>
        <p>{html.escape((s.get("snippet") or "")[:220])}</p></div>"""
        for s in sources
    )
    return f"""<div class="section"><h3>Sources &amp; Citations ({len(sources)})</h3>{items}</div>"""


def _geo_html(d: dict) -> str:
    g = d.get("geography")
    if not g:
        return ""
    return f"""<div class="section"><h3>Geography</h3><div class="geo"><b>{html.escape(g.get("locationName", ""))}</b>
      · {html.escape(str(g.get("latitude", "")))}, {html.escape(str(g.get("longitude", "")))}
      <p style="margin-top:6px;color:#94a3b8">{html.escape(g.get("historicalSignificance", ""))}</p></div></div>"""


def _rabbit_holes_html(d: dict) -> str:
    holes = d.get("rabbitHoles") or []
    if not holes:
        return ""
    items = "".join(
        f"""<div class="branch"><div><h4>{html.escape(r.get("title", ""))}</h4>
        <p>{html.escape(r.get("teaser", ""))}</p>
        <div class="meta">{html.escape(r.get("affinityCategory", ""))}</div></div></div>"""
        for r in holes
    )
    return f"""<div class="section"><h3>Keep Exploring</h3>{items}</div>"""


@router.get("/view/{hub_id}", response_class=HTMLResponse)
async def view_hub(hub_id: str):
    hub = get_precomputed_hub(hub_id)
    if hub is None:
        raise HTTPException(status_code=404, detail="Hub not found")

    hero = (
        f'<img src="{html.escape(_asset(hub.root.imageUrl))}" alt="">'
        if hub.root.imageUrl
        else '<div style="height:260px;background:#1f2937;border-radius:16px"></div>'
    )
    coords = ""
    if hub.root.coordinates and hub.root.coordinates.location_name:
        coords = f" · {html.escape(hub.root.coordinates.location_name)}"
    root_holes = "".join(f"<span>{html.escape(h)}</span>" for h in hub.root.rabbit_holes)
    wow = ""
    if hub.root.wow_fact:
        wow = f'<div class="wow"><b>Wow.</b> {html.escape(hub.root.wow_fact)}</div>'

    branches = ""
    for c in hub.children:
        img = (
            f'<img src="{html.escape(_asset(c.imageUrl))}" alt="">'
            if c.imageUrl
            else '<div style="width:150px;height:110px;background:#1f2937;border-radius:10px;flex-shrink:0"></div>'
        )
        choles = "".join(f"<span>{html.escape(r)}</span>" for r in c.rabbit_holes)
        cm = c.timestamp or ""
        if c.coordinates and c.coordinates.location_name:
            cm = f"{cm} · {html.escape(c.coordinates.location_name)}"
        branches += f"""<div class="branch">
          {img}
          <div>
            <h4>{html.escape(c.title)}</h4>
            <p>{html.escape(c.summary)}</p>
            <div class="holes">{choles}</div>
            <div class="meta">{cm}</div>
          </div>
        </div>"""
    if not branches:
        branches = '<div class="empty">No child branches were produced for this hub.</div>'

    d = get_dossier(hub.root.id) or {}
    dossier_head = ""
    if d:
        dossier_head = f"""<div class="section"><h3>Article</h3><div class="dossier">
          <div class="kicker">Tagline</div><h4>{html.escape(d.get("tagline", ""))}</h4>
          <p>{html.escape(d.get("abstract", ""))}</p>
          <p><b style="color:#67e8f9">Core thesis:</b> {html.escape(d.get("coreThesis", ""))}</p>
          <p class="trace">Era: {html.escape(str(d.get("era", "")))} · Curiosity score: {html.escape(str(d.get("curiosityScore", "")))}/10</p>
        </div></div>"""
        if d.get("wowFact"):
            wow = f'<div class="wow"><b>Wow.</b> {html.escape(d["wowFact"])}</div>'

    body = f"""<div class="crumb"><a href="/view">← All hubs</a> / {html.escape(hub.category)}</div>
    <div class="hero">
      {hero}
      <div>
        <span class="tag">{html.escape(hub.category)}</span>
        <h2>{html.escape(hub.root.title)}</h2>
        <div class="meta">Source topic: <strong>{html.escape(hub.topic)}</strong>{coords}</div>
        <p class="lead">{html.escape(hub.root.summary)}</p>
        <div class="holes">{root_holes}</div>
        {wow}
      </div>
    </div>

    {dossier_head}
    {_timeline_html(d)}
    {_mechanisms_html(d)}
    {_gallery_html(d)}
    {_geo_html(d)}
    {_sources_html(d)}
    {_rabbit_holes_html(d)}

    <div class="section"><h3>Child Branches ({len(hub.children)})</h3>{branches}</div>

    <div class="section"><h3>Follow-up Q&amp;A</h3>
      <div class="qa">
        <textarea id="qbox" placeholder="Ask anything about this topic — the agent runs a live grounded search and streams a cited answer…"></textarea>
        <button class="btn" id="askBtn" onclick="askFollowUp()">Ask</button>
        <button class="btn ghost" id="researchBtn" onclick="deepResearch()">Deep-research this topic</button>
      </div>
      <div class="chatlog" id="chatlog"></div>
    </div>

    <div class="section" style="margin-top:20px">
      <button class="btn ghost" onclick="window.open('/api/v1/graph/precomputed/{hub_id}','_blank')">Hub JSON</button>
      <button class="btn ghost" onclick="window.open('/api/v1/research/dossier/{html.escape(hub.root.id)}','_blank')">Dossier JSON</button>
    </div>

<script>
const NODE_TITLE = {html.escape(json_dumps(hub.root.title))};
const ROOT_ID = {html.escape(json_dumps(hub.root.id))};
const CATEGORY = {html.escape(json_dumps(hub.category))};

function log(msg, cls) {{
  const el = document.createElement('div');
  el.className = 'msg' + (cls ? ' ' + cls : '');
  el.innerHTML = msg;
  document.getElementById('chatlog').appendChild(el);
  el.scrollIntoView({{behavior:'smooth', block:'nearest'}});
}}
function trace(msg, cls) {{
  const el = document.createElement('div');
  el.className = 'trace' + (cls ? ' ' + cls : '');
  el.textContent = msg;
  document.getElementById('chatlog').appendChild(el);
}}
function setBusy(on) {{
  document.getElementById('askBtn').disabled = on;
  document.getElementById('researchBtn').disabled = on;
}}

async function consumeSSE(url) {{
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {{
    const {{done, value}} = await reader.read();
    if (done) break;
    buf += dec.decode(value, {{stream: true}});
    let idx;
    while ((idx = buf.indexOf('\\n\\n')) !== -1) {{
      const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
      const m = chunk.match(/^data: (.*)$/m);
      if (!m) continue;
      try {{ handleEvent(JSON.parse(m[1])); }} catch (e) {{ console.error(e); }}
    }}
  }}
}}

let streamDone = false;
async function askFollowUp() {{
  const q = document.getElementById('qbox').value.trim();
  if (!q || document.getElementById('askBtn').disabled) return;
  streamDone = false;
  setBusy(true);
  document.getElementById('chatlog').innerHTML = '';
  log('<span class="hint">You:</span> ' + escapeHtml(q));
  const url = '/api/v1/chat/stream?node_title=' + encodeURIComponent(NODE_TITLE) + '&question=' + encodeURIComponent(q) + '&ancestors=' + encodeURIComponent(ROOT_ID);
  try {{ await consumeSSE(url); }} catch (e) {{ log('<span class="hint">Error:</span> ' + e.message); }}
  setBusy(false);
  streamDone = true;
}}

async function deepResearch() {{
  if (document.getElementById('researchBtn').disabled) return;
  streamDone = false;
  setBusy(true);
  document.getElementById('chatlog').innerHTML = '';
  log('<span class="hint">Deep research on:</span> ' + escapeHtml(NODE_TITLE));
  const url = '/api/v1/research/stream?topic=' + encodeURIComponent(NODE_TITLE) + '&category=' + encodeURIComponent(CATEGORY);
  try {{ await consumeSSE(url); }} catch (e) {{ log('<span class="hint">Error:</span> ' + e.message); }}
  setBusy(false);
  streamDone = true;
}}

let answerEl = null;
function handleEvent(ev) {{
  const e = ev.event, data = ev.data || {{}};
  if (e === 'thought') trace('● ' + (data.text || ''));
  else if (e === 'tool_call') trace('🔧 ' + data.tool + ': ' + (data.query || '') + '…', 'tool');
  else if (e === 'tool_result') trace('✓ ' + data.tool + ' → ' + (data.preview || ''), 'tool');
  else if (e === 'source') trace('📄 ' + (data.title || '') + ' — ' + (data.publisher || ''), 'src');
  else if (e === 'answer_start') {{
    answerEl = document.createElement('div');
    answerEl.className = 'msg';
    answerEl.innerHTML = '<span class="hint">Guide:</span> ';
    document.getElementById('chatlog').appendChild(answerEl);
  }}
  else if (e === 'token') {{
    if (answerEl) answerEl.innerHTML += escapeHtml(data.token || '');
  }}
  else if (e === 'node_stream') {{
    const n = data.node || {{}};
    log('<b>🔍 ' + escapeHtml(n.title || '') + '</b><br>' + escapeHtml((n.summary || '').slice(0, 200)));
  }}
  else if (e === 'dossier') {{
    const d = data.dossier || {{}};
    log('<b>📖 Dossier ready:</b> ' + escapeHtml(d.title || '') + '<span class="cite">' + (d.sources || []).length + ' sources · ' + (d.timeline || []).length + ' timeline events</span>');
  }}
  else if (e === 'done') {{
    if (!answerEl) log('<span class="hint">Done.</span>');
  }}
  else if (e === 'error') {{
    log('<span class="hint">Error:</span> ' + escapeHtml(data.message || ''));
  }}
}}

function escapeHtml(s) {{
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}}
</script>"""

    return _page(hub.root.title, body)


def json_dumps(v: str) -> str:
    import json

    return json.dumps(v)
