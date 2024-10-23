"use client";
import React from "react";

import createGlobe from "cobe";
import { useEffect, useRef } from "react";

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maxWidth = 700;
  useEffect(() => {
    let phi = 0;
    let width = 0;
    let offset: [number, number] = [100, window.innerHeight];
    let scaleFactor = 2;
    const onResize = () => {
      if (window.innerWidth <= 1000 && canvasRef.current && canvasRef.current.offsetWidth == maxWidth) {
        scaleFactor = 1.75;
        offset = [100, window.innerHeight];
      } else {
        scaleFactor = 2;
        if (canvasRef.current && canvasRef.current.offsetWidth < maxWidth) {
          offset = [0, window.innerHeight];
        } else {
          offset = [100, window.innerHeight];
        }
      }
      return canvasRef.current && (width = canvasRef.current.offsetWidth);
    };

    window.addEventListener("resize", onResize);
    onResize();
    if (!canvasRef.current) return;
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      scale: 1.2,
      theta: 0.27,
      dark: 0,
      offset: offset,
      diffuse: 1,
      mapSamples: 16000,
      mapBrightness: 1,
      baseColor: [1, 1, 1],
      markerColor: [0.8824, 0.9412, 0.451],
      glowColor: [0.9, 0.9, 0.9],
      markers: [
        { location: [34.0522, -118.2437], size: 0.1 },
        { location: [35.6762, 139.6503], size: 0.1 },
        { location: [64.0522, -118.2437], size: 0.1 },
        { location: [19.4326, -99.1332], size: 0.1 },
        { location: [114.0522, -108.2437], size: 0.1 },
        { location: [47.7128, -59.006], size: 0.1 },
        { location: [-7.0522, -73.2437], size: 0.1 },
        { location: [-33.0522, -60.2437], size: 0.1 },
        { location: [51.1657, 10.4515], size: 0.1 },
        { location: [9.082, 8.6753], size: 0.1 },
        { location: [20.7558, 47.6173], size: 0.1 },
        { location: [-7.7558, 30.6173], size: 0.1 },
        { location: [28.6139, 77.209], size: 0.1 },
        { location: [37.7749, -122.4194], size: 0.1 },
        { location: [93.5505, -46.6333], size: 0.1 },
        { location: [-30.9042, 125.4074], size: 0.1 },
        { location: [-7.9042, 145.4074], size: 0.1 },
        { location: [51.5074, -0.1278], size: 0.1 },
        { location: [-20.082, 20.6753], size: 0.1 },
      ],
      onRender: (state) => {
        // Called on every animation frame.
        // `state` will be an empty object, return updated params.
        state.phi = phi;
        phi -= 0.005;
        state.width = width * scaleFactor;
        state.height = width * scaleFactor;
      },
    });
    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1";
      }
    });
    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
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
