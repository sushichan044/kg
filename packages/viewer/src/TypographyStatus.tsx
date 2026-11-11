import type { TypographyState } from "./use-typography";

export function TypographyLoading() {
  return <p role="status">書体を読み込んでいます…</p>;
}

export function TypographyStatus({ state }: Readonly<{ state: TypographyState }>) {
  if (state.kind === "ready") return null;
  return (
    <div role="alert">
      <p>書体を読み込めませんでした。</p>
      <button type="button" onClick={state.retry}>
        再試行
      </button>
    </div>
  );
}
