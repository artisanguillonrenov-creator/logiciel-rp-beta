"""Compare a protected source with an existing import; repair only proven differences."""
import argparse
import ast
from datetime import datetime, timezone
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import time
import urllib.request


class UnsafeState(RuntimeError):
    pass


def emit(kind, **data):
    print(json.dumps({"event": kind, **data}, ensure_ascii=False), flush=True)


def mount(path):
    r = subprocess.run(["findmnt", "-J", "-T", str(path), "-o", "TARGET,SOURCE,FSTYPE"], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)["filesystems"][0]


def guard(src, dst, source_volume):
    if src.is_symlink() or dst.is_symlink() or not src.is_dir() or not dst.is_dir():
        raise UnsafeState("SOURCE_OR_EXISTING_IMPORT_NOT_READY")
    if src.resolve() == dst.resolve() or src.resolve() in dst.resolve().parents or dst.resolve() in src.resolve().parents:
        raise UnsafeState("OVERLAPPING_SOURCE_DESTINATION")
    sm, dm = mount(src), mount(dst)
    if "/networkvolumes/" + source_volume not in sm["source"]:
        raise UnsafeState("WRONG_SOURCE_VOLUME")
    if dm["fstype"] != "fuse.geesefs" or sm["source"] == dm["source"]:
        raise UnsafeState("GLOBAL_MOUNT_NOT_READY")
    return {"source_mount": sm, "destination_mount": dm}


def safe_path(root, rel):
    rel = Path(rel)
    if rel.is_absolute() or ".." in rel.parts or not rel.parts:
        raise UnsafeState("UNSAFE_RELATIVE_PATH")
    p = root
    if p.is_symlink():
        raise UnsafeState("SYMLINK_ROOT")
    for part in rel.parts:
        p = p / part
        if p.is_symlink():
            raise UnsafeState("SYMLINK_PATH: " + str(rel))
    return p


def rules(src):
    p = src / "elyndor_copy_job.py"
    raw = p.read_bytes()
    tree = ast.parse(raw)
    skips = {"elyndor_copy_job.py", "elyndor_transfer.log", ".ipynb_checkpoints", "Untitled*.ipynb"}
    original = {}
    filters = []
    for n in ast.walk(tree):
        if isinstance(n, ast.Assign) and any(any(k in ast.unparse(t).lower() for k in ("skip", "exclude")) for t in n.targets):
            try:
                value = ast.literal_eval(n.value)
            except (ValueError, TypeError):
                continue
            if isinstance(value, (list, tuple, set)) and all(isinstance(x, str) for x in value):
                original[", ".join(ast.unparse(t) for t in n.targets)] = sorted(value)
                for item in value:
                    if item.startswith(str(src) + "/"):
                        item = item[len(str(src)) + 1:]
                    if not item.startswith("/") and ".." not in Path(item).parts:
                        skips.add(item)
        if isinstance(n, ast.If) and any(isinstance(v, ast.Continue) for stmt in n.body for v in ast.walk(stmt)):
            filters.append(ast.unparse(n.test))
        if isinstance(n, ast.ListComp) and n.generators[0].ifs:
            filters.extend(ast.unparse(v) for v in n.generators[0].ifs)
    return skips, {"copy_script_sha256": hashlib.sha256(raw).hexdigest(), "original_skip_lists": original, "original_filter_conditions": sorted(set(filters)), "applied_skips": sorted(skips)}


def excluded(rel, skips):
    return any(fnmatch.fnmatchcase(rel, x) if "/" in x else any(fnmatch.fnmatchcase(part, x) for part in Path(rel).parts) for x in skips)


def scan(root, skips=()):
    files, links, skipped = {}, [], []
    pending = [root]
    while pending:
        parent = pending.pop()
        for e in os.scandir(parent):
            rel = str(Path(e.path).relative_to(root))
            if e.is_symlink():
                links.append(rel)
            elif excluded(rel, skips):
                skipped.append(rel)
            elif e.is_dir(follow_symlinks=False):
                pending.append(Path(e.path))
            elif e.is_file(follow_symlinks=False):
                s = e.stat(follow_symlinks=False)
                files[rel] = [s.st_size, s.st_mtime_ns]
                if len(files) % 2000 == 0:
                    emit("SCAN_PROGRESS", root=str(root), files=len(files))
    return files, links, skipped


def open_regular(path):
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise UnsafeState("NOT_REGULAR: " + str(path))
    return os.fdopen(fd, "rb")


def digest(root, rel):
    p = safe_path(root, rel)
    h = hashlib.sha256()
    with open_regular(p) as f:
        before = os.fstat(f.fileno())
        total = 0
        last_notice = 0
        while True:
            b = f.read(8 * 1024 * 1024)
            if not b:
                break
            h.update(b)
            total += len(b)
            if total - last_notice >= 1024 ** 3:
                emit("HASH_PROGRESS", root=str(root), path=rel, bytes=total)
                last_notice = total
        after = os.fstat(f.fileno())
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns) or total != before.st_size:
        raise UnsafeState("FILE_CHANGED_DURING_HASH: " + rel)
    return h.hexdigest()


def model_file(src, rel, size):
    named = rel.lower().endswith(".gguf")
    if not named and size < 256 * 1024 * 1024:
        return False
    with open_regular(safe_path(src, rel)) as f:
        first = f.read(8)
    is_model = first[:4] == b"GGUF"
    if named and (not is_model or len(first) != 8 or int.from_bytes(first[4:8], "little") not in (2, 3)):
        raise UnsafeState("INVALID_SOURCE_GGUF_HEADER: " + rel)
    return is_model


def critical(rel):
    p = Path(rel)
    if p.name in ("llama-server", "llama-cli"):
        return True
    if any(x in p.parts for x in (".cache", ".git", "venv", ".venv", "site-packages", "node_modules", "__pycache__", "llama.cpp")):
        return False
    return p.suffix.lower() in (".sh", ".jinja", ".json", ".yaml", ".yml", ".toml", ".py", ".ts", ".js", ".md", ".txt", ".env")


def copy_one(src, dst, rel, fingerprint, golden=None):
    p, q = safe_path(src, rel), safe_path(dst, rel)
    if q.exists() and not q.is_file():
        raise UnsafeState("DESTINATION_PATH_CONFLICT: " + rel)
    q.parent.mkdir(parents=True, exist_ok=True)
    safe_path(dst, rel)
    name = None
    try:
        with open_regular(p) as inp, tempfile.NamedTemporaryFile(prefix=".elyndor-repair-", suffix=".part", dir=q.parent, delete=False) as out:
            name = out.name
            before = os.fstat(inp.fileno())
            if [before.st_size, before.st_mtime_ns] != fingerprint:
                raise UnsafeState("SOURCE_CHANGED_BEFORE_COPY: " + rel)
            h, total = hashlib.sha256(), 0
            while True:
                b = inp.read(8 * 1024 * 1024)
                if not b:
                    break
                out.write(b)
                h.update(b)
                total += len(b)
            after = os.fstat(inp.fileno())
            out.flush()
            os.fsync(out.fileno())
        if [after.st_size, after.st_mtime_ns] != fingerprint or total != fingerprint[0]:
            raise UnsafeState("SOURCE_CHANGED_DURING_COPY: " + rel)
        actual = h.hexdigest()
        if golden and actual != golden:
            raise UnsafeState("SOURCE_HASH_CHANGED: " + rel)
        staged_rel = str(Path(name).relative_to(dst))
        if digest(dst, staged_rel) != actual:
            raise UnsafeState("STAGED_COPY_HASH_FAILED: " + rel)
        safe_path(dst, rel)
        os.replace(name, q)
        name = None
        if digest(dst, rel) != actual:
            raise UnsafeState("FINAL_COPY_HASH_FAILED: " + rel)
        return actual
    finally:
        if name is not None:
            Path(name).unlink(missing_ok=True)


def audit(src, dst, skips, repair=False, ready=None):
    src, dst = Path(src), Path(dst)
    if src.is_symlink() or dst.is_symlink() or src.resolve() == dst.resolve() or src.resolve() in dst.resolve().parents or dst.resolve() in src.resolve().parents:
        raise UnsafeState("OVERLAPPING_OR_SYMLINK_ROOT")
    sf, sl, sx = scan(src, skips)
    df, dl, dx = scan(dst)
    if not sf:
        raise UnsafeState("EMPTY_SOURCE_INVENTORY")
    bad, hashes, models = {}, {}, []
    for rel, fp in sf.items():
        safe_path(src, rel)
        safe_path(dst, rel)
        if rel not in df:
            bad[rel] = "missing"
        elif df[rel][0] != fp[0]:
            bad[rel] = "size_mismatch"
        if model_file(src, rel, fp[0]):
            models.append(rel)
    check = set(models) | {rel for rel in sf if critical(rel)}
    corrupted = False
    for rel in sorted(check):
        hashes[rel] = digest(src, rel)
        if rel in df and df[rel][0] == sf[rel][0] and digest(dst, rel) != hashes[rel]:
            bad[rel] = "sha256_mismatch"
            corrupted = True
    if corrupted:
        emit("EXTENDING_HASH_CHECK_TO_ALL_FILES")
        for rel in sorted(sf.keys() - check):
            hashes[rel] = digest(src, rel)
            if rel in df and df[rel][0] == sf[rel][0] and digest(dst, rel) != hashes[rel]:
                bad[rel] = "sha256_mismatch"
    summary = {"status": "differences_found" if bad else "verified", "source_files": len(sf), "source_bytes": sum(v[0] for v in sf.values()), "destination_import_files": len(df), "destination_extra_files": len(df.keys() - sf.keys()), "source_symlinks_excluded": len(sl), "source_technical_exclusions": sx, "hash_checked_files": len(hashes), "full_hash_check": corrupted, "models": [{"path": r, "bytes": sf[r][0], "source_sha256": hashes[r]} for r in models], "differences": bad, "repairs": [], "repair_bytes": 0, "errors": []}
    emit("COMPARISON_RESULT", **summary)
    if repair and bad:
        if ready:
            additional = ready(summary)
            if additional and set(additional) - set(skips):
                return audit(src, dst, set(skips) | set(additional), repair=True)
        if scan(src, skips)[0] != sf:
            raise UnsafeState("SOURCE_INVENTORY_CHANGED_BEFORE_REPAIR")
        for rel, why in sorted(bad.items()):
            try:
                golden = copy_one(src, dst, rel, sf[rel], hashes.get(rel))
                hashes[rel] = golden
                summary["repairs"].append({"path": rel, "reason": why, "bytes": sf[rel][0], "sha256": golden})
                summary["repair_bytes"] += sf[rel][0]
                emit("FILE_REPAIRED", path=rel, reason=why, bytes=sf[rel][0])
            except Exception as e:
                summary["errors"].append(str(e))
                break
    fresh, _, _ = scan(dst)
    remaining = {r: "missing_or_size" for r, fp in sf.items() if r not in fresh or fresh[r][0] != fp[0]}
    for rel, golden in hashes.items():
        if rel in fresh and fresh[rel][0] == sf[rel][0] and digest(dst, rel) != golden:
            remaining[rel] = "sha256"
    if scan(src, skips)[0] != sf:
        summary["errors"].append("SOURCE_INVENTORY_CHANGED_DURING_AUDIT")
    summary["remaining_differences"] = remaining
    summary["hash_verified_files"] = len(hashes) - sum(1 for r in hashes if r in remaining)
    summary["status"] = "verified" if not remaining and not summary["errors"] else "not_verified"
    return summary


def await_start_signal(url, run_id, summary, script_sha):
    emit("AWAITING_REPAIR_START", run_id=run_id, differences=len(summary["differences"]))
    deadline = time.monotonic() + 1800
    while time.monotonic() < deadline:
        try:
            req = urllib.request.Request(url + "?t=" + str(int(time.time())), headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.loads(r.read(65536))
            if data.get("run_id") == run_id and data.get("proceed") is True and data.get("copy_script_sha256") == script_sha and data.get("writer_quiesced") is True:
                extra = data.get("extra_exclusions", [])
                if not isinstance(extra, list) or len(extra) > 50 or any(not isinstance(v, str) or not v or len(v) > 256 or Path(v).is_absolute() or ".." in Path(v).parts for v in extra):
                    raise UnsafeState("INVALID_CONFIRMED_EXCLUSIONS")
                return extra
        except Exception:
            pass
        time.sleep(15)
    raise UnsafeState("REPAIR_START_NOT_RECEIVED_NO_DATA_REPAIRED")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="/workspace")
    ap.add_argument("--destination", default="/workspace-global/elyndor_ro_import")
    ap.add_argument("--source-volume", required=True)
    ap.add_argument("--repair", action="store_true")
    ap.add_argument("--go-url")
    ap.add_argument("--run-id")
    args = ap.parse_args()
    src, dst = Path(args.source), Path(args.destination)
    emit("ELYNDOR_RECONCILE_STARTED")
    deadline = time.monotonic() + 300
    while True:
        try:
            mounts = guard(src, dst, args.source_volume)
            break
        except Exception:
            if time.monotonic() >= deadline:
                raise
            emit("WAITING_FOR_EXPECTED_MOUNTS")
            time.sleep(10)
    emit("EXPECTED_MOUNTS_READY", **mounts)
    skips, meta = rules(src)
    emit("COPY_RULES", **meta)
    ps = subprocess.run(["ps", "-eo", "pid,args"], capture_output=True, text=True).stdout
    pids = [x.split()[0] for x in ps.splitlines() if "python" in x and "/workspace/elyndor_copy_job.py" in x]
    if pids:
        raise UnsafeState("EXISTING_COPY_WRITER_RUNNING_PIDS:" + ",".join(pids))
    callback = None
    if args.repair:
        if not args.go_url or not args.run_id or not args.go_url.startswith("https://raw.githubusercontent.com/artisanguillonrenov-creator/logiciel-rp-beta/"):
            raise UnsafeState("REPAIR_REQUIRES_SCOPED_START_SIGNAL")
        def callback(summary):
            extra = await_start_signal(args.go_url, args.run_id, summary, meta["copy_script_sha256"])
            meta["confirmed_extra_exclusions"] = extra
            meta["applied_skips"] = sorted(set(skips) | set(extra))
            return extra
    result = audit(src, dst, skips, args.repair, callback)
    result.update(meta, **mounts, utc=datetime.now(timezone.utc).isoformat())
    report_rel = "elyndor_validation/" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + str(os.getpid())
    report_dir = safe_path(dst.parent, report_rel)
    report_dir.mkdir(parents=True, exist_ok=False)
    report = safe_path(dst.parent, report_rel + "/validation.json")
    fd = os.open(report, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    emit("ELYNDOR_VALIDATION_RESULT", report=str(report), **result)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        emit("ELYNDOR_RECONCILE_FAILED", error=str(e))
        raise SystemExit(1)
