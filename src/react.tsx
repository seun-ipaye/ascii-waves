import { useEffect, useRef, type CSSProperties } from "react";
import { createWaves, type WavesOptions } from "./waves";

export type { WavesOptions } from "./waves";

export interface AsciiWavesProps extends WavesOptions {
  /** Cover the whole viewport (true), or fill the nearest positioned parent (false). Default true. */
  fixed?: boolean;
  /** CSS background behind the characters. Default "#000". */
  background?: string;
  className?: string;
  style?: CSSProperties;
}

export function AsciiWaves({
  fixed = true,
  background = "#000",
  className,
  style,
  ...options
}: AsciiWavesProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const waves = createWaves(canvas, JSON.parse(optionsKey));
    return () => waves.destroy();
  }, [optionsKey]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

export default AsciiWaves;
