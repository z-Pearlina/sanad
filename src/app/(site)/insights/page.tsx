import type { Metadata } from "next";
import { FormulaChart, LengthChart, LinkedChart, RegionChart, type Length, type Linked, type Row, type Turning } from "@/components/InsightCharts";
import { GROUP_LABEL } from "@/lib/labels";
import { readData } from "@/lib/readData";

type Insights = {
  formulas: { labels: string[]; rows: Row[]; unplaced: number; turning: Turning };
  regions: { labels: string[]; rows: Row[] };
  lengths: { total: number; rows: Length[] };
  linked: Linked[];
};

export const metadata: Metadata = { title: "رؤى من البيانات · سَنَد" };

const data = readData<Insights>("insights.json");
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export default function InsightsPage() {
  const { formulas, regions, lengths, linked } = data;
  const counted = sum(formulas.rows.map((r) => r.total));
  const late = sum(formulas.rows.filter((r) => r.t > 11).map((r) => r.total));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="naskh text-4xl font-bold leading-snug">رؤى من البيانات</h1>
      <p className="mt-2 text-midad-soft">أرقام وصفية من أسانيد صحيح البخاري في هذه البيانات، لا أحكام. مرّ على الرسوم أو اضغط عليها لترى تفاصيلها.</p>

      <Insight
        title="كيف تغيّرت صيغ الأداء عبر الطبقات؟"
        note={`تُنسب الصيغة في كل صلة إلى من قالها، أي التلميذ، وفي أول صلة هو البخاري من الطبقة الحادية عشرة. حُسبت ${counted} صلة، وبقيت ${formulas.unplaced} لا تُعرف طبقة قائلها.${late ? ` وصلات الطبقة الثانية عشرة (${late}) أقل من أن تُرسم.` : ""}`}
      >
        <FormulaChart labels={formulas.labels} rows={formulas.rows} turning={formulas.turning} />
      </Insight>

      <Insight
        title="أين عاش رواة كل طبقة؟"
        note="الأعداد نفسها التي على الخريطة الرئيسية: رواة تقريب التهذيب ممن تدل نسبتهم على بلد، مجموعة بالأقاليم، لا أماكن سماعهم."
      >
        <RegionChart labels={regions.labels} rows={regions.rows} />
      </Insight>

      <div className="grid gap-x-12 lg:grid-cols-2">
        <Insight
          title="كم رجلاً في السند؟"
          note="الأسانيد التامة فقط: تتصل إلى النبي ﷺ، ورجالها كلهم معروفون، وآخرها صحابي، وأولها شيخ من الطبقة التاسعة فما بعدها، حتى لا تدخل الأسانيد المعلّقة."
        >
          <LengthChart total={lengths.total} rows={lengths.rows} />
        </Insight>

        <Insight
          title="من أكثر الرواة صلات؟"
          note={`عدد المختلفين ممن عُرفت تراجمهم، لا عدد المرات، دون البخاري نفسه. وليس كثرة الصلات حكماً على الراوي: الحكم لفظ ابن حجر في ترجمته، ومجموعاته في الموقع من ${GROUP_LABEL.sahabi} إلى ${GROUP_LABEL.daif}.`}
        >
          <LinkedChart men={linked} />
        </Insight>
      </div>
    </main>
  );
}

function Insight({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-khatt pt-6">
      <h2 className="naskh mb-3 text-2xl font-bold leading-normal">{title}</h2>
      {children}
      <p className="mt-3 text-xs leading-relaxed text-midad-soft">{note}</p>
    </section>
  );
}
