<div dir="rtl">

# سَنَد: رجال صحيح البخاري في الزمان والمكان

موقع عربي يعرض كل حديث من صحيح البخاري مع رجال سنده واحداً واحداً، وحكم ابن حجر على كل راوٍ بلفظه في «تقريب التهذيب»، ثم يضع السند على الخريطة وعلى خط الزمن.

## ما في الموقع

- **الرئيسية:** خريطة انتشار رواة الكتب الستة عبر الطبقات الاثنتي عشرة، بمنزلق وزر تشغيل، ثم البحث والأحاديث المختارة.
- **صفحة الحديث** (`/hadith/?n=1`): النص بصيغ التحمّل ملوّنة وأسماء الرواة روابط، والسلسلة من النبي ﷺ إلى البخاري بدارة لكل راوٍ وحكمه، وخريطة السند، والشريط الزمني للوفيات.
- **صفحة الراوي** (`/narrator/?id=4685`): ترجمته كاملة من التقريب، وطبقته ووفاته وبلده، وشيوخه وتلاميذه في أسانيد البخاري، وأحاديثه.
- **الكتب** (`/books/`)، و**حول** (`/about/`): المنهج والمصادر وحدود البيانات.

## المنهج باختصار

- أداة isnady تقرأ الأسانيد من نصوص البخاري وتربط كل اسم بترجمته في التقريب.
- التطبيق لا يصدر حكماً: ينقل لفظ ابن حجر كما هو، ويستعمل مرتبته للتلوين فقط.
- البلد من نسبة الراوي في ترجمته، والخريطة تعرض مواطن الرواة لا أماكن السماع.
- كل رقم في الواجهة محسوب من البيانات (`public/data/stats.json`).

## التقنية

- Next.js 16 بتصدير ثابت (`output: "export"`)، وTypeScript، وTailwind 4. لا خادم ولا قاعدة بيانات وقت التشغيل.
- البيانات ملفات JSON مولَّدة مسبقاً في `public/data/` ومرفوعة مع المستودع، فلا يحتاج النشر إلى Python.
- الخريطة تُسقط وقت توليد البيانات بـd3-geo وtopojson-client من world-atlas، فيصل إلى المتصفح مسار SVG جاهز.
- نص الحديث يُجلب من Ummah API في المتصفح، مع بديل صامت من بياناتنا إن تعذّر.

## التشغيل محلياً

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # static site in out/
```

## إعادة توليد البيانات (اختياري)

يحتاج Python 3 وgit. الأوامر لـbash:

```bash
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/bayramkotan/isnady-data data-src/isnady-data
git -C data-src/isnady-data sparse-checkout set --no-cone /catalog.json /sunni/sahih_al_bukhari/book.json /sunni/sahih_al_bukhari/ara.json /sunni/sahih_al_bukhari/eng.json /rijal/sunni/
git -C data-src/isnady-data checkout
python -m venv .venv-isnady
.venv-isnady/bin/pip install --no-deps isnady    # Windows: .venv-isnady/Scripts/pip
IY=.venv-isnady/bin/iy
$IY repo add "$PWD/data-src/isnady-data"
$IY repo use isnady-all-sources-default
$IY catalog import sahih_al_bukhari --language ara --language eng
$IY catalog import taqrib_al_tahdhib_ibn_hajar_al_asqalani
npm run data       # scripts/build_data.py, then scripts/build_map.mjs
```

## النشر على Render

Static Site، وأمر البناء `npm ci && npm run build`، ومجلد النشر `out` (والإعداد نفسه في `render.yaml`).

## المصادر والرخص

| المصدر | الاستعمال | الرخصة |
|---|---|---|
| [isnady](https://github.com/bayramkotan/isnady) | قراءة الأسانيد وربط الرواة | MIT |
| [isnady-data](https://github.com/bayramkotan/isnady-data) | نصوص البخاري وملف التقريب | |
| [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api) | أصل نصوص الأحاديث | Unlicense |
| [OpenITI](https://openiti.org) | «تقريب التهذيب» لابن حجر، تحقيق محمد عوامة (دار الرشيد، 1986) | |
| [Ummah API](https://ummahapi.com) | نص الحديث في صفحة الحديث | |
| [AhmedBaset/hadith-json](https://github.com/AhmedBaset/hadith-json) | عناوين الكتب بالعربية | |
| [world-atlas](https://github.com/topojson/world-atlas) / Natural Earth | يابسة الخريطة | ISC / ملك عام |
| Amiri، IBM Plex Sans Arabic، Aref Ruqaa ([Fontsource](https://fontsource.org)) | الخطوط | SIL OFL 1.1 |

</div>

---

## English summary

**Sanad** shows every hadith of Sahih al-Bukhari with the men of its chain one by one, Ibn Hajar's verdict on each narrator in his own words (from *Taqrib al-Tahdhib*), and the chain on a map and a timeline: where its narrators lived, when they died, and how the centre of transmission moved across the generations.

- **Home:** a map of where the narrators of the six books lived, generation (tabaqa) by generation, with a slider and a play button; search by hadith number or narrator name; featured hadiths.
- **Hadith page** (`/hadith/?n=1`): the Arabic text with transmission words marked and narrators linked; the chain from the Prophet ﷺ down to al-Bukhari; the chain map; a timeline of death years. Text is fetched live from the Ummah API, with a silent fallback to the bundled data.
- **Narrator page** (`/narrator/?id=4685`): the full Taqrib entry, tabaqa, death, home, teachers and students as they appear in al-Bukhari's chains.

The app issues no grading of its own: it quotes Ibn Hajar and uses his rank only for colour. Chains are parsed and linked by [isnady](https://github.com/bayramkotan/isnady) (MIT); texts come from fawazahmed0/hadith-api (Unlicense) via isnady-data; the Taqrib from OpenITI. Built with Next.js 16 (static export), TypeScript and Tailwind 4; every figure shown is computed from the data.
