import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  BOT_TOKEN,
  GAS_URL,           // כתובת ה-Web app של Apps Script (מסתיימת ב-/exec)
  SHARED_SECRET,     // אותו סוד שבתוך Code.gs
  PUBLIC_URL,        // כתובת ה-Render (https://...onrender.com) ללא / בסוף
  PORT = 3000,
} = process.env;

const app = express();
app.use(express.json({ limit: "1mb" }));

/* ---------- גשר ל-Apps Script (צד שרת, ללא CORS) ---------- */
async function gas(action, payload) {
  const r = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: SHARED_SECRET, action, payload: payload || {} }),
    redirect: "follow",
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "gas error");
  return j.data;
}

/* ---------- Telegram API ---------- */
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function appButton(text) {
  return { inline_keyboard: [[{ text, web_app: { url: PUBLIC_URL } }]] };
}

/* ---------- אימות initData של טלגרם ---------- */
function checkInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calc = crypto.createHmac("sha256", secretKey).update(dcs).digest("hex");
  if (calc !== hash) return null;
  try { return JSON.parse(params.get("user") || "null"); } catch { return null; }
}

async function roleOf(user) {
  if (!user) return null;
  const cfg = await gas("getConfig");
  const id = String(user.id);
  if (String(cfg.managerChatId) === id) return "manager";
  if (String(cfg.warehouseChatId) === id) return "warehouse";
  return null;
}

async function auth(req) {
  const initData = req.headers["x-init-data"] || (req.body && req.body.initData) || "";
  const user = checkInitData(initData);
  if (!user) return null;
  const role = await roleOf(user);
  return role ? { user, role } : null;
}

/* ---------- API ---------- */
app.post("/api/me", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a) return res.json({ ok: false, error: "unauthorized" });
    res.json({ ok: true, role: a.role, name: a.user.first_name || "" });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/catalog", async (_req, res) => {
  try {
    const data = await gas("getCatalog");
    res.json({ ok: true, products: data.products, packTypes: data.packTypes });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/orders/list", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a) return res.json({ ok: false, error: "unauthorized" });
    const orders = await gas("listOrders", { status: req.body.status || "" });
    res.json({ ok: true, orders });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/orders/create", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "manager") return res.json({ ok: false, error: "unauthorized" });
    const order = await gas("createOrder", { ...req.body.order, createdBy: a.user.first_name || "" });
    const cfg = await gas("getConfig");
    if (cfg.warehouseChatId) {
      await tg("sendMessage", {
        chat_id: cfg.warehouseChatId,
        text: `📦 הזמנה חדשה #${order.orderNo}\nפתח את המחסן כדי לצפות ולאשר.`,
        reply_markup: appButton("🦁 פתח מחסן"),
      });
    }
    res.json({ ok: true, order });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/orders/confirm", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "warehouse") return res.json({ ok: false, error: "unauthorized" });
    const order = await gas("confirmOrder", { orderNo: req.body.orderNo, confirmedBy: a.user.first_name || "" });
    const cfg = await gas("getConfig");
    if (cfg.managerChatId) {
      await tg("sendMessage", { chat_id: cfg.managerChatId, text: `🎉 הזמנה #${order.orderNo} מוכנה לאיסוף!` });
    }
    res.json({ ok: true, order });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/orders/edit", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "manager") return res.json({ ok: false, error: "unauthorized" });
    const order = await gas("editOrder", { orderNo: req.body.orderNo, fields: req.body.fields || {} });
    const cfg = await gas("getConfig");
    if (cfg.warehouseChatId) {
      await tg("sendMessage", {
        chat_id: cfg.warehouseChatId,
        text: `🔄 הזמנה #${order.orderNo} עודכנה ע״י המנהל.`,
        reply_markup: appButton("🦁 פתח מחסן"),
      });
    }
    res.json({ ok: true, order });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

/* ---------- Telegram webhook ---------- */
app.post("/tg/:secret", async (req, res) => {
  if (req.params.secret !== SHARED_SECRET) return res.sendStatus(403);
  res.sendStatus(200); // ack מיד
  try {
    const u = req.body;
    const msg = u.message || u.edited_message;
    if (msg && msg.text) {
      const chatId = msg.chat.id;
      const text = msg.text.trim();
      if (text.startsWith("/start")) {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "היי בוס 🦁\nברוך הבא לבוט המחסן.\nלפתיחה לחץ למטה 👇",
          reply_markup: appButton("🦁 פתח מחסן"),
        });
      } else if (text.startsWith("/iammanager")) {
        await gas("setConfig", { key: "managerChatId", value: String(chatId) });
        await tg("sendMessage", { chat_id: chatId, text: `✅ הוגדרת כמנהל.\nchat id: ${chatId}` });
      } else if (text.startsWith("/iamwarehouse")) {
        await gas("setConfig", { key: "warehouseChatId", value: String(chatId) });
        await tg("sendMessage", { chat_id: chatId, text: `✅ הוגדרת כמחסן.\nchat id: ${chatId}` });
      } else if (text.startsWith("/whoami")) {
        await tg("sendMessage", { chat_id: chatId, text: `chat id: ${chatId}` });
      } else {
        await tg("sendMessage", { chat_id: chatId, text: "לפתיחת המחסן 👇", reply_markup: appButton("🦁 פתח מחסן") });
      }
    }
  } catch (e) { console.error("webhook error:", e); }
});

/* ---------- health ---------- */
app.get("/healthz", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* ---------- הגשת ה-Mini App (static) ---------- */
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

/* ---------- הפעלה ---------- */
app.listen(PORT, async () => {
  console.log(`warehouse-bot listening on :${PORT}`);
  if (!BOT_TOKEN || !GAS_URL || !SHARED_SECRET) {
    console.warn("⚠️ חסרים משתני סביבה: BOT_TOKEN / GAS_URL / SHARED_SECRET");
    return;
  }
  if (PUBLIC_URL) {
    try {
      const wh = await tg("setWebhook", { url: `${PUBLIC_URL}/tg/${SHARED_SECRET}`, allowed_updates: ["message"] });
      console.log("setWebhook:", JSON.stringify(wh));
      const mb = await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "מחסן", web_app: { url: PUBLIC_URL } } });
      console.log("setChatMenuButton:", JSON.stringify(mb));
    } catch (e) { console.error("startup setup error:", e); }
  } else {
    console.warn("⚠️ PUBLIC_URL לא הוגדר — webhook לא נרשם.");
  }
});
