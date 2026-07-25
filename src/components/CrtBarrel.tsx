"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Props = {
  amount: number;
  /** 1 = full res (sharp), ~0.45 = chunky CRT */
  resolution?: number;
  children: ReactNode;
};

/**
 * Unit barrel map (shape only). Strength is applied via feDisplacementMap
 * `scale`, not baked into the map — so amount=0.05 stays gentle.
 *
 * For each pixel, we store how far to sample toward the screen edge
 * (classic CRT bulge): center barely moves, corners move most.
 */
function buildBarrelMap(
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const w = Math.max(2, Math.round(width));
  const h = Math.max(2, Math.round(height));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const img = ctx.createImageData(w, h);
  const data = img.data;
  const aspect = w / h;
  const yEncode = h / w;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const v = y / (h - 1);

      // Elliptical coords so a wide panel bulges like a round tube
      const nx = (u * 2 - 1) * aspect;
      const ny = v * 2 - 1;
      const r2 = nx * nx + ny * ny;

      // Gentle unit warp: sample a bit further from center (r² falloff)
      // Fixed shape — slider only changes how many pixels this moves.
      const k = 0.22;
      const zoom = 1.02;
      const mx = nx * zoom * (1 + r2 * k);
      const my = ny * zoom * (1 + r2 * k);

      const su = (mx / aspect) * 0.5 + 0.5;
      const sv = my * 0.5 + 0.5;

      const dx = su - u;
      const dy = (sv - v) * yEncode;

      const i = (y * w + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(128 + dx * 255)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + dy * 255)));
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function canvasToBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return "";
  return URL.createObjectURL(blob);
}

/**
 * Low-res → (optional) barrel → upscale.
 *
 * Curvature: SVG feDisplacementMap samples each output pixel from a
 * nearby input pixel. The map says "pull from farther out at the edges",
 * which makes the image bulge like CRT glass. `amount` only sets how
 * many pixels that pull is (scale ≈ lowResWidth * amount * 0.45).
 */
export default function CrtBarrel({
  amount,
  resolution = 0.5,
  children,
}: Props) {
  const rawId = useId();
  const filterId = useMemo(
    () => `crt-barrel-${rawId.replace(/:/g, "")}`,
    [rawId],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 632 });
  const [mapUrl, setMapUrl] = useState("");

  const res = Math.min(1, Math.max(0.3, resolution));
  const lw = Math.max(2, Math.round(size.w * res));
  const lh = Math.max(2, Math.round(size.h * res));
  const up = 1 / res;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.round(cr.width);
      const h = Math.round(cr.height);
      if (w > 2 && h > 2) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  const resBucket = Math.round(res * 20) / 20;

  // Map shape is fixed — only rebuild when the low-res size changes
  useEffect(() => {
    let alive = true;
    let url = "";
    const canvas = buildBarrelMap(lw, lh);
    if (!canvas) return;
    canvasToBlobUrl(canvas).then((next) => {
      if (!alive) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      setMapUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return next;
      });
      url = next;
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [lw, lh, resBucket]);

  // amount 0.05 → ~2% of width — subtle tube lip, not a fishbowl
  const dispScale =
    amount <= 0.001 ? 0 : Math.round(lw * amount * 0.45);

  const blur = Math.max(0.35, (1 - res) * 1.35);
  const useWarp = Boolean(mapUrl && dispScale > 0);
  const filterUrl = res < 0.995 || useWarp ? `url(#${filterId})` : undefined;

  const sourceStyle = {
    width: size.w,
    height: size.h,
    transform: `scale(${res})`,
    transformOrigin: "top left",
  } as CSSProperties;

  return (
    <svg
      ref={svgRef}
      className="crt-barrel-svg"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <defs>
        <filter
          id={filterId}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          x={-lw * 0.12}
          y={-lh * 0.12}
          width={lw * 1.24}
          height={lh * 1.24}
          colorInterpolationFilters="sRGB"
        >
          {mapUrl && (
            <feImage
              href={mapUrl}
              result="dispMap"
              x={0}
              y={0}
              width={lw}
              height={lh}
              preserveAspectRatio="none"
            />
          )}
          {useWarp ? (
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale={dispScale}
              xChannelSelector="R"
              yChannelSelector="G"
              result="warped"
            />
          ) : (
            <feOffset in="SourceGraphic" result="warped" />
          )}
          <feGaussianBlur in="warped" stdDeviation={blur} />
        </filter>
      </defs>

      <g transform={`scale(${up})`}>
        <g filter={filterUrl}>
          <foreignObject x={0} y={0} width={lw} height={lh}>
            <div
              className="crt-source"
              style={sourceStyle}
              {...({ xmlns: "http://www.w3.org/1999/xhtml" } as object)}
            >
              {children}
            </div>
          </foreignObject>
        </g>
      </g>
    </svg>
  );
}
