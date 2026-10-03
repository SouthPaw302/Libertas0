#!/usr/bin/env python3
from __future__ import annotations
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REQ=["SOUL.md","AGENTS.md","SYSTEM_CONTRACT.json","CAPABILITY_REGISTRY.json","MODULE_REGISTRY.json","DEVELOPMENT_STATE.json","DECISIONS.md","FAILURES.md","orchestrator/TASK_SCHEMA.json","orchestrator/RESULT_SCHEMA.json","docs/FOUNDING_CHARTER.md","docs/PHASE1_VERIFICATION_FABRIC.md"]
errors=[]
for rel in REQ:
 if not (ROOT/rel).is_file(): errors.append(f"missing {rel}")
def load(name):
 try: return json.loads((ROOT/name).read_text(encoding="utf-8"))
 except Exception as e:
  errors.append(f"invalid JSON {name}: {e}"); return {}
contract=load("SYSTEM_CONTRACT.json"); caps=load("CAPABILITY_REGISTRY.json"); mods=load("MODULE_REGISTRY.json"); state=load("DEVELOPMENT_STATE.json")
load("orchestrator/TASK_SCHEMA.json"); load("orchestrator/RESULT_SCHEMA.json")
states=set(contract.get("module_states",[])); ml=mods.get("modules",[]); ids=[m.get("id") for m in ml]
if len(ids)!=len(set(ids)): errors.append("duplicate module id")
for m in ml:
 if m.get("state") not in states: errors.append(f"invalid module state: {m}")
 for dep in m.get("depends_on",[]):
  if dep not in ids: errors.append(f"unknown dependency {dep} for {m.get('id')}")
active=state.get("active_module")
if active not in ids: errors.append(f"active module missing: {active}")
else:
 ms=next(m for m in ml if m.get("id")==active)
 if ms.get("state")!=state.get("status"): errors.append(f"active module state mismatch: registry={ms.get('state')} development={state.get('status')}")
capids=[c.get("id") for c in caps.get("capabilities",[])]
if len(capids)!=len(set(capids)): errors.append("duplicate capability id")
if contract.get("local_debug",{}).get("issue")!=1: errors.append("local debug issue must be #1")
if contract.get("local_debug",{}).get("report_branch")!="validation/local-debug": errors.append("unexpected local debug branch")
if errors:
 print("LIBERTAS SYSTEM VALIDATION: FAIL")
 for e in errors: print("- "+e)
 sys.exit(1)
print("LIBERTAS SYSTEM VALIDATION: PASS")
print(f"active_module={active} status={state.get('status')}")
print(f"modules={len(ml)} capabilities={len(capids)}")
