# מחסן · בוט טלגרם (Mini App)

שירות Node יחיד ל-Render: מגיש את ה-Mini App, מריץ את הבוט, ומדבר עם Google Sheets דרך Apps Script.

## ארכיטקטורה
דפדפן (Mini App) → שרת Node (אותו origin) → Apps Script → Google Sheets
הבוט שולח התראות בטלגרם. אין CORS, אין Service Account.

---

## פריסה ל-Render (פעם אחת)

1. **העלה את התיקייה הזו לריפו ב-GitHub** (כמו galileo-v2).
2. ב-Render → **New → Web Service** → חבר את הריפו.
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server.js`
3. תחת **Environment** הוסף 4 משתנים:

   | Key | Value |
   |-----|-------|
   | `BOT_TOKEN` | הטוקן מ-BotFather |
   | `GAS_URL` | כתובת ה-Web app של Apps Script (מסתיימת ב-/exec) |
   | `SHARED_SECRET` | אותו סוד מתוך Code.gs |
   | `PUBLIC_URL` | כתובת ה-Render, ללא / בסוף (אחרי הפריסה הראשונה) |

   > טיפ: בפריסה הראשונה תקבל את כתובת ה-Render. הוסף אותה ל-`PUBLIC_URL` ובצע **Manual Deploy** שוב — אז ה-webhook ייקבע אוטומטית.

4. בעת ההפעלה השרת קובע אוטומטית את ה-webhook ואת כפתור התפריט של הבוט.

---

## הרשמת המשתמשים (פעם אחת)

בטלגרם, אל הבוט:
- המנהל שולח: `/iammanager`
- המחסן שולח: `/iamwarehouse`

(כל אחד מקבל אישור עם ה-chat id שלו. הערכים נשמרים בטאב Config בגיליון.)

פקודות נוספות: `/start` פותח את האפליקציה · `/whoami` מציג chat id.

---

## שימוש
- פתח את הבוט → לחץ **🦁 פתח מחסן** (או כפתור התפריט).
- **מנהל:** משיכת סחורה (טקסט חופשי) או אריזה → בון → שלח למחסן.
- **מחסן:** רואה הזמנות ממתינות → לוחץ "מוכן לאיסוף".
- כל ההזמנות נשמרות בטאב **Orders** בגיליון.

## פיתוח מקומי
```
npm install
npm run dev      # Mini App בלבד (Vite) — ל-UI
# להרצת השרת מקומית צריך .env עם המשתנים
```
