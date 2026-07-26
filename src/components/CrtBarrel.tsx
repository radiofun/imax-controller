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

/** Panel design canvas inside the glass (stage 980×700 minus bezel chrome). */
const DESIGN_W = 900;
const DESIGN_H = 632;

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
 * Blink/Gecko render in low-resolution coordinates and scale the filtered
 * result. WebKit ignores that scale when a foreignObject is filtered, so its
 * fallback keeps the foreignObject in full-size screen coordinates.
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
  /** Real screen layout size in CSS pixels. */
  const [screen, setScreen] = useState({ w: DESIGN_W, h: DESIGN_H });
  const [mapBitmap, setMapBitmap] = useState({ url: "", w: 0, h: 0 });
  const [useWebKitLayout, setUseWebKitLayout] = useState(false);

  const res = Math.min(1, Math.max(0.3, resolution));
  // Barrel / FO work in screen-pixel space (scaled by CRT resolution).
  const lw = Math.max(2, Math.round(screen.w * res));
  const lh = Math.max(2, Math.round(screen.h * res));
  const upX = screen.w / lw;
  const upY = screen.h / lh;

  const filterW = useWebKitLayout ? screen.w : lw;
  const filterH = useWebKitLayout ? screen.h : lh;
  // WebKit sizes CSS reference-filter output from feImage's natural bitmap.
  // Give it a full-size map so the filtered HTML cannot collapse to `res`.
  const mapW = useWebKitLayout ? Math.round(screen.w) : lw;
  const mapH = useWebKitLayout ? Math.round(screen.h) : lh;

  // Fit the fixed design canvas into the active FO coordinate space.
  const designScale = Math.min(filterW / DESIGN_W, filterH / DESIGN_H);
  const ox = (filterW - DESIGN_W * designScale) / 2;
  const oy = (filterH - DESIGN_H * designScale) / 2;

  useEffect(() => {
    const ua = navigator.userAgent;
    const webKit =
      /AppleWebKit\//.test(ua) &&
      !/(?:Chrome|Chromium|Edg|OPR)\//.test(ua);
    setUseWebKitLayout(webKit);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const update = () => {
      const w = Math.round(svg.clientWidth);
      const h = Math.round(svg.clientHeight);
      if (w > 2 && h > 2) {
        setScreen((s) => (s.w === w && s.h === h ? s : { w, h }));
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [useWebKitLayout]);

  // Map shape is fixed — only rebuild when its bitmap dimensions change.
  useEffect(() => {
    let alive = true;
    let url = "";
    const canvas = buildBarrelMap(mapW, mapH);
    if (!canvas) return;
    canvasToBlobUrl(canvas).then((next) => {
      if (!alive) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      setMapBitmap((prev) => {
        if (prev.url) URL.revokeObjectURL(prev.url);
        return { url: next, w: mapW, h: mapH };
      });
      url = next;
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mapW, mapH]);

  // amount 0.05 → ~2% of width — subtle tube lip, not a fishbowl
  const dispScale =
    amount <= 0.001
      ? 0
      : useWebKitLayout
        ? amount * 0.45
        : Math.round(filterW * amount * 0.45);

  // In the WebKit layout there is no outer scale, so compensate in user units.
  const blur = Math.max(
    0.35,
    useWebKitLayout ? ((1 - res) * 1.35) / res : (1 - res) * 1.35,
  );
  const mapReady = Boolean(
    mapBitmap.url && mapBitmap.w === mapW && mapBitmap.h === mapH,
  );
  const useWarp = Boolean(mapReady && dispScale > 0);
  const canFilter = !useWebKitLayout || mapReady;
  const filterUrl =
    canFilter && (res < 0.995 || useWarp)
      ? `url(#${filterId})`
      : undefined;

  const sourceStyle = {
    width: DESIGN_W,
    height: DESIGN_H,
    transform: `translate(${ox}px, ${oy}px) scale(${designScale})`,
    transformOrigin: "top left",
  } as CSSProperties;

  const filterDefinition = (
    <filter
      id={filterId}
      filterUnits={useWebKitLayout ? "objectBoundingBox" : "userSpaceOnUse"}
      primitiveUnits={
        useWebKitLayout ? "objectBoundingBox" : "userSpaceOnUse"
      }
      x={useWebKitLayout ? "-12%" : -filterW * 0.12}
      y={useWebKitLayout ? "-12%" : -filterH * 0.12}
      width={useWebKitLayout ? "124%" : filterW * 1.24}
      height={useWebKitLayout ? "124%" : filterH * 1.24}
      colorInterpolationFilters="sRGB"
    >
      {mapReady && (
        <feImage
          href={mapBitmap.url}
          result="dispMap"
          x={0}
          y={0}
          width={useWebKitLayout ? 1 : filterW}
          height={useWebKitLayout ? 1 : filterH}
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
      <feGaussianBlur
        in="warped"
        stdDeviation={
          useWebKitLayout ? `${blur / filterW} ${blur / filterH}` : blur
        }
      />
    </filter>
  );

  if (useWebKitLayout) {
    const webKitFilterStyle = {
      filter: filterUrl,
      WebkitFilter: filterUrl,
    } as CSSProperties;

    return (
      <>
        <svg
          ref={svgRef}
          className="crt-filter-defs"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          aria-hidden
        >
          <defs>{filterDefinition}</defs>
        </svg>
        <div className="crt-webkit-filter-host" style={webKitFilterStyle}>
          <div className="crt-source" style={sourceStyle}>
            {children}
          </div>
        </div>
      </>
    );
  }

  return (
    <svg
      ref={svgRef}
      className="crt-barrel-svg"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <defs>{filterDefinition}</defs>

      <g
        transform={useWebKitLayout ? undefined : `scale(${upX} ${upY})`}
      >
        <g filter={filterUrl}>
          <foreignObject x={0} y={0} width={filterW} height={filterH}>
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
