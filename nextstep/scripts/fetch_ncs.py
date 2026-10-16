#!/usr/bin/env python3
"""Refresh NextStep's career information from National Careers Service job profiles.

Fetches every job profile listed in src/data/slugs.json from
https://nationalcareers.service.gov.uk/job-profiles/<slug>, extracts the structured sections and writes
src/data/ncs.json. The app never contacts the National Careers Service at runtime.

NCS content is Crown copyright, reused under the Open Government Licence v3.0.

Usage (from the nextstep folder):
    pip install beautifulsoup4
    python3 scripts/fetch_ncs.py
"""
import datetime
import json
import pathlib
import re
import sys
import time
import urllib.request

from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://nationalcareers.service.gov.uk/job-profiles/"


def clean(text):
    text = re.sub(r"\s+", " ", text or "").strip()
    return re.sub(r" ([.,;:)])", r"\1", text).replace("( ", "(")


def items(node):
    return [clean(li.get_text(" ")) for li in node.find_all("li") if clean(li.get_text(" "))]


def paragraphs(node):
    return [clean(p.get_text(" ")) for p in node.find_all("p", recursive=True) if clean(p.get_text(" "))]


def route(sec):
    """One 'How to become' route (University, College, Apprenticeship, Work, ...), kept in reading order."""
    content = sec.find(class_="job-profile-subsection-content") or sec
    out = {"id": sec.get("id"), "title": clean(sec.find("h3").get_text()) if sec.find("h3") else "", "content": [], "requirements": []}
    mode = "text"
    for el in content.children:
        name = getattr(el, "name", None)
        if name == "h4":
            heading = clean(el.get_text()).lower()
            mode = "req" if "entry requirements" in heading else "skip" if "more information" in heading else "text"
            continue
        if mode == "skip" or name not in ("p", "ul"):
            continue
        if name == "p":
            t = clean(el.get_text(" "))
            if not t:
                continue
            if mode == "text":
                out["content"].append({"p": t})
            elif not t.lower().startswith(("you'll usually need", "you'll need", "you may need")):
                out["requirements"].append(t)
        else:
            lst = items(el)
            if lst:
                if mode == "req":
                    out["requirements"].extend(lst)
                else:
                    out["content"].append({"ul": lst})
    return out


def parse(slug, html):
    s = BeautifulSoup(html, "html.parser")
    h1 = s.find("h1")
    if not h1:
        raise ValueError("no title")
    header = h1.find_parent("div")
    alt = header.find("h2") if header else None
    summary = header.find("p") if header else None

    def text_of(css):
        el = s.select_one(css)
        return clean(el.get_text(" ")) if el else None

    starter, experienced = text_of(".dfc-code-jpsstarter"), text_of(".dfc-code-jpsexperienced")
    hours = s.select_one(".dfc-code-jphours")
    pattern = s.select_one(".dfc-code-jpwpattern")

    htb = s.find(id="HowToBecome")
    intro = []
    if htb:
        first_ul = htb.find("ul", recursive=False)
        intro = items(first_ul) if first_ul else []
    routes = [route(sec) for sec in (htb.select("section.job-profile-subsection") if htb else []) if sec.get("id") != "moreinfo"]
    # "More information": registration, professional bodies, career tips, further information
    more = s.find(id="moreinfo")
    info = []
    if more:
        content = more.find(class_="job-profile-subsection-content") or more
        for el in content.find_all(["h4", "p", "li"]):
            t = clean(el.get_text(" "))
            if not t:
                continue
            if el.name == "h4":
                info.append({"h": t, "items": []})
            elif el.name == "p" and el.find_parent("li"):
                continue
            else:
                if not info:
                    info.append({"h": "", "items": []})
                info[-1]["items"].append(t)

    wit = s.find(id="WhatItTakes")
    skills, restrictions = [], []
    if wit:
        for sub in wit.select("section.job-profile-subsection"):
            if sub.get("id") == "restrictions":
                restrictions = items(sub) or paragraphs(sub)[1:]
            else:
                skills = items(sub)

    wyd = s.find(id="WhatYouWillDo")
    tasks, environment = [], []
    if wyd:
        env = wyd.find(id="workingenvironment")
        for sub in wyd.select("section.job-profile-subsection"):
            if sub is not env and not tasks:
                tasks = items(sub)
        if not tasks:
            tasks = items(wyd)
        if env:
            environment = [clean(x) for x in env.get_text("\n").split("\n") if clean(x) and clean(x).lower() != "working environment"]

    cpp = s.find(id="CareerPathAndProgression")
    progression = []
    if cpp:
        for el in cpp.find_all(["p", "li"]):
            t = clean(el.get_text(" "))
            if t:
                progression.append(("- " if el.name == "li" else "") + t)

    related = []
    rel = s.select_one(".job-profile-related")
    if rel:
        for a in rel.find_all("a", href=True):
            m = re.match(r"/job-profiles/([^/?#]+)", a["href"])
            if m:
                related.append(m.group(1))

    return {
        "slug": slug,
        "title": clean(h1.get_text()),
        "altTitles": clean(alt.get_text(" ").replace("Alternative titles for this job include", "")) if alt else "",
        "summary": clean(summary.get_text(" ")) if summary else "",
        "salary": {"starter": starter.replace(" Starter", "") if starter else None,
                   "experienced": experienced.replace(" Experienced", "") if experienced else None},
        "hours": clean(hours.get_text(" ")) if hours else None,
        "pattern": clean(pattern.get_text(" ")) if pattern else None,
        "routesIntro": intro,
        "routes": routes,
        "info": info,
        "skills": skills,
        "restrictions": restrictions,
        "tasks": tasks,
        "environment": environment,
        "progression": progression,
        "related": related,
    }


def main():
    slugs = json.loads((ROOT / "src/data/slugs.json").read_text())
    out, failed = {}, []
    for i, slug in enumerate(slugs):
        try:
            req = urllib.request.Request(BASE + slug, headers={"User-Agent": "NextStep career prototype (data refresh)"})
            with urllib.request.urlopen(req, timeout=30) as r:
                if "/job-profiles/" not in r.geturl():
                    raise ValueError("redirected to " + r.geturl())
                out[slug] = parse(slug, r.read().decode("utf-8"))
            print(f"[{i + 1}/{len(slugs)}] {slug}")
        except Exception as e:  # keep going; report at the end
            failed.append(f"{slug}: {e}")
        time.sleep(0.3)
    data = {"retrieved": datetime.date.today().isoformat(), "source": "National Careers Service", "licence": "Open Government Licence v3.0", "profiles": out}
    (ROOT / "src/data/ncs.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {len(out)} profiles")
    if failed:
        print("FAILED:\n" + "\n".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
