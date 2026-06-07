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

const LION_URL = {
  smile: () => `${PUBLIC_URL}/lion_smile.png`,
  grin: () => `${PUBLIC_URL}/lion_grin.png`,
  wink: () => `${PUBLIC_URL}/lion_wink.png`,
  neutral: () => `${PUBLIC_URL}/lion_neutral.png`,
};

// שולח תמונת אריה עם כיתוב; אם נכשל — נופל חזרה להודעת טקסט
async function sendLion(chatId, photoUrl, caption, withButton) {
  const body = { chat_id: chatId, photo: photoUrl, caption, parse_mode: "HTML" };
  if (withButton) body.reply_markup = appButton("🦁 פתח מחסן");
  const r = await tg("sendPhoto", body);
  if (!r.ok) {
    const t = { chat_id: chatId, text: caption };
    if (withButton) t.reply_markup = appButton("🦁 פתח מחסן");
    await tg("sendMessage", t);
  }
  return r;
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

app.post("/api/inventory", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a) return res.json({ ok: false, error: "unauthorized" });
    const inventory = await gas("getInventory");
    res.json({ ok: true, inventory });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/deposit", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "manager") return res.json({ ok: false, error: "unauthorized" });
    const r = await gas("deposit", { product: req.body.product, grams: req.body.grams, by: a.user.first_name || "" });
    res.json({ ok: true, result: r });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

app.post("/api/orders/create", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "manager") return res.json({ ok: false, error: "unauthorized" });
    const order = await gas("createOrder", { ...req.body.order, createdBy: a.user.first_name || "" });
    const cfg = await gas("getConfig");
    if (cfg.warehouseChatId) {
      await sendLion(cfg.warehouseChatId, LION_URL.smile(),
        `📦 <b>הזמנה חדשה #${order.orderNo}</b>\nפתח את המחסן כדי לקבל ולאשר.`, true);
    }
    res.json({ ok: true, order });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// מחסן: "קיבלתי"
app.post("/api/orders/receive", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "warehouse") return res.json({ ok: false, error: "unauthorized" });
    const order = await gas("receiveOrder", { orderNo: req.body.orderNo, receivedBy: a.user.first_name || "" });
    const cfg = await gas("getConfig");
    if (cfg.managerChatId) {
      await sendLion(cfg.managerChatId, LION_URL.wink(),
        `📥 <b>הזמנה #${order.orderNo} התקבלה</b> במחסן ובטיפול.`, false);
    }
    res.json({ ok: true, order });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// מחסן: תיקון כמות/משקל בעת חוסר
app.post("/api/orders/setqty", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "warehouse") return res.json({ ok: false, error: "unauthorized" });
    const order = await gas("setOrderQty", { orderNo: req.body.orderNo, fields: req.body.fields || {} });
    const cfg = await gas("getConfig");
    if (cfg.managerChatId) {
      await sendLion(cfg.managerChatId, LION_URL.wink(),
        `✏️ <b>הזמנה #${order.orderNo} עודכנה ע״י המחסן</b>\nכמות: ${order.qty} · משקל: ${order.drawWeight || "—"} גרם`, false);
    }
    res.json({ ok: true, order });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// מחסן: אישור סופי — מוריד מלאי
app.post("/api/orders/confirm", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "warehouse") return res.json({ ok: false, error: "unauthorized" });
    const order = await gas("confirmOrder", { orderNo: req.body.orderNo, confirmedBy: a.user.first_name || "" });
    const cfg = await gas("getConfig");
    if (cfg.managerChatId) {
      await sendLion(cfg.managerChatId, LION_URL.grin(),
        `🎉 <b>הזמנה #${order.orderNo} מוכנה לאיסוף!</b>`, false);
    }
    res.json({ ok: true, order });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

// מחסן: "נאסף" — ההזמנה יצאה בפועל
app.post("/api/orders/collect", async (req, res) => {
  try {
    const a = await auth(req);
    if (!a || a.role !== "warehouse") return res.json({ ok: false, error: "unauthorized" });
    const order = await gas("collectOrder", { orderNo: req.body.orderNo, collectedBy: a.user.first_name || "" });
    const cfg = await gas("getConfig");
    if (cfg.managerChatId) {
      await sendLion(cfg.managerChatId, LION_URL.grin(),
        `📤 <b>הזמנה #${order.orderNo} נאספה</b> ויצאה מהמחסן.`, false);
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
      await sendLion(cfg.warehouseChatId, LION_URL.wink(),
        `🔄 <b>הזמנה #${order.orderNo} עודכנה</b> ע״י המנהל.`, true);
    }
    res.json({ ok: true, order });
  } catch (e) { res.json({ ok: false, error: String(e) }); }
});

/* ---------- Telegram webhook ---------- */
function regReply(role, r) {
  const who = role === "manager" ? "מנהל" : "מחסן";
  switch (r.status) {
    case "registered": return `✅ הוגדרת כ${who}.\nchat id: ${r.chatId}`;
    case "replaced":   return `✅ הוחלף — הוגדרת כ${who}.\nchat id: ${r.chatId}`;
    case "already_you":return `כבר רשום כ${who} ✓\nchat id: ${r.chatId}`;
    case "locked":     return `🔒 תפקיד ה${who} כבר תפוס.\nכדי להחליף: פתח את המתג allowRegister בגיליון (TRUE) ושלח שוב.`;
    case "bot_register_off": return `🚫 רישום דרך הבוט חסום.\nניהול התפקידים נעשה ידנית בגיליון.`;
    default: return `שגיאת רישום.`;
  }
}

app.post("/tg/:secret", async (req, res) => {
  if (req.params.secret !== SHARED_SECRET) return res.sendStatus(403);
  res.sendStatus(200); // ack מיד
  try {
    const u = req.body;
    const msg = u.message || u.edited_message;
    if (!msg || !msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const cfg = await gas("getConfig");
    const isManager = String(cfg.managerChatId) === String(chatId);
    const isWarehouse = String(cfg.warehouseChatId) === String(chatId);
    const known = isManager || isWarehouse;

    if (text.startsWith("/start")) {
      await sendLion(chatId, LION_URL.neutral(),
        "היי בוס 🦁\nברוך הבא לבוט המחסן.\nלפתיחה לחץ למטה 👇", true);

    } else if (text.startsWith("/iammanager")) {
      const r = await gas("registerRole", { role: "manager", chatId: String(chatId) });
      await tg("sendMessage", { chat_id: chatId, text: regReply("manager", r) });

    } else if (text.startsWith("/iamwarehouse")) {
      const r = await gas("registerRole", { role: "warehouse", chatId: String(chatId) });
      await tg("sendMessage", { chat_id: chatId, text: regReply("warehouse", r) });

    } else if (text.startsWith("/status")) {
      if (!isManager) { await tg("sendMessage", { chat_id: chatId, text: "❌ פקודה למנהל בלבד." }); return; }
      await tg("sendMessage", { chat_id: chatId, text:
        `מצב רישום:\nמנהל: ${cfg.managerChatId || "—"}\nמחסן: ${cfg.warehouseChatId || "—"}\nרישום דרך בוט: ${cfg.botRegister}\nמתג החלפה: ${cfg.allowRegister}` });

    } else if (text.startsWith("/reset")) {
      if (!isManager) { await tg("sendMessage", { chat_id: chatId, text: "❌ פקודה למנהל בלבד." }); return; }
      const part = text.split(/\s+/)[1];
      if (part === "manager" || part === "warehouse") {
        await gas("resetRole", { role: part });
        await tg("sendMessage", { chat_id: chatId, text: `♻️ תפקיד ${part} אופס. שלח /iam${part} מהחשבון החדש (אחרי פתיחת allowRegister=TRUE).` });
      } else {
        await tg("sendMessage", { chat_id: chatId, text: "שימוש: /reset manager  או  /reset warehouse" });
      }

    } else if (text.startsWith("/whoami")) {
      await tg("sendMessage", { chat_id: chatId, text: `chat id: ${chatId}` });

    } else if (text.startsWith("/מלאי") || text.startsWith("/stock")) {
      if (!known) { await tg("sendMessage", { chat_id: chatId, text: "❌ אין הרשאה." }); return; }
      const inv = await gas("getInventory");
      const lines = (inv || []).map(it => `${it.product} · ${Number(it.grams).toLocaleString()} גרם`).join("\n");
      await tg("sendMessage", { chat_id: chatId, text: `📦 מלאי נוכחי\n\n${lines || "—"}` });

    } else {
      await tg("sendMessage", { chat_id: chatId, text: "לפתיחת המחסן 👇", reply_markup: appButton("🦁 פתח מחסן") });
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
