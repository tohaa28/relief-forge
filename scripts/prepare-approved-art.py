#!/usr/bin/env python3
"""Verify approved original raster artwork and extract precise pictogram crops.
Never resize, draw, optimize, quantize, or re-encode approved PNGs.
"""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/"web"/"approved"
MANIFEST=json.loads((ASSETS/"sha256-manifest.json").read_text("utf-8"))
FILES=MANIFEST["files"]
def check(rel,data):
    expected=FILES.get(rel)
    if not expected:
        raise ValueError("Unlisted approved asset: "+rel)
    actual=hashlib.sha256(data).hexdigest()
    if actual!=expected:
        raise ValueError(f"Approved asset modified: {rel}, SHA-256 {actual}")
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Expected PNG signature: "+rel)

for rel in sorted(k for k in FILES if not k.startswith("web/approved/icons/")):
    check(rel,(ROOT/rel).read_bytes())
archive=ASSETS/"icons-approved.zip"
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
if digest!=MANIFEST["archive_sha256"]:
    raise ValueError("Approved pictogram ZIP modified")
with ZipFile(archive) as package:
    names=package.namelist()
    expected=sorted(Path(k).name for k in FILES if k.startswith("web/approved/icons/"))
    if sorted(names)!=expected or len(names)!=len(set(names)):
        raise ValueError("Unexpected files in pictogram package")
    output=ASSETS/"icons"
    output.mkdir(exist_ok=True)
    for name in names:
        if Path(name).name!=name or not name.lower().endswith(".png"):
            raise ValueError("Unsafe image path: "+name)
        content=package.read(name)
        check("web/approved/icons/"+name,content)
        (output/name).write_bytes(content)
print(f"Verified {len(FILES)} exact approved raster assets (3 originals + {len(names)} tool icons).")
