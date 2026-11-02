import type { TypographyState } from "./use-typography";

export function TypographyStatus({
  state,
}: Readonly<{ state: TypographyState & { retry: () => void } }>) {
  if (state.kind === "ready") return null;
  if (state.kind === "loading") return <p role="status">書体を読み込んでいます…</p>;
  return (
    <div role="alert">
      <p>書体を読み込めませんでした。</p>
      <button type="button" onClick={state.retry}>
        再試行
      </button>
    </div>
  );
}
