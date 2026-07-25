"use client";

import { useEffect, useRef, type ReactNode } from "react";

const STAGE_W = 980;
const STAGE_H = 700;
const INSET = 12;
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
 * Fills the flex slot and scales the fixed 980×700 canvas with CSS
 * transform only — transform does not affect layout, so ResizeObserver
 * cannot feedback-loop (which felt like gradual/eased resizing with zoom).
 */
export default function StageFrame({ children }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(0.5);

  useEffect(() => {
    const slot = slotRef.current;
    const stage = stageRef.current;
    if (!slot || !stage) return;

    const apply = (next: number) => {
      if (Math.abs(scaleRef.current - next) < 0.0005) return;
      scaleRef.current = next;
      // Direct DOM write — no React render lag while dragging a window edge.
      stage.style.transform = `translate(-50%, -50%) scale(${next})`;
    };

    const update = () => {
      apply(fitScale(slot.clientWidth, slot.clientHeight));
    };

    update();

    let raf = 0;
    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    });
    ro.observe(slot);

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const t = window.setTimeout(update, 200);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.clearTimeout(t);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="stage-slot" ref={slotRef}>
      <div
        ref={stageRef}
        className="stage stage-inner"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: "translate(-50%, -50%) scale(0.5)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
