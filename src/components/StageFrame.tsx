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
 * Desktop: lay out at fitted CSS size (no transform) so CrtBarrel/foreignObject
 * can measure real screen pixels.
 *
 * Mobile: keep the 980×700 design canvas and CSS-transform scale it. Transform
 * on plain HTML (flat CRT, no foreignObject) is reliable on iOS; writing scale
 * via DOM avoids React resize lag / feedback loops.
 */
export default function StageFrame({ children }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(0.5);
  const [mobile, setMobile] = useState(false);
  const [layout, setLayout] = useState({
    w: STAGE_W * 0.5,
    h: STAGE_H * 0.5,
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const slot = slotRef.current;
    const stage = stageRef.current;
    if (!slot || !stage) return;

    const update = () => {
      const next = fitScale(slot.clientWidth, slot.clientHeight);

      if (mobile) {
        if (Math.abs(scaleRef.current - next) < 0.0005) return;
        scaleRef.current = next;
        stage.style.transform = `translate(-50%, -50%) scale(${next})`;
        return;
      }

      const w = STAGE_W * next;
      const h = STAGE_H * next;
      setLayout((prev) =>
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
  }, [mobile]);

  return (
    <div className="stage-slot" ref={slotRef}>
      {mobile ? (
        <div
          ref={stageRef}
          className="stage stage-transform"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: "translate(-50%, -50%) scale(0.5)",
          }}
        >
          {children}
        </div>
      ) : (
        <div
          ref={stageRef}
          className="stage stage-layout"
          style={{ width: layout.w, height: layout.h }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
