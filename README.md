# ascii-waves

Animated ASCII waves for your website background.

Slow waves roll across a black field of tiny characters, so parts of the screen glow and fade like a breathing tide. Hover, click, tap, or drag and the water reacts: it dents where you press, then sends a ripple outward.

- Works with **React** or **plain JavaScript**
- Tiny: about 6 kB, no dependencies
- Fast: draws from a pre-rendered glyph sheet, with a coarse wave grid
- Respects `prefers-reduced-motion`
- Written in TypeScript, types included

## Install

```bash
npm install ascii-waves
```

## React

```jsx
import { AsciiWaves } from "ascii-waves/react";

export default function App() {
  return (
    <>
      <AsciiWaves />
      <main style={{ position: "relative" }}>
        <h1>Hello</h1>
      </main>
    </>
  );
}
```

By default the waves fill the whole viewport behind your page. Put your content above it with `position: relative` (and a `z-index` if needed).

To fill a container instead of the viewport, set `fixed={false}`. The nearest positioned parent becomes the waves' frame:

```jsx
<div style={{ position: "relative", height: 400 }}>
  <AsciiWaves fixed={false} color="#4fd1ff" brightness={0.4} />
</div>
```

The canvas has `pointer-events: none`, so it never blocks clicks on your page. Interaction is picked up from the page itself.

## Plain JavaScript

```js
import { createWaves } from "ascii-waves";

const canvas = document.querySelector("canvas");
const waves = createWaves(canvas, { color: "#4fd1ff" });

// later, to stop it and clean up:
waves.destroy();
```

Give the canvas a size with CSS (for example `width: 100%; height: 300px`). The waves match it and resize automatically.

## Options

All options are optional. In React, pass them as props.

| Option | Default | Description |
| --- | --- | --- |
| `color` | `"#ffffff"` | Character color, as a hex string (`#fff` or `#4fd1ff`). |
| `brightness` | `0.5` | Opacity of the brightest characters, from 0 to 1. Lower is subtler. |
| `cellSize` | `4` | Size of each character in px on desktop. Smaller means a finer texture and more work. |
| `mobileCellSize` | `6` | Character size on small screens. |
| `fps` | `30` | Frames per second on desktop. |
| `mobileFps` | `20` | Frames per second on small screens. |
| `mobileBreakpoint` | `768` | Viewport width (px) at or below which the mobile settings apply. |
| `chars` | letters, digits, symbols | The characters to draw with, for example `"01"` or `" .:-=+*#%@"`. |
| `speed` | `1` | Wave speed multiplier. `0.5` is half speed. |
| `interactive` | `true` | Hover glow plus click, tap, and drag ripples. |
| `respectReducedMotion` | `true` | Draw one still frame for visitors who prefer reduced motion. |

React-only props:

| Prop | Default | Description |
| --- | --- | --- |
| `fixed` | `true` | `true` covers the viewport. `false` fills the nearest positioned parent. |
| `background` | `"#000"` | CSS background behind the characters. Use `"transparent"` to show your own page. |
| `className`, `style` | | Applied to the canvas. |

## Notes

- Rendering is canvas-based and runs only in the browser. In Next.js and other SSR frameworks the component renders an empty canvas on the server and starts on the client.
- Smaller `cellSize` values look finer but draw more characters. If it feels heavy on older devices, raise `cellSize` or lower `fps`.
- The canvas does not capture touch gestures, so page scrolling still works on phones.

## License

MIT
