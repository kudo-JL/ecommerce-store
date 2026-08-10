# 🚀 دليل النشر الكامل — متجر إلكتروني

هذا الدليل يوصلك من "مجلد فيه ملفات" إلى **متجر منشور على الأنترنيت + تطبيق PWA قابل للتثبيت + (اختياري) تطبيق على Google Play**، بأقل مجهود ممكن.

---

## 🎯 الملخص — خطوتين فقط

| الخطوة | النتيجة | الوقت | التكلفة |
|---|---|---|---|
| **1. النشر على الأنترنيت** (Railway) | المتجر يخدم زبائنك على دومين عام | 5–10 دقائق | مجاني، ثم $5/شهر |
| **2a. PWA تلقائي** (بعد النشر) | الزبون يقدر يثبّته كتطبيق بدون Google Play | **فوري** (الملفات جاهزة) | 0 |
| **2b. Google Play** (اختياري) | تطبيقك يظهر في متجر Google Play | 1–2 ساعة إعداد + 1–7 أيام مراجعة Google | $25 مرة وحدة |

> ✅ **الخطوة 2a (PWA) كافية 100%** لتبدأ تبيع اليوم.
> ⭐ **الخطوة 2b (Google Play)** لما يكون عندك زبائن وتبي اسمك الرسمي في المتجر.

---

## ⚡ المسار السريع: Railway.app (5 دقائق)

**Railway** = سيرفر سحابي يدير كل شي (HTTPS، domains، backups أولية). الأسهل للمبتدئين.

### الخطوة 1.1: ارفع المشروع على GitHub

افتح PowerShell في مجلد المشروع (بعد فك الضغط عن `ecommerce-store.zip`):

```powershell
cd ecommerce-store
git init
git add .
git commit -m "Initial commit"
# الآن أنشئ repo جديد على github.com (بدون README, بدون .gitignore — كله موجود)
# ثم:
git remote add origin https://github.com/YOUR_USERNAME/ecommerce-store.git
git branch -M main
git push -u origin main
```

> لو ما عندك git: حمّله من [git-scm.com](https://git-scm.com)، ثم `git config --global user.name "اسمك"` و `git config --global user.email "إيميلك"`.

### الخطوة 1.2: أنشئ مشروع Railway

1. ادخل [railway.app](https://railway.app) وسجّل بحساب GitHub
2. اضغط **New Project** → **Deploy from GitHub repo** → اختر `ecommerce-store`
3. Railway يبدأ يبني تلقائياً ويشغّل المشروع

### الخطوة 1.3: أضف قرص ثابت لـ SQLite

> ⚠️ بدون هذي الخطوة، قاعدة البيانات تتمسح مع كل إعادة نشر!

في Railway dashboard:
1. اضغط على كارت الخدمة (ecommerce-store)
2. اضغط **+ New** → **Volume** → Mount Path: `/app/data` → اضغط Add
3. ارجع للخدمة → اذهب لـ **Variables** → اضغط **+ New Variable**:
   - `PORT` = `3000`
4. اذهب لـ **Settings** → **Deploy** → اضغط **Restart**

### الخطوة 1.4: أول تشغيل (تهيئة DB + منتوجات تجريبية)

في Railway اضغط على الخدمة → **Settings** → **Deploy** → **Custom Start Command**:
```
node scripts/init-db.js && node scripts/seed.js && node server.js
```
أو الأسهل: من **Settings** → **One-off command** (أو shell):
```bash
node scripts/init-db.js
node scripts/seed.js
```

### الخطوة 1.5: دومينك (اختياري لكن مهم)

في Railway → Settings → **Networking** → **Generate Domain** يعطيك رابط فرعي: `your-app.up.railway.app`

لو عندك دومين خاص (`yourstore.com`):
1. **Custom Domain** في Railway → يضيف لك CNAME
2. روح لمزود الدومين (Namecheap, GoDaddy…) → DNS → أضف CNAME

### ✅ انتهيت!

افتح `https://your-app.up.railway.app` — المتجر شغّال.

**روابط مهمة:**
- المتجر: `https://your-app.up.railway.app/`
- لوحة التحكم: `https://your-app.up.railway.app/admin/` (كلمة المرور: `JL@kudo92`)

> ⚠️ **غيّر كلمة المرور فوراً** من الإعدادات بعد أول دخول.

---

## 📱 PWA: تطبيق قابل للتثبيت (تلقائي!)

بما أننا أضفنا الملفات الجاهزة في المشروع (`manifest.webmanifest` + `sw.js` + الأيقونات + link tags في القوالب)، **ما تحتاج تسوي شي إضافي**. بعد نشر الموقع:

1. افتح `https://yourstore.com` في Chrome (أندرويد أو PC)
2. شوف شريط العنوان → أيقونة **"تثبيت"** (في PC: علامة `+` على يمين شريط العنوان؛ في الموبايل: `⋮` → "إضافة للشاشة الرئيسية")
3. اضغطها → يصير عندك تطبيق بأيقونة 🛍️، يفتح بملء الشاشة، يشتغل أوفلاين

**للزبون:** نفس الخطوات. ما يحتاج Google Play.

---

## 📲 Google Play (اختياري، لما تكون جاهز)

**الفكرة:** نغلّف الـ PWA في "قشرة Android" باستخدام [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) من Google. النتيجة: تطبيق حقيقي على Play Store، يفتح موقعك، بدون سطر كود Android.

### الخطوة 2b.1: حساب Google Play Developer

1. ادفع **$25 مرة وحدة** على [play.google.com/console/signup](https://play.google.com/console/signup)
2. استخدم أي Gmail (شخصي يفي بالغرض)
3. املأ بيانات المطوّر (اسمك، عنوان، طريقة دفع)

### الخطوة 2b.2: جهّز PWA

تأكد إن موقعك على دومين عام بـ **HTTPS** (Railway يوفره تلقائياً).

### الخطوة 2b.3: ثبّت Bubblewrap

على جهازك (PowerShell):
```powershell
npm install -g @bubblewrap/cli
```

### الخطوة 2b.4: ابني التطبيق

```powershell
# عدّل twa-manifest.json: ضع دومينك الحقيقي في "host"
# ثم:
bubblewrap init --manifest=https://yourstore.com/manifest.webmanifest
bubblewrap build
```

هذا يعطيك ملف `app-bundle-release.aab` + ملف `android.keystore` (احتفظ بالـ keystore! لو ضاع ما تقدر تحدّث التطبيق).

### الخطوة 2b.5: اربط التطبيق بالموقع (Digital Asset Links)

1. خذ SHA256 من الـ keystore:
   ```powershell
   keytool -list -v -keystore android.keystore -alias my-key-alias | Select-String "SHA256"
   ```
2. افتح `public/.well-known/assetlinks.json` في المشروع
3. استبدل `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` بالقيمة الحقيقية
4. ارفع التحديث لـ Railway (commit + push)
5. تحقق: افتح `https://yourstore.com/.well-known/assetlinks.json` — لازم يطلع JSON صحيح

### الخطوة 2b.6: قدّم على Google Play

1. ادخل [play.google.com/console](https://play.google.com/console)
2. **Create app** → اسم: "متجري" → لغة: العربية
3. **Production** → **Create new release** → ارفع `app-bundle-release.aab`
4. املأ **Store listing**:
   - وصف قصير (80 حرف)
   - وصف كامل (4000 حرف)
   - لقطات شاشة (8.5" tablet + 6" phone)
   - أيقونة 512x512 (موجودة في `public/uploads/icon-512.png`)
   - Feature graphic 1024x500
   - **Privacy policy URL** (استعمل [privacypolicies.com](https://www.privacypolicies.com) لتوليد مجاني)
5. **Content rating** → املأ الاستبيان
6. **App content** → أكّد لا يوجد محتوى حساس
7. اضغط **Review release** → **Start rollout to Production**
8. انتظر **1–7 أيام** للمراجعة

### ✅ تطبيقك على Google Play!

روابط الزبائن: `https://play.google.com/store/apps/details?id=com.yourstore.app`

---

## 🔧 المسار البديل: VPS خاص (Hetzner / OVH)

لما تبغى تحكم كامل + أرخص على المدى الطويل. سيرفر بـ 3–4€/شهر.

### على السيرفر (SSH):

```bash
# تحديث + تثبيت
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx

# رفع المشروع
scp -r ecommerce-store root@YOUR_SERVER_IP:/var/www/

# تشغيل
cd /var/www/ecommerce-store
npm install --production
node scripts/init-db.js
node scripts/seed.js

# PM2 (يبقيه شغّال 24/7)
npm install -g pm2
pm2 start ecosystem.config.js
pm2 startup
pm2 save

# Nginx
cp nginx.conf.example /etc/nginx/sites-available/store
nano /etc/nginx/sites-available/store   # غيّر yourstore.com
ln -s /etc/nginx/sites-available/store /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL مجاني
certbot --nginx -d yourstore.com -d www.yourstore.com
```

### نسخ احتياطي يومي للـ SQLite:

```bash
# أنشئ /etc/cron.daily/backup-store
cat <<'EOF' > /etc/cron.daily/backup-store
#!/bin/bash
mkdir -p /var/backups/store
cp /var/www/ecommerce-store/data/store.db /var/backups/store/db-$(date +\%F).db
find /var/backups/store -name "*.db" -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/backup-store
```

---

## 📋 قائمة فحص ما قبل الإطلاق

- [ ] غيّرت كلمة مرور المدير من `/admin/settings`
- [ ] عدّلت `store_name` و `store_tagline` و `currency` من الإعدادات
- [ ] أضفت منتوجاتك الحقيقية (أو استخدمت "استيراد من رابط")
- [ ] اختبرت إضافة للسلة + إتمام طلب
- [ ] اختبرت PWA: افتحت الموقع في Chrome → "تثبيت"
- [ ] (اختياري) ملأت assetlinks.json ورفعته
- [ ] (اختياري) نشرت على Google Play

---

## 🆘 حل المشاكل

| المشكلة | الحل |
|---|---|
| `EADDRINUSE` على Railway | المنفذ مشغول — تأكد إنك ما تشغّل المشروع محلياً في نفس الوقت |
| `SQLITE_CANTOPEN` | القرص الثابت (Volume) مو مربوط على `/app/data` |
| 502 Bad Gateway (VPS) | `pm2 status` — أعد التشغيل: `pm2 restart ecommerce-store` |
| PWA ما يطلع "تثبيت" | تأكد من HTTPS + افتح DevTools → Application → Manifest |
| Play Console رفض التطبيق | اقرأ رسالة الرفض بعناية، غالباً تحتاج تضيف Privacy Policy URL |

---

**كل شي جاهز — ارفع، انشر، ابدأ بيع! 🚀**
