"""Read-only migration probe; never executes the original copy script."""
import ast
import glob
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess


def redact(text):
    text = re.sub(r"rpa_[A-Za-z0-9_-]+", "[REDACTED]", text)
    return re.sub(r"(?i)(Bearer\s+)[A-Za-z0-9._-]+", r"\1[REDACTED]", text)


def path_literal(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Call) and len(node.args) == 1:
        fn = ast.unparse(node.func)
        if fn in ("Path", "pathlib.Path"):
            return path_literal(node.args[0])
    return None


def probe(source="/workspace", destination="/workspace-global/elyndor_ro_import"):
    src, dst = Path(source), Path(destination)
    result = {"source": str(src), "destination": str(dst), "errors": []}
    result["hostname"] = subprocess.getoutput("hostname")
    result["gpu_devices"] = glob.glob("/dev/nvidia[0-9]*")
    result["nvidia_control"] = Path("/dev/nvidiactl").exists()
    result["mounts"] = {}
    for p in (src, dst.parent):
        r = subprocess.run(["findmnt", "-T", str(p), "-o", "TARGET,SOURCE,FSTYPE"], capture_output=True, text=True)
        result["mounts"][str(p)] = r.stdout.strip() or r.stderr.strip()
    script = src / "elyndor_copy_job.py"
    if script.is_file():
        raw = script.read_bytes()
        result["copy_script_sha256"] = hashlib.sha256(raw).hexdigest()
        tree = ast.parse(raw)
        exclusions, paths, conditions = {}, {}, []
        for n in ast.walk(tree):
            if isinstance(n, ast.Assign):
                names = [ast.unparse(x) for x in n.targets]
                if any("skip" in x.lower() or "exclude" in x.lower() for x in names):
                    try:
                        value = ast.literal_eval(n.value)
                    except (ValueError, TypeError):
                        continue
                    if isinstance(value, (list, tuple, set)) and all(isinstance(x, str) for x in value):
                        exclusions[", ".join(names)] = sorted(redact(x) for x in value)
                value = path_literal(n.value)
                if value and value.startswith(str(src)):
                    paths[", ".join(names)] = redact(value)
            elif isinstance(n, ast.If):
                condition = ast.unparse(n.test)
                if any(x in condition.lower() for x in ("symlink", "islink", "checkpoint", "ipynb", "skip", "exclude")):
                    conditions.append(redact(condition))
        result["original_exclusions"] = exclusions
        result["original_path_constants"] = paths
        result["original_exclusion_conditions"] = conditions
    else:
        result["errors"].append("copy_script_missing")
    log = src / "elyndor_transfer.log"
    if log.is_file():
        text = log.read_text(errors="replace")
        result["transfer_log"] = {"lines": len(text.splitlines()), "done_markers": text.count("TRANSFER_DONE"), "tail": redact("\n".join(text.splitlines()[-12:]))}
    ps = subprocess.run(["ps", "-eo", "pid,args"], capture_output=True, text=True).stdout
    result["copy_process_pids"] = [line.split()[0] for line in ps.splitlines() if "python" in line and "elyndor_copy_job.py" in line]
    count = total = links = 0
    models = []
    for root, dirs, names in os.walk(src, followlinks=False, onerror=lambda e: result["errors"].append(str(e))):
        dirs[:] = [d for d in dirs if not (Path(root) / d).is_symlink()]
        for name in names:
            p = Path(root) / name
            if p.is_symlink():
                links += 1
                continue
            try:
                if not p.is_file():
                    continue
                size = p.stat().st_size
                count += 1
                total += size
                if p.suffix.lower() == ".gguf":
                    rel = p.relative_to(src)
                    q = dst / rel
                    models.append({"relative_path": str(rel), "source_bytes": size, "destination_bytes": q.stat().st_size if q.is_file() and not q.is_symlink() else None})
            except OSError as e:
                result["errors"].append(str(e))
    result.update(source_raw_regular_files=count, source_raw_bytes=total, source_symlink_files=links, models=models)
    result["source_top"] = sorted(os.listdir(src))
    result["destination_top"] = sorted(os.listdir(dst)) if dst.is_dir() else None
    print("ELYNDOR_PROBE_RESULT")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return result


if __name__ == "__main__":
    probe()
