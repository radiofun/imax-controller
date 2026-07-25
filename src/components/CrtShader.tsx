"use client";

import { useEffect, useRef } from "react";
import type { CrtSettings } from "@/lib/crtSettings";

const VERT_300 = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_300 = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform float u_vignette;
uniform float u_scanlines;
uniform float u_grille;
uniform float u_flicker;
uniform float u_noise;

in vec2 v_uv;
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float line = sin(v_uv.y * u_res.y * 1.15 * 3.14159);
  float scan = mix(1.0, 0.62 + 0.38 * line * line, clamp(u_scanlines, 0.0, 1.0));

  float x = v_uv.x * u_res.x;
  float rMask = 0.78 + 0.22 * smoothstep(0.0, 0.4, abs(fract(x / 3.0) - 0.15));
  float gMask = 0.78 + 0.22 * smoothstep(0.0, 0.4, abs(fract(x / 3.0 - 0.33) - 0.15));
  float bMask = 0.78 + 0.22 * smoothstep(0.0, 0.4, abs(fract(x / 3.0 - 0.66) - 0.15));
  vec3 grille = mix(vec3(1.0), vec3(rMask, gMask, bMask), clamp(u_grille, 0.0, 1.0));

  vec2 fromC = (v_uv - 0.5) * vec2(1.0, 0.92);
  float dist = length(fromC);
  float vig = smoothstep(0.95, 0.58, dist);
  float vigAmt = clamp(u_vignette, 0.0, 1.5) / 1.5;
  float vigMix = mix(1.0, mix(0.93, 1.0, vig), vigAmt);

  float roll = 0.97 + 0.03 * sin((v_uv.y + u_time * 0.08) * 22.0) * u_flicker;
  float flicker = 1.0 - u_flicker * 0.06 * (0.5 + 0.5 * sin(u_time * 37.0));
  float n = (hash(v_uv * u_res + floor(u_time * 60.0)) - 0.5) * 0.12 * u_noise;

  vec3 mul = vec3(scan) * grille * vigMix * roll * flicker;
  mul += n;
  mul *= vec3(1.0, 0.97, 0.88);

  outColor = vec4(clamp(mul, 0.0, 1.0), 1.0);
}`;

const VERT_100 = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_100 = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_vignette;
uniform float u_scanlines;
uniform float u_grille;
uniform float u_flicker;
uniform float u_noise;
varying vec2 v_uv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float line = sin(v_uv.y * u_res.y * 1.15 * 3.14159);
  float scan = mix(1.0, 0.62 + 0.38 * line * line, clamp(u_scanlines, 0.0, 1.0));

  float x = v_uv.x * u_res.x;
  float rMask = 0.78 + 0.22 * smoothstep(0.0, 0.4, abs(fract(x / 3.0) - 0.15));
  float gMask = 0.78 + 0.22 * smoothstep(0.0, 0.4, abs(fract(x / 3.0 - 0.33) - 0.15));
  float bMask = 0.78 + 0.22 * smoothstep(0.0, 0.4, abs(fract(x / 3.0 - 0.66) - 0.15));
  vec3 grille = mix(vec3(1.0), vec3(rMask, gMask, bMask), clamp(u_grille, 0.0, 1.0));

  vec2 fromC = (v_uv - 0.5) * vec2(1.0, 0.92);
  float dist = length(fromC);
  float vig = smoothstep(0.95, 0.58, dist);
  float vigAmt = clamp(u_vignette, 0.0, 1.5) / 1.5;
  float vigMix = mix(1.0, mix(0.93, 1.0, vig), vigAmt);

  float roll = 0.97 + 0.03 * sin((v_uv.y + u_time * 0.08) * 22.0) * u_flicker;
  float flicker = 1.0 - u_flicker * 0.06 * (0.5 + 0.5 * sin(u_time * 37.0));
  float n = (hash(v_uv * u_res + floor(u_time * 60.0)) - 0.5) * 0.12 * u_noise;

  vec3 mul = vec3(scan) * grille * vigMix * roll * flicker;
  mul += n;
  mul *= vec3(1.0, 0.97, 0.88);

  gl_FragColor = vec4(clamp(mul, 0.0, 1.0), 1.0);
}`;

type GL = WebGLRenderingContext | WebGL2RenderingContext;

function compile(gl: GL, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || "shader compile failed";
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function createProgram(gl: GL, vsSrc: string, fsSrc: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) || "program link failed");
  }
  return prog;
}

function getGL(canvas: HTMLCanvasElement): { gl: GL; is2: boolean } | null {
  const opts: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  };
  const gl2 = canvas.getContext("webgl2", opts);
  if (gl2) return { gl: gl2, is2: true };
  const gl1 =
    canvas.getContext("webgl", opts) ||
    canvas.getContext("experimental-webgl", opts);
  if (gl1) return { gl: gl1 as WebGLRenderingContext, is2: false };
  return null;
}

type Props = {
  settings: CrtSettings;
};

/** WebGL CRT glass overlay (scanlines / grille / vignette / noise). */
export default function CrtShader({ settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const got = getGL(canvas);
    if (!got) {
      canvas.classList.add("crt-shader-fallback");
      return;
    }
    const { gl, is2 } = got;
    canvas.classList.remove("crt-shader-fallback");

    let prog: WebGLProgram;
    try {
      prog = createProgram(
        gl,
        is2 ? VERT_300 : VERT_100,
        is2 ? FRAG_300 : FRAG_100,
      );
    } catch {
      canvas.classList.add("crt-shader-fallback");
      return;
    }

    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const loc = gl.getAttribLocation(prog, "a_pos");
    let vao: WebGLVertexArrayObject | null = null;
    if (is2) {
      const gl2 = gl as WebGL2RenderingContext;
      vao = gl2.createVertexArray();
      gl2.bindVertexArray(vao);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    } else {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uVignette = gl.getUniformLocation(prog, "u_vignette");
    const uScanlines = gl.getUniformLocation(prog, "u_scanlines");
    const uGrille = gl.getUniformLocation(prog, "u_grille");
    const uFlicker = gl.getUniformLocation(prog, "u_flicker");
    const uNoise = gl.getUniformLocation(prog, "u_noise");

    let raf = 0;
    let alive = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(2, Math.round(parent.clientWidth * dpr));
      const h = Math.max(2, Math.round(parent.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const frame = (t: number) => {
      if (!alive) return;
      resize();
      const s = settingsRef.current;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      if (is2 && vao) {
        (gl as WebGL2RenderingContext).bindVertexArray(vao);
      } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform1f(uVignette, s.vignette);
      gl.uniform1f(uScanlines, s.scanlines);
      gl.uniform1f(uGrille, s.grille);
      gl.uniform1f(uFlicker, s.flicker);
      gl.uniform1f(uNoise, s.noise);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      gl.deleteBuffer(buf);
      if (is2 && vao) {
        (gl as WebGL2RenderingContext).deleteVertexArray(vao);
      }
      gl.deleteProgram(prog);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="crt-shader"
      data-crt-ignore="true"
      aria-hidden
    />
  );
}
