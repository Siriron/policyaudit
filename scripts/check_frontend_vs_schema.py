#!/usr/bin/env python3
"""Cross-check frontend contract calls against the contract's real ABI (genvm-lint schema --json).

Usage: python check_frontend_vs_schema.py contracts/<file>.py [src_dir]   (default src_dir = src)
Fails (exit 1) on: a functionName the contract does not have; a readContract of a write method or a writeContract
of a view method; a contract method that no frontend file ever calls (unreachable flow). Heuristic text scan: it
reads `readContract(` / `writeContract(` call sites with a literal functionName. Does not follow dynamic names.
"""
import json, re, subprocess, sys, pathlib

contract = sys.argv[1]
src = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "src")
out = subprocess.run(["genvm-lint", "schema", contract, "--json"], capture_output=True, text=True).stdout
schema = json.loads(out[out.index("{"):])["schema"]["methods"]
calls = {}  # name -> set of kinds
for f in list(src.rglob("*.ts")) + list(src.rglob("*.tsx")) + list(src.rglob("*.js")) + list(src.rglob("*.jsx")):
    text = f.read_text(errors="ignore")
    for m in re.finditer(r"\b(readContract|writeContract)\s*\(\s*\{(.*?)\}\s*\)", text, re.S):
        fn = re.search(r"functionName\s*:\s*['\"]([A-Za-z0-9_]+)['\"]", m.group(2))
        if fn:
            calls.setdefault(fn.group(1), set()).add(m.group(1))
bad = []
for name, kinds in sorted(calls.items()):
    if name not in schema:
        bad.append(f"UNKNOWN METHOD: frontend calls '{name}' but the contract has no such method"); continue
    ro = schema[name]["readonly"]
    if ro and "writeContract" in kinds: bad.append(f"KIND MISMATCH: '{name}' is a view method but is sent with writeContract")
    if not ro and "readContract" in kinds: bad.append(f"KIND MISMATCH: '{name}' is a write method but is called with readContract")
for name in sorted(schema):
    if name not in calls: bad.append(f"NOT REACHABLE FROM UI: contract method '{name}' is never called by the frontend")
print(f"{len(schema)} contract methods, {len(calls)} distinct frontend calls")
print("\n".join(bad) if bad else "OK: every frontend call matches the schema and every method is reachable")
sys.exit(1 if bad else 0)
