# אטלס · בעיות אמיתיות, ומה אפשר לבנות

מפת עולם שגדלה כל שבוע. כל נעץ הוא בעיה אחת במקום אחד, מתוך הדיווח השבועי של The Economist, ולצידה רעיון קונקרטי למה אפשר לבנות.

## פתיחה מקומית
לחיצה כפולה על `index.html`. האתר עובד דרך `file://` בלי שרת: כל הנתונים נטענים מקובצי JS (`data/*.js`), המפה מקובץ מקומי, והגופנים שמורים בתוך האתר. אין שרתי אריחים ואין CDN.

## מבנה
```
index.html, about.html        עמודים (נוצרים מ-templates/ על ידי הבנייה)
issue/<date>.html             "המשלוח השבועי" לכל גיליון
assets/css/kit.css            ערכת העיצוב המשותפת (RTL, בהיר/כהה, חלונות מונחים)
assets/css/atlas.css          שכבת האתר
assets/js/core.js             משותף: תגיות ומשפחות צבע, כרטיס נעץ, מונחים, ערכת נושא
assets/js/app.js              המפה: אשכולות, מגירה, סינון, ציר זמן, דפוסים
assets/js/vendor.js           d3-geo, d3-zoom, d3-selection, topojson-client (באנדל אחד)
data/world.js                 Natural Earth 1:50m (world-atlas@2), נחלת הכלל
data/index.js                 רשימת הגיליונות והדפוסים
data/pins-<date>.js           הנעצים של גיליון אחד
src/pins.json                 מקור האמת: הגדרות, גיליונות, דפוסים, קישורים, כל הנעצים
src/issues/<date>.json        קלט של גיליון (+ <date>.editorial.json לדפוסים וקישורים)
tools/build.mjs               ולידציה (כולל point-in-polygon) ויצירת data/ ועמודים
tools/og.py                   תמונות OG ‏(1200×630)
tools/check.py                בדיקה ב-1280/390, בהיר/כהה, file:// ושרת
```

## הוספת גיליון
```bash
npm install                                   # פעם אחת: d3-geo ו-topojson-client לבנייה
node tools/build.mjs --add src/issues/2026-11-21.json
python3 tools/og.py                           # דורש playwright
python3 tools/check.py                        # עוצר על כל שגיאה
```
הבנייה נכשלת ולא כותבת כלום אם נעץ נופל מחוץ למדינה שלו, אם תגית לא ברשימה הסגורה, אם כותרת ארוכה משמונה מילים, או אם מונח לא מופיע בטקסט של הכרטיס.

## פריסה ב-GitHub Pages
1. ריפו חדש, דחיפה של התיקייה כמו שהיא (`.nojekyll` כבר בפנים, `interview/` מוחרג).
2. ‏Settings → Pages → Deploy from a branch → `main` / `root`.
3. כדי שתמונות ה-OG יעבדו ברשתות חברתיות, הכניסו את הכתובת המלאה ב-`src/pins.json` → `site.url` (למשל `https://<user>.github.io/atlas/`) והריצו `node tools/build.mjs`.

GoatCounter ‏(rony.goatcounter.com) נטען רק בכתובת אמיתית, לא ב-`file://` ולא ב-localhost.

## רישיונות
גבולות: Natural Earth (נחלת הכלל). גופנים: Heebo ו-Frank Ruhl Libre ‏(SIL OFL, ‏`assets/fonts/LICENSE-*`). הסיכומים נכתבו מחדש בעברית ומבוססים על דיווח ב-The Economist.
