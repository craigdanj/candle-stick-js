# CandleChart.js

A dependency-free, responsive SVG candlestick chart. Includes floating OHLC/volume tooltips, volume, cursor-centered wheel zoom, pointer drag pan, keyboard controls, themes, live updates, and SVG export.

## Quick start

Open `index.html` directly in a modern browser for the demo. No server, build step, CDN, or network access required.

```html
<div id="chart" style="height: 420px; width: 100%"></div>
<script src="candle-chart.js"></script>
<script>
  const chart = new CandleChart("#chart", {
    theme: "dark",
    volume: true,
    visibleBars: 70,
    precision: 2,
  });
  chart.setData([
    {
      time: "2026-01-01",
      open: 100,
      high: 108,
      low: 97,
      close: 105,
      volume: 1200,
    },
    {
      time: "2026-01-02",
      open: 105,
      high: 109,
      low: 101,
      close: 103,
      volume: 1500,
    },
  ]);
</script>
```

The container must have an explicit height. Size changes are detected automatically. Each instance owns its own SVG element, unique clipping IDs, and listeners. Hover only updates the overlay, leaving the candle elements intact. The UMD script exposes `window.CandleChart`; CommonJS bundlers can use `require('./candle-chart.js')`. Instantiate only in a browser, after the container exists. No CSS file is needed.

## Data contract

`time` accepts Unix **milliseconds**, a valid Date, or an ISO date string. Use ISO strings with `Z` or a timezone offset for intraday timestamps. Axis labels use UTC. Candles occupy equally spaced slots; weekends and missing intervals are compressed.

`open`, `high`, `low`, `close` must be finite numbers. High must be at least open and close; low must be at most open and close. `volume` is optional (defaults to zero), finite and nonnegative. `setData` sorts input by time and rejects duplicate timestamps. It copies input and validates the whole batch before replacing existing data. An empty array clears the chart.

## API

| Method                | Behavior                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setData(candles)`    | Replace history and reset the viewport to the most recent bars.                                                                                                        |
| `update(candle)`      | Replace the last candle if time matches; append if newer; reject older timestamps. Supply the complete bar. Follow new bars only when already viewing the latest data. |
| `setOptions(options)` | Merge options and redraw; changing visibleBars resets the view.                                                                                                        |
| `getData()`           | Return a defensive copy of all candles.                                                                                                                                |
| `resetView()`         | Show the latest visibleBars candles.                                                                                                                                   |
| `fitContent()`        | Fit the full dataset.                                                                                                                                                  |
| `zoom(factor, x?)`    | A factor below 1 zooms in; above 1 zooms out. Optional x is a CSS-pixel position inside the SVG element.                                                               |
| `resize()`            | Re-measure the container; normally automatic.                                                                                                                          |
| `toSVG()`             | Return a standalone SVG string.                                                                                                                                        |
| `toDataURL()`         | Return a SVG data URL.                                                                                                                                                 |
| `destroy()`           | Remove the SVG element, observer, listeners, and pending render. Do not reuse the instance.                                                                            |

Mutation/view methods return the chart for chaining (except resize/destroy).

### Options

- `theme`: `'dark'` (default) or `'light'`.
- `volume`: show volume bars; default `true`.
- `visibleBars`: initial/reset viewport size, at least 5; default 70.
- `precision`: price decimal places, integer 0–10; default 2.
- `colors`: overrides for `background`, `text`, `grid`, `up`, `down`, `crosshair` (CSS colors).
- `onCrosshairMove(candle, index)`: pointer-move callback receiving a copied bar and its index. Can update your own accessible OHLC readout.

```js
chart.update({
  time: "2026-01-03",
  open: 103,
  high: 110,
  low: 102,
  close: 109,
  volume: 1700,
});
chart.setOptions({ theme: "light", colors: { up: "#00875a" } });
// React: create in an effect with a container ref; call chart.destroy() in cleanup.
```

## Interaction and scope

Drag with mouse or one touch to pan. Wheel zoom anchors to the cursor. Double-click resets. Focus the SVG element: left/right arrows pan, +/- zoom, Home resets. Touch dragging is supported; pinch zoom is not implemented. The chart has a keyboard help label; provide a companion HTML table/readout when complete screen-reader access to prices is required.

Modern browsers with SVG, Pointer Events, and ResizeObserver are required. Rendering is coalesced using requestAnimationFrame, and only visible bars are drawn. History is stored in memory without an automatic retention limit. Fixed-width price labels suit ordinary prices; very long price strings may need a wider axis in the source. The chart provides a linear, automatically scaled price axis; indicators, order entry, log scales, multi-pane overlays, and market feeds are outside this version's scope.

Demo data is synthetic, including simulated live ticks. Connect your own data source and aggregate trades into OHLC candles upstream.

## License

MIT. See LICENSE.

## Tests

Run `node test.cjs` for dependency-free API regression tests. These use a lightweight mock SVG DOM and check validation, atomic replacement, chronological updates, defensive copies, viewport following, flat/empty series, and cleanup. Tooltip values and out-of-bounds hover are also tested. These checks do not replace visual browser testing.

## SVG version (v2)

All candles, wicks, axes, volume bars, crosshairs, and tooltips are native SVG elements. Hover over a candle column to see its full UTC timestamp, open, high, low, close, and volume. The selected column is highlighted. The tooltip hides when the pointer leaves the chart or moves outside the plot. Tooltip position is clamped to the chart bounds.

The constructor and data API remain the same. `toDataURL()` now returns SVG instead of PNG; `toSVG()` provides raw SVG markup. The demo's export button downloads an `.svg` file.
