"use client";
import React from "react";

import createGlobe from "cobe";
import { useEffect, useRef } from "react";

// cobe 2 has no frame loop of its own: every `globe.update()` draws one frame. So the
// spin runs here, and only while the globe is on screen and the tab is visible; scrolled
// past or in a background tab it costs nothing. "Reduce motion" gets one still frame.
const DPR = 2;
const SPIN = 0.005; // radians per frame, the same speed as before
const MARKER = 0.1;
const SCALE = 1.2;

// Two things in cobe 2 change the look we had on 0.6, so this canvas's WebGL context is
// adjusted before cobe takes it (cobe's own getContext call gets this same context back):
//  - It blends every pass with SRC_ALPHA, so the soft halo round the globe comes out at
//    alpha², thinner, and the edge reads hard. Its shaders already write premultiplied
//    colour, so ONE / ONE_MINUS_SRC_ALPHA gives back the full halo.
//  - Markers are hard, opaque discs, even on the rim. 0.6 drew a glow fading from the
//    centre and towards the rim; the shader edits below draw that again.
// The edits match cobe 2.0.1's shader text exactly (the version is pinned). If an upgrade
// changes it they stop applying and the markers go back to cobe's discs; nothing breaks.
const SHADER_EDITS: [string, string][] = [
  ["attribute vec2 n;", "varying float fz;attribute vec2 n;"],
  ["gl_Position=vec4(y,0,1),m=n,g=w,h=x;", "gl_Position=vec4(y,0,1),m=n,g=w,h=x,fz=l.z/length(l);"],
  [
    "void main(){if(length(m)>.25)discard;vec3 a=h>.5?g:v;gl_FragColor=vec4(a,1);}",
    "varying float fz;void main(){float s=smoothstep(.25,0.,length(m))*max(fz,0.);if(s<=0.)discard;vec3 a=h>.5?g:v;gl_FragColor=vec4(a*s,s);}",
  ],
];
// A canvas keeps its context across a remount (React runs effects twice in development),
// and wrapping it twice would apply the edits twice and break the shader.
const adjusted = new WeakSet<object>();
function keepOldLook(canvas: HTMLCanvasElement) {
  // The same attributes cobe asks for, so its call is answered by this context.
  const attributes = { alpha: true, stencil: false, antialias: true, depth: false, preserveDrawingBuffer: false };
  const gl = (canvas.getContext("webgl2", attributes) ?? canvas.getContext("webgl", attributes)) as
    | WebGLRenderingContext
    | WebGL2RenderingContext
    | null;
  if (!gl || adjusted.has(gl)) return;
  adjusted.add(gl);
  const shaderSource = gl.shaderSource.bind(gl);
  gl.shaderSource = (shader, source) => shaderSource(shader, SHADER_EDITS.reduce((text, [from, to]) => text.replace(from, to), source));
  const blendFunc = gl.blendFunc.bind(gl);
  gl.blendFunc = () => blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maxWidth = 700;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let phi = 0;
    let width = 0;
    let offset: [number, number] = [45, window.innerHeight];
    let scaleFactor = 2;
    const measure = () => {
      if (window.innerWidth <= 1000 && canvas.offsetWidth == maxWidth) {
        scaleFactor = 1.75;
        offset = [45, window.innerHeight];
      } else {
        scaleFactor = 2;
        offset = canvas.offsetWidth < maxWidth ? [0, window.innerHeight] : [45, window.innerHeight];
      }
      width = canvas.offsetWidth;
    };
    measure();

    // cobe 0.6 drew into a buffer the canvas's own shape (its box is often not square, e.g.
    // 700x650) but laid the globe out against a square "resolution" of width * scaleFactor.
    // cobe 2 lays it out against the buffer itself. So the buffer stays the canvas's shape
    // and the scale and offset are converted so every pixel lands where 0.6 put it.
    // (cobe 2 takes CSS pixels and multiplies size and offset by the pixel ratio itself.)
    const size = () => {
      const w = canvas.clientWidth * DPR;
      const h = canvas.clientHeight * DPR;
      const r = width * scaleFactor;
      const s = SCALE * (r / h);
      const x = h * (1 / SCALE + offset[0] / r) - w / s;
      const y = h * (offset[1] / r) - h * (1 / SCALE - 1 / s);
      return { width: w / DPR, height: h / DPR, scale: s, offset: [x / DPR, y / DPR] as [number, number] };
    };

    keepOldLook(canvas);
    const stylesBefore = new Set(document.head.querySelectorAll("style"));
    const globe = createGlobe(canvas, {
      devicePixelRatio: DPR,
      ...size(),
      phi: 0,
      theta: 0.27,
      dark: 0,
      diffuse: 1,
      mapSamples: 16000,
      mapBrightness: 1,
      baseColor: [1, 1, 1],
      markerColor: [0.8824, 0.9412, 0.451],
      glowColor: [0.9, 0.9, 0.9],
      markerElevation: 0,
      markers: [
        { location: [34.0522, -118.2437], size: MARKER },
        { location: [35.6762, 139.6503], size: MARKER },
        { location: [64.0522, -118.2437], size: MARKER },
        { location: [19.4326, -99.1332], size: MARKER },
        { location: [114.0522, -108.2437], size: MARKER },
        { location: [47.7128, -59.006], size: MARKER },
        { location: [-7.0522, -73.2437], size: MARKER },
        { location: [-33.0522, -60.2437], size: MARKER },
        { location: [51.1657, 10.4515], size: MARKER },
        { location: [9.082, 8.6753], size: MARKER },
        { location: [20.7558, 47.6173], size: MARKER },
        { location: [-7.7558, 30.6173], size: MARKER },
        { location: [28.6139, 77.209], size: MARKER },
        { location: [37.7749, -122.4194], size: MARKER },
        { location: [93.5505, -46.6333], size: MARKER },
        { location: [-30.9042, 125.4074], size: MARKER },
        { location: [-7.9042, 145.4074], size: MARKER },
        { location: [51.5074, -0.1278], size: MARKER },
        { location: [-20.082, 20.6753], size: MARKER },
      ],
    });
    // cobe 2 adds a <style> to <head> for its CSS-anchored marker labels and rewrites it on
    // every frame, which makes the browser recheck the whole page's styles 60 times a second
    // (measured: 4.9 ms a frame becomes 12-15 ms beside a page-sized DOM). We give no marker
    // an id, so it only ever holds ":root{}"; detached, the writes cost nothing.
    document.head.querySelectorAll("style").forEach((node) => {
      if (!stylesBefore.has(node)) node.remove();
    });

    // The first frame is drawn: swap the static picture for the live globe.
    document.querySelector("#fallbackglobe")?.remove();
    canvas.style.opacity = "1";

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let onScreen = false;
    const tick = () => {
      phi -= SPIN;
      globe.update({ phi });
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      const run = onScreen && !document.hidden && !still;
      if (run && !frame) frame = requestAnimationFrame(tick);
      if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    observer.observe(canvas);
    document.addEventListener("visibilitychange", sync);

    const onResize = () => {
      measure();
      globe.update({ ...size(), phi });
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("resize", onResize);
      globe.destroy();
    };
  }, []);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        maxWidth: maxWidth,
        aspectRatio: 1,
        margin: "auto",
        position: "absolute",
        right: "0",
        zIndex: "2",
      }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          contain: "layout paint size",
          opacity: 0,
          transition: "opacity 1s ease",
        }}
      />
    </div>
  );
}
