export type NavId =
  | "functions"
  | "alarms"
  | "title"
  | "run"
  | "jog"
  | "stop"
  | "remote"
  | "flag0"
  | "flag1"
  | "flag2"
  | "flag3"
  | "flag4"
  | "reset"
  | "mode"
  | "autoload"
  | "changeshow"
  | "play";

type Links = Partial<Record<"up" | "down" | "left" | "right", NavId>>;

export const NAV_START: NavId = "run";

export const NAV_LINKS: Record<NavId, Links> = {
  functions: { right: "alarms", down: "title" },
  alarms: { left: "functions", down: "flag0" },
  title: { up: "functions", down: "run", right: "flag0" },
  run: { up: "title", right: "jog", down: "remote" },
  jog: { up: "title", left: "run", right: "stop", down: "remote" },
  stop: { up: "title", left: "jog", right: "flag0", down: "remote" },
  remote: { up: "jog", down: "mode", right: "reset" },
  flag0: { up: "alarms", down: "flag1", left: "title" },
  flag1: { up: "flag0", down: "flag2", left: "stop" },
  flag2: { up: "flag1", down: "flag3", left: "remote" },
  flag3: { up: "flag2", down: "flag4", left: "remote" },
  flag4: { up: "flag3", down: "reset", left: "remote" },
  reset: { up: "flag4", down: "play", left: "remote" },
  mode: { up: "remote", right: "autoload" },
  autoload: { up: "remote", left: "mode", right: "changeshow" },
  changeshow: { up: "remote", left: "autoload", right: "play" },
  play: { up: "reset", left: "changeshow" },
};

export const NAV_ORDER: NavId[] = [
  "functions",
  "alarms",
  "title",
  "run",
  "jog",
  "stop",
  "remote",
  "flag0",
  "flag1",
  "flag2",
  "flag3",
  "flag4",
  "reset",
  "mode",
  "autoload",
  "changeshow",
  "play",
];

export function moveNav(from: NavId, dir: keyof Links): NavId {
  return NAV_LINKS[from][dir] ?? from;
}

export function stepNav(from: NavId, delta: number): NavId {
  const i = NAV_ORDER.indexOf(from);
  const next = (i + delta + NAV_ORDER.length) % NAV_ORDER.length;
  return NAV_ORDER[next];
}

/**
 * Overlay menu cursor: row-major grid of `contentCount` items,
 * plus a footer CLOSE at index `contentCount`.
 */
export function moveMenu(
  index: number,
  cols: number,
  contentCount: number,
  dir: "up" | "down" | "left" | "right",
): number {
  if (contentCount <= 0) return 0;
  const closeIndex = contentCount;
  const lastRow = Math.floor((contentCount - 1) / cols);

  if (index === closeIndex) {
    if (dir === "up") return contentCount - 1;
    if (dir === "down") return 0;
    return closeIndex;
  }

  const row = Math.floor(index / cols);
  const col = index % cols;

  if (dir === "down" && row === lastRow) return closeIndex;
  if (dir === "up" && row === 0) return closeIndex;

  let r = row;
  let c = col;
  if (dir === "left") c -= 1;
  if (dir === "right") c += 1;
  if (dir === "up") r -= 1;
  if (dir === "down") r += 1;

  if (c < 0) {
    c = cols - 1;
    r -= 1;
  }
  if (c >= cols) {
    c = 0;
    r += 1;
  }

  if (r < 0) return closeIndex;
  if (r > lastRow) return closeIndex;

  let next = r * cols + c;
  if (next >= contentCount) {
    // short final row — step to close or last item
    if (dir === "right") return closeIndex;
    next = contentCount - 1;
  }
  return next;
}
