const LINE = ".kgv-line";
const LINE_TEXT = ".kgv-line-text";

function lineText(node: ParentNode): string | undefined {
  const texts = [...node.querySelectorAll(LINE_TEXT)];
  return texts.length === 0 ? undefined : texts.map(({ textContent }) => textContent).join("");
}

/**
 * 選択範囲のうち、原稿の本文に当たる文字列を返す。本文の行を含まない範囲や、
 * ビューアーの外にかかる範囲には undefined を返し、ブラウザーの既定のコピーに任せる。
 *
 * 行の切れ目には、段落が終わる行のあとにだけ改行を入れる。折り返しの位置は原稿にないからだ。
 */
function manuscriptText(range: Range, viewer: Element): string | undefined {
  const ancestor = range.commonAncestorContainer;
  const element = ancestor instanceof Element ? ancestor : ancestor.parentElement;
  if (element === null || !viewer.contains(element)) return undefined;
  const fragment = range.cloneContents();
  if (element.closest(LINE_TEXT) !== null) return fragment.textContent;
  if (element.closest(LINE) !== null) return lineText(fragment);

  const lines = [...fragment.querySelectorAll(LINE)].map((line) => ({
    text: lineText(line) ?? "",
    paragraphEnd: line.getAttribute("data-break") === "paragraph-end",
  }));
  if (lines.length === 0) return undefined;
  // 最後のページの余りは空の行で埋まり、原稿の空行と見分けられない
  // 余りの行が改行としてコピーされないよう、選択の末尾の空の行は数えない
  while (lines.length > 1 && lines.at(-1)?.text === "") lines.pop();
  return lines
    .map(({ text, paragraphEnd }, index) =>
      index < lines.length - 1 && paragraphEnd ? `${text}\n` : text,
    )
    .join("");
}

/**
 * ビューアーの本文を選んでコピーしたとき、クリップボードに原稿の文字列を書く。
 * WebKit は縦中横のテキストを U+FFFC としてコピーするので、DOM の文字から組み立て直す。
 */
export function copyManuscriptText(event: ClipboardEvent, viewer: Element): void {
  const selection = document.getSelection();
  if (selection === null || selection.isCollapsed || event.clipboardData === null) return;
  const texts: string[] = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const text = manuscriptText(selection.getRangeAt(index), viewer);
    if (text === undefined) return;
    texts.push(text);
  }
  event.clipboardData.setData("text/plain", texts.join("\n"));
  event.preventDefault();
}
