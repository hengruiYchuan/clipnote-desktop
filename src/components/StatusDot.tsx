export function StatusDot({ paused = false }: { paused?: boolean }) {
  return (
    <span className="status" data-paused={paused || undefined}>
      <span className="status__dot" aria-hidden="true" />
      {paused ? "采集已暂停" : "正在采集"}
    </span>
  );
}
