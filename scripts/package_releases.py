#!/usr/bin/env python3
"""
Package two standalone community releases under releases/:
  1. Antigravity-SilverInk-Ultra (+ .zip) — Full 60 FPS video, eye-tracking, and full VFX
  2. Antigravity-SilverInk-Lite  (+ .zip) — Low-RAM 1080p static + 1-shot crisp VFX (~1.5-2 MB)
"""

from __future__ import annotations

import json
import shutil
import sys
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from build_payload import DEFAULT_MAX_DIM, build_payload  # noqa: E402

LITE_STRIP_KEYS = (
    "videoWallpaper",
    "eyeTracking",
    "eyeScleraMask",
    "eyeIrisLeft",
    "eyeIrisRight",
    "eyeBlinkMask",
)

ROOT_DOC_FILES = (".gitignore", ".gitattributes", "LICENSE", "README.md", "SKILL.md")
COMMON_DIRS = ("daemon", "engine", "references")


def write_starter_config(target_dir: Path, performance_mode: str) -> None:
    cfg = {
        "themeName": "Silver Ink Starlight",
        "bubbleName": "Silver Ink Starlight",
        "inputStyle": "sync",
        "dimming": 28,
        "wpEnabled": True,
        "customWp": "",
        "userAvatar": "",
        "agentAvatar": "",
        "glassBlur": 3,
        "avatarSize": 32,
        "avatarRadius": 50,
        "performanceMode": performance_mode,
    }
    (target_dir / "theme_config.json").write_text(
        json.dumps(cfg, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_windows_launchers(target_dir: Path, profile: str) -> None:
    install_bat = (
        "@echo off\r\n"
        "cd /d \"%~dp0\"\r\n"
        f"powershell -NoProfile -ExecutionPolicy Bypass -File \"%~dp0scripts\\install-win.ps1\" -Profile {profile.capitalize()}\r\n"
        "echo.\r\n"
        "pause\r\n"
    )
    uninstall_bat = (
        "@echo off\r\n"
        "cd /d \"%~dp0\"\r\n"
        "node \"%~dp0scripts\\uninstall.js\"\r\n"
        "echo.\r\n"
        "pause\r\n"
    )
    (target_dir / "INSTALL_WINDOWS.bat").write_bytes(install_bat.encode("ascii"))
    (target_dir / "UNINSTALL.bat").write_bytes(uninstall_bat.encode("ascii"))


def copy_common_skeleton(dst_root: Path) -> None:
    if dst_root.exists():
        shutil.rmtree(dst_root)
    dst_root.mkdir(parents=True, exist_ok=True)

    for rel in ROOT_DOC_FILES:
        src = REPO_ROOT / rel
        if src.is_file():
            shutil.copy2(src, dst_root / rel)

    for rel_dir in COMMON_DIRS:
        src_dir = REPO_ROOT / rel_dir
        if src_dir.is_dir():
            shutil.copytree(src_dir, dst_root / rel_dir)

    scripts_dst = dst_root / "scripts"
    scripts_dst.mkdir(parents=True, exist_ok=True)
    for item in (REPO_ROOT / "scripts").iterdir():
        if item.name in ("package_releases.py", "__pycache__") or item.suffix == ".pyc":
            continue
        if item.is_file():
            shutil.copy2(item, scripts_dst / item.name)


def build_resized_lite_user_avatar(src_avatar: Path, dst_avatar: Path) -> None:
    from PIL import Image, ImageOps

    with Image.open(src_avatar) as img:
        img = ImageOps.exif_transpose(img)
        has_alpha = img.mode in ("RGBA", "LA", "PA") or (
            img.mode == "P" and "transparency" in img.info
        )
        img = img.convert("RGBA" if has_alpha else "RGB")
        w, h = img.size
        longest = max(w, h)
        if longest > 256:
            scale = 256.0 / float(longest)
            new_size = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        img.save(dst_avatar, format="WEBP", quality=88, method=6)


def prepare_ultra_release(ultra_dir: Path) -> None:
    copy_common_skeleton(ultra_dir)
    shutil.copytree(REPO_ROOT / "themes", ultra_dir / "themes")
    build_payload(
        ultra_dir / "themes" / "themes.json",
        ultra_dir / "engine" / "core.js",
        ultra_dir / "dist" / "theme_payload.js",
        DEFAULT_MAX_DIM,
        profile="ultra",
    )
    write_starter_config(ultra_dir, "ultra")
    write_windows_launchers(ultra_dir, "ultra")


def prepare_lite_release(lite_dir: Path) -> None:
    copy_common_skeleton(lite_dir)
    themes_dst = lite_dir / "themes"
    assets_dst = themes_dst / "assets"
    assets_dst.mkdir(parents=True, exist_ok=True)

    src_assets = REPO_ROOT / "themes" / "assets"
    for svg_file in src_assets.glob("*.svg"):
        shutil.copy2(svg_file, assets_dst / svg_file.name)

    for rel_name in (
        "ink_starlight_lite_1080p.webp",
        "ghibli_zoro_user.webp",
        "ghibli_emerald_zoro_2k.webp",
        "wlop_cosmic_2k.webp",
    ):
        src_file = src_assets / rel_name
        if not src_file.is_file():
            raise FileNotFoundError(f"Required Lite asset missing: {src_file}")
        shutil.copy2(src_file, assets_dst / rel_name)

    raw_user_av = src_assets / "ink_starlight_user.webp"
    if not raw_user_av.is_file():
        raise FileNotFoundError(f"Required Lite user avatar source missing: {raw_user_av}")
    build_resized_lite_user_avatar(raw_user_av, assets_dst / "ink_starlight_user.webp")

    raw_themes = json.loads((REPO_ROOT / "themes" / "themes.json").read_text(encoding="utf-8"))
    lite_themes: dict[str, dict] = {}
    for name, cfg in raw_themes.items():
        if not isinstance(cfg, dict):
            continue
        copied = dict(cfg)
        if copied.get("liteWallpaper"):
            copied["wallpaper"] = copied["liteWallpaper"]
        for strip_key in LITE_STRIP_KEYS:
            copied.pop(strip_key, None)
        lite_themes[name] = copied

    (themes_dst / "themes.json").write_text(
        json.dumps(lite_themes, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    build_payload(
        themes_dst / "themes.json",
        lite_dir / "engine" / "core.js",
        lite_dir / "dist" / "theme_payload.js",
        DEFAULT_MAX_DIM,
        profile="lite",
    )
    write_starter_config(lite_dir, "lite")
    write_windows_launchers(lite_dir, "lite")


def zip_release_dir(folder: Path, zip_path: Path) -> tuple[int, float]:
    if zip_path.exists():
        zip_path.unlink()
    file_count = 0
    parent_base = folder.parent
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for path in sorted(folder.rglob("*")):
            if path.is_file():
                zf.write(path, arcname=path.relative_to(parent_base))
                file_count += 1
    size_mb = zip_path.stat().st_size / (1024.0 * 1024.0)
    return file_count, size_mb


def main() -> int:
    lite_wp = REPO_ROOT / "themes" / "assets" / "ink_starlight_lite_1080p.webp"
    if not lite_wp.is_file():
        raise FileNotFoundError(f"Missing 1080p Lite wallpaper asset: {lite_wp}")

    releases_dir = REPO_ROOT / "releases"
    releases_dir.mkdir(parents=True, exist_ok=True)

    ultra_dir = releases_dir / "Antigravity-SilverInk-Ultra"
    lite_dir = releases_dir / "Antigravity-SilverInk-Lite"
    ultra_zip = releases_dir / "Antigravity-SilverInk-Ultra.zip"
    lite_zip = releases_dir / "Antigravity-SilverInk-Lite.zip"

    prepare_ultra_release(ultra_dir)
    ultra_count, ultra_mb = zip_release_dir(ultra_dir, ultra_zip)

    prepare_lite_release(lite_dir)
    lite_count, lite_mb = zip_release_dir(lite_dir, lite_zip)

    print(f"[package-releases] Ultra: {ultra_count} files -> {ultra_zip} ({ultra_mb:.2f} MB)")
    print(f"[package-releases] Lite : {lite_count} files -> {lite_zip} ({lite_mb:.2f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
