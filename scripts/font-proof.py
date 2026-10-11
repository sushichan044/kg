# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.66.1", "uharfbuzz==0.56.3"]
# ///
"""Prepare original fonts and HarfBuzz measurements for the browser proof."""

import hashlib
import io
import json
from pathlib import Path
import unicodedata
import urllib.request
import zipfile

from fontTools.ttLib import TTFont
import uharfbuzz as hb


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "packages/viewer/font-proof/.cache"
FONTS = [
    {
        "id": "genei",
        "family": "KGProofGenei",
        "file": "GenEiKoburiMin6-R.ttf",
        "url": "https://okoneya.jp/font/GenEiKoburiMin_v6.1.zip",
        "archivePath": "GenEiKoburiMin_v6.1a/GenEiKoburiMin6-R.ttf",
        "licensePath": "GenEiKoburiMin_v6.1a/OFLicense.txt",
        "sha256": "c27fb4039ac9fae19152716992b5b9d07558e24f6cccea7b0c1abd0109235166",
    },
    {
        "id": "source-serif",
        "family": "KGProofSourceSerif",
        "file": "SourceSerif4-Regular.ttf",
        "url": "https://raw.githubusercontent.com/adobe-fonts/source-serif/4.005R/TTF/SourceSerif4-Regular.ttf",
        "licenseUrl": "https://raw.githubusercontent.com/adobe-fonts/source-serif/4.005R/LICENSE.md",
        "sha256": "e5a4ee6a3d87bb9024796be390c6771e2a0eb1883dae25effaf57ca01668e24b",
    },
]
WESTERN = ["water", "Wave", "office", "ffi", "TypographyTypography", "AVATAR", "to", "QR", "URL", "12"]
JAPANESE = ["あいう漢字カナ", "「、。ー」", "あ゙", "が", "𠮷", "かん", "漢", "字", "あ", "い", "と", "読む"]


def download(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def prepare_font(config):
    path = CACHE / config["file"]
    license_path = CACHE / f"{config['id']}-license.txt"
    if path.exists() and license_path.exists():
        data = path.read_bytes()
    else:
        data = download(config["url"])
        if "archivePath" in config:
            archive = zipfile.ZipFile(io.BytesIO(data))
            data = archive.read(config["archivePath"])
            license_data = archive.read(config["licensePath"])
        else:
            license_data = download(config["licenseUrl"])
        if hashlib.sha256(data).hexdigest() != config["sha256"]:
            raise ValueError(f"Upstream font changed: {config['id']}")
        path.write_bytes(data)
        license_path.write_bytes(license_data)
    if hashlib.sha256(data).hexdigest() != config["sha256"]:
        raise ValueError(f"Cached font checksum mismatch: {config['id']}")
    return data


def graphemes(text):
    parts = []
    for character in text:
        if parts and unicodedata.category(character).startswith("M"):
            parts[-1] += character
        else:
            parts.append(character)
    return parts


def utf16_offset(text, index):
    return len(text[:index].encode("utf-16-le")) // 2


def shape(font, text, direction, kern, liga):
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    buffer.direction = direction
    buffer.language = "ja" if direction == "ttb" else "en"
    buffer.cluster_level = hb.BufferClusterLevel.MONOTONE_GRAPHEMES
    hb.shape(font, buffer, {
        "kern": kern, "liga": liga, "vkrn": False,
        "palt": False, "vpal": False, "halt": False, "vhal": False,
    })
    glyphs = []
    for info, position in zip(buffer.glyph_infos, buffer.glyph_positions):
        if info.codepoint == 0:
            raise ValueError(f"Missing glyph in {text!r}")
        glyphs.append({
            "glyphId": info.codepoint, "cluster": info.cluster,
            "xAdvance": position.x_advance, "yAdvance": position.y_advance,
            "xOffset": position.x_offset, "yOffset": position.y_offset,
        })
    starts = sorted({glyph["cluster"] for glyph in glyphs})
    clusters = []
    offset = 0
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(text)
        members = [glyph for glyph in glyphs if glyph["cluster"] == start]
        advance = sum(g["xAdvance"] if direction == "ltr" else -g["yAdvance"] for g in members)
        span = {"offsetEm": offset / font.face.upem, "advanceEm": advance / font.face.upem}
        clusters.append({
            "textRange": {"start": utf16_offset(text, start), "end": utf16_offset(text, end)},
            "layoutSpan": span,
            # A drawing box is not an ink bounding box. The browser shapes the whole run.
            "renderSpan": span,
        })
        offset += advance
    return {"kind": "clustered", "advanceEm": offset / font.face.upem, "clusters": clusters}, glyphs


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / "evidence").mkdir(exist_ok=True)
    result = {"harfbuzzVersion": hb.version_string(), "fonts": [], "measurements": {}}
    latin_texts = sorted({word[start:end] for word in WESTERN for start in range(len(word)) for end in range(start + 1, len(word) + 1)})
    japanese_texts = sorted(set(JAPANESE) | {part for text in JAPANESE for part in graphemes(text)})
    for config in FONTS:
        data = prepare_font(config)
        table = TTFont(io.BytesIO(data))
        font = hb.Font(hb.Face(data))
        font.scale = (font.face.upem, font.face.upem)
        result["fonts"].append({
            "id": config["id"], "family": config["family"], "file": config["file"],
            "sha256": config["sha256"], "upem": font.face.upem,
            "version": table["name"].getDebugName(5),
            "features": {tag: sorted({f.FeatureTag for f in table[tag].table.FeatureList.FeatureRecord}) for tag in ["GPOS", "GSUB"] if tag in table},
        })
        for direction, texts in [("ltr", latin_texts), ("ttb", japanese_texts if config["id"] == "genei" else [])]:
            for text in texts:
                for kern, liga in [(True, True), (False, True), (True, False), (False, False)]:
                    measurement, glyphs = shape(font, text, direction, kern, liga)
                    key = json.dumps([config["id"], direction, kern, liga, text], ensure_ascii=False, separators=(",", ":"))
                    result["measurements"][key] = {"measurement": measurement, "glyphs": glyphs}
    (CACHE / "measurements.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(result['measurements'])} real-font measurements with HarfBuzz {hb.version_string()}")


if __name__ == "__main__":
    main()
