#!/usr/bin/env python3
"""Static audit of a GenVM v0.2 contract: the literal checks of the project's nondet bug catalog.

Usage: python scripts/audit_contract.py contracts/policyaudit.py

These are source checks. They complement, and never replace, the direct-mode tests that execute the contract.
Exits 1 on any failure.
"""
import ast
import io
import re
import sys
import tokenize

PRAGMA = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'
FORBIDDEN = {
    r"import genlayer as gl": "v0.3 import",
    r"gl\.contract\.": "v0.3 API",
    r"gl\.storage\.allow": "v0.3 API",
    r"gl\.message\.raw": "v0.3 API (v0.2 is gl.message_raw)",
    r"run_nondet_default": "v0.3 API",
    r"get_timestamp": "v0.3 API",
    r"sender_account": "wrong field (sender_address)",
    r"status_code": "SDK Response has .status, never .status_code",
    r"\.send\(": "use emit_transfer(value=...)",
    r"float\(": "no floats anywhere near nondet code",
    r"DynArray": "never on nested dataclasses; use a delimiter-joined str",
    r"json\.loads\(": "run_nondet_unsafe / leaders_res values are already decoded",
    r"gl\.UserError": "the class is gl.vm.UserError",
    r"gl\.get_webpage|gl\.exec_prompt": "use gl.nondet.web.get / gl.nondet.exec_prompt",
    r"int\(gl\.message_raw": "message_raw['datetime'] is an ISO string",
    r"run_nondet\(": "bare run_nondet is the sandboxed variant in v0.2; use run_nondet_unsafe",
}


def strip_comments(source):
    out = []
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        if tok.type != tokenize.COMMENT:
            out.append(tok)
    return tokenize.untokenize(out)


def main(path):
    source = open(path).read()
    problems = []
    if source.splitlines()[0].strip() != PRAGMA:
        problems.append("line 1 is not the pinned py-genlayer runner pragma")

    tree = ast.parse(source)
    # drop docstrings so prose cannot trip the greps
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef)) and node.body:
            first = node.body[0]
            if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
                first.value.value = ""
    code = ast.unparse(tree)
    for pattern, why in FORBIDDEN.items():
        for m in re.finditer(pattern, code):
            problems.append(f"forbidden `{m.group(0)}`: {why}")

    # self inside leader_fn / validator_fn
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name in ("leader_fn", "validator_fn"):
            for sub in ast.walk(node):
                if isinstance(sub, ast.Name) and sub.id == "self":
                    problems.append(f"`self` referenced inside {node.name} (line {sub.lineno})")

    # run_nondet_unsafe positional only
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "run_nondet_unsafe":
            if node.keywords or len(node.args) != 2:
                problems.append("run_nondet_unsafe must be called positionally with (leader_fn, validator_fn)")

    # class-body annotations are storage fields: only genuine storage types allowed
    storage_types = ("TreeMap", "DynArray", "u256", "u64", "u32", "u8", "str", "Address", "bool")
    for cls in [n for n in tree.body if isinstance(n, ast.ClassDef)]:
        is_contract = any("Contract" in ast.unparse(b) for b in cls.bases)
        annotated = set()
        for stmt in cls.body:
            if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
                annotated.add(stmt.target.id)
                if is_contract and not any(ast.unparse(stmt.annotation).startswith(t) for t in storage_types):
                    problems.append(f"class-body annotation `{stmt.target.id}` is not a storage type")
                if is_contract and stmt.value is not None:
                    problems.append(f"class-body attribute `{stmt.target.id}` has a value; constants belong at module level")
        if is_contract:
            for sub in ast.walk(cls):
                if isinstance(sub, (ast.Assign, ast.AugAssign)):
                    targets = sub.targets if isinstance(sub, ast.Assign) else [sub.target]
                    for t in targets:
                        if (isinstance(t, ast.Attribute) and isinstance(t.value, ast.Name) and t.value.id == "self"
                                and t.attr not in annotated):
                            problems.append(f"`self.{t.attr} =` has no class-body annotation (line {sub.lineno}); it would not persist")

    if problems:
        print("\n".join("FAIL: " + p for p in problems))
        return 1
    print("OK: contract passes the static nondet audit")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
