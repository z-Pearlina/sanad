#!/usr/bin/env python3
"""Build public/data/insights.json: the figures of the insights page.

Everything is counted from isnady.db with the functions of build_map_data.py
(homes, generations, short names), so these figures agree with the maps. The
page writes its sentences from this file; no figure is typed by hand.

Usage: python scripts/build_insights.py [--db PATH] [--out public/data/insights.json]
"""

import argparse
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_map_data import REGIONS, band, build  # noqa: E402

FORMULAS = [
    ("عن", {"'an"}),
    ("حدثنا/حدثني", {"haddathana", "haddathani"}),
    ("أخبرنا/أخبرني", {"akhbarana", "akhbarani"}),
    ("سمعت/سمع", {"sami'tu", "sami'a"}),
    ("أنّ", {"anna"}),
    ("قال", {"qala"}),
]
OTHER = "وغيرها"
FIRST_TEACHER_GENERATION = 9  # earlier than this, the "chain" is a suspended (mu'allaq) report
TOP_LINKED = 10
EXAMPLES = 3
FEATURED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "journeys.json")


def formula_of(transmission):
    for i, (_, words) in enumerate(FORMULAS):
        if transmission in words:
            return i
    return len(FORMULAS)


def formulas(chains, persons, bukhari, numbers):
    """Each link's word belongs to the student who said it: the narrator before it, or al-Bukhari in the first."""
    labels = [name for name, _ in FORMULAS] + [OTHER]
    by_generation = collections.defaultdict(lambda: [0] * len(labels))
    unplaced = 0
    most_an, least_an = None, None
    for _, hid, _, links in chains:
        speaker = bukhari
        an = 0
        for _, _, pid, _, trans in links:
            generation = 11 if speaker == bukhari else (persons[speaker].get("t") if speaker else None)
            if generation:
                by_generation[generation][formula_of(trans)] += 1
            else:
                unplaced += 1
            an += trans == "'an"
            speaker = pid
        if len(links) >= 5:
            number = numbers[hid]
            share = an / len(links)
            if most_an is None or (share, -number) > (most_an[0], -most_an[1]):
                most_an = (share, number)
            if least_an is None or (share, number) < (least_an[0], least_an[1]):
                least_an = (share, number)
    rows = [{"t": t, "total": sum(c), "counts": c} for t, c in sorted(by_generation.items())]
    return {"labels": labels, "rows": rows, "unplaced": unplaced, "examples": {"mostAn": str(most_an[1]), "leastAn": str(least_an[1])}}


def turning_chain(chains, persons, display, bukhari, numbers):
    """A featured hadith whose chain turns as the figures do: "حدثنا" from al-Bukhari's end, then "عن" to the Companion."""
    with open(FEATURED, encoding="utf-8") as f:
        titles = {x["number"]: x["title"] for x in json.load(f)}
    best = None
    for _, hid, _, links in chains:
        if numbers[hid] not in titles or not all(pid for _, _, pid, _, _ in links):
            continue
        words = [formula_of(trans) for _, _, _, _, trans in links]
        speakers = [bukhari] + [pid for _, _, pid, _, _ in links][:-1]
        told = 0
        while told < len(words) and words[told] in (1, 2):
            told += 1
        rest = words[told:]
        if told < 2 or len(rest) < 2 or rest[0] != 0:
            continue
        # the longest run of "عن" after the turn, and the fewest other words
        score = (rest.count(0) - (len(rest) - rest.count(0)), told)
        if best is None or score > best[0]:
            best = (score, hid, speakers[told - 1], speakers[told])
    if best is None:
        return None
    name = lambda pid: display.get(pid) or persons[pid]["name"]  # noqa: E731
    return {"n": str(numbers[best[1]]), "title": titles[numbers[best[1]]], "until": name(best[2]), "from": name(best[3])}


def regions(spread, top, display_top):
    labels = [name for _, name, _ in REGIONS]
    rows = []
    for t in sorted(spread, key=int):
        counts = [sum(spread[t].get(c, 0) for c in cities) for _, _, cities in REGIONS]
        rows.append({"t": int(t), "total": sum(counts), "counts": counts})
    # a well-known man of the leading region, for the first generation and the fullest one
    examples = []
    for row in (rows[0], max(rows, key=lambda r: r["total"])):
        i = max(range(len(labels)), key=lambda k: row["counts"][k])
        people = [p for c in REGIONS[i][2] for p in top.get(str(row["t"]), {}).get(c, [])]
        if people:
            best = max(people, key=lambda p: p["c"])
            examples.append({"t": row["t"], "region": labels[i], "id": best["id"], "n": best["n"]})
    return {"labels": labels, "rows": rows, "examples": examples}


def lengths(chains, persons, ends, numbers):
    """Full chains only: to the Prophet ﷺ, every man identified, a Companion last, a teacher of generation 9 or later first."""
    tally = collections.Counter()
    examples = collections.defaultdict(list)
    for iid, hid, _, links in chains:
        if ends.get(iid) != "prophet" or not links or not all(pid for _, _, pid, _, _ in links):
            continue
        first, last = persons[links[0][2]], persons[links[-1][2]]
        if not (first.get("t") and first["t"] >= FIRST_TEACHER_GENERATION):
            continue
        if not (last.get("t") == 1 or last.get("rank") == 1):
            continue
        tally[len(links)] += 1
        examples[len(links)].append(numbers[hid])
    return {
        "total": sum(tally.values()),
        "rows": [{"men": n, "count": tally[n], "examples": [str(x) for x in sorted(set(examples[n]))[:EXAMPLES]]} for n in sorted(tally)],
    }


def linked(chains, persons, display, bukhari):
    teachers = collections.defaultdict(set)
    students = collections.defaultdict(set)
    for _, _, _, links in chains:
        seq = [bukhari] + [pid for _, _, pid, _, _ in links]
        for student, teacher in zip(seq, seq[1:]):
            if student and teacher:
                teachers[student].add(teacher)
                students[teacher].add(student)
    men = [pid for pid in set(teachers) | set(students) if pid != bukhari]
    men.sort(key=lambda pid: (-(len(teachers[pid]) + len(students[pid])), persons[pid]["key"]))
    return [{"id": persons[pid]["key"].split(":")[1], "n": display.get(pid) or persons[pid]["name"],
             "g": band(persons[pid].get("rank")).replace("none", "see"),  # the page's name for a rank not extracted
             "teachers": len(teachers[pid]), "students": len(students[pid])} for pid in men[:TOP_LINKED]]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "isnady", "isnady.db"))
    ap.add_argument("--out", default="public/data/insights.json")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    data, db, persons, display, chains, _, bukhari = build(args.db)
    numbers = {hid: num for hid, num in db.execute("SELECT id, number FROM hadiths")}
    numeric = {hid: int(float(num)) for hid, num in numbers.items()}
    ends = dict(db.execute("SELECT id, ends_with FROM isnads"))

    out = {
        "formulas": {**formulas(chains, persons, bukhari, numeric), "turning": turning_chain(chains, persons, display, bukhari, numeric)},
        "regions": regions(data["spread"], data["top"], display),
        "lengths": lengths(chains, persons, ends, numeric),
        "linked": linked(chains, persons, display, bukhari),
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    for row in out["formulas"]["rows"]:
        lead = max(range(len(row["counts"])), key=lambda i: row["counts"][i])
        print(f"tabaqa {row['t']:>2}: {row['total']:>6} links, leads {out['formulas']['labels'][lead]} {row['counts'][lead] / row['total']:.0%}")
    print(f"unplaced links {out['formulas']['unplaced']}; full chains {out['lengths']['total']}: "
          + ", ".join(f"{r['men']}:{r['count']}" for r in out["lengths"]["rows"]))
    print("most linked:", ", ".join(f"{m['n']} {m['teachers']}+{m['students']}" for m in out["linked"]))
    print("turning chain:", out["formulas"]["turning"])


if __name__ == "__main__":
    main()
