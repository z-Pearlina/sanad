#!/usr/bin/env python3
"""Build the data behind the interactive narration map.

Reads the isnady database (Sahih al-Bukhari and Taqrib al-Tahdhib imported)
and writes one compact JSON file with:

  cities    the cities and regions on the map, with coordinates
  tabaqat   Ibn Hajar's twelve generations, in his own words
  spread    narrators per generation per place (Taqrib entries whose nisba names it)
  top       best-known Bukhari narrators per generation per city
  flows     teacher-city -> student-city links in Bukhari's chains, per generation
  journeys  a few chains, narrator by narrator, for the "follow a hadith" tour

Usage:
  python3 scripts/build_map_data.py --db "$(.venv-isnady/bin/iy datadir)/isnady.db" \
      --out public/data/map.json --journeys scripts/journeys.json
"""

import argparse
import collections
import json
import re
import sqlite3
import sys
import unicodedata

# ---------------------------------------------------------------- text helpers

MARKS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def strip_marks(text: str) -> str:
    return MARKS.sub("", unicodedata.normalize("NFC", text)).replace("ٱ", "ا").strip()


# ---------------------------------------------------------------- places
# Approximate coordinates (lat, lon). Regions are drawn differently from cities.
CITIES = [
    ("madina", "المدينة", 24.47, 39.61, False),
    ("makka", "مكة", 21.42, 39.83, False),
    ("taif", "الطائف", 21.27, 40.42, False),
    ("yamama", "اليمامة", 24.63, 46.72, False),
    ("sanaa", "صنعاء", 15.37, 44.19, False),
    ("yaman", "اليمن", 14.2, 46.4, True),
    ("kufa", "الكوفة", 32.03, 44.40, False),
    ("basra", "البصرة", 30.50, 47.78, False),
    ("baghdad", "بغداد", 33.31, 44.37, False),
    ("wasit", "واسط", 32.19, 46.30, False),
    ("mosul", "الموصل", 36.34, 43.13, False),
    ("jazira", "الجزيرة", 35.9, 41.3, True),
    ("harran", "حران", 36.86, 39.03, False),
    ("sham", "الشام", 34.3, 38.4, True),
    ("dimashq", "دمشق", 33.51, 36.29, False),
    ("hims", "حمص", 34.73, 36.72, False),
    ("quds", "بيت المقدس", 31.78, 35.23, False),
    ("ramla", "الرملة", 31.93, 34.87, False),
    ("asqalan", "عسقلان", 31.67, 34.57, False),
    ("ayla", "أيلة", 29.53, 35.01, False),
    ("misr", "مصر", 30.01, 31.23, False),
    ("tinnis", "تنيس", 31.20, 32.23, False),
    ("rayy", "الري", 35.59, 51.44, False),
    ("isfahan", "أصبهان", 32.65, 51.67, False),
    ("khurasan", "خراسان", 34.9, 59.4, True),
    ("naysabur", "نيسابور", 36.21, 58.80, False),
    ("marw", "مرو", 37.66, 62.19, False),
    ("harat", "هراة", 34.35, 62.20, False),
    ("balkh", "بلخ", 36.76, 66.90, False),
    ("baghlan", "بغلان", 36.13, 68.70, False),
    ("bukhara", "بخارى", 39.77, 64.42, False),
]

# Nisba -> place. When a name carries several, the last one wins
# ("الكوفي ثم المكي" -> Mecca). الهمداني is a tribe, so it is not here.
NISBA = {
    "المدني": "madina", "المديني": "madina", "المكي": "makka", "الطائفي": "taif",
    "اليمامي": "yamama", "الصنعاني": "sanaa", "اليماني": "yaman",
    "الكوفي": "kufa", "البصري": "basra", "البغدادي": "baghdad", "الواسطي": "wasit",
    "الموصلي": "mosul", "الجزري": "jazira", "الحراني": "harran",
    "الشامي": "sham", "الدمشقي": "dimashq", "الحمصي": "hims", "المقدسي": "quds",
    "الرملي": "ramla", "العسقلاني": "asqalan", "الأيلي": "ayla",
    "المصري": "misr", "التنيسي": "tinnis",
    "الرازي": "rayy", "الأصبهاني": "isfahan", "الخراساني": "khurasan",
    "النيسابوري": "naysabur", "المروزي": "marw", "الهروي": "harat",
    "البلخي": "balkh", "البغلاني": "baghlan", "البخاري": "bukhara",
}
NISBA_RE = re.compile("(?<![؀-ۿ])(" + "|".join(sorted(NISBA, key=len, reverse=True)) + ")(?![؀-ۿ])")

# Words that end the name part of a Taqrib entry. Searching only before them
# keeps praise such as "حتى قال البخاري" from being read as a nisba.
STOP = {
    "ثقة", "صدوق", "حافظ", "الحافظ", "إمام", "الإمام", "قال", "حتى", "فقيه", "الفقيه", "مشهور",
    "متفق", "جبل", "أمير", "صحابي", "صحابية", "ولد", "مقبول", "ضعيف", "رأس", "أحد", "من",
    "مستور", "مجهول", "متروك", "كذاب", "لين", "عابد", "زاهد",
}


def name_part(name: str) -> list:
    words = []
    for word in strip_marks(name).split():
        if word in STOP:
            break
        words.append(word)
    return words


# Most Companions carry no city nisba in the Taqrib. These homes follow the
# well-known biographies and are marked "manual" so they can be reviewed.
COMPANION_HOMES = {
    "taqrib:8426": "madina",   # Abu Hurayra
    "taqrib:8633": "madina",   # Aisha
    "taqrib:3490": "madina",   # Ibn Umar
    "taqrib:871": "madina",    # Jabir ibn Abd Allah
    "taqrib:3613": "kufa",     # Ibn Mas'ud
    "taqrib:648": "kufa",      # al-Bara' ibn Azib
    "taqrib:4753": "kufa",     # Ali ibn Abi Talib
    "taqrib:4888": "madina",   # Umar ibn al-Khattab
    "taqrib:8694": "madina",   # Umm Salama
    "taqrib:316": "madina",    # Usama ibn Zayd
    "taqrib:7180": "basra",    # Abu Bakra
    "taqrib:4647": "kufa",     # Abu Mas'ud al-Badri
    "taqrib:6840": "kufa",     # al-Mughira ibn Shu'ba
    "taqrib:3219": "kufa",     # Ibn Abi Awfa
    "taqrib:2120": "madina",   # Zayd ibn Thabit
    "taqrib:8693": "basra",    # Umm Atiyya
    "taqrib:4540": "kufa",     # Adi ibn Hatim
    "taqrib:2202": "madina",   # al-Sa'ib ibn Yazid
    "taqrib:903": "madina",    # Jubayr ibn Mut'im
    "taqrib:4558": "kufa",     # Urwa al-Bariqi
    "taqrib:4641": "misr",     # Uqba ibn Amir
    "taqrib:2253": "madina",   # Abu Sa'id al-Khudri
    "taqrib:2658": "madina",   # Sahl ibn Sa'd
    # frequent Successors and later narrators whose Taqrib entry names no city
    "taqrib:6296": "madina",   # al-Zuhri
    "taqrib:7302": "madina",   # Hisham ibn Urwa
    "taqrib:6943": "basra",    # Musa ibn Isma'il al-Tabudhaki
    "taqrib:2396": "madina",   # Sa'id ibn al-Musayyib
    "taqrib:5065": "kufa",     # Abu Ishaq al-Sabi'i
    "taqrib:3092": "kufa",     # al-Sha'bi
    "taqrib:6992": "madina",   # Musa ibn Uqba
    "taqrib:5489": "madina",   # al-Qasim ibn Muhammad
    "taqrib:253": "madina",    # Ibrahim ibn al-Mundhir
    "taqrib:1412": "basra",    # Hafs ibn Umar al-Hawdi
    "taqrib:3967": "sham",     # al-Awza'i
    "taqrib:7952": "kufa",     # Abu Burda
    "taqrib:4359": "kufa",     # Ubayd ibn Isma'il
}
# Companions whose generation the parser missed (found by name below).
COMPANION_NAMES = ["أنس بن مالك بن النضر", "عبد الله بن عباس بن عبد المطلب"]
COMPANION_NAME_HOMES = {"أنس بن مالك بن النضر": "basra", "عبد الله بن عباس بن عبد المطلب": "makka"}

BUKHARI_KEY = "taqrib:5727"

TRANSMISSION = {
    "haddathana": "حدثنا", "haddathani": "حدثني", "akhbarana": "أخبرنا", "akhbarani": "أخبرني",
    "'an": "عن", "sami'tu": "سمعت", "sami'a": "سمع", "anna": "أن", "qala": "قال",
    "sa'altu": "سألت", "sa'ala": "سأل", "su'ila": "سُئل", "anba'ana": "أنبأنا",
    "za'ama": "زعم", "qara'tu 'ala": "قرأت على",
}

TABAQAT = [
    (1, "الصحابة", ""),
    (2, "كبار التابعين", "كابن المسيب"),
    (3, "الطبقة الوسطى من التابعين", "كالحسن وابن سيرين"),
    (4, "طبقة تليها، جلّ روايتهم عن كبار التابعين", "كالزهري وقتادة"),
    (5, "الطبقة الصغرى منهم، الذين رأوا الواحد والاثنين", "كالأعمش"),
    (6, "عاصروا الخامسة، ولم يثبت لهم لقاء أحد من الصحابة", "كابن جريج"),
    (7, "كبار أتباع التابعين", "كمالك والثوري"),
    (8, "الطبقة الوسطى منهم", "كابن عيينة وابن علية"),
    (9, "الصغرى من أتباع التابعين", "كيزيد بن هارون والشافعي"),
    (10, "كبار الآخذين عن تبع الأتباع", "كأحمد بن حنبل"),
    (11, "الطبقة الوسطى من ذلك", "كالذهلي والبخاري"),
    (12, "صغار الآخذين عن تبع الأتباع", "كالترمذي"),
]


def era(tabaqa: int) -> str:
    # Ibn Hajar's own rule in the Taqrib introduction.
    if tabaqa <= 2:
        return "قبل سنة 100هـ"
    if tabaqa <= 8:
        return "بعد سنة 100هـ"
    return "بعد سنة 200هـ"


def band(rank):
    if rank == 1:
        return "sahabi"
    if rank in (2, 3):
        return "thiqa"
    if rank in (4, 5):
        return "saduq"
    if rank in (6, 7, 9):
        return "maqbul"
    if rank in (8, 10, 11, 12):
        return "daif"
    return "none"


def companion_label(name: str) -> str:
    head = strip_marks(name).split()[:3]
    return "صحابية" if "بنت" in head or (head and head[0] == "أم") else "صحابي"


def verdict_for(p) -> str:
    if band(p.get("rank")) == "sahabi":
        return companion_label(p["name"])
    return short_verdict(p.get("phrase"))


def short_verdict(phrase):
    if not phrase:
        return ""
    text = phrase.strip()
    for cut in ("،", ",", " إلا ", " لكن "):
        if cut in text:
            text = text.split(cut)[0]
    words = text.split()
    return " ".join(words[:5]) + ("…" if len(words) > 5 else "")


PRONOUNS = {
    "أبيه", "أبيها", "أبوه", "أمه", "أمها", "جده", "جدها", "عمه", "عمها", "أخيه", "أخته",
    "خاله", "مولاه", "مولاها", "رجل", "رجلا", "شيخ", "هو", "غيره", "أبي", "بعض أصحابه",
}


def normalize_raw(raw: str) -> str:
    text = strip_marks(raw)
    text = re.split("[،,]", text)[0]
    text = re.sub(r"\s+(رضى|رضي) الله عن(ه|ها|هما|هم)\b.*$", "", text)
    text = re.sub(r"\s+صلى الله عليه وسلم.*$", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r" هو ابن ", " بن ", text)
    text = re.sub(r" هو ", " ", text)
    text = re.sub(r"^(أبي|أبا) ", "أبو ", text)
    return text


# ---------------------------------------------------------------- build

def build(db_path: str) -> dict:
    db = sqlite3.connect(db_path)

    persons = {}
    for pid, key, name, tabaqa in db.execute("SELECT id, key, name_ar, tabaqa FROM persons"):
        persons[pid] = {"key": key, "name": name or "", "t": tabaqa, "t0": tabaqa}
    for pid, phrase, rank in db.execute("SELECT person_id, phrase, rank FROM verdicts"):
        if pid in persons and "rank" not in persons[pid]:
            persons[pid]["rank"] = rank
            persons[pid]["phrase"] = phrase

    by_key = {p["key"]: pid for pid, p in persons.items()}
    manual = set()
    for pid, p in persons.items():
        if p["key"] in COMPANION_HOMES:
            p["city"] = COMPANION_HOMES[p["key"]]
            manual.add(pid)
        else:
            hits = [w for w in name_part(p["name"]) if w in NISBA]
            p["city"] = NISBA[hits[-1]] if hits else None
        companion = p.get("rank") == 1 or "صحبة" in p["name"][:200]
        if p.get("t") is None and companion:
            p["t"] = 1
            p["rank"] = 1
    for prefix in COMPANION_NAMES:
        for pid, p in persons.items():
            if p["name"].startswith(prefix):
                p["t"] = 1
                p["rank"] = p.get("rank") or 1
                p["city"] = COMPANION_NAME_HOMES[prefix]
                manual.add(pid)

    bukhari = by_key[BUKHARI_KEY]
    persons[bukhari]["city"] = "bukhara"

    # display names: the form Bukhari's narrators actually use
    raws = collections.defaultdict(collections.Counter)
    occurrences = collections.Counter()
    for raw, pid in db.execute("SELECT raw_name, person_id FROM isnad_links WHERE person_id IS NOT NULL"):
        occurrences[pid] += 1
        name = normalize_raw(raw)
        if name and name not in PRONOUNS and len(name.split()) <= 5:
            raws[pid][name] += 1

    city_nisbas = set(NISBA)

    ism_count = collections.Counter(
        strip_marks(p["name"]).split()[0] for p in persons.values() if p["name"].strip())

    def taqrib_short(pid):
        t = name_part(persons[pid]["name"])
        if not t:
            return ""
        i = 2 if t[0] in ("عبد", "أبو", "أم") and len(t) > 1 else 1
        parts = t[:i]
        j = i
        if j < len(t) and t[j] == "بن" and j + 1 < len(t):
            father = t[j + 1:j + 3] if t[j + 1] in ("عبد", "أبي") and j + 2 < len(t) else t[j + 1:j + 2]
            parts = parts + ["بن"] + father
            j = j + 1 + len(father)
        rest = t[j:j + 8]
        if len(parts) == i and "مولى" in rest:
            k = rest.index("مولى")
            parts = parts + ["مولى"] + ["ابن" if w == "بن" else w for w in rest[k + 1:k + 3]]
        else:
            for w in rest:
                if w.startswith("ال") and w.endswith("ي") and w not in city_nisbas and w not in ("الذي", "التي"):
                    parts.append(w)
                    break
        return " ".join(parts)

    display = {}
    for pid in occurrences:
        counter = raws.get(pid)
        if not counter:
            display[pid] = taqrib_short(pid)
            continue
        top_name, top_n = counter.most_common(1)[0]
        good = [(len(n.split()), c, n) for n, c in counter.items() if c >= 0.3 * top_n]
        name = max(good)[2]
        # a bare common first name (سفيان، مالك، هشام) needs the Taqrib form
        if len(name.split()) == 1 and not name.startswith("ال") and ism_count[name] >= 8:
            name = taqrib_short(pid) or name
        display[pid] = name
    # names shared by several narrators (سفيان، حماد) fall back to the Taqrib form
    shared = collections.Counter(display.values())
    for pid, name in display.items():
        if shared[name] > 1 and len(name.split()) == 1:
            display[pid] = taqrib_short(pid)
    display[bukhari] = "البخاري"

    # spread: every Taqrib narrator whose entry gives a generation and whose
    # nisba names a place. Hand-assigned homes are left out, so the circles
    # match the caption on the map.
    spread = collections.defaultdict(collections.Counter)
    for pid, p in persons.items():
        if p.get("t0") and p.get("city") and pid not in manual:
            spread[p["t0"]][p["city"]] += 1

    # chains
    chains = []
    for iid, hid, ordinal in db.execute("SELECT id, hadith_id, ordinal FROM isnads"):
        links = db.execute(
            "SELECT position, raw_name, person_id, match_confidence, transmission FROM isnad_links "
            "WHERE isnad_id = ? ORDER BY position", (iid,)).fetchall()
        chains.append((iid, hid, ordinal, links))

    flows = collections.defaultdict(collections.Counter)
    local = collections.defaultdict(collections.Counter)
    for _, _, _, links in chains:
        seq = [bukhari] + [pid for _, _, pid, _, _ in links]
        for student, teacher in zip(seq, seq[1:]):
            if not student or not teacher:
                continue
            s, t = persons[student], persons[teacher]
            if not (s.get("city") and t.get("city") and s.get("t")):
                continue
            if s["city"] == t["city"]:
                local[s["t"]][s["city"]] += 1
            else:
                flows[s["t"]][(t["city"], s["city"])] += 1

    # best-known Bukhari narrators per generation and city
    top = collections.defaultdict(lambda: collections.defaultdict(list))
    for pid, n in occurrences.most_common():
        p = persons[pid]
        if p.get("t") and p.get("city"):
            bucket = top[p["t"]][p["city"]]
            if len(bucket) < 6:
                bucket.append({
                    "id": p["key"].split(":")[1],
                    "n": display[pid],
                    "b": band(p.get("rank")),
                    "v": verdict_for(p),
                    "c": n,
                    **({"m": 1} if pid in manual else {}),
                })

    cities_out = []
    used = {c for t in spread for c in spread[t]} | {c for t in flows for pair in flows[t] for c in pair}
    for cid, name, lat, lon, region in CITIES:
        if cid in used:
            cities_out.append({"id": cid, "name": name, "lat": lat, "lon": lon, **({"region": 1} if region else {})})

    tabaqat_out = []
    for n, title, example in TABAQAT:
        counts = spread.get(n, {})
        tabaqat_out.append({
            "n": n, "title": title, "example": example, "era": era(n),
            "narrators": sum(counts.values()), "cities": len(counts),
            "links": sum(flows[n].values()) + sum(local[n].values()),
        })

    data = {
        "source": "Sahih al-Bukhari chains and Taqrib al-Tahdhib (isnady-data, read with isnady)",
        "cities": cities_out,
        "tabaqat": tabaqat_out,
        "spread": {str(t): dict(c) for t, c in sorted(spread.items())},
        "local": {str(t): dict(c) for t, c in sorted(local.items())},
        "flows": {str(t): [{"from": a, "to": b, "n": n} for (a, b), n in c.most_common()]
                  for t, c in sorted(flows.items())},
        "top": {str(t): {c: v for c, v in cities.items()} for t, cities in sorted(top.items())},
    }
    return data, db, persons, display, chains, manual, bukhari


def journeys(db, persons, display, chains, manual, bukhari, wanted):
    out = []
    hadith_number = {hid: num for hid, num in db.execute("SELECT id, number FROM hadiths")}
    by_number = collections.defaultdict(list)
    for iid, hid, ordinal, links in chains:
        by_number[hadith_number[hid]].append((ordinal, iid, links))
    ends = dict(db.execute("SELECT id, ends_with FROM isnads"))
    for number, title in wanted:
        if not by_number.get(number):
            print(f"journey {number}: no chain found, skipped", file=sys.stderr)
            continue
        ordinal, iid, links = sorted(by_number[number])[0]
        nodes = []
        for pos, raw, pid, conf, trans in reversed(links):
            p = persons.get(pid) if pid else None
            nodes.append({
                **({"id": p["key"].split(":")[1]} if p else {}),
                "n": display.get(pid) or normalize_raw(raw),
                "city": p.get("city") if p else None,
                **({"m": 1} if pid in manual else {}),
                "t": p.get("t") if p else None,
                "b": band(p.get("rank")) if p else "unknown",
                "v": verdict_for(p) if p else "",
                "tr": TRANSMISSION.get(trans, ""),
                **({"auto": 1} if conf is not None and conf < 1 else {}),
            })
        nodes.append({"id": BUKHARI_KEY.split(":")[1], "n": "البخاري", "city": "bukhara",
                      "t": 11, "b": band(persons[bukhari].get("rank")), "v": short_verdict(persons[bukhari].get("phrase")),
                      "tr": ""})
        out.append({"number": int(number), "title": title, "prophet": ends.get(iid) == "prophet", "nodes": nodes})
    return out


def death_years(db):
    return {pid: (dy, note) for pid, dy, note in db.execute("SELECT id, death_year_ah, death_year_note FROM persons")}


# Complete chains (every narrator identified, every home known) that cross
# several cities. Titles are quoted from the hadith text as it stands.
DEFAULT_JOURNEYS = [
    ("1", "إنما الأعمال بالنيات"),
    ("6516", "لا تسبوا الأموات، فإنهم قد أفضوا إلى ما قدموا"),
    ("5681", "الشفاء في ثلاثة: شرطة محجم، أو شربة عسل، أو كية بنار"),
    ("3205", "نصرت بالصبا، وأهلكت عاد بالدبور"),
    ("218", "إنهما ليعذبان، وما يعذبان في كبير"),
    ("4895", "شهدت الصلاة يوم الفطر مع رسول الله صلى الله عليه وسلم…"),
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", required=True, help="isnady.db with Sahih al-Bukhari and the Taqrib imported")
    ap.add_argument("--out", required=True, help="output JSON, e.g. public/data/map.json")
    ap.add_argument("--journeys", help='JSON list of {"number": 1, "title": "..."}; titles are quoted from the hadith text')
    args = ap.parse_args()

    data, db, persons, display, chains, manual, bukhari = build(args.db)
    deaths = death_years(db)
    wanted = DEFAULT_JOURNEYS
    if args.journeys:
        with open(args.journeys, encoding="utf-8") as f:
            wanted = [(str(x["number"]), x["title"]) for x in json.load(f)]
    js = journeys(db, persons, display, chains, manual, bukhari, wanted)
    # add death years to journey nodes and top lists
    key_to_pid = {p["key"].split(":")[1]: pid for pid, p in persons.items()}
    for j in js:
        for node in j["nodes"]:
            if "id" in node:
                dy = deaths.get(key_to_pid[node["id"]], (None, None))[0]
                if dy:
                    node["d"] = dy
    for t, cities in data["top"].items():
        for lst in cities.values():
            for item in lst:
                dy = deaths.get(key_to_pid[item["id"]], (None, None))[0]
                if dy:
                    item["d"] = dy
    data["journeys"] = js

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {args.out}: {len(data['cities'])} places, {sum(len(v) for v in data['flows'].values())} city links, {len(js)} journeys")


if __name__ == "__main__":
    main()
