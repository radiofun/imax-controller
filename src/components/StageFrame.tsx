"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const STAGE_W = 980;
const STAGE_H = 700;
const INSET = 4;
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
 * Lays out the 980×700 monitor at a fitted CSS size (no transform).
 * Scaling the design canvas inside CrtBarrel avoids iOS foreignObject bugs
 * caused by CSS transform on an ancestor.
 */
export default function StageFrame({ children }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    w: STAGE_W * 0.5,
    h: STAGE_H * 0.5,
  });

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    const update = () => {
      const s = fitScale(slot.clientWidth, slot.clientHeight);
      const w = STAGE_W * s;
      const h = STAGE_H * s;
      setSize((prev) =>
        Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5
          ? prev
          : { w, h },
      );
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
        className="stage"
        style={{ width: size.w, height: size.h }}
      >
        {children}
      </div>
    </div>
  );
}
