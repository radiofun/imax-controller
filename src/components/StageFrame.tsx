"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const STAGE_W = 980;
const STAGE_H = 700;
/** Keep bezel shadow / subpixels from clipping against the slot edge. */
const INSET = 16;
/** Avoid absurd upscaling on very large displays. */
const MAX_SCALE = 2.25;

type Props = {
  children: ReactNode;
};

function fitScale(width: number, height: number) {
  const w = width - INSET;
  const h = height - INSET;
  if (w < 2 || h < 2) return 0.25;
  return Math.min(MAX_SCALE, w / STAGE_W, h / STAGE_H);
}

/**
 * Scales the fixed 980×700 design canvas to fill its slot.
 * Layout box matches the scaled size so nothing is clipped by ancestors.
 */
export default function StageFrame({ children }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      const next = fitScale(width, height);
      setScale((prev) => (Math.abs(prev - next) < 0.002 ? prev : next));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const layoutW = Math.round(STAGE_W * scale * 1000) / 1000;
  const layoutH = Math.round(STAGE_H * scale * 1000) / 1000;

  return (
    <div className="stage-slot" ref={slotRef}>
      <div
        className="stage"
        style={
          {
            width: layoutW,
            height: layoutH,
            "--stage-scale": scale,
          } as CSSProperties
        }
      >
        <div className="stage-inner">{children}</div>
      </div>
    </div>
  );
}
