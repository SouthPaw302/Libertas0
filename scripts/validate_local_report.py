#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,re,sys
from pathlib import Path
ap=argparse.ArgumentParser(); ap.add_argument("path",nargs="?",default="reports/local-debug/LATEST.json"); a=ap.parse_args()
try: d=json.loads(Path(a.path).read_text(encoding="utf-8"))
except Exception as e: print(f"LOCAL DEBUG REPORT: FAIL invalid json: {e}"); sys.exit(1)
required=["task_id","tested_sha","status","environment","measurements","artifacts","logs","reproduction","notes","completed_at"]
errors=[f"missing {k}" for k in required if k not in d]
if not re.fullmatch(r"[0-9a-f]{40}",str(d.get("tested_sha",""))): errors.append("tested_sha must be 40 lowercase hex")
if d.get("tested_sha")=="0"*40: errors.append("placeholder tested_sha is not relayable")
if d.get("status") not in {"PASS","FAIL","BLOCKED"}: errors.append("invalid status")
if not isinstance(d.get("environment"),dict): errors.append("environment must be object")
if not isinstance(d.get("measurements"),dict): errors.append("measurements must be object")
for k in ["artifacts","logs","reproduction"]:
 if not isinstance(d.get(k),list): errors.append(f"{k} must be array")
if errors:
 print("LOCAL DEBUG REPORT: FAIL")
 for e in errors: print("- "+e)
 sys.exit(1)
print("LOCAL DEBUG REPORT: PASS")
print(f"task={d['task_id']} tested_sha={d['tested_sha']} status={d['status']}")
