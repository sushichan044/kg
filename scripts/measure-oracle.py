# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools==4.66.1", "uharfbuzz==0.56.3"]
# ///
"""Generate the oracle fixture for the viewer's DOM-free font measurer.

Advances come from uharfbuzz and fontTools, which read vmtx themselves, so the
fixture is independent of harfbuzzjs. Values are in font units.

    uv run scripts/measure-oracle.py
"""

import hashlib
import json
import re
from pathlib import Path

from fontTools import version as fonttools_version
from fontTools.ttLib import TTFont
import uharfbuzz as hb


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "packages/viewer/assets"
OUTPUT = ROOT / "packages/viewer/src/measure-oracle.json"
FACES = [
    {"id": "mincho-400", "file": "RinMincho-Regular.ttf"},
    {"id": "mincho-700", "file": "RinMincho-Bold.ttf"},
    {"id": "genei-koburi-400", "file": "GenEiKoburiMin6-R.ttf"},
]
FIXED_PITCH = {"palt": False, "vpal": False, "halt": False, "vhal": False, "vkrn": False, "liga": True}
CLASSES = {
    "kana": ["あ", "ア", "ゃ", "っ", "ヴ", "ヶ", "ー", "ゝ"],
    "kanji": ["漢", "字", "〆", "々", "〇"],
    "punctuation": ["「", "」", "『", "（", "、", "。", "・", "：", "〔", "【", "〜", "…", "‥", "―"],
    "dividing": ["！", "？", "‼", "⁉"],
    "fullwidth": ["Ａ", "ｚ", "０", "＃"],
    "symbols": ["㍿", "①", "™", "♡", "♪", "☆"],
    "quotes": ["“", "”", "‘", "’"],
    "ascii": ["A", "z", "0", "9", "W", "!", "?", ".", ",", "-", "(", "@", "'", " "],
    "latin": ["é", "ñ", "é", "Ω", "Ж"],
    "halfwidth": ["ｱ", "ｶﾞ", "ｰ", "｡", "｢"],
    "spaces": ["　", " "],
    "combining": ["あ゙", "ん゙", "ア゚", "ㇷ゚", "゙"],
    "long-marks": ["〱", "〲"],
    "missing": ["한", "글", "𠮷", "𪚲", "😀", "👍\U0001f3fd"],
}
RUNS = ["office", "water", "Wave", "AVATAR", "ffi"]


def shape(font, text, direction, features):
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    buffer.direction = direction
    buffer.language = "ja" if direction == "ttb" else "en"
    buffer.cluster_level = hb.BufferClusterLevel.MONOTONE_GRAPHEMES
    hb.shape(font, buffer, features)
    advance = sum(-p.y_advance if direction == "ttb" else p.x_advance for p in buffer.glyph_positions)
    return advance, [info.codepoint for info in buffer.glyph_infos]


def collapse(match: re.Match[str]) -> str:
    inline = "{ " + re.sub(r",\n\s+", ", ", match[1]) + " }"
    line_start = match.string.rfind("\n", 0, match.start()) + 1
    # oxfmt が折り返す長さの行はまとめず、生成した結果がそのまま整形済みになるようにする
    if match.start() - line_start + len(inline) + 1 > 100:
        return match[0]
    return inline


def main():
    fixture = {
        "generator": "uv run scripts/measure-oracle.py",
        "tools": {"uharfbuzz": hb.__version__, "harfbuzz": hb.version_string(), "fonttools": fonttools_version},
        "unit": "font units; upright is the TTB advance, sideways the LTR advance, both without kerning",
        "faces": {},
    }
    for config in FACES:
        data = (ASSETS / config["file"]).read_bytes()
        table = TTFont(ASSETS / config["file"])
        cmap = table.getBestCmap()
        if cmap is None:
            raise ValueError(f"No Unicode cmap in {config['file']}")
        vmtx = table["vmtx"].metrics
        order = table.getGlyphOrder()
        font = hb.Font(hb.Face(data))
        no_kern = {**FIXED_PITCH, "kern": False}
        graphemes = {}
        glyphs = set()
        for cls, items in CLASSES.items():
            for text in items:
                if any(ord(character) not in cmap for character in text):
                    graphemes[text] = {"class": cls, "missing": True}
                    continue
                upright, used = shape(font, text, "ttb", no_kern)
                sideways, _ = shape(font, text, "ltr", no_kern)
                glyphs.update(used)
                graphemes[text] = {"class": cls, "upright": upright, "sideways": sideways}
        # vrt2 の字形は測定の経路から届かないので、vmtx の読み取りを確かめるために別に記録する
        for text in CLASSES["halfwidth"]:
            _, used = shape(font, text, "ttb", {**no_kern, "vrt2": True})
            glyphs.update(used)
        runs = {text: shape(font, text, "ltr", {**FIXED_PITCH, "kern": True})[0] for text in RUNS}
        vertical = {str(glyph): vmtx[order[glyph]][0] for glyph in sorted(glyphs)
                    if vmtx[order[glyph]][0] != font.face.upem}
        fixture["faces"][config["id"]] = {
            "file": config["file"],
            "sha256": hashlib.sha256(data).hexdigest(),
            "upem": font.face.upem,
            "graphemes": graphemes,
            "runs": runs,
            "verticalAdvances": vertical,
        }
    text = json.dumps(fixture, ensure_ascii=False, indent=2)
    # 末端のオブジェクトを 1 行にまとめ、1 書記素を 1 行で読めるようにする
    text = re.sub(r"\{\n\s+([^{}\[\]]*?)\n\s+\}", collapse, text)
    OUTPUT.write_text(text + "\n", encoding="utf-8")
    counts = {key: len(face["graphemes"]) for key, face in fixture["faces"].items()}
    print(f"Wrote {OUTPUT.relative_to(ROOT)} with {counts}")


if __name__ == "__main__":
    main()
