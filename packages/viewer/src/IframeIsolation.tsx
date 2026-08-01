import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { viewerStyles } from "./styleContent";

export interface IframeIsolationProps {
  children: ReactNode;
  className?: string;
  title?: string;
  styleOverrides?: string;
}

export function IframeIsolation({
  children,
  className,
  title = "viewer",
  styleOverrides,
}: IframeIsolationProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  const srcdoc = useMemo(
    () =>
      [
        "<!DOCTYPE html>",
        "<html>",
        '<head><meta charset="utf-8">',
        "<style>",
        viewerStyles,
        "</style>",
        "<style>html,body{margin:0;padding:0;height:100%;overflow:hidden}",
        "#root{height:100%}</style>",
        "</head>",
        '<body><div id="root"></div></body>',
        "</html>",
      ].join(""),
    [],
  );

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
            {styleOverrides !== undefined && <style>{styleOverrides}</style>}
            {children}
          </>,
          mountNode,
        )}
    </iframe>
  );
}
