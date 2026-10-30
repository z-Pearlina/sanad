import type { Metadata } from "next";
import Dara from "@/components/Dara";
import Salla from "@/components/Salla";
import { GROUP_LABEL } from "@/lib/labels";
import { readData } from "@/lib/readData";
import type { Group } from "@/lib/types";

type Stats = {
  hadiths: number;
  isnads: number;
  isnadsFullyKnown: number;
  isnadsToProphet: number;
  isnadsWithNote: number;
  isnadsNotLocated: number;
  links: number;
  linksKnown: number;
  narrators: number;
  narratorsWithTabaqa: number;
  narratorsWithNisbaCity: number;
  narratorsWithManualHome: number;
  narratorsWithDeath: number;
  narratorsWithRank: number;
  taqribNarrators: number;
  taqribLocated: number;
  books: number;
  hadithsWithoutBook: number;
  cities: number;
  featured: number;
};
type MapFile = { tabaqat: { links: number }[] };

const s = readData<Stats>("stats.json");
const map = readData<MapFile>("map.json");
const chainLinks = map.tabaqat.reduce((sum, t) => sum + t.links, 0);
// Isolated left-to-right so the sign stays after the digits inside Arabic text.
const pct = (part: number, whole: number) => <bdi dir="ltr">{Math.round((part / whole) * 100)}%</bdi>;
const n = (v: number) => v.toLocaleString("en-US");

export const metadata: Metadata = { title: "حول سَنَد" };

const GROUPS: { group: Group | null; ranks: string }[] = [
  { group: "sahabi", ranks: "المرتبة 1: الصحابة" },
  { group: "thiqa", ranks: "المرتبتان 2 و3: من أُكّد مدحه، ثم ثقة أو متقن أو ثبت أو عدل" },
  { group: "saduq", ranks: "المرتبتان 4 و5: صدوق أو لا بأس به، ثم صدوق سيئ الحفظ أو يهم أو تغيّر بأخرة" },
  { group: "maqbul", ranks: "المراتب 6 و7 و9: مقبول، ومستور أو مجهول الحال، ومجهول" },
  { group: "daif", ranks: "المراتب 8 و10 و11 و12: ضعيف، ومتروك، ومتهم بالكذب، وكذاب" },
  { group: "see", ranks: "لم تُستخرج مرتبته آلياً، فالحكم في نص الترجمة" },
  { group: null, ranks: "لم يُعرف صاحب الاسم، فالدارة غُفل" },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="naskh text-4xl font-bold leading-snug">حول سَنَد</h1>
      <p className="naskh mt-3 text-xl leading-loose">
        «سَنَد» يعرض كل حديث من صحيح البخاري مع رجال سنده واحداً واحداً، وحكم ابن حجر على كل راوٍ بلفظه في «تقريب
        التهذيب»، ثم يروي السند على الخريطة وعلى خط الزمن: أين عاش رجاله، ومتى ماتوا، وكيف انتقل مركز الرواية عبر
        الأجيال.
      </p>

      <Section title="قصة الدارة">
        <figure className="flex flex-wrap items-end justify-center gap-x-16 gap-y-6 py-4">
          <DaraDrawing dotted caption="منقوطة" note="عُرفت ترجمة صاحبها" />
          <DaraDrawing dotted={false} caption="غُفل" note="لم يُعرف صاحب الاسم" />
        </figure>
        <blockquote className="naskh border-s-2 border-mughra ps-4 text-xl leading-loose">
          قال ابن الصلاح في المقدمة (النوع الخامس والعشرون): «ينبغي له أن يجعل بين كل حديثين دارة تفصل بينهما وتميز»،
          ونقل: «واستحب الخطيب الحافظ أن تكون الدارات غفلا، فإذا عارض فكل حديث يفرغ من عرضه ينقط في الدارة التي تليه
          نقطة».
        </blockquote>
        <p>
          كان المحدّث يترك الدارة فارغة، فإذا قابل الحديث بأصله نقّطها. وفي «سَنَد» كل راوٍ دارة على هذا المعنى: منقوطة إن
          عُرفت ترجمته في التقريب، وغُفل إن لم يُعرف صاحب الاسم، فيُكتب اسمه كما ورد في النص بلا تخمين. ولون الدارة من
          مرتبة الراوي عند ابن حجر، ولا يُعتمد على اللون وحده: لفظ الحكم مكتوب بجانب كل دارة.
        </p>
        <ul className="mt-2 space-y-2">
          {GROUPS.map(({ group, ranks }) => (
            <li key={group ?? "none"} className="flex items-start gap-3">
              <span className="pt-0.5">
                <Dara group={group} size={20} />
              </span>
              <span>
                <span className="font-semibold">{GROUP_LABEL[group ?? "unknown"]}</span>
                <span className="text-midad-soft"> · {ranks}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="المنهج">
        <ul className="list-disc space-y-2 ps-5">
          <li>
            نصوص الأحاديث بأسانيدها من نسخة fawazahmed0/hadith-api، وتُجلب في صفحة الحديث من Ummah API حين يتاح، ونصوصها
            واحدة.
          </li>
          <li>
            أداة isnady تقرأ الأسانيد من النص وتربط كل اسم بترجمته في «تقريب التهذيب» ({n(s.taqribNarrators)} ترجمة).
            البخاري نفسه ليس من حلقات النص، فأُضيف آخر كل سند من ترجمته.
          </li>
          <li>
            التطبيق لا يحكم على حديث ولا على راوٍ: ينقل لفظ ابن حجر كما هو، ويستعمل المرتبة للتلوين فقط. وعبارة «يتصل إلى
            النبي <Salla />» تُكتب حين تذكر الأداة أن السند ينتهي إليه، ولا يُستنتج منها رفع ولا وقف.
          </li>
          <li>
            موطن الراوي من نسبته في ترجمته، من جزء الاسم وحده قبل الحكم والوفاة، وإن تعددت النسب فالأخيرة («الكوفي ثم
            المكي» مكة). ومن لا نسبة له من أكثر الرجال وروداً، وأكثرهم صحابة، فموطنه من المشهور في التراجم، ويُكتب ذلك معه
            ({s.narratorsWithManualHome} راوياً في أسانيد البخاري). وكل خرائط الموقع تأخذ الموطن من مصدر واحد، فلا تختلف.
          </li>
          <li>
            الطبقات بلفظ ابن حجر في مقدمة التقريب، ومن لا تُعرف وفاته يُقرَّب زمنه بقاعدته: الأولى والثانية قبل المائة،
            ومن الثالثة إلى الثامنة بعد المائة، ومن التاسعة بعد المائتين. ويُرسم ذلك بخط متقطع ويوصف بأنه «تقريبي».
          </li>
          <li>
            خريطة الرئيسية: دوائرها لرجال الكتب الستة في التقريب ممن لهم طبقة ونسبة إلى بلد ({n(s.taqribLocated)} من{" "}
            {n(s.taqribNarrators)}، أي {pct(s.taqribLocated, s.taqribNarrators)})، على {s.cities} مدينة وإقليماً. وخطوطها
            انتقال الرواية من بلد الشيخ إلى بلد تلميذه في أسانيد البخاري، من {n(chainLinks)} صلة بين شيخ وتلميذه عُرف
            بلداهما.
          </li>
          <li>
            في صفحة الحديث يُروى السند على الخريطة راوياً بعد راوٍ من موطن الصحابي إلى البخاري، والمسافة في الملخص تقريبية
            بين المواطن لا الطرق. والخرائط كلها تعرض مواطن الرواة لا أماكن السماع.
          </li>
        </ul>
      </Section>

      <Section title="حدود البيانات">
        <ul className="list-disc space-y-2 ps-5">
          <li>
            رُبط {n(s.linksKnown)} اسماً من {n(s.links)} في الأسانيد بتراجمها ({pct(s.linksKnown, s.links)})، وعُرف كل رجال{" "}
            {n(s.isnadsFullyKnown)} سنداً فقط من {n(s.isnads)} ({pct(s.isnadsFullyKnown, s.isnads)}). ومن لم يُعرف يُعرض اسمه
            كما ورد في النص بلا تخمين.
          </li>
          <li>
            في الأسانيد {n(s.narrators)} راوياً مختلفاً: لـ{pct(s.narratorsWithTabaqa, s.narrators)} منهم طبقة، ولـ
            {pct(s.narratorsWithNisbaCity, s.narrators)} نسبة إلى بلد، ولـ{pct(s.narratorsWithDeath, s.narrators)} سنة
            وفاة.
          </li>
          <li>
            استخراج الحكم آلي وناقص عند بعض كبار الأئمة (مالك بلا مرتبة، ولفظ الزهري مبتور)، فالترجمة كاملة في صفحة كل
            راوٍ هي المرجع. ووسم «تعرّف آلي» يعني أن الأداة لم تقطع بصاحب الاسم.
          </li>
          <li>
            {s.isnadsNotLocated} سنداً لم يوجد نصه داخل نص الحديث فيُعرض بلا تلوين، و{s.isnadsWithNote} سنداً تعتمد على
            سند الحديث الذي قبلها فتُذكر الملاحظة معها. والتعاليق بعد المتن لا تستخرجها الأداة.
          </li>
          <li>
            عناوين الكتب العربية من مستودع AhmedBaset/hadith-json، وقد طابق ترقيمها ترقيمنا في الكتب الـ{s.books}.
          </li>
        </ul>
      </Section>

      <Section title="المصادر والرخص">
        <ul className="space-y-2">
          <Source name="isnady" href="https://github.com/bayramkotan/isnady" license="MIT">
            قراءة الأسانيد وربط الرواة بتراجمهم.
          </Source>
          <Source name="isnady-data" href="https://github.com/bayramkotan/isnady-data">
            نصوص صحيح البخاري، وملف «تقريب التهذيب».
          </Source>
          <Source name="fawazahmed0/hadith-api" href="https://github.com/fawazahmed0/hadith-api" license="Unlicense">
            أصل نصوص الأحاديث العربية والإنجليزية.
          </Source>
          <Source name="OpenITI" href="https://openiti.org">
            «تقريب التهذيب» لابن حجر العسقلاني، بتحقيق محمد عوامة (دار الرشيد، 1406هـ/1986م).
          </Source>
          <Source name="Ummah API" href="https://ummahapi.com">
            نص الحديث في صفحة الحديث.
          </Source>
          <Source name="AhmedBaset/hadith-json" href="https://github.com/AhmedBaset/hadith-json">
            عناوين كتب البخاري بالعربية.
          </Source>
          <Source name="Natural Earth" href="https://www.naturalearthdata.com" license="ملكية عامة">
            خريطة الأساس: اليابسة عبر حزمة world-atlas (رخصة ISC)، والأنهار والبحيرات بمقياس 1:50m.
          </Source>
          <Source name="d3" href="https://d3js.org" license="ISC">
            رسم الخرائط: الإسقاط وقت البناء، والتكبير والحركة في المتصفح.
          </Source>
          <Source name="Amiri وIBM Plex Sans Arabic وAref Ruqaa" href="https://fontsource.org" license="SIL OFL 1.1">
            الخطوط، مستضافة مع الموقع.
          </Source>
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 space-y-3 border-t border-khatt pt-6 leading-relaxed">
      <h2 className="naskh text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** A large dara as a scribe drew it: dotted once checked, ghufl (empty) until then. */
function DaraDrawing({ dotted, caption, note }: { dotted: boolean; caption: string; note: string }) {
  return (
    <figcaption className="flex flex-col items-center gap-2">
      <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r="44" fill="none" stroke="var(--midad)" strokeWidth="3" />
        <circle cx="52" cy="52" r="38" fill="none" stroke="var(--mughra)" strokeWidth="1.2" />
        {dotted && <circle cx="52" cy="52" r="9" fill="var(--midad)" />}
      </svg>
      <span className="naskh text-2xl font-bold">{caption}</span>
      <span className="text-sm text-midad-soft">{note}</span>
    </figcaption>
  );
}

function Source({ name, href, license, children }: { name: string; href: string; license?: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="font-semibold text-nila underline underline-offset-4 phone:inline-flex phone:min-h-11 phone:min-w-11 phone:items-center" dir="auto">
        {name}
      </a>
      {license && <span className="text-sm text-midad-soft"> · {license}</span>}
      <span className="block text-midad-soft">{children}</span>
    </li>
  );
}
