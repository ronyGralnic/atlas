# אטלס · איפה העולם נתקע, ומה אפשר לבנות

גלובוס חי שגדל כל שבוע. בכל נקודה יש בעיה אמיתית, אדם (בדוי) שחי אותה, ורעיון קונקרטי שאפשר לבנות.

## פתיחה מקומית
לחיצה כפולה על `index.html`. האתר עובד דרך `file://` בלי שרת: כל הנתונים נטענים מקובצי JS (`data/*.js`), הגבולות, הדגלים, הגופנים והאיורים שמורים בתוך האתר. אין שרתי אריחים ואין CDN.

## מה יש בעמוד
- **פס התראות רץ**: בעיה אחת ומשפט על הרעיון, לכל סיפור. נעצר בריחוף או בכפתור.
- **גלובוס חי**: מסתובב לאט, עם יום ולילה אמיתיים לפי השעה עכשיו, ושמיים בצבע השעה אצל הקורא. גרירה מסובבת, גלגלת מתקרבת, לחיצה על מדינה פותחת את החלון שלה. אפשר לעבור למפה שטוחה.
- **"מה מסקרן אתכם?"**: שמונה אריחי נושא עם ספירה חיה, אזורים, וחיפוש (גם לפי שם הדמות).
- **סיפורים**: כרטיס לכל סיפור, עם איור מונפש, דגל, דמות והרעיון.
- **חלון מדינה**, **חלון "המספרים מאחורי המפה"**, **"הפתיעו אותי"**, **דפוסים** ו**ציר זמן** עם PLAY.

## מבנה
```
index.html, about.html        עמודים (נוצרים מ-templates/ על ידי הבנייה)
issue/<date>.html             "המשלוח השבועי" לכל גיליון
assets/css/kit.css            ערכת העיצוב המשותפת (RTL, בהיר/כהה, חלונות מונחים)
assets/css/atlas.css          שכבת האתר
assets/css/scenes.css         צבעים ותנועה של האיורים
assets/js/core.js             משותף: משפחות צבע, דגלים, דמויות, שעה מקומית, כרטיס סיפור, מונחים
assets/js/scenes.js           20 איורים מונפשים (SVG), אחד לכל סוג סיפור
assets/js/app.js              עמוד הבית: גלובוס, טיקר, סינון, סיפורים, חלונות
assets/js/vendor.js           d3-geo, d3-zoom, d3-selection, topojson-client (באנדל אחד, tools/vendor-entry.js)
assets/flags/                 דגלים מ-flag-icons (MIT), רק של מדינות שיש בהן סיפורים
data/world.js                 Natural Earth 1:50m (מפה שטוחה ובדיקת גבולות)
data/world-110m.js            Natural Earth 1:110m (הגלובוס המסתובב)
data/index.js                 רשימת הגיליונות והדפוסים
data/pins-<date>.js           הסיפורים של גיליון אחד
src/pins.json                 מקור האמת: הגדרות, גיליונות, דפוסים, קישורים, כל הנעצים
src/issues/<date>.json        קלט של גיליון (+ <date>.editorial.json לדפוסים וקישורים)
tools/build.mjs               ולידציה (גבולות, תגיות, דמות, איור, דגל, אזור זמן) ויצירת data/ ועמודים
tools/og.py                   תמונות OG ‏(1200×630)
tools/check.py                בדיקה ב-1280/390, בהיר/כהה, file:// ושרת
```

## הוספת גיליון
```bash
npm install                                   # פעם אחת: d3-geo, topojson-client, flag-icons לבנייה
node tools/build.mjs --add src/issues/2026-11-21.json
python3 tools/og.py                           # דורש playwright
python3 tools/check.py                        # עוצר על כל שגיאה
```
לכל נעץ צריך גם: `persona` (שם, גיל, תפקיד, מקום, סיפור, "אחרי", ואווטאר), `hook_he` לפס ההתראות, `teaser_he`, `scene` (אחד מהאיורים ב-`scenes.js`), `place.iso2` ו-`place.tz`. הבנייה נכשלת ולא כותבת כלום אם משהו חסר, אם נעץ נופל מחוץ למדינה שלו, אם תגית לא ברשימה הסגורה או אם כותרת ארוכה משמונה מילים.

## פריסה ב-GitHub Pages
‏Settings ← Pages ← Deploy from a branch ← `main` / root. הכתובת `https://ronygralnic.github.io/atlas/` כבר מוגדרת ב-`src/pins.json` ← `site.url`, ולכן תמונות ה-OG מוחלטות.

GoatCounter ‏(rony.goatcounter.com) נטען רק בכתובת אמיתית, לא ב-`file://` ולא ב-localhost.

## רישיונות
גבולות: Natural Earth (נחלת הכלל). דגלים: flag-icons ‏(MIT). גופנים: Heebo ו-Frank Ruhl Libre ‏(SIL OFL, ‏`assets/fonts/LICENSE-*`). האיורים והדמויות נוצרו לאתר. הדמויות בדויות.
