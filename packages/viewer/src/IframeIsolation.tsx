import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { IframeStyleInjection } from "./IframeStyleInjection";

export type IframeIsolationProps = Readonly<{
  children: ReactNode;
  className?: string;
  title?: string;
  styles?: IframeStyleInjection;
}>;

/**
 * Sizing for the iframe document itself. Kept out of the style injection so that swapping
 * stylesheets never leaves the isolated document without a scroll box.
 */
const shellStyles = "html,body{margin:0;padding:0;height:100%;overflow:hidden}#root{height:100%}";

const srcdoc = [
  "<!DOCTYPE html>",
  "<html>",
  '<head><meta charset="utf-8">',
  `<style>${shellStyles}</style>`,
  "</head>",
  '<body><div id="root"></div></body>',
  "</html>",
].join("");

export function IframeIsolation({
  children,
  className,
  title = "viewer",
  styles = IframeStyleInjection.defaults,
}: IframeIsolationProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (doc === null || doc === undefined) return;
    setMountNode(doc.getElementById("root"));
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe === null) return;

    const mount = iframe.contentDocument?.getElementById("root");
    if (mount !== null && mount !== undefined) {
      setMountNode(mount);
      return;
    }

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [handleLoad]);

  const iframeStyle = {
    width: "100%",
    height: "100%",
    border: "none",
    display: "block",
  } as const;

  return (
    <iframe ref={iframeRef} className={className} title={title} srcDoc={srcdoc} style={iframeStyle}>
      {mountNode !== null &&
        createPortal(
          <>
            {/* Portaled rather than inlined into srcdoc so stylesheet changes apply
                without tearing down the iframe and remounting its React tree. */}
            <style>{IframeStyleInjection.toCssText(styles)}</style>
            {children}
          </>,
          mountNode,
        )}
    </iframe>
  );
}
