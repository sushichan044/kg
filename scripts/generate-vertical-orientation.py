# /// script
# requires-python = ">=3.11"
# ///
"""Generate the Vertical_Orientation table used by @sushichan044/kg-core.

Reads Unicode's VerticalOrientation.txt (UAX #50), merges adjacent code points
with the same value, and writes a compact TypeScript module. The source is
pinned by version and SHA-256 so the generated table is reproducible.

    uv run scripts/generate-vertical-orientation.py [--source PATH]

Without --source the pinned file is downloaded from unicode.org.
"""

import argparse
import hashlib
from pathlib import Path
import re
import urllib.request


UNICODE_VERSION = "17.0.0"
SOURCE_URL = f"https://www.unicode.org/Public/{UNICODE_VERSION}/ucd/VerticalOrientation.txt"
SOURCE_SHA256 = "dcef09c3fb24d356b042569c328ec341efc5b53447700d799f2fb4834c3cd3cd"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "packages/core/src/internal/vertical-orientation-data.ts"
MAX_CODE_POINT = 0x10FFFF
# One character per value keeps the encoded table small. Upper case is the value
# itself; lower case marks the "transformed" variants.
CODES = {"U": "U", "R": "R", "Tu": "u", "Tr": "r"}
LINE = re.compile(r"^([0-9A-F]{4,6})(?:\.\.([0-9A-F]{4,6}))?\s*;\s*(U|R|Tu|Tr)\b")
MISSING = re.compile(r"^#\s*@missing:\s*([0-9A-F]{4,6})\.\.([0-9A-F]{4,6})\s*;\s*(U|R|Tu|Tr)\b")


def read_source(path):
    if path is not None:
        return Path(path).read_bytes()
    with urllib.request.urlopen(SOURCE_URL, timeout=60) as response:
        return response.read()


def parse(text: str) -> list[str]:
    listed: list[str | None] = [None] * (MAX_CODE_POINT + 1)
    defaults: list[tuple[int, int, str]] = []
    for line in text.splitlines():
        missing = MISSING.match(line)
        if missing is not None:
            defaults.append((int(missing[1], 16), int(missing[2], 16), missing[3]))
            continue
        match = LINE.match(line)
        if match is None:
            continue
        start = int(match[1], 16)
        end = int(match[2] or match[1], 16)
        for code_point in range(start, end + 1):
            listed[code_point] = match[3]
    # The @missing lines give the value of every code point the file does not list.
    # Later @missing lines override earlier ones, as the UCD file format specifies.
    fallback: list[str | None] = [None] * (MAX_CODE_POINT + 1)
    for start, end, value in defaults:
        for code_point in range(start, end + 1):
            fallback[code_point] = value
    values: list[str] = []
    for code_point, value in enumerate(listed):
        resolved = value if value is not None else fallback[code_point]
        if resolved is None:
            raise ValueError(f"No Vertical_Orientation value for U+{code_point:04X}")
        values.append(resolved)
    return values


def ranges(values):
    merged = []
    for code_point, value in enumerate(values):
        if not merged or merged[-1][1] != value:
            merged.append((code_point, value))
    return merged


def encode(merged):
    tokens = []
    previous = 0
    for start, value in merged:
        tokens.append(f"{start - previous:x}{CODES[value]}")
        previous = start
    return "".join(tokens)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", help="read VerticalOrientation.txt from this path")
    arguments = parser.parse_args()
    data = read_source(arguments.source)
    digest = hashlib.sha256(data).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError(f"VerticalOrientation.txt checksum mismatch: {digest}")
    text = data.decode("utf-8")
    if f"VerticalOrientation-{UNICODE_VERSION}.txt" not in text:
        raise ValueError(f"Expected Unicode {UNICODE_VERSION} data")
    merged = ranges(parse(text))
    encoded = encode(merged)
    OUTPUT.write_text(
        "\n".join([
            "// scripts/generate-vertical-orientation.py が生成する。直接編集せず、スクリプトを実行し直す",
            f"// 出典: {SOURCE_URL}",
            f"// SHA-256: {SOURCE_SHA256}",
            "",
            f'export const UNICODE_VERSION = "{UNICODE_VERSION}";',
            "",
            "/**",
            " * 値が変わる位置ごとに、直前の位置からの差を 16 進数で書き、その後に値を 1 文字で続ける",
            " *",
            " * 値は U、R、u（Tu）、r（Tr）のいずれか",
            " */",
            "export const ENCODED_VERTICAL_ORIENTATION =",
            f'  "{encoded}";',
            "",
        ]),
        encoding="utf-8",
    )
    print(f"Wrote {len(merged)} ranges ({len(encoded)} characters) from Unicode {UNICODE_VERSION}")


if __name__ == "__main__":
    main()
