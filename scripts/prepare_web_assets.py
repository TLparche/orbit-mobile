"""Restore final website images from pinned public CDN URLs, without research inputs.

Existing files are reused only when their SHA-256 matches the frozen manifest.
Changed or unavailable remote images fail visibly; analysis is never refreshed.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys
import tempfile
import time
from urllib.parse import urljoin, urlsplit

import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "public"
MANIFEST = Path(__file__).with_name("web_assets.json")
HOSTS = {"cdn-optimized.imweb.me", "cdn.imweb.me"}
MAX_BYTES = 20_000_000


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(root, relative):
    root = root.resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or path == root:
        raise ValueError(f"Output path outside target directory: {relative}")
    return path


def valid_file(path, spec):
    return (path.is_file() and path.stat().st_size == spec["bytes"]
            and digest(path.read_bytes()) == spec["sha256"])


def write_verified(path, data, spec):
    if len(data) != spec["bytes"] or digest(data) != spec["sha256"]:
        raise ValueError(f"Frozen image differs: {spec['path']}; existing file was kept")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def validate_url(url):
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.hostname not in HOSTS
            or parts.username is not None or parts.password is not None
            or parts.port not in (None, 443) or not parts.path or parts.fragment):
        raise ValueError(f"URL is outside the approved image CDN: {url}")
    return url


class Fetcher:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "SMCC-Research/1.0 (representative image research)",
            "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        })
        self.last_request = 0.0

    def get(self, url):
        last_error = None
        for attempt in range(3):
            current = validate_url(url)
            try:
                for redirect in range(4):
                    time.sleep(max(0.0, 1.05 - (time.monotonic() - self.last_request)))
                    self.last_request = time.monotonic()
                    with self.session.get(current, stream=True, timeout=(10, 35),
                                          allow_redirects=False) as response:
                        if response.status_code in {301, 302, 303, 307, 308}:
                            location = response.headers.get("Location")
                            if redirect == 3 or not location:
                                raise ValueError("Too many redirects or missing Location")
                            current = validate_url(urljoin(current, location))
                            continue
                        response.raise_for_status()
                        if not response.headers.get("Content-Type", "").lower().startswith("image/"):
                            raise ValueError("CDN response is not an image")
                        length = response.headers.get("Content-Length")
                        if length and (not length.isdecimal() or int(length) > MAX_BYTES):
                            raise ValueError("Invalid or oversized image response")
                        data = bytearray()
                        for chunk in response.iter_content(65536):
                            data.extend(chunk)
                            if len(data) > MAX_BYTES:
                                raise ValueError("Image exceeds 20 MB")
                        if not data:
                            raise ValueError("Empty image response")
                        return bytes(data)
            except requests.RequestException as error:
                last_error = error
                if attempt < 2:
                    time.sleep(2 ** attempt)
        raise RuntimeError(f"Image download failed: {url}: {last_error}")


def canonical_rgb(image):
    image.seek(0)
    image = ImageOps.exif_transpose(image)
    if "A" in image.getbands() or "transparency" in image.info:
        rgba = image.convert("RGBA")
        return Image.alpha_composite(Image.new("RGBA", rgba.size, "white"), rgba).convert("RGB")
    return image.convert("RGB")


def preview_bytes(source):
    buffer = io.BytesIO()
    with Image.open(source) as image:
        ImageOps.contain(canonical_rgb(image), (360, 450)).save(buffer, "JPEG", quality=85)
    return buffer.getvalue()


def gallery_bytes(output, manifest):
    paths = sorted(asset["preview"]["path"] for asset in manifest["images"])
    columns, cell_w, cell_h, padding = 20, 100, 124, 2
    atlas = Image.new("RGB", (columns * cell_w, math.ceil(len(paths) / columns) * cell_h), "#f1f2ed")
    for index, name in enumerate(paths):
        x, y = index % columns * cell_w, index // columns * cell_h
        with Image.open(safe_path(output, name)) as source:
            contained = ImageOps.contain(ImageOps.exif_transpose(source).convert("RGB"),
                                         (96, 120), Image.Resampling.LANCZOS)
            atlas.paste(contained, (x + padding + (96 - contained.width) // 2,
                                   y + padding + (120 - contained.height) // 2))
    buffer = io.BytesIO()
    atlas.save(buffer, "WEBP", quality=85, method=6)
    return buffer.getvalue()


def nebula_bytes():
    # Same fixed decorative texture as the final site's local design builder.
    import numpy as np
    width, height = 1920, 1200
    rng = np.random.default_rng(20261031)

    def noise(grid):
        array = rng.random((grid, max(2, round(grid * width / height)))).astype(np.float32)
        return np.asarray(Image.fromarray(array).resize((width, height), Image.Resampling.BICUBIC))

    broad, warp = noise(5), noise(9)
    cloud = sum(noise(grid) * weight for grid, weight in [(6, .47), (15, .28), (36, .15), (90, .07), (220, .03)])
    y, x = np.mgrid[0:height, 0:width].astype(float)
    x /= width
    y /= height
    axis = y - (.99 - .74 * x + .08 * np.sin(x * 8)) + (warp - .5) * .32
    veil = np.exp(-(axis / .24) ** 2)
    dust = np.exp(-((axis + .018 + (broad - .5) * .12) / .042) ** 2)
    filaments = np.clip((cloud - .30) * 2.7, 0, 1.25) ** 1.6
    density = veil * filaments * (1 - .72 * dust)
    light = np.clip(.35 + x * .8, 0, 1)[..., None]
    color = np.array([49, 25, 79]) * (1 - light) + np.array([16, 48, 91]) * light
    edge = np.clip(1 - ((x - .5) ** 2 * .9 + (y - .5) ** 2), .38, 1)
    rgb = np.array([2, 3, 10]) + density[..., None] * color * edge[..., None]
    halo = np.exp(-(((x - .69) / .48) ** 2 + ((y - .25) / .40) ** 2)) * cloud
    rgb += halo[..., None] * np.array([3, 6, 13])
    buffer = io.BytesIO()
    Image.fromarray(np.uint8(np.clip(rgb, 0, 255))).save(buffer, "WEBP", quality=91, method=6)
    return buffer.getvalue()


def output_specs(manifest):
    for asset in manifest["images"]:
        yield asset
        yield asset["preview"]
    yield manifest["gallery"]
    yield manifest["nebula"]


def load_manifest(output):
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest["version"] != 1 or len(manifest["images"]) != 240:
        raise ValueError("Expected the fixed 240-image website snapshot")
    paths = set()
    for spec in output_specs(manifest):
        safe_path(output, spec["path"])
        if spec["path"] in paths or not re.fullmatch(r"[0-9a-f]{64}", spec["sha256"]):
            raise ValueError("Duplicate output path or invalid digest in image manifest")
        paths.add(spec["path"])
    for asset in manifest["images"]:
        if not asset["urls"]:
            raise ValueError("Missing image source URL")
        for url in asset["urls"]:
            validate_url(url)
    return manifest


def prepare(output, cache, manifest, offline=False):
    fetcher = Fetcher()
    downloaded = reused = restored = 0
    try:
        for index, asset in enumerate(manifest["images"], 1):
            target = safe_path(output, asset["path"])
            cached = safe_path(cache, Path(asset["path"]).name)
            if valid_file(target, asset):
                reused += 1
            elif valid_file(cached, asset):
                write_verified(target, cached.read_bytes(), asset)
                restored += 1
            else:
                if offline:
                    raise ValueError(f"Image missing from output/cache in offline mode: {asset['path']}")
                errors = []
                for url in asset["urls"]:
                    try:
                        data = fetcher.get(url)
                        write_verified(cached, data, asset)
                        write_verified(target, data, asset)
                        downloaded += 1
                        break
                    except (requests.RequestException, RuntimeError, ValueError) as error:
                        errors.append(str(error))
                else:
                    raise RuntimeError(f"Cannot restore {asset['path']}: {'; '.join(errors)}")
            preview = asset["preview"]
            destination = safe_path(output, preview["path"])
            if not valid_file(destination, preview):
                write_verified(destination, preview_bytes(target), preview)
            if index % 20 == 0:
                print(f"Images {index}/240 (downloaded {downloaded}, cached {restored}, unchanged {reused})", flush=True)
        for name, builder in [("gallery", lambda: gallery_bytes(output, manifest)), ("nebula", nebula_bytes)]:
            spec = manifest[name]
            target = safe_path(output, spec["path"])
            if not valid_file(target, spec):
                write_verified(target, builder(), spec)
    finally:
        fetcher.session.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Static website directory")
    parser.add_argument("--cache-dir", type=Path, default=ROOT / ".cache/web-assets", help="Reusable original image cache")
    parser.add_argument("--offline", action="store_true", help="Restore from existing output/cache without network")
    parser.add_argument("--check", action="store_true", help="Check all 482 image hashes without downloads or writes")
    args = parser.parse_args()
    try:
        manifest = load_manifest(args.output)
        if not args.check:
            prepare(args.output, args.cache_dir, manifest, args.offline)
        missing = [spec["path"] for spec in output_specs(manifest)
                   if not valid_file(safe_path(args.output, spec["path"]), spec)]
        if missing:
            raise ValueError(f"{len(missing)} images missing or changed; first: {missing[0]}")
        print("OK: all 482 website image hashes match the frozen snapshot.", flush=True)
        return 0
    except (OSError, ValueError, RuntimeError, requests.RequestException) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
