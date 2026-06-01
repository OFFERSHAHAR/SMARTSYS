/*** ============================================================
 *  מחסן · בוט טלגרם — שכבת Google Sheets (Apps Script)
 *  ------------------------------------------------------------
 *  הדבק קובץ זה בעורך Apps Script של הגיליון:
 *    Extensions → Apps Script  (הרחבות → Apps Script)
 *
 *  שלבי הפעלה (פעם אחת):
 *    1. הדבק את כל הקובץ הזה (מחק קוד קיים).
 *    2. בחר את הפונקציה  setup  ולחץ Run. אשר הרשאות.
 *    3. Deploy → New deployment → סוג: Web app
 *         Execute as: Me   |   Who has access: Anyone
 *       העתק את כתובת ה‑Web app (מסתיימת ב‑/exec) ושלח לי אותה.
 *
 *  אבטחה: כל פעולת כתיבה דורשת את ה‑SECRET למטה (משותף עם שרת Render).
 * ============================================================ */

const SECRET = '5df5fb11434ea8be13b320ddd7d797d51d1473d43bd11a8f';

const ORDER_HEADERS = [
  'orderNo', 'type', 'product', 'qty', 'packages', 'packType', 'packWeight',
  'freeText', 'status', 'createdBy', 'createdAt', 'confirmedBy', 'confirmedAt',
  'version', 'updatedAt'
];

/* ---------------- הקמה ראשונית ---------------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const orders = ss.getSheetByName('Orders') || ss.insertSheet('Orders');
  orders.clear();
  orders.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]).setFontWeight('bold');
  orders.setFrozenRows(1);

  const products = ss.getSheetByName('Products') || ss.insertSheet('Products');
  products.clear();
  products.getRange(1, 1, 1, 1).setValues([['name']]).setFontWeight('bold');
  products.getRange(2, 1, 5, 1).setValues([['A'], ['B'], ['C'], ['D'], ['MINI']]);
  products.setFrozenRows(1);

  const packs = ss.getSheetByName('PackTypes') || ss.insertSheet('PackTypes');
  packs.clear();
  packs.getRange(1, 1, 1, 3).setValues([['name', 'weight', 'mode']]).setFontWeight('bold');
  packs.getRange(2, 1, 2, 3).setValues([
    ['קופסת פלסטיק', 10, 'fixed'],
    ['שקית', '', 'free']
  ]);
  packs.setFrozenRows(1);

  const cfg = ss.getSheetByName('Config') || ss.insertSheet('Config');
  cfg.clear();
  cfg.getRange(1, 1, 1, 2).setValues([['key', 'value']]).setFontWeight('bold');
  cfg.getRange(2, 1, 5, 2).setValues([
    ['lastOrderNo', 0],
    ['managerChatId', ''],
    ['warehouseChatId', ''],
    ['botRegister', 'TRUE'],   // האם בכלל מותר לרשום תפקידים דרך הבוט
    ['allowRegister', 'TRUE']  // מתג חד-פעמי: פתח כדי לאפשר החלפת תפקיד תפוס
  ]);
  cfg.setFrozenRows(1);

  return 'setup done · tabs: Orders, Products, PackTypes, Config';
}

/* ---------------- נקודות כניסה ---------------- */
function doGet() {
  return json_({ ok: true, service: 'warehouse-sheets', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.secret !== SECRET) return json_({ ok: false, error: 'unauthorized' });

    const p = body.payload || {};
    let result;
    switch (body.action) {
      case 'createOrder':  result = createOrder_(p); break;
      case 'getOrder':     result = getOrder_(p.orderNo); break;
      case 'listOrders':   result = listOrders_(p.status); break;
      case 'confirmOrder': result = confirmOrder_(p.orderNo, p.confirmedBy); break;
      case 'editOrder':    result = editOrder_(p.orderNo, p.fields || {}); break;
      case 'getCatalog':   result = getCatalog_(); break;
      case 'getConfig':    result = getConfig_(); break;
      case 'setConfig':    result = setConfig_(p.key, p.value); break;
      case 'registerRole': result = registerRole_(p.role, p.chatId); break;
      case 'resetRole':    result = resetRole_(p.role); break;
      default: return json_({ ok: false, error: 'unknown action: ' + body.action });
    }
    return json_({ ok: true, data: result });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------------- פעולות הזמנות ---------------- */
function createOrder_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const no = nextOrderNo_();
    const { sh, headers } = ordersData_();
    const now = new Date();
    const rec = {
      orderNo: no, type: p.type || '', product: p.product || '',
      qty: p.qty || '', packages: p.packages || '', packType: p.packType || '',
      packWeight: (p.packWeight === undefined ? '' : p.packWeight), freeText: p.freeText || '',
      status: 'sent', createdBy: p.createdBy || '', createdAt: now,
      confirmedBy: '', confirmedAt: '', version: 1, updatedAt: now
    };
    sh.appendRow(headers.map(h => (rec[h] !== undefined ? rec[h] : '')));
    return orderToOut_(rec);
  } finally {
    lock.releaseLock();
  }
}

function getOrder_(no) {
  const { rows } = ordersData_();
  const o = rows.find(r => String(r.orderNo) === String(no));
  return o ? orderToOut_(o) : null;
}

function listOrders_(status) {
  const { rows } = ordersData_();
  const r = status ? rows.filter(x => x.status === status) : rows;
  return r.map(orderToOut_);
}

function confirmOrder_(no, by) {
  const { sh, headers, rows } = ordersData_();
  const o = rows.find(r => String(r.orderNo) === String(no));
  if (!o) throw 'order not found: ' + no;
  const now = new Date();
  setCell_(sh, headers, o._row, 'status', 'ready');
  setCell_(sh, headers, o._row, 'confirmedBy', by || '');
  setCell_(sh, headers, o._row, 'confirmedAt', now);
  setCell_(sh, headers, o._row, 'updatedAt', now);
  return getOrder_(no);
}

function editOrder_(no, fields) {
  const { sh, headers, rows } = ordersData_();
  const o = rows.find(r => String(r.orderNo) === String(no));
  if (!o) throw 'order not found: ' + no;
  ['product', 'qty', 'packages', 'packType', 'packWeight', 'freeText'].forEach(f => {
    if (fields[f] !== undefined) setCell_(sh, headers, o._row, f, fields[f]);
  });
  setCell_(sh, headers, o._row, 'version', Number(o.version || 1) + 1);
  setCell_(sh, headers, o._row, 'status', 'sent'); // נשלח מחדש לאחר עריכה
  setCell_(sh, headers, o._row, 'updatedAt', new Date());
  return getOrder_(no);
}

/* ---------------- קטלוג + קונפיג ---------------- */
function getCatalog_() {
  const products = sheet_('Products').getDataRange().getValues().slice(1)
    .filter(r => r[0] !== '')
    .map(r => ({ name: String(r[0]) }));
  const packTypes = sheet_('PackTypes').getDataRange().getValues().slice(1)
    .filter(r => r[0] !== '')
    .map(r => ({ name: String(r[0]), weight: (r[1] === '' ? null : Number(r[1])), mode: String(r[2] || 'fixed') }));
  return { products, packTypes };
}

function getConfig_() {
  const v = sheet_('Config').getDataRange().getValues().slice(1);
  const o = {};
  v.forEach(r => { if (r[0] !== '') o[r[0]] = r[1]; });
  return o;
}

function setConfig_(key, value) {
  const cfg = sheet_('Config');
  const v = cfg.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === key) { cfg.getRange(i + 1, 2).setValue(value); return { key: key, value: value }; }
  }
  cfg.appendRow([key, value]);
  return { key: key, value: value };
}

function truthy_(v) {
  return String(v).trim().toUpperCase() === 'TRUE';
}

/* רישום תפקיד עם נעילה.
   role: 'manager' | 'warehouse'  ·  מחזיר {status, chatId} */
function registerRole_(role, chatId) {
  if (role !== 'manager' && role !== 'warehouse') throw 'bad role';
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const cfg = getConfig_();
    const key = role === 'manager' ? 'managerChatId' : 'warehouseChatId';
    const current = String(cfg[key] || '');
    const incoming = String(chatId);

    // רישום דרך הבוט חסום לגמרי
    if (!truthy_(cfg.botRegister)) {
      return { status: 'bot_register_off', chatId: current };
    }
    // כבר רשום אותו אדם
    if (current === incoming) {
      return { status: 'already_you', chatId: current };
    }
    // התפקיד תפוס ע"י מישהו אחר — צריך מתג שיתוף פתוח
    if (current && !truthy_(cfg.allowRegister)) {
      return { status: 'locked', chatId: current };
    }
    // אישור הרישום
    setConfig_(key, incoming);
    // אם השתמשנו במתג השיתוף — נסגור אותו אוטומטית אחרי שימוש
    if (current && truthy_(cfg.allowRegister)) {
      setConfig_('allowRegister', 'FALSE');
    }
    return { status: current ? 'replaced' : 'registered', chatId: incoming };
  } finally {
    lock.releaseLock();
  }
}

function resetRole_(role) {
  const key = role === 'manager' ? 'managerChatId'
            : role === 'warehouse' ? 'warehouseChatId' : null;
  if (!key) throw 'bad role';
  setConfig_(key, '');
  return { status: 'reset', role: role };
}

/* ---------------- עזרי ליבה ---------------- */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) { return ss_().getSheetByName(name); }

function ordersData_() {
  const sh = sheet_('Orders');
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(c => c === '')) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j]; });
    obj._row = i + 1;
    rows.push(obj);
  }
  return { sh: sh, headers: headers, rows: rows };
}

function orderToOut_(o) {
  return {
    orderNo: String(o.orderNo),
    type: o.type,
    product: o.product,
    qty: o.qty,
    packages: o.packages,
    packType: o.packType,
    packWeight: o.packWeight,
    freeText: o.freeText,
    status: o.status,
    createdBy: o.createdBy,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : '',
    confirmedBy: o.confirmedBy,
    confirmedAt: o.confirmedAt ? new Date(o.confirmedAt).toISOString() : '',
    version: o.version,
    updatedAt: o.updatedAt ? new Date(o.updatedAt).toISOString() : ''
  };
}

function nextOrderNo_() {
  const cfg = sheet_('Config');
  const v = cfg.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    if (v[i][0] === 'lastOrderNo') {
      const next = Number(v[i][1] || 0) + 1;
      cfg.getRange(i + 1, 2).setValue(next);
      return next;
    }
  }
  cfg.appendRow(['lastOrderNo', 1]);
  return 1;
}

function setCell_(sh, headers, row, field, value) {
  const col = headers.indexOf(field) + 1;
  if (col > 0) sh.getRange(row, col).setValue(value);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
