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
/** Breathing room so the bezel isn’t clipped by the slot. */
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

function supportsZoom() {
  try {
    return typeof CSS !== "undefined" && CSS.supports("zoom", "1");
  } catch {
    return false;
  }
}

/**
 * Scales the fixed 980×700 canvas to fill its slot.
 * Prefers CSS `zoom` (correct layout + paint on mobile WebKit/Blink).
 * Falls back to transform + matching layout box.
 */
export default function StageFrame({ children }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [useZoom, setUseZoom] = useState(false);

  useEffect(() => {
    setUseZoom(supportsZoom());
  }, []);

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
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    ro.observe(el);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    // iOS often reports the final slot size a tick after rotation / chrome show.
    const t1 = window.setTimeout(update, 100);
    const t2 = window.setTimeout(update, 350);

    return () => {
      ro.disconnect();
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const layoutW = STAGE_W * scale;
  const layoutH = STAGE_H * scale;

  return (
    <div className="stage-slot" ref={slotRef}>
      {useZoom ? (
        <div
          className="stage stage-inner"
          style={
            {
              width: STAGE_W,
              height: STAGE_H,
              zoom: scale,
            } as CSSProperties
          }
        >
          {children}
        </div>
      ) : (
        <div
          className="stage"
          style={{ width: layoutW, height: layoutH }}
        >
          <div
            className="stage-inner"
            style={{
              width: STAGE_W,
              height: STAGE_H,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
