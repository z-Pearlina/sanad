"""Build the static JSON data of the site from isnady.db and the Taqrib file.

Usage:
    python scripts/build_data.py [--db PATH] [--taqrib PATH] [--out public/data]

isnady.db is produced by the isnady CLI (see README). Only the Python
standard library is used, so the output can be regenerated anywhere and is
committed to the repository (the static host never runs Python).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "isnady" / "isnady.db"
DEFAULT_TAQRIB = ROOT / "data-src/isnady-data/rijal/sunni/taqrib_al_tahdhib_ibn_hajar_al_asqalani.md"
BOOK_TITLES = ROOT / "scripts/bukhari_books_ar.json"
SAHABA_HOMES = ROOT / "scripts/sahaba_homes.json"  # reviewed homes of Companions without a city nisba

# Featured hadiths (reviewed): every narrator identified, confidence >= 0.8, three cities or more,
# short and well known. Hadith 1 is kept first although its chain has two cities only.
FEATURED = ["1", "3461", "6724", "3636", "5363", "6516", "1610", "2075", "1933", "3559", "5448", "1913", "2875"]

BUKHARI_TAQRIB = "5727"  # al-Bukhari himself, appended as the last link of every chain

# ---------------------------------------------------------------- Arabic text

MARKS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def strip_marks(text: str) -> str:
    return MARKS.sub("", text).replace("ٱ", "ا").strip()


def norm(text: str) -> str:
    """Loose form used to compare words: no marks, unified alef/ya/ta marbuta."""
    t = strip_marks(text)
    t = re.sub("[آأإٱ]", "ا", t)
    return t.replace("ى", "ي").replace("ة", "ه")


# ---------------------------------------------------------------- cities

# key: (Arabic name, lat, lon, kind)
CITIES = {
    "madina": ("المدينة", 24.47, 39.61, "city"),
    "makka": ("مكة", 21.42, 39.83, "city"),
    "taif": ("الطائف", 21.27, 40.42, "city"),
    "yamama": ("اليمامة", 24.63, 46.72, "city"),
    "sanaa": ("صنعاء", 15.37, 44.19, "city"),
    "yaman": ("اليمن", 15.0, 45.5, "region"),
    "kufa": ("الكوفة", 32.03, 44.40, "city"),
    "basra": ("البصرة", 30.50, 47.78, "city"),
    "baghdad": ("بغداد", 33.31, 44.37, "city"),
    "wasit": ("واسط", 32.19, 46.30, "city"),
    "mawsil": ("الموصل", 36.34, 43.13, "city"),
    "jazira": ("الجزيرة", 36.2, 40.8, "region"),
    "harran": ("حران", 36.86, 39.03, "city"),
    "sham": ("الشام", 34.2, 37.6, "region"),
    "dimashq": ("دمشق", 33.51, 36.29, "city"),
    "hims": ("حمص", 34.73, 36.72, "city"),
    "quds": ("بيت المقدس", 31.78, 35.23, "city"),
    "ramla": ("الرملة", 31.93, 34.87, "city"),
    "asqalan": ("عسقلان", 31.67, 34.57, "city"),
    "ayla": ("أيلة", 29.53, 35.01, "city"),
    "misr": ("مصر", 30.01, 31.23, "city"),
    "tinnis": ("تنيس", 31.20, 32.23, "city"),
    "rayy": ("الري", 35.59, 51.44, "city"),
    "isbahan": ("أصبهان", 32.65, 51.67, "city"),
    "khurasan": ("خراسان", 36.0, 59.5, "region"),
    "naysabur": ("نيسابور", 36.21, 58.80, "city"),
    "marw": ("مرو", 37.66, 62.19, "city"),
    "harat": ("هراة", 34.35, 62.20, "city"),
    "balkh": ("بلخ", 36.76, 66.90, "city"),
    "baghlan": ("بغلان", 36.13, 68.70, "city"),
    "bukhara": ("بخارى", 39.77, 64.42, "city"),
}

# nisba word (normalized, with the article) -> city key
NISBAS = {
    "المدني": "madina", "المديني": "madina", "المكي": "makka", "الطائفي": "taif",
    "اليمامي": "yamama", "الصنعاني": "sanaa", "اليماني": "yaman",
    "الكوفي": "kufa", "البصري": "basra", "البغدادي": "baghdad", "الواسطي": "wasit",
    "الموصلي": "mawsil", "الجزري": "jazira", "الحراني": "harran",
    "الشامي": "sham", "الدمشقي": "dimashq", "الحمصي": "hims", "المقدسي": "quds",
    "الرملي": "ramla", "العسقلاني": "asqalan", "الايلي": "ayla",
    "المصري": "misr", "التنيسي": "tinnis",
    "الرازي": "rayy", "الاصبهاني": "isbahan", "الخراساني": "khurasan",
    "النيسابوري": "naysabur", "المروزي": "marw", "الهروي": "harat", "البلخي": "balkh",
    "البغلاني": "baghlan", "البخاري": "bukhara",
}
NISBAS = {norm(k): v for k, v in NISBAS.items()}

# The name part of an entry ends where Ibn Hajar starts quoting, grading or dating.
# Words are in normalized form (see norm): ه for ة, ي for ى, plain alef.
NAME_END = re.compile(
    r"\s(?:و?قال|مات|و?روي|روايه|عن|صحابي|صحابيه|صحبه|رؤيه|ثقه|صدوق|مقبول|ضعيف|مجهول|مجهوله|متروك|لا يعرف"
    r"|من\s+(?:ال)?(?:اولي|ثانيه|ثالثه|رابعه|خامسه|سادسه|سابعه|ثامنه|تاسعه|عاشره|حاديه|صغار|كبار))(?!\S)")

# ---------------------------------------------------------------- tabaqat

TABAQAT = {
    1: ("الأولى", "الصحابة", "", "before100"),
    2: ("الثانية", "كبار التابعين", "كابن المسيب", "before100"),
    3: ("الثالثة", "الطبقة الوسطى من التابعين", "كالحسن وابن سيرين", "after100"),
    4: ("الرابعة", "طبقة تليها، جلّ روايتهم عن كبار التابعين", "كالزهري وقتادة", "after100"),
    5: ("الخامسة", "الطبقة الصغرى من التابعين، الذين رأوا الواحد والاثنين ولم يثبت لبعضهم السماع من الصحابة", "كالأعمش", "after100"),
    6: ("السادسة", "طبقة عاصروا الخامسة، لكن لم يثبت لهم لقاء أحد من الصحابة", "كابن جريج", "after100"),
    7: ("السابعة", "كبار أتباع التابعين", "كمالك والثوري", "after100"),
    8: ("الثامنة", "الطبقة الوسطى من أتباع التابعين", "كابن عيينة وابن علية", "after100"),
    9: ("التاسعة", "الطبقة الصغرى من أتباع التابعين", "كيزيد بن هارون والشافعي وأبي داود الطيالسي وعبد الرزاق", "after200"),
    10: ("العاشرة", "كبار الآخذين عن تبع الأتباع ممن لم يلق التابعين", "كأحمد بن حنبل", "after200"),
    11: ("الحادية عشرة", "الطبقة الوسطى من ذلك", "كالذهلي والبخاري", "after200"),
    12: ("الثانية عشرة", "صغار الآخذين عن تبع الأتباع", "كالترمذي", "after200"),
}

# Ibn Hajar rank (1..12) -> color group
RANK_GROUP = {1: "sahabi", 2: "thiqa", 3: "thiqa", 4: "saduq", 5: "saduq",
              6: "maqbul", 7: "maqbul", 9: "maqbul", 8: "daif", 10: "daif", 11: "daif", 12: "daif"}

PROBLEMS_AR = {
    "no chain of its own: the text goes on from the hadith before it":
        "ليس له سند مستقل: النص متصل بالحديث الذي قبله",
    'the chain of the hadith before it ("from him" / "with this chain")':
        "يعتمد على سند الحديث الذي قبله («عنه» / «بهذا الإسناد»)",
}

# Transmission words shown in vermilion inside the text (normalized forms).
TAHAMMUL = {norm(w) for w in [
    "حدثنا", "حدثني", "وحدثنا", "وحدثني", "أخبرنا", "أخبرني", "وأخبرنا", "وأخبرني",
    "أنبأنا", "أنبأني", "عن", "سمعت", "سمع", "سمعا", "أن", "أنه", "أنها", "سألت",
    "كتب", "قرأت", "حدثه", "حدثها", "أخبره", "أخبرها", "يحدث", "يخبر",
]}


# ---------------------------------------------------------------- Taqrib file

def read_taqrib(path: Path) -> dict[str, str]:
    """Taqrib number -> full entry text, without page/manuscript markers.

    Entries start with "### $ N", "### $$ N" (women) or "### $DIC_NIS$ N".
    A number printed twice in the edition gets a "b" on its second use, as in isnady.
    """
    entries: dict[str, list[str]] = {}
    current = None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^### \$(?:\$|DIC_\w+\$)? (\d+) (.*)$", line)
        if m:
            current = m.group(1) + ("b" if m.group(1) in entries else "")
            entries[current] = [m.group(2)]
        elif line.startswith("~~") and current is not None:
            entries[current].append(line[2:])
        else:
            current = None
    out = {}
    for no, parts in entries.items():
        t = " ".join(parts)
        t = re.sub(r"PageV\d+P\d+|ms\d+|\|", " ", t)
        out[no] = re.sub(r"\s+", " ", t).strip()
    return out


def city_of(entry: str) -> tuple[str | None, str | None]:
    """City key and the nisba word it came from: the last city nisba in the name part."""
    n = norm(entry)
    m = NAME_END.search(n)
    name_part = n[: m.start()] if m else n
    found = None
    for word in name_part.split():
        if word in NISBAS:
            found = word
    return (NISBAS[found], found) if found else (None, None)


# ---------------------------------------------------------------- build

def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def taqrib_no(key: str | None) -> str | None:
    return key.split(":")[1] if key and key.startswith("taqrib:") else None


def segments_for(raw: str, links: list[dict]) -> list[list]:
    """Split an isnad's text into [text, kind, ref] parts: names, transmission words, the rest."""
    parts: list[list] = []
    pos = 0

    def plain(chunk: str) -> None:
        for tok in re.split(r"(\s+)", chunk):
            if not tok:
                continue
            kind = "tr" if norm(tok.strip("،,:")) in TAHAMMUL else "t"
            if parts and parts[-1][1] == kind == "t":
                parts[-1][0] += tok
            else:
                parts.append([tok, kind, None])

    for ln in links:
        i = raw.find(ln["raw"], pos)
        if i < 0:
            continue
        plain(raw[pos:i])
        parts.append([ln["raw"], "name", ln["id"]])
        pos = i + len(ln["raw"])
    plain(raw[pos:])
    return parts


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--taqrib", type=Path, default=DEFAULT_TAQRIB)
    ap.add_argument("--out", type=Path, default=ROOT / "public/data")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    db = sqlite3.connect(args.db)
    q = lambda sql, *a: db.execute(sql, a).fetchall()  # noqa: E731
    taqrib = read_taqrib(args.taqrib)
    books_ar = json.loads(BOOK_TITLES.read_text(encoding="utf-8"))["titles"]
    sahaba_homes = {k: v[0] for k, v in json.loads(SAHABA_HOMES.read_text(encoding="utf-8")).items()
                    if not k.startswith("_")}

    # ---- persons
    verdict = {pid: (phrase, rank) for pid, phrase, rank in q(
        "select person_id, phrase, rank from verdicts where rank_scheme='ibn-hajar-taqrib'")}
    persons: dict[int, dict] = {}  # by db id
    by_no: dict[str, dict] = {}
    for pid, key, name, kunya, laqab, death, tabaqa in q(
            "select id, key, name_ar, kunya, laqab, death_year_ah, tabaqa from persons"):
        no = taqrib_no(key)
        if no is None:
            continue
        entry = taqrib.get(no, "")
        city, nisba = city_of(entry)
        city_src = "nisba" if city else None
        if not city and no in sahaba_homes:
            city, city_src = sahaba_homes[no], "reviewed"
        phrase, rank = verdict.get(pid, (None, None))
        p = {"id": no, "name": name, "kunya": kunya, "laqab": laqab, "death": death, "tabaqa": tabaqa,
             "rank": rank, "group": RANK_GROUP.get(rank, "see") if rank else "see", "phrase": phrase,
             "city": city, "citySrc": city_src, "nisba": nisba, "entry": entry}
        persons[pid] = p
        by_no[no] = p
    bukhari = by_no[BUKHARI_TAQRIB]

    def brief(p: dict) -> dict:
        return {k: p[k] for k in ("id", "name", "death", "tabaqa", "rank", "group", "phrase", "city")}

    # ---- sections and hadith order
    hadiths = q("select id, number, number_sort, section_number from hadiths order by number_sort")
    sec_of = {h[0]: h[3] for h in hadiths}
    # Hadiths without a book (section 0): take the book of their neighbours when both agree.
    for i, (hid, _, _, s) in enumerate(hadiths):
        if s == 0:
            prev = next((hadiths[j][3] for j in range(i - 1, -1, -1) if hadiths[j][3]), None)
            nxt = next((hadiths[j][3] for j in range(i + 1, len(hadiths)) if hadiths[j][3]), None)
            sec_of[hid] = prev if prev == nxt else 0
    en_titles = {n: t for n, t in q(
        "select s.number, t.title from sections s join section_titles t on t.section_id=s.id where t.edition_id=2")}
    sections = []
    for no in sorted(set(sec_of.values()) - {0}):
        nums = [h[1] for h in hadiths if sec_of[h[0]] == no]
        sections.append({"no": no, "ar": books_ar[str(no)], "en": en_titles.get(no), "first": nums[0],
                         "last": nums[-1], "count": len(nums)})
    sec_title = {s["no"]: s["ar"] for s in sections}

    texts = {(hid, ed): t for hid, ed, t in q("select hadith_id, edition_id, text from texts")}
    isnads = defaultdict(list)
    for iid, hid, ordinal, raw, ends, problem in q(
            "select id, hadith_id, ordinal, raw_text, ends_with, problem from isnads order by hadith_id, ordinal"):
        isnads[hid].append((iid, ordinal, raw, ends, problem))
    links = defaultdict(list)
    for iid, pos, raw, pid, conf, tr in q(
            "select isnad_id, position, raw_name, person_id, match_confidence, transmission from isnad_links order by isnad_id, position"):
        links[iid].append((pos, raw, pid, conf, tr))

    out = args.out
    # Clear the per-item folders only: map.json comes from scripts/build_map.mjs.
    for folder in ("hadith", "narrators"):
        if (out / folder).exists():
            shutil.rmtree(out / folder)

    # ---- hadith files + narrator usage
    used: dict[str, dict] = defaultdict(lambda: {"hadiths": [], "teachers": Counter(), "students": Counter()})
    stats = Counter()
    numbers = [h[1] for h in hadiths]
    for idx, (hid, number, _, _) in enumerate(hadiths):
        ar = texts.get((hid, 1), "")
        chains = []
        for iid, ordinal, raw, ends, problem in isnads[hid]:
            chain = []
            for pos, rname, pid, conf, tr in links[iid]:
                p = persons.get(pid) if pid else None
                link = {"raw": rname.strip(), "tr": tr, "conf": conf, "id": p["id"] if p else None}
                if p:
                    link.update({k: v for k, v in brief(p).items() if k != "id"})
                chain.append(link)
            # Ordered from al-Bukhari to the Companion: each one heard from the next.
            ids = [BUKHARI_TAQRIB] + [ln["id"] for ln in chain]
            for i, nid in enumerate(ids):
                if nid is None:
                    continue
                if number not in used[nid]["hadiths"]:
                    used[nid]["hadiths"].append(number)
                if i + 1 < len(ids) and ids[i + 1] is not None:
                    used[nid]["teachers"][ids[i + 1]] += 1
                if i > 0 and ids[i - 1] is not None:
                    used[nid]["students"][ids[i - 1]] += 1
            stats["isnads"] += 1
            stats["known_all"] += all(ln["id"] for ln in chain)
            start = ar.find(raw) if raw else -1
            chains.append({
                "ordinal": ordinal,
                "toProphet": ends == "prophet",
                "problem": PROBLEMS_AR.get(problem, problem) if problem else None,
                "start": start,
                "end": start + len(raw) if start >= 0 else -1,
                "segments": segments_for(raw, chain) if raw else [],
                # from al-Bukhari (index 0) up to the Companion
                "links": [{"raw": "البخاري", "tr": None, "conf": 1.0, "id": BUKHARI_TAQRIB,
                           **{k: v for k, v in brief(bukhari).items() if k != "id"}}] + chain,
            })
        sec = sec_of[hid]
        write(out / "hadith" / f"{number}.json", {
            "n": number,
            "book": {"no": sec, "title": sec_title.get(sec)} if sec else None,
            "prev": numbers[idx - 1] if idx > 0 else None,
            "next": numbers[idx + 1] if idx + 1 < len(numbers) else None,
            "ar": ar,
            "en": texts.get((hid, 2)),
            "isnads": chains,
        })

    # ---- narrators
    index = []
    for no, u in used.items():
        p = by_no[no]
        name_of = lambda n: by_no[n]["name"] if n in by_no else None  # noqa: E731
        write(out / "narrators" / f"{no}.json", {
            **{k: v for k, v in p.items() if k != "nisba"},
            "nisbaWord": p["nisba"],
            "count": len(u["hadiths"]),
            "hadiths": u["hadiths"],
            "teachers": [{"id": t, "name": name_of(t), "count": c} for t, c in u["teachers"].most_common()],
            "students": [{"id": s, "name": name_of(s), "count": c} for s, c in u["students"].most_common()],
        })
        index.append({"id": no, "name": p["name"], "kunya": p["kunya"], "laqab": p["laqab"],
                      "nisba": p["nisba"], "death": p["death"], "group": p["group"], "count": len(u["hadiths"])})
    index.sort(key=lambda r: -r["count"])
    write(out / "narrators-index.json", index)

    # ---- spread map: every Taqrib narrator with a tabaqa and a city nisba
    spread = []
    for t, (ordinal, desc, example, era) in TABAQAT.items():
        group = [p for p in by_no.values() if p["tabaqa"] == t]
        cities = Counter(p["city"] for p in group if p["city"] and p["citySrc"] == "nisba")
        spread.append({"tabaqa": t, "ordinal": ordinal, "desc": desc, "example": example, "era": era,
                       "total": len(group), "located": sum(cities.values()), "cities": dict(cities.most_common())})
    write(out / "spread.json", spread)
    write(out / "cities.json", {k: {"ar": a, "lat": la, "lon": lo, "kind": kind} for k, (a, la, lo, kind) in CITIES.items()})
    write(out / "sections.json", sections)

    # ---- featured hadiths
    featured = []
    for n in FEATURED:
        h = json.loads((out / "hadith" / f"{n}.json").read_text(encoding="utf-8"))
        chain = h["isnads"][0]
        companion = chain["links"][-1]
        matn = h["ar"][chain["end"]:].replace("‏", "")
        # Preview: the first quoted words of the matn, verbatim, when there are any.
        quoted = re.search(r'"\s*([^"]{12,})"?', matn)  # some quotes are never closed (hadith 1)
        preview = quoted.group(1).strip() if quoted else re.sub(r"^[\s،,:ـ]*(?:رض[يى] الله عن(?:هما|ها|ه)\s*ـ?)?[\s،,:ـ]*", "", matn)
        featured.append({"n": n, "matn": preview,
                         "companion": companion["raw"], "companionId": companion["id"],
                         "cities": list(dict.fromkeys(ln["city"] for ln in reversed(chain["links"]) if ln.get("city"))),
                         "length": len(chain["links"])})
    write(out / "featured.json", featured)

    # ---- report
    located = sum(s["located"] for s in spread)
    print(f"hadiths {len(hadiths)}, isnads {stats['isnads']}, fully identified {stats['known_all']} "
          f"({stats['known_all'] / stats['isnads']:.0%})")
    print(f"narrators in Bukhari chains {len(used)}; Taqrib narrators with tabaqa and city {located}")
    for s in spread:
        top = ", ".join(f"{CITIES[c][0]} {n}" for c, n in list(s["cities"].items())[:4])
        print(f"  tabaqa {s['tabaqa']:>2}: {s['located']:>4}/{s['total']:<4} {top}")
    print(f"books {len(sections)}; hadiths without a book {sum(1 for v in sec_of.values() if v == 0)}")


if __name__ == "__main__":
    main()
