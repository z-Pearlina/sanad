"""Build the static JSON data of the site from isnady.db and the Taqrib file.

Usage:
    python scripts/build_data.py [--db PATH] [--taqrib PATH] [--out public/data]

isnady.db is produced by the isnady CLI (see README). Only the Python
standard library is used, so the output can be regenerated anywhere and is
committed to the repository (the static host never runs Python).

Places, homes, generations and short names come from build_map_data.py, the
script behind the home map, so every map and page of the site agrees.
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_map_data import (  # noqa: E402
    CITIES as PLACES, DEATH_FIXES, REGIONS, display_names, fixed_death, generation_of, home_of, verdict_for,
)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "isnady" / "isnady.db"
DEFAULT_TAQRIB = ROOT / "data-src/isnady-data/rijal/sunni/taqrib_al_tahdhib_ibn_hajar_al_asqalani.md"
BOOK_TITLES = ROOT / "scripts/bukhari_books_ar.json"

# Featured hadiths (reviewed): every narrator identified, confidence >= 0.8, three cities or more,
# short and well known. Hadith 1 is kept first although its chain has two cities only.
# "Order the chain" game: whole chains of known narrators, short enough to sort on a phone.
GAME_LINKS = (4, 6)  # narrators per chain, al-Bukhari not counted
GAME_MAX = 400
# Names that only point to someone else in the chain ("his father") cannot be placed by a player.
GAME_SKIP_NAMES = ["أبيه", "أبيها", "جده", "جدها", "عمه", "أمه", "أخيه", "أبي", "خاله", "مولاه"]

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
    place_name = {cid: name for cid, name, *_ in PLACES}

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
        city, manual, nisba = home_of(key, name or "")
        phrase, rank = verdict.get(pid, (None, None))
        t, rank = generation_of(name or "", tabaqa, rank)
        p = {"id": no, "name": name, "short": None, "kunya": kunya, "laqab": laqab, "death": fixed_death(no, death), "tabaqa": t,
             "rank": rank, "group": RANK_GROUP.get(rank, "see") if rank else "see", "phrase": phrase,
             "city": city, "citySrc": ("manual" if manual else "nisba") if city else None, "nisba": nisba,
             "entry": taqrib.get(no, ""), "t0": tabaqa}
        if no in DEATH_FIXES:
            p["deathFix"] = DEATH_FIXES[no][2]
        persons[pid] = p
        by_no[no] = p
    bukhari = by_no[BUKHARI_TAQRIB]
    # the short names of the home map ("ابن عيينة", "الحميدي")
    bukhari_pid = next(pid for pid, p in persons.items() if p is bukhari)
    display, _ = display_names(db, {pid: {"name": p["name"] or ""} for pid, p in persons.items()}, bukhari_pid)
    for pid, short in display.items():
        if pid in persons:
            persons[pid]["short"] = short

    def brief(p: dict) -> dict:
        out = {k: p[k] for k in ("id", "name", "short", "death", "tabaqa", "rank", "group", "phrase", "city")}
        if p["citySrc"] == "manual":
            out["cityManual"] = True  # «موطنه من المشهور في التراجم»
        return out

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
    used: dict[str, dict] = defaultdict(lambda: {"hadiths": [], "teachers": Counter(), "students": Counter(), "chains": 0})
    stats = Counter()
    game: dict[tuple, dict] = {}  # one entry per distinct chain of narrators
    game_skip = {norm(w) for w in GAME_SKIP_NAMES}
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
            for nid in dict.fromkeys(ids):  # once per chain, in order, so the files come out the same on every run
                if nid is not None:
                    used[nid]["chains"] += 1
            for i, nid in enumerate(ids):
                if nid is None:
                    continue
                if number not in used[nid]["hadiths"]:
                    used[nid]["hadiths"].append(number)
                if i + 1 < len(ids) and ids[i + 1] is not None:
                    used[nid]["teachers"][ids[i + 1]] += 1
                if i > 0 and ids[i - 1] is not None:
                    used[nid]["students"][ids[i - 1]] += 1
            ids_up = [ln["id"] for ln in reversed(chain)]  # Companion first
            if (ends == "prophet" and GAME_LINKS[0] <= len(chain) <= GAME_LINKS[1] and all(ids_up)
                    and len(set(ids_up)) == len(ids_up) and tuple(ids_up) not in game
                    and all((ln["conf"] or 0) >= 0.8 and ln.get("tabaqa") for ln in chain)
                    and not any(norm(ln["raw"]) in game_skip for ln in chain)):
                game[tuple(ids_up)] = {"n": number, "links": [
                    {"id": ln["id"], "raw": ln["raw"], "tabaqa": ln["tabaqa"], "death": ln["death"]} for ln in reversed(chain)]}
            stats["isnads"] += 1
            stats["known_all"] += all(ln["id"] for ln in chain)
            stats["links"] += len(chain)
            stats["links_known"] += sum(1 for ln in chain if ln["id"])
            stats["to_prophet"] += ends == "prophet"
            stats["problems"] += bool(problem)
            stats["not_located"] += ar.find(raw) < 0 if raw else 1
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
        city_of_no = lambda n: by_no[n]["city"] if n in by_no else None  # noqa: E731
        short_of = lambda n: by_no[n]["short"] if n in by_no else None  # noqa: E731
        write(out / "narrators" / f"{no}.json", {
            **{k: v for k, v in p.items() if k not in ("nisba", "t0")},
            "nisbaWord": p["nisba"],
            "count": len(u["hadiths"]),
            "hadiths": u["hadiths"],
            "teachers": [{"id": t, "name": name_of(t), "short": short_of(t), "city": city_of_no(t), "count": c}
                         for t, c in u["teachers"].most_common()],
            "students": [{"id": s, "name": name_of(s), "short": short_of(s), "city": city_of_no(s), "count": c}
                         for s, c in u["students"].most_common()],
        })
        index.append({"id": no, "name": p["name"], "short": p["short"], "kunya": p["kunya"], "laqab": p["laqab"],
                      "nisba": p["nisba"], "death": p["death"], "group": p["group"], "count": len(u["hadiths"])})
    index.sort(key=lambda r: -r["count"])
    write(out / "narrators-index.json", index)

    # ---- tabaqat: every Taqrib narrator with a tabaqa (as the parser read it) and a city nisba,
    # the same count as the circles of the home map
    spread = []
    for t, (ordinal, desc, example, era) in TABAQAT.items():
        group = [p for p in by_no.values() if p["t0"] == t]
        cities = Counter(p["city"] for p in group if p["city"] and p["citySrc"] == "nisba")
        spread.append({"tabaqa": t, "ordinal": ordinal, "desc": desc, "example": example, "era": era,
                       "total": len(group), "located": sum(cities.values()), "cities": dict(cities.most_common())})
    write(out / "spread.json", spread)
    write(out / "cities.json", {cid: {"ar": name, "lat": lat, "lon": lon, "kind": "region" if region else "city"}
                                for cid, name, lat, lon, region in PLACES})
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

    # ---- game: an even sample across the book, so every run of the game differs
    chains_ok = list(game.values())
    step = max(1, len(chains_ok) // GAME_MAX)
    write(out / "game.json", chains_ok[::step][:GAME_MAX])

    # ---- figures shown on the site (About page): computed here, never typed by hand
    chain_people = [by_no[i] for i in used if i != BUKHARI_TAQRIB]
    write(out / "stats.json", {
        "hadiths": len(hadiths),
        "isnads": stats["isnads"],
        "isnadsFullyKnown": stats["known_all"],
        "isnadsToProphet": stats["to_prophet"],
        "isnadsWithNote": stats["problems"],
        "isnadsNotLocated": stats["not_located"],
        "links": stats["links"],
        "linksKnown": stats["links_known"],
        "narrators": len(chain_people),
        "narratorsWithTabaqa": sum(1 for p in chain_people if p["tabaqa"]),
        "narratorsWithNisbaCity": sum(1 for p in chain_people if p["citySrc"] == "nisba"),
        "narratorsWithManualHome": sum(1 for p in chain_people if p["citySrc"] == "manual"),
        "narratorsWithDeath": sum(1 for p in chain_people if p["death"]),
        "narratorsWithRank": sum(1 for p in chain_people if p["rank"]),
        "taqribNarrators": len(by_no),
        "taqribLocated": sum(s_["located"] for s_ in spread),
        "books": len(sections),
        "hadithsWithoutBook": sum(1 for v in sec_of.values() if v == 0),
        "cities": len(PLACES),
        "featured": len(FEATURED),
    })

    # ---- time page: the narrators of the chains whose death year the Taqrib gives
    dated = sorted((p for p in chain_people if p["death"]), key=lambda p: (-used[p["id"]]["chains"], p["death"], p["id"]))
    write(out / "time.json", {
        "total": len(chain_people),
        "dated": len(dated),
        "regions": [{"id": rid, "name": name, "cities": cities} for rid, name, cities in REGIONS],
        "fixes": [{"id": no, "n": by_no[no]["short"] or by_no[no]["name"], "from": was, "to": year, "why": why}
                  for no, (was, year, why) in DEATH_FIXES.items()],
        "narrators": [{
            "id": p["id"], "n": p["short"] or p["name"], "y": p["death"], "t": p["tabaqa"], "g": p["group"], "v": verdict_for(p),
            "c": p["city"], **({"m": 1} if p["citySrc"] == "manual" else {}), "k": used[p["id"]]["chains"],
        } for p in dated],
    })

    # ---- report
    located = sum(s["located"] for s in spread)
    print(f"hadiths {len(hadiths)}, isnads {stats['isnads']}, fully identified {stats['known_all']} "
          f"({stats['known_all'] / stats['isnads']:.0%})")
    print(f"narrators in Bukhari chains {len(used)}; Taqrib narrators with tabaqa and city {located}")
    for s in spread:
        top = ", ".join(f"{place_name[c]} {n}" for c, n in list(s["cities"].items())[:4])
        print(f"  tabaqa {s['tabaqa']:>2}: {s['located']:>4}/{s['total']:<4} {top}")
    print(f"books {len(sections)}; hadiths without a book {sum(1 for v in sec_of.values() if v == 0)}")


if __name__ == "__main__":
    main()
