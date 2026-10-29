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
  narratorsWithReviewedCity: number;
  narratorsWithDeath: number;
  narratorsWithRank: number;
  taqribNarrators: number;
  taqribLocated: number;
  books: number;
  hadithsWithoutBook: number;
  cities: number;
};

const s = readData<Stats>("stats.json");
// Isolated left-to-right so the sign stays after the digits inside Arabic text.
const pct = (part: number, whole: number) => <bdi dir="ltr">{Math.round((part / whole) * 100)}%</bdi>;

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
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="naskh text-3xl font-bold leading-snug">حول سَنَد</h1>
      <p className="naskh mt-2 text-xl">
        «سَنَد» يعرض كل حديث من صحيح البخاري مع رجال سنده واحداً واحداً، وحكم ابن حجر على كل راوٍ بلفظه في «تقريب
        التهذيب»، ثم يضع السند على الخريطة وعلى خط الزمن: أين عاش رجاله، ومتى ماتوا، وكيف انتقل مركز الرواية عبر
        الأجيال.
      </p>

      <Section title="الدارة">
        <blockquote className="naskh border-s-2 border-mughra ps-4 text-xl">
          قال ابن الصلاح في المقدمة (النوع الخامس والعشرون): «ينبغي له أن يجعل بين كل حديثين دارة تفصل بينهما وتميز»،
          ونقل: «واستحب الخطيب الحافظ أن تكون الدارات غفلا، فإذا عارض فكل حديث يفرغ من عرضه ينقط في الدارة التي تليه
          نقطة».
        </blockquote>
        <p>
          فكل راوٍ في «سَنَد» دارة: منقوطة إن عُرفت ترجمته في التقريب، وغُفل (فارغة) إن لم يُعرف صاحب الاسم. ولون
          الدارة من مرتبة الراوي عند ابن حجر، ولا يُعتمد على اللون وحده: لفظ الحكم مكتوب بجانب كل دارة.
        </p>
        <ul className="mt-2 space-y-2">
          {GROUPS.map(({ group, ranks }) => (
            <li key={group ?? "none"} className="flex items-start gap-3">
              <span className="pt-0.5"><Dara group={group} size={20} /></span>
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
            أداة isnady تقرأ الأسانيد من النص وتربط كل اسم بترجمته في «تقريب التهذيب» ({s.taqribNarrators} ترجمة).
            البخاري نفسه ليس من حلقات النص، فأُضيف آخر كل سند من ترجمته.
          </li>
          <li>
            التطبيق لا يحكم على حديث ولا على راوٍ: ينقل لفظ ابن حجر كما هو، ويستعمل المرتبة للتلوين فقط. وعبارة «يتصل إلى
            النبي <Salla />» تُكتب حين تذكر الأداة أن السند ينتهي إليه، ولا يُستنتج منها رفع ولا وقف.
          </li>
          <li>
            البلد من نسبة الراوي في ترجمته، من جزء الاسم وحده قبل الحكم والوفاة، وإن تعددت النسب فالأخيرة («الكوفي ثم
            المكي» مكة). والصحابة أكثرهم بلا نسبة، فلـ{s.narratorsWithReviewedCity} من أكثرهم وروداً موطن روجع يدوياً.
            الخريطة تعرض مواطن الرواة لا أماكن السماع.
          </li>
          <li>
            الطبقات بلفظ ابن حجر في مقدمة التقريب، ومن لا تُعرف وفاته يُقرَّب زمنه بقاعدته: الأولى والثانية قبل المائة،
            ومن الثالثة إلى الثامنة بعد المائة، ومن التاسعة بعد المائتين. ويُرسم ذلك بخط متقطع ويوصف بأنه «تقريبي».
          </li>
          <li>
            خريطة الرئيسية لكل رجال الكتب الستة في التقريب ممن لهم طبقة ونسبة إلى بلد ({s.taqribLocated} من{" "}
            {s.taqribNarrators}، أي {pct(s.taqribLocated, s.taqribNarrators)})، وعلى {s.cities} مدينة وإقليماً.
          </li>
        </ul>
      </Section>

      <Section title="حدود البيانات">
        <ul className="list-disc space-y-2 ps-5">
          <li>
            رُبط {s.linksKnown} اسماً من {s.links} في الأسانيد بتراجمها ({pct(s.linksKnown, s.links)})، وعُرف كل رجال{" "}
            {s.isnadsFullyKnown} سنداً فقط من {s.isnads} ({pct(s.isnadsFullyKnown, s.isnads)}). ومن لم يُعرف يُعرض اسمه
            كما ورد في النص بلا تخمين.
          </li>
          <li>
            في الأسانيد {s.narrators} راوياً مختلفاً: لـ{pct(s.narratorsWithTabaqa, s.narrators)} منهم طبقة، ولـ
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
          <Source name="Natural Earth عبر world-atlas" href="https://github.com/topojson/world-atlas" license="ISC، والبيانات ملك عام">
            يابسة الخريطة.
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

function Source({ name, href, license, children }: { name: string; href: string; license?: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="font-semibold text-nila underline underline-offset-4" dir="auto">
        {name}
      </a>
      {license && <span className="text-sm text-midad-soft"> · {license}</span>}
      <span className="block text-midad-soft">{children}</span>
    </li>
  );
}
