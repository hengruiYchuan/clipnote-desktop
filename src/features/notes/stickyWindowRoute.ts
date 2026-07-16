export function resolveStickyNoteId(search: string, windowLabel: string) {
  const queryId = Number(new URLSearchParams(search).get("stickyNote"));
  if (Number.isInteger(queryId) && queryId > 0) return queryId;

  const labelId = Number(/^sticky-(\d+)$/.exec(windowLabel)?.[1]);
  return Number.isInteger(labelId) && labelId > 0 ? labelId : 0;
}
