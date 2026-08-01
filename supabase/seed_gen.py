#!/usr/bin/env python3
"""
Attesta seed generator.

Inputs (downloaded if absent):
  - NIST SP 800-53 Rev 5.2.0 OSCAL catalog (controls + 800-53A objectives)
  - FedRAMP 2026-markdown control reference (Class B/C/D membership)

Output: 02_seed.sql  ->  control, control_objective, framework,
                         framework_control, control_mapping, framework_parameter

Run:  python3 seed_gen.py && psql "$DB" -f 01_schema.sql -f 02_seed.sql
"""

import json, os, re, urllib.request

NIST_URL = ("https://raw.githubusercontent.com/usnistgov/oscal-content/main/"
            "nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json")
FR_BASE = "https://raw.githubusercontent.com/FedRAMP/2026-markdown/main/reference/controls/"
FAMS = ["access-control", "awareness-and-training", "audit-and-accountability",
        "assessment-authorization-and-monitoring", "configuration-management",
        "contingency-planning", "identification-and-authentication", "incident-response",
        "maintenance", "media-protection",
        "personally-identifiable-information-processing-and-transparency",
        "personnel-security", "physical-and-environmental-protection", "planning",
        "program-management", "risk-assessment", "supply-chain-risk-management",
        "system-and-communications-protection", "system-and-information-integrity",
        "system-and-services-acquisition"]

FRAMEWORK_ID = "fedramp-class-c"
CATALOG_VERSION = "5.2.0"

os.makedirs("seed/fam", exist_ok=True)


def q(s):
    """Quote for SQL."""
    if s is None:
        return "null"
    return "'" + str(s).replace("'", "''") + "'"


def arr(items):
    if not items:
        return "'{}'"
    return "'{" + ",".join(items) + "}'"


# ---------- fetch ----------

if not os.path.exists("seed/nist_catalog.json"):
    urllib.request.urlretrieve(NIST_URL, "seed/nist_catalog.json")

fam_text = {}
for f in FAMS:
    p = f"seed/fam/{f}.md"
    if not os.path.exists(p):
        urllib.request.urlretrieve(FR_BASE + f + ".md", p)
    fam_text[f] = open(p).read()


# ---------- FedRAMP class membership ----------

def norm_id(anchor):
    """ac-02-01 -> ac-2.1 ; IA-02 -> ia-2"""
    m = re.match(r'([A-Za-z]{2})-0*(\d+)(?:[-.]0*(\d+))?$', anchor.strip())
    if not m:
        return None
    base = f"{m.group(1).lower()}-{int(m.group(2))}"
    return base + (f".{int(m.group(3))}" if m.group(3) else "")


membership = {}   # control_id -> set of classes
fr_label = {}     # control_id -> 'AC-02 (01)'

for fam, txt in fam_text.items():
    for block in re.split(r'\n## ', txt)[1:]:
        head = block.split('\n', 1)[0]
        m = re.match(r'([A-Z]{2}-\d+(?:\s*\(\d+\))?)', head)
        if not m:
            continue
        label = m.group(1).strip()
        anchor_m = re.search(r'\{\s*#([A-Za-z0-9\-]+)\s*\}', head)
        cid = norm_id(anchor_m.group(1)) if anchor_m else None
        if not cid:
            cid = norm_id(label.replace(' ', '').replace('(', '-').replace(')', ''))
        if not cid:
            continue
        classes = set(re.findall(r'subset-applicability__tag">Class ([A-D])<', block))
        membership[cid] = classes
        fr_label[cid] = label

# FedRAMP ODP values appear as bold assignments in the guidance block.
# Captured opportunistically; assigned_value stays null where not stated.
params = {}  # (control_id, param_key) -> label
cat = json.load(open("seed/nist_catalog.json"))["catalog"]


# ---------- NIST catalog ----------

controls = []


def collect(node, family):
    for c in node.get("controls", []) or []:
        controls.append((c, family))
        collect(c, family)


for g in cat.get("groups", []):
    collect(g, g["id"])


def props(c):
    return {p["name"]: p.get("value") for p in c.get("props", []) or []}


def statement_text(c):
    for p in c.get("parts", []) or []:
        if p.get("name") == "statement":
            return flatten(p)
    return None


def flatten(part, depth=0):
    out = []
    if part.get("prose"):
        out.append(part["prose"])
    for sp in part.get("parts", []) or []:
        t = flatten(sp, depth + 1)
        if t:
            out.append(t)
    return "\n".join(out) if out else None


def methods_of(c):
    ms = []
    for p in c.get("parts", []) or []:
        if p.get("name") == "assessment-method":
            mid = p.get("id", "").split("asm-")[-1]
            if mid in ("examine", "interview", "test"):
                ms.append(mid)
    return sorted(set(ms))


control_rows = []
objective_rows = []
param_rows = []

for c, fam in controls:
    pr = props(c)
    withdrawn = pr.get("status") == "withdrawn"
    cid = c["id"]
    parent = None
    if "." in cid:
        parent = cid.split(".")[0]
    control_rows.append(dict(
        control_id=cid,
        family=fam,
        title=c.get("title"),
        statement=statement_text(c),
        is_enhancement="." in cid,
        parent_control_id=parent,
        is_withdrawn=withdrawn,
        methods=methods_of(c),
    ))

    # ODP params declared on the control
    for prm in c.get("params", []) or []:
        param_rows.append(dict(
            control_id=cid,
            param_key=prm.get("id"),
            label=prm.get("label") or (prm.get("select") or {}).get("how-many"),
        ))

    # objectives
    seq = [0]

    def walk_obj(part, parent_oid, depth):
        for p in part.get("parts", []) or []:
            if p.get("name") != "assessment-objective":
                continue
            oid = p.get("id")
            kids = [k for k in (p.get("parts") or [])
                    if k.get("name") == "assessment-objective"]
            seq[0] += 1
            objective_rows.append(dict(
                objective_id=oid,
                control_id=cid,
                parent_objective_id=parent_oid,
                statement=p.get("prose"),
                is_leaf=not kids,
                depth=depth,
                sequence=seq[0],
            ))
            walk_obj(p, oid, depth + 1)

    for p in c.get("parts", []) or []:
        if p.get("name") == "assessment-objective":
            oid = p.get("id")
            kids = [k for k in (p.get("parts") or [])
                    if k.get("name") == "assessment-objective"]
            seq[0] += 1
            objective_rows.append(dict(
                objective_id=oid, control_id=cid, parent_objective_id=None,
                statement=p.get("prose"), is_leaf=not kids, depth=0, sequence=seq[0],
            ))
            walk_obj(p, oid, 1)


# ---------- emit ----------

out = []
w = out.append

w("-- Attesta seed. Generated by seed_gen.py — do not hand-edit.")
w(f"-- NIST OSCAL catalog {CATALOG_VERSION} + FedRAMP 2026 Class C membership.")
w("begin;")
w("")

w("-- ---------- control ----------")
for r in control_rows:
    w("insert into control (control_id, family, title, statement, is_enhancement, "
      "parent_control_id, is_withdrawn, methods, catalog_version) values ("
      f"{q(r['control_id'])}, {q(r['family'])}, {q(r['title'])}, {q(r['statement'])}, "
      f"{str(r['is_enhancement']).lower()}, {q(r['parent_control_id'])}, "
      f"{str(r['is_withdrawn']).lower()}, {arr(r['methods'])}::assessment_method[], "
      f"{q(CATALOG_VERSION)});")
w("")

w("-- ---------- control_objective ----------")
# parents before children
objective_rows.sort(key=lambda r: (r["control_id"], r["depth"], r["sequence"]))
for r in objective_rows:
    w("insert into control_objective (objective_id, control_id, parent_objective_id, "
      "statement, is_leaf, depth, sequence) values ("
      f"{q(r['objective_id'])}, {q(r['control_id'])}, {q(r['parent_objective_id'])}, "
      f"{q(r['statement'])}, {str(r['is_leaf']).lower()}, {r['depth']}, {r['sequence']});")
w("")

w("-- ---------- framework ----------")
w("insert into framework (id, name, version_pin, spine_relation, aliases) values ("
  f"{q(FRAMEWORK_ID)}, 'FedRAMP Rev5 Class C', "
  f"'rev5-class-c-catalog-5.2.0-2026-05-11', 'baseline_selection', "
  "'{moderate,fedramp-moderate-r5}');")
w("")

w("-- ---------- framework_control + control_mapping ----------")
classc = sorted([cid for cid, cl in membership.items() if "C" in cl])
for cid in sorted(membership.keys()):
    is_c = "C" in membership[cid]
    label = fr_label.get(cid, cid.upper())
    w("with fc as (insert into framework_control (framework_id, framework_control_id, "
      "control_id, is_baseline_member) values ("
      f"{q(FRAMEWORK_ID)}, {q(label)}, {q(cid)}, {str(is_c).lower()}) returning id) "
      "insert into control_mapping (framework_control_id, control_id, relation) "
      f"select fc.id, {q(cid)}, 'equivalent' from fc;")
w("")

w("-- ---------- framework_parameter ----------")
seen = set()
for r in param_rows:
    k = (r["control_id"], r["param_key"])
    if k in seen or not r["param_key"]:
        continue
    seen.add(k)
    w("insert into framework_parameter (framework_id, control_id, param_key, label, "
      "assigned_value, source) values ("
      f"{q(FRAMEWORK_ID)}, {q(r['control_id'])}, {q(r['param_key'])}, "
      f"{q(r['label'])}, null, 'fedramp') on conflict do nothing;")
w("")

w("commit;")

open("02_seed.sql", "w").write("\n".join(out))

# ---------- report ----------
leaves = [r for r in objective_rows if r["is_leaf"]]
classc_set = set(classc)
classc_leaves = [r for r in leaves if r["control_id"] in classc_set]

print(f"control rows            : {len(control_rows)}")
print(f"  withdrawn             : {sum(1 for r in control_rows if r['is_withdrawn'])}")
print(f"objective rows          : {len(objective_rows)}  (leaves: {len(leaves)})")
print(f"framework_control rows  : {len(membership)}")
print(f"  Class C members       : {len(classc)}")
print(f"framework_parameter rows: {len(seen)}")
print()
print(f"KROME REVIEW SCOPE      : {len(classc_leaves)} leaf objectives across {len(classc)} controls")
print()
print("wrote 02_seed.sql")
