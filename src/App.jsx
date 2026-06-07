import React, { useState, useEffect, useCallback } from "react";
import {
  Package, Gift, Send, Pencil, Check, ChevronRight, ScrollText,
  Scale, Bell, Plus, Minus, RotateCcw, Sparkles, Loader2, PackagePlus, Boxes, PackageCheck
} from "lucide-react";

/* ============================================================
   מחסן · Telegram Mini App  (Manager + Warehouse, role-aware)
   ============================================================ */

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
const INIT_DATA = tg?.initData || "";

/* ---- מותג האריה ---- */
const LION = {
  wink: "/lion_wink.png",         // ברירת מחדל / לוגו על הבון
  grin: "/lion_grin.png",         // מוכן לאיסוף / אישור
  smile: "/lion_smile.png",       // יצירת בון
  neutral: "/lion_neutral.png",   // עומד — כניסה / המתנה
  celebrate: "/lion_celebrate.png", // יושב — חגיגה / ריק
};
const Lion = ({ src, size = 96, className = "", style = {} }) => (
  <img src={src} alt="" width={size} height={size}
    className={className}
    style={{ width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 6px 14px rgba(0,0,0,.35))", ...style }} />
);

async function api(path, body) {
  const r = await fetch("/api" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Init-Data": INIT_DATA },
    body: JSON.stringify(body || {}),
  });
  return r.json();
}

const fmt = (n) => {
  const r = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
};
const pad4 = (n) => String(n).padStart(4, "0");
const fmtDate = (d) =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
const fmtTime = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function normalize(o) {
  const d = o.createdAt ? new Date(o.createdAt) : new Date();
  return {
    orderNo: o.orderNo,
    no: pad4(o.orderNo),
    dateStr: fmtDate(d),
    timeStr: fmtTime(d),
    type: o.type,
    product: o.product,
    qty: o.qty,
    packages: o.packages,
    packType: o.packType,
    packWeight: o.packWeight,
    drawWeight: o.drawWeight,
    text: o.freeText,
    status: o.status,
    receivedBy: o.receivedBy,
    confirmedBy: o.confirmedBy,
    edited: Number(o.version || 1) > 1,
  };
}

/* ---------------- Styles ---------------- */
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Rubik:wght@500;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
    .wb * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    .wb { font-family:'Assistant', ui-sans-serif, system-ui, sans-serif; --chat:#0c0e13; }
    .disp { font-family:'Rubik','Assistant',sans-serif; }
    .mono { font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums; }
    @keyframes msgIn { from{opacity:0; transform:translateY(10px) scale(.97)} to{opacity:1; transform:none} }
    .msgIn{ animation:msgIn .42s cubic-bezier(.22,1,.36,1) both }
    @keyframes pop { 0%{opacity:0; transform:scale(.92)} 60%{transform:scale(1.015)} 100%{opacity:1; transform:scale(1)} }
    .pop{ animation:pop .5s cubic-bezier(.22,1,.36,1) both }
    @keyframes glow { 0%,100%{opacity:.45} 50%{opacity:.85} }
    .glowp{ animation:glow 7s ease-in-out infinite }
    @keyframes toastIn { from{opacity:0; transform:translateY(-14px)} to{opacity:1; transform:none} }
    .toastIn{ animation:toastIn .45s cubic-bezier(.22,1,.36,1) both }
    @keyframes stamp { 0%{opacity:0; transform:rotate(-14deg) scale(1.4)} 100%{opacity:1; transform:rotate(-14deg) scale(1)} }
    .stamp{ animation:stamp .5s cubic-bezier(.22,1,.36,1) both }
    @keyframes spin { to{ transform:rotate(360deg) } }
    .spin{ animation:spin 1s linear infinite }
    .scrl::-webkit-scrollbar{ width:0 }
    .paper{ background:linear-gradient(178deg,#FCF8EF 0%,#F4ECDB 100%); }
    .scallop{ position:absolute; left:0; right:0; height:9px; background-repeat:repeat-x; pointer-events:none; }
    .scallop-t{ top:0; background-image:radial-gradient(circle 6px at 6px 0, var(--chat) 6px, transparent 6.5px); background-size:12px 9px; }
    .scallop-b{ bottom:0; background-image:radial-gradient(circle 6px at 6px 9px, var(--chat) 6px, transparent 6.5px); background-size:12px 9px; }
    .press{ transition:transform .12s ease, filter .12s ease, background .2s ease }
    .press:active{ transform:scale(.96) }
    .grain{ background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E"); }
  `}</style>
);

/* ---------------- Receipt ---------------- */
const Barcode = ({ seed }) => {
  let s = seed || 42;
  const bars = Array.from({ length: 46 }, () => {
    s = (s * 9301 + 49297) % 233280;
    return 1 + Math.round((s / 233280) * 2.4);
  });
  return (
    <div className="flex items-end gap-[2px] h-9 justify-center">
      {bars.map((w, i) => (
        <span key={i} style={{ width: w, height: i % 7 === 0 ? "100%" : "82%" }} className="bg-[#2a2520]" />
      ))}
    </div>
  );
};

const Row = ({ label, value, strong }) => (
  <div className="flex items-baseline justify-between gap-3 py-[5px]">
    <span className="text-[12.5px] text-[#8a7f6f]">{label}</span>
    <span className="flex-1 mx-1 border-b border-dotted border-[#cdbfa6] translate-y-[-3px]" />
    <span className={`mono text-[14px] ${strong ? "font-bold text-[#1d1814]" : "text-[#3a342c]"}`}>{value}</span>
  </div>
);

const Receipt = ({ o }) => {
  const isPack = o.type === "pack";
  return (
    <div className="pop relative w-full paper rounded-[14px] text-[#2a2520] shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)] overflow-hidden">
      <div className="scallop scallop-t" />
      <span className="absolute -right-[7px] top-[112px] w-3.5 h-3.5 rounded-full" style={{ background: "var(--chat)" }} />
      <span className="absolute -left-[7px] top-[112px] w-3.5 h-3.5 rounded-full" style={{ background: "var(--chat)" }} />

      <div className="px-5 pt-5 pb-4" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-11 h-11 rounded-full grid place-items-center overflow-hidden" style={{ background: "linear-gradient(160deg,#2a2218,#0f0c08)", border: "2px solid #d8caae" }}>
              <Lion src={LION.wink} size={40} style={{ filter: "none" }} />
            </div>
            <div>
              <div className="disp font-extrabold text-[15px] leading-none tracking-tight">מחסן</div>
              <div className="text-[9px] tracking-[.25em] text-[#a89a82] mono">WAREHOUSE</div>
            </div>
          </div>
          {o.edited && (
            <div className="stamp px-2 py-0.5 rounded border-2 border-[#d23f3f] text-[#d23f3f] font-extrabold text-[11px] tracking-wide disp">
              עודכן
            </div>
          )}
        </div>

        <div className="text-center mt-4 mb-1">
          <div className="disp font-black text-[22px] tracking-tight">{isPack ? "בון אריזה" : "בון משיכה"}</div>
          <div className="mono text-[12px] text-[#8a7f6f] mt-0.5">#{o.no} · {o.dateStr} · {o.timeStr}</div>
        </div>

        <div className="my-3 border-t-2 border-dashed border-[#d8caae]" />

        {isPack ? (
          <>
            <Row label="מוצר" value={o.product} strong />
            <Row label="כמות" value={`${o.qty} יח׳`} />
            <Row label="אריזות למילוי" value={`${o.packages}`} />
            <Row label="סוג אריזה" value={o.packType} strong />
            <Row label="משקל אריזה" value={`${fmt(o.packWeight)} גרם`} />
            {o.drawWeight ? <Row label="משקל סחורה" value={`${fmt(o.drawWeight)} גרם`} /> : null}
          </>
        ) : (
          <div className="rounded-xl p-3 text-[14px] leading-relaxed text-[#3a342c]" style={{ background: "rgba(0,0,0,.045)", border: "1px dashed #d8caae" }}>
            <div className="flex items-center gap-1.5 mb-1.5 text-[#7a6f5d] font-bold text-[12px]">
              <ScrollText size={14} /> פירוט משיכה
            </div>
            {o.text}
          </div>
        )}

        <div className="my-3 border-t-2 border-dashed border-[#d8caae]" />
        <Barcode seed={parseInt(o.no, 10) || 42} />
        <div className="text-center mono text-[10px] tracking-[.3em] text-[#a89a82] mt-1.5">
          WH-{o.no}-{isPack ? "PK" : "WD"}
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold"
             style={{ color: o.status === "collected" ? "rgba(255,255,255,.45)" : o.status === "ready" ? "#1c9a55" : o.status === "received" ? "#2563c9" : "#b07a14" }}>
          {o.status === "collected"
            ? <><Check size={12} /> נאסף ✓</>
            : o.status === "ready"
              ? <><Check size={13} /> מוכן לאיסוף ✓</>
              : o.status === "received"
                ? <><Check size={12} /> התקבל — בטיפול</>
                : <><Bell size={12} /> ממתין לקבלה</>}
        </div>
      </div>
      <div className="scallop scallop-b" />
    </div>
  );
};

/* ---------------- Controls ---------------- */
const BigBtn = ({ icon, label, sub, onClick, primary, disabled }) => (
  <button onClick={onClick} disabled={disabled}
    className="press w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-right disabled:opacity-50"
    dir="rtl"
    style={primary
      ? { background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505", boxShadow: "0 10px 26px -10px rgba(255,140,20,.6)" }
      : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", color: "#fff" }}>
    <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
          style={primary ? { background: "rgba(0,0,0,.12)" } : { background: "rgba(255,255,255,.08)" }}>{icon}</span>
    <span className="flex-1">
      <span className="block font-extrabold text-[15px] leading-tight disp">{label}</span>
      {sub && <span className={`block text-[12px] ${primary ? "text-[#6b430a]" : "text-white/45"}`}>{sub}</span>}
    </span>
    <ChevronRight size={18} className={primary ? "text-[#6b430a]" : "text-white/30"} style={{ transform: "scaleX(-1)" }} />
  </button>
);

const Stepper = ({ value, set, min = 1 }) => (
  <div className="flex items-center gap-2">
    <button onClick={() => set(Math.max(min, value - 1))} className="press w-8 h-8 rounded-full grid place-items-center"
      style={{ background: "rgba(255,255,255,.08)", color: "#fff" }}><Minus size={15} /></button>
    <div className="mono text-white font-bold text-[16px] min-w-[44px] text-center">{value}</div>
    <button onClick={() => set(value + 1)} className="press w-8 h-8 rounded-full grid place-items-center"
      style={{ background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505" }}><Plus size={15} /></button>
  </div>
);

const Chip = ({ active, onClick, children }) => (
  <button onClick={onClick}
    className="press px-3 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap"
    style={active
      ? { background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505" }
      : { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", color: "#fff" }}>
    {children}
  </button>
);

const PackForm = ({ catalog, state, set, onSubmit, editing }) => {
  const valid = state.product && state.qty > 0 && state.packages > 0 && state.packType && state.packWeight > 0 && state.drawWeight > 0;
  return (
    <div dir="rtl" className="msgIn rounded-2xl p-4 space-y-4"
         style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)" }}>
      <div className="flex items-center gap-1.5 text-white font-extrabold text-[14px] disp">
        <Gift size={16} className="text-[#FFB020]" /> פרטי אריזה
      </div>

      <div>
        <div className="text-white/55 text-[12px] mb-2 font-semibold">סוג מוצר</div>
        <div className="flex gap-2 overflow-x-auto scrl pb-1">
          {catalog.products.map((p) => (
            <Chip key={p.name} active={state.product === p.name} onClick={() => set({ ...state, product: p.name })}>
              {p.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-white/55 text-[12px] font-semibold">כמות (יחידות)</div>
        <Stepper value={state.qty} set={(v) => set({ ...state, qty: v })} />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-white/55 text-[12px] font-semibold">אריזות למילוי</div>
        <Stepper value={state.packages} set={(v) => set({ ...state, packages: v })} />
      </div>

      <div>
        <div className="text-white/55 text-[12px] mb-2 font-semibold">סוג אריזה (מדבקה)</div>
        <div className="flex flex-wrap gap-2">
          {catalog.packTypes.map((t) => (
            <Chip key={t.name} active={state.packType === t.name}
              onClick={() => set({
                ...state,
                packType: t.name,
                packMode: t.mode,
                packWeight: t.mode === "fixed" ? t.weight : (state.packMode === "free" ? state.packWeight : 0),
              })}>
              {t.name}{t.mode === "fixed" ? ` · ${t.weight}g` : ""}
            </Chip>
          ))}
        </div>
        {state.packMode === "free" && (
          <div className="msgIn mt-3 flex items-center justify-between rounded-xl px-3 py-2.5"
               style={{ background: "rgba(255,176,32,.08)", border: "1px solid rgba(255,176,32,.25)" }}>
            <div className="text-[#FFB020] text-[12px] font-semibold flex items-center gap-1.5"><Scale size={14} /> משקל שקית (גרם)</div>
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" value={state.packWeight || ""}
                onChange={(e) => set({ ...state, packWeight: Number(e.target.value) })}
                placeholder="0"
                className="mono w-20 bg-transparent outline-none text-white text-[16px] font-bold text-center border-b border-white/20 focus:border-[#FFB020]" />
              <span className="text-white/40 text-[12px]">g</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
           style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line, rgba(255,255,255,.1))" }}>
        <div className="text-white/70 text-[12px] font-semibold flex items-center gap-1.5"><Scale size={14} className="text-[#FFB020]" /> משקל סחורה שנמשך (גרם)</div>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="decimal" value={state.drawWeight || ""}
            onChange={(e) => set({ ...state, drawWeight: Number(e.target.value) })}
            placeholder="0"
            className="mono w-20 bg-transparent outline-none text-white text-[16px] font-bold text-center border-b border-white/20 focus:border-[#FFB020]" />
          <span className="text-white/40 text-[12px]">g</span>
        </div>
      </div>

      <button disabled={!valid} onClick={onSubmit}
        className="press w-full py-3 rounded-xl font-extrabold text-[15px] disp flex items-center justify-center gap-2"
        style={valid
          ? { background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505", boxShadow: "0 10px 26px -10px rgba(255,140,20,.6)" }
          : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.3)" }}>
        <ScrollText size={17} /> {editing ? "עדכן בון" : "צור בון"}
      </button>
    </div>
  );
};

const Shell = ({ children }) => (
  <div className="wb min-h-screen w-full flex flex-col" style={{ background: "radial-gradient(120% 60% at 50% -5%, #15110a 0%, #0a0b0f 45%, #07080b 100%)" }}>
    <Styles />
    <div className="glowp pointer-events-none fixed top-[-12%] left-1/2 -translate-x-1/2 w-[460px] h-[460px] rounded-full"
         style={{ background: "radial-gradient(circle, rgba(255,140,20,.16), transparent 65%)", filter: "blur(20px)" }} />
    <div className="grain pointer-events-none fixed inset-0 opacity-[.035] mix-blend-overlay" />
    <div className="relative z-10 w-full max-w-[480px] mx-auto px-4 py-5 flex-1">{children}</div>
  </div>
);

const Center = ({ children }) => (
  <Shell><div className="h-[80vh] flex flex-col items-center justify-center text-center gap-4">{children}</div></Shell>
);

const Toast = ({ msg }) =>
  msg ? (
    <div className="toastIn fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold text-white"
         style={{ background: "rgba(20,22,30,.94)", border: "1px solid rgba(255,255,255,.12)", backdropFilter: "blur(12px)", boxShadow: "0 16px 40px -12px rgba(0,0,0,.7)" }} dir="rtl">
      <Sparkles size={15} className="text-[#FFB020]" /> {msg}
    </div>
  ) : null;

/* ============================================================ */
export default function App() {
  const [phase, setPhase] = useState("loading"); // loading | denied | ready | error
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");
  const [catalog, setCatalog] = useState({ products: [], packTypes: [] });
  const [toast, setToast] = useState(null);
  const fire = (m) => { setToast(m); setTimeout(() => setToast(null), 2400); };

  useEffect(() => {
    try { tg?.ready(); tg?.expand(); tg?.setHeaderColor?.("#0c0e13"); tg?.setBackgroundColor?.("#0c0e13"); } catch (e) {}
    (async () => {
      try {
        const me = await api("/me");
        if (!me.ok) { setPhase("denied"); return; }
        setRole(me.role); setName(me.name || "");
        const cat = await api("/catalog");
        if (cat.ok) setCatalog({ products: cat.products || [], packTypes: cat.packTypes || [] });
        setPhase("ready");
      } catch (e) { setPhase("error"); }
    })();
  }, []);

  if (phase === "loading")
    return <Center><Lion src={LION.neutral} size={150} /><div className="flex items-center gap-2 text-white/60 text-[14px]"><Loader2 size={16} className="spin text-[#FFB020]" /> טוען…</div></Center>;
  if (phase === "denied")
    return <Center>
      <Lion src={LION.neutral} size={130} style={{ opacity: .85 }} />
      <div className="text-white font-bold text-[16px]">אין הרשאה</div>
      <div className="text-white/45 text-[13px] leading-relaxed max-w-[260px]">שלח <span className="mono">/iammanager</span> או <span className="mono">/iamwarehouse</span> לבוט כדי להירשם, ואז פתח שוב.</div>
    </Center>;
  if (phase === "error")
    return <Center>
      <div className="text-white font-bold text-[16px]">שגיאת חיבור</div>
      <button onClick={() => location.reload()} className="press px-4 py-2 rounded-xl text-[#231505] font-bold" style={{ background: "linear-gradient(145deg,#FFB020,#FF7A18)" }}>נסה שוב</button>
    </Center>;

  return role === "manager"
    ? <Manager name={name} catalog={catalog} fire={fire} toast={toast} />
    : <Warehouse name={name} fire={fire} toast={toast} />;
}

/* ---------------- Manager ---------------- */
function Manager({ name, catalog, fire, toast }) {
  const [stage, setStage] = useState("menu"); // menu | withdraw | packform | preview | done | deposit | stock
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [form, setForm] = useState({ product: null, qty: 10, packages: 4, packType: null, packMode: null, packWeight: 0, drawWeight: 0 });
  const [preview, setPreview] = useState(null);
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  // deposit
  const [depProduct, setDepProduct] = useState(null);
  const [depGrams, setDepGrams] = useState(0);
  // inventory
  const [inv, setInv] = useState(null);

  const reset = () => {
    setStage("menu"); setEditing(false); setDraft("");
    setForm({ product: null, qty: 10, packages: 4, packType: null, packMode: null, packWeight: 0, drawWeight: 0 });
    setPreview(null); setSent(null); setDepProduct(null); setDepGrams(0);
  };

  const buildPreview = (o) => {
    const now = new Date();
    return { no: "—", dateStr: fmtDate(now), timeStr: fmtTime(now), status: "sent", edited: false, ...o };
  };

  const goWithdrawPreview = () => {
    if (!draft.trim()) return;
    setPreview(buildPreview({ type: "withdraw", text: draft.trim() }));
    setStage("preview");
  };
  const goPackPreview = () => {
    setPreview(buildPreview({
      type: "pack", product: form.product, qty: form.qty, packages: form.packages,
      packType: form.packType, packWeight: form.packWeight, drawWeight: form.drawWeight,
    }));
    setStage("preview");
  };

  const send = async () => {
    setBusy(true);
    const order = preview.type === "pack"
      ? { type: "pack", product: preview.product, qty: preview.qty, packages: preview.packages, packType: preview.packType, packWeight: preview.packWeight, drawWeight: preview.drawWeight }
      : { type: "withdraw", freeText: preview.text };
    const res = await api("/orders/create", { order });
    setBusy(false);
    if (!res.ok) { fire("שגיאה בשליחה"); return; }
    setSent(normalize(res.order)); setStage("done"); fire("נשלח למחסן ✓");
    tg?.HapticFeedback?.notificationOccurred?.("success");
  };

  const doDeposit = async () => {
    if (!depProduct || depGrams <= 0) return;
    setBusy(true);
    const res = await api("/deposit", { product: depProduct, grams: depGrams });
    setBusy(false);
    if (!res.ok) { fire("שגיאה בהפקדה"); return; }
    fire(`הופקד ✓ ${depProduct}: ${res.result.grams} גרם`);
    tg?.HapticFeedback?.notificationOccurred?.("success");
    setDepProduct(null); setDepGrams(0); setStage("menu");
  };

  const loadInv = async () => {
    setStage("stock"); setInv(null);
    const res = await api("/inventory", {});
    setInv(res.ok ? res.inventory : []);
  };

  return (
    <Shell>
      <Toast msg={toast} />
      <Header title="מנהל" right={stage !== "menu" && <button onClick={reset} className="press flex items-center gap-1.5 px-3 py-2 rounded-full text-white/70 text-[12px] font-semibold" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}><RotateCcw size={14} /> חדש</button>} />

      {stage === "menu" && (
        <div className="space-y-4">
          <div dir="rtl" className="msgIn rounded-2xl px-4 py-4 text-white flex items-center gap-3" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)" }}>
            <Lion src={LION.smile} size={72} />
            <div className="flex-1">
              <div className="disp font-extrabold text-[20px]">היי בוס 🦁</div>
              <div className="text-white/55 text-[14px] mt-0.5">מה צריך היום ?</div>
            </div>
          </div>
          <div className="space-y-2.5">
            <BigBtn primary icon={<Package size={18} />} label="משיכת סחורה" sub="טקסט חופשי — מה למשוך מהמחסן" onClick={() => setStage("withdraw")} />
            <BigBtn icon={<Gift size={18} />} label="אריזה" sub="מוצר · כמות · אריזות · משקל" onClick={() => setStage("packform")} />
            <BigBtn icon={<PackagePlus size={18} />} label="הפקדת סחורה" sub="הוסף משקל למלאי לפי מוצר" onClick={() => setStage("deposit")} />
            <BigBtn icon={<Boxes size={18} />} label="מלאי נוכחי" sub="כמה יש מכל סוג במחסן" onClick={loadInv} />
          </div>
        </div>
      )}

      {stage === "withdraw" && (
        <div className="space-y-3" dir="rtl">
          <Back onClick={reset} />
          <div className="text-white/55 text-[13px] font-semibold">פרט מה למשוך מהמחסן:</div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
            placeholder="לדוגמה: 3 ארגזי מוצר B, חבית שמן, 5 שקיות..."
            className="w-full rounded-2xl p-4 text-white text-[15px] outline-none resize-none"
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }} />
          <button disabled={!draft.trim()} onClick={goWithdrawPreview}
            className="press w-full py-3 rounded-xl font-extrabold text-[15px] disp flex items-center justify-center gap-2"
            style={draft.trim() ? { background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505" } : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.3)" }}>
            <ScrollText size={17} /> צור בון
          </button>
        </div>
      )}

      {stage === "packform" && (
        <div className="space-y-3">
          <Back onClick={reset} />
          <PackForm catalog={catalog} state={form} set={setForm} editing={editing} onSubmit={goPackPreview} />
        </div>
      )}

      {stage === "deposit" && (
        <div className="space-y-4" dir="rtl">
          <Back onClick={reset} />
          <div className="msgIn rounded-2xl p-4 space-y-4" style={{ background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.08)" }}>
            <div className="flex items-center gap-1.5 text-white font-extrabold text-[14px] disp"><PackagePlus size={16} className="text-[#FFB020]" /> הפקדת סחורה למלאי</div>
            <div>
              <div className="text-white/55 text-[12px] mb-2 font-semibold">סוג מוצר</div>
              <div className="flex gap-2 overflow-x-auto scrl pb-1">
                {catalog.products.map((p) => (
                  <Chip key={p.name} active={depProduct === p.name} onClick={() => setDepProduct(p.name)}>{p.name}</Chip>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "rgba(255,176,32,.08)", border: "1px solid rgba(255,176,32,.25)" }}>
              <div className="text-[#FFB020] text-[12px] font-semibold flex items-center gap-1.5"><Scale size={14} /> משקל להוספה (גרם)</div>
              <div className="flex items-center gap-2">
                <input type="number" inputMode="decimal" value={depGrams || ""} onChange={(e) => setDepGrams(Number(e.target.value))} placeholder="0"
                  className="mono w-24 bg-transparent outline-none text-white text-[16px] font-bold text-center border-b border-white/20 focus:border-[#FFB020]" />
                <span className="text-white/40 text-[12px]">g</span>
              </div>
            </div>
            <button disabled={!depProduct || depGrams <= 0 || busy} onClick={doDeposit}
              className="press w-full py-3 rounded-xl font-extrabold text-[15px] disp flex items-center justify-center gap-2"
              style={(depProduct && depGrams > 0) ? { background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505" } : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.3)" }}>
              {busy ? <Loader2 size={16} className="spin" /> : <PackagePlus size={17} />} הפקד למלאי
            </button>
          </div>
        </div>
      )}

      {stage === "stock" && (
        <div className="space-y-3" dir="rtl">
          <Back onClick={reset} />
          <div className="text-white font-extrabold text-[16px] disp flex items-center gap-1.5"><Boxes size={18} className="text-[#FFB020]" /> מלאי נוכחי</div>
          {inv === null ? (
            <div className="h-[40vh] flex items-center justify-center"><Loader2 size={28} className="spin text-[#FFB020]" /></div>
          ) : inv.length === 0 ? (
            <div className="text-white/45 text-[14px]">אין נתוני מלאי.</div>
          ) : (
            <div className="space-y-2">
              {inv.map((it) => (
                <div key={it.product} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
                  <div className="w-9 h-9 rounded-xl grid place-items-center font-black text-[#231505] disp" style={{ background: "linear-gradient(145deg,#FFB020,#FF7A18)" }}>{it.product}</div>
                  <div className="flex-1 text-white font-semibold">מוצר {it.product}</div>
                  <div className="mono text-white font-bold text-[15px]">{Number(it.grams).toLocaleString()} <span className="text-white/40 text-[12px]">g</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {stage === "preview" && preview && (
        <div className="space-y-3">
          <div className="text-white/55 text-[13px] font-semibold text-center" dir="rtl">בדוק ושלח</div>
          <Receipt o={preview} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={send}
              className="press flex-1 py-3 rounded-xl font-extrabold text-[15px] disp flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505", boxShadow: "0 10px 26px -10px rgba(255,140,20,.6)" }}>
              {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} שלח למחסן
            </button>
            <button onClick={() => setStage(preview.type === "pack" ? "packform" : "withdraw")}
              className="press px-4 py-3 rounded-xl font-bold text-[14px] text-white flex items-center gap-1.5"
              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
              <Pencil size={15} /> ערוך
            </button>
          </div>
        </div>
      )}

      {stage === "done" && sent && (
        <div className="space-y-4">
          <div className="flex justify-center"><Lion src={LION.grin} size={110} /></div>
          <div dir="rtl" className="msgIn flex items-center justify-center gap-2 py-3 rounded-2xl text-[#34d27b] font-bold text-[14px]"
               style={{ background: "rgba(52,210,123,.1)", border: "1px solid rgba(52,210,123,.25)" }}>
            <Check size={18} /> בון #{sent.no} נשלח למחסן
          </div>
          <Receipt o={sent} />
          <BigBtn primary icon={<Plus size={18} />} label="פעולה נוספת" sub="חזרה לתפריט" onClick={reset} />
        </div>
      )}
    </Shell>
  );
}

/* ---------------- Warehouse ---------------- */
function Warehouse({ name, fire, toast }) {
  const [orders, setOrders] = useState(null);
  const [busyNo, setBusyNo] = useState(null);
  const [editNo, setEditNo] = useState(null);
  const [editFields, setEditFields] = useState({ qty: 0, drawWeight: 0 });
  const [stock, setStock] = useState(null); // null=hidden, []=loading→list

  const loadStock = async () => {
    setStock("loading");
    const res = await api("/inventory", {});
    setStock(res.ok ? res.inventory : []);
  };

  const load = useCallback(async () => {
    const res = await api("/orders/list", {});
    if (res.ok) {
      const list = (res.orders || []).map(normalize).sort((a, b) => Number(b.orderNo) - Number(a.orderNo));
      setOrders(list);
    } else setOrders([]);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const receive = async (no) => {
    setBusyNo(no);
    const res = await api("/orders/receive", { orderNo: no });
    setBusyNo(null);
    if (res.ok) { fire("התקבל ✓"); tg?.HapticFeedback?.impactOccurred?.("medium"); load(); }
    else fire("שגיאה");
  };

  const confirm = async (no) => {
    setBusyNo(no);
    const res = await api("/orders/confirm", { orderNo: no });
    setBusyNo(null);
    if (res.ok) { fire("מוכן לאיסוף 🎉 · מלאי עודכן"); tg?.HapticFeedback?.notificationOccurred?.("success"); load(); }
    else fire("שגיאה");
  };

  const collect = async (no) => {
    setBusyNo(no);
    const res = await api("/orders/collect", { orderNo: no });
    setBusyNo(null);
    if (res.ok) { fire("נאסף 📤"); tg?.HapticFeedback?.notificationOccurred?.("success"); load(); }
    else fire("שגיאה");
  };

  const openEdit = (o) => { setEditNo(o.orderNo); setEditFields({ qty: Number(o.qty) || 0, drawWeight: Number(o.drawWeight) || 0 }); };
  const saveEdit = async (no) => {
    setBusyNo(no);
    const res = await api("/orders/setqty", { orderNo: no, fields: { qty: editFields.qty, drawWeight: editFields.drawWeight } });
    setBusyNo(null); setEditNo(null);
    if (res.ok) { fire("כמות עודכנה ✓"); load(); }
    else fire("שגיאה");
  };

  const pending  = (orders || []).filter((o) => o.status === "sent");
  const received = (orders || []).filter((o) => o.status === "received");
  const ready    = (orders || []).filter((o) => o.status === "ready");
  const collected = (orders || []).filter((o) => o.status === "collected");

  const editBox = (o) => (
    <div dir="rtl" className="msgIn rounded-xl p-3 space-y-3" style={{ background: "rgba(255,176,32,.08)", border: "1px solid rgba(255,176,32,.25)" }}>
      <div className="text-[#FFB020] text-[12px] font-bold flex items-center gap-1.5"><Pencil size={13} /> תיקון בעת חוסר</div>
      <div className="flex items-center justify-between">
        <span className="text-white/60 text-[12px]">כמות בפועל</span>
        <Stepper value={editFields.qty} set={(v) => setEditFields((f) => ({ ...f, qty: v }))} min={0} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-white/60 text-[12px]">משקל סחורה (גרם)</span>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="decimal" value={editFields.drawWeight || ""} onChange={(e) => setEditFields((f) => ({ ...f, drawWeight: Number(e.target.value) }))}
            className="mono w-20 bg-transparent outline-none text-white text-[15px] font-bold text-center border-b border-white/20 focus:border-[#FFB020]" />
          <span className="text-white/40 text-[12px]">g</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => saveEdit(o.orderNo)} className="press flex-1 py-2 rounded-lg font-bold text-[13px]" style={{ background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505" }}>שמור</button>
        <button onClick={() => setEditNo(null)} className="press px-4 py-2 rounded-lg font-bold text-[13px] text-white" style={{ background: "rgba(255,255,255,.08)" }}>ביטול</button>
      </div>
    </div>
  );

  return (
    <Shell>
      <Toast msg={toast} />
      <Header title="מחסן" right={<div className="flex gap-2">
        <button onClick={loadStock} className="press flex items-center gap-1.5 px-3 py-2 rounded-full text-white/70 text-[12px] font-semibold" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}><Boxes size={14} /> מלאי</button>
        <button onClick={load} className="press flex items-center gap-1.5 px-3 py-2 rounded-full text-white/70 text-[12px] font-semibold" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)" }}><RotateCcw size={14} /> רענן</button>
      </div>} />

      {stock !== null && (
        <div dir="rtl" className="msgIn mb-4 rounded-2xl p-4" style={{ background: "rgba(255,176,32,.07)", border: "1px solid rgba(255,176,32,.22)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-extrabold text-[14px] disp flex items-center gap-1.5"><Boxes size={16} className="text-[#FFB020]" /> מלאי נוכחי</div>
            <button onClick={() => setStock(null)} className="press text-white/45 text-[12px] font-semibold">סגור ✕</button>
          </div>
          {stock === "loading" ? (
            <div className="py-4 flex justify-center"><Loader2 size={22} className="spin text-[#FFB020]" /></div>
          ) : stock.length === 0 ? (
            <div className="text-white/45 text-[13px]">אין נתוני מלאי.</div>
          ) : (
            <div className="space-y-1.5">
              {stock.map((it) => (
                <div key={it.product} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,.05)" }}>
                  <div className="w-7 h-7 rounded-lg grid place-items-center font-black text-[#231505] text-[13px] disp" style={{ background: "linear-gradient(145deg,#FFB020,#FF7A18)" }}>{it.product}</div>
                  <div className="flex-1 text-white/80 text-[13px] font-semibold">מוצר {it.product}</div>
                  <div className="mono text-white font-bold text-[14px]">{Number(it.grams).toLocaleString()} <span className="text-white/40 text-[11px]">g</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {orders === null && (
        <div className="h-[60vh] flex items-center justify-center"><Loader2 size={30} className="spin text-[#FFB020]" /></div>
      )}

      {orders !== null && pending.length === 0 && received.length === 0 && ready.length === 0 && collected.length === 0 && (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center gap-3" dir="rtl">
          <Lion src={LION.celebrate} size={150} />
          <div className="text-white/45 text-[14px] font-semibold">אין הזמנות</div>
        </div>
      )}

      {/* שלב 1 — חדשות, ממתינות לקבלה */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <div className="text-white/55 text-[13px] font-bold flex items-center gap-1.5" dir="rtl"><Bell size={14} className="text-[#FFB020]" /> חדשות — ממתינות לקבלה ({pending.length})</div>
          {pending.map((o) => (
            <div key={o.orderNo} className="space-y-2">
              <Receipt o={o} />
              <button disabled={busyNo === o.orderNo} onClick={() => receive(o.orderNo)}
                className="press w-full py-3 rounded-xl font-extrabold text-[15px] disp flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505", boxShadow: "0 10px 26px -10px rgba(255,140,20,.6)" }}>
                {busyNo === o.orderNo ? <Loader2 size={16} className="spin" /> : <Check size={17} />} קיבלתי
              </button>
            </div>
          ))}
        </div>
      )}

      {/* שלב 2 — בטיפול, אפשר לתקן כמות ולאשר סופית */}
      {received.length > 0 && (
        <div className="space-y-4 mt-6">
          <div className="text-white/55 text-[13px] font-bold flex items-center gap-1.5" dir="rtl"><Package size={14} className="text-[#2563c9]" /> בטיפול ({received.length})</div>
          {received.map((o) => (
            <div key={o.orderNo} className="space-y-2">
              <Receipt o={o} />
              {editNo === o.orderNo ? editBox(o) : (
                <div className="flex gap-2">
                  <button disabled={busyNo === o.orderNo} onClick={() => confirm(o.orderNo)}
                    className="press flex-1 py-3 rounded-xl font-extrabold text-[15px] disp flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(145deg,#34d27b,#1c9a55)", color: "#06240f", boxShadow: "0 10px 26px -10px rgba(52,210,123,.5)" }}>
                    {busyNo === o.orderNo ? <Loader2 size={16} className="spin" /> : <Check size={17} />} מוכן לאיסוף
                  </button>
                  {o.type === "pack" && (
                    <button onClick={() => openEdit(o)} className="press px-4 py-3 rounded-xl font-bold text-[14px] text-white flex items-center gap-1.5"
                      style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}>
                      <Pencil size={15} /> חוסר
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* מוכנות לאיסוף — כפתור "נאסף" */}
      {ready.length > 0 && (
        <div className="space-y-4 mt-6">
          <div className="text-white/55 text-[13px] font-bold flex items-center gap-1.5" dir="rtl"><Check size={14} className="text-[#34d27b]" /> מוכנות לאיסוף ({ready.length})</div>
          {ready.map((o) => (
            <div key={o.orderNo} dir="rtl" className="rounded-2xl p-3 space-y-2"
                 style={{ background: "rgba(52,210,123,.07)", border: "1px solid rgba(52,210,123,.2)" }}>
              <div className="flex items-center gap-3">
                <Check size={18} className="text-[#34d27b]" />
                <div className="flex-1 text-white text-[14px] font-semibold">בון #{o.no} · {o.type === "pack" ? o.product : "משיכה"}</div>
                <span className="text-[#34d27b] text-[12px] font-bold">מוכן</span>
              </div>
              <button disabled={busyNo === o.orderNo} onClick={() => collect(o.orderNo)}
                className="press w-full py-2.5 rounded-xl font-extrabold text-[14px] disp flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(145deg,#FFB020,#FF7A18)", color: "#231505" }}>
                {busyNo === o.orderNo ? <Loader2 size={15} className="spin" /> : <PackageCheck size={16} />} נאסף
              </button>
            </div>
          ))}
        </div>
      )}

      {/* נאספו — סופי */}
      {collected.length > 0 && (
        <div className="space-y-2 mt-6">
          <div className="text-white/40 text-[12px] font-bold" dir="rtl">נאספו ({collected.length})</div>
          {collected.map((o) => (
            <div key={o.orderNo} dir="rtl" className="flex items-center gap-3 px-4 py-2.5 rounded-2xl opacity-60"
                 style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line, rgba(255,255,255,.08))" }}>
              <PackageCheck size={16} className="text-white/40" />
              <div className="flex-1 text-white/70 text-[13px] font-semibold">בון #{o.no} · {o.type === "pack" ? o.product : "משיכה"}</div>
              <span className="text-white/35 text-[11px] font-bold">נאסף</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* ---------------- shared bits ---------------- */
const Header = ({ title, right }) => (
  <div className="flex items-center justify-between mb-4" dir="rtl">
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 rounded-full grid place-items-center overflow-hidden" style={{ background: "linear-gradient(160deg,#FFB020,#FF7A18)" }}>
        <Lion src={LION.wink} size={38} style={{ filter: "none" }} />
      </div>
      <div>
        <div className="disp text-white font-black text-[17px] leading-none">מחסן</div>
        <div className="text-[#34d27b] text-[11.5px] mt-0.5">{title}</div>
      </div>
    </div>
    {right}
  </div>
);

const Back = ({ onClick }) => (
  <button onClick={onClick} className="press text-white/50 text-[13px] font-semibold flex items-center gap-1" dir="rtl">
    <ChevronRight size={16} /> חזרה
  </button>
);
