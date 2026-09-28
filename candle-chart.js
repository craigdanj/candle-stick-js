/* CandleChart v2.0.0 | MIT License */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CandleChart = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const themes = {
    dark: {
      background: "#101922",
      text: "#90a4b8",
      grid: "#22313f",
      up: "#42d6a4",
      down: "#fa7583",
      crosshair: "#b3c5d6",
    },
    light: {
      background: "#ffffff",
      text: "#526578",
      grid: "#e7edf2",
      up: "#098b65",
      down: "#d44559",
      crosshair: "#677b8d",
    },
  };
  function normalize(bar) {
    if (!bar || typeof bar !== "object")
      throw new TypeError("A candle must be an object");
    const time =
      bar.time instanceof Date
        ? bar.time.getTime()
        : typeof bar.time === "string"
          ? Date.parse(bar.time)
          : bar.time;
    if (!Number.isFinite(time) || !Number.isFinite(new Date(time).getTime()))
      throw new TypeError(
        "time must be an ISO date, Date, or Unix milliseconds",
      );
    for (const key of ["open", "high", "low", "close"])
      if (!Number.isFinite(bar[key]))
        throw new TypeError(key + " must be a finite number");
    if (
      bar.high < Math.max(bar.open, bar.close) ||
      bar.low > Math.min(bar.open, bar.close) ||
      bar.low > bar.high
    )
      throw new RangeError("Invalid OHLC range");
    const volume = bar.volume === undefined ? 0 : bar.volume;
    if (!Number.isFinite(volume) || volume < 0)
      throw new RangeError("volume must be a nonnegative number");
    return {
      time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume,
    };
  }
  let nextId = 0;
  const NS = "http://www.w3.org/2000/svg";
  class CandleChart {
    constructor(container, options = {}) {
      this.host =
        typeof container === "string"
          ? document.querySelector(container)
          : container;
      if (!this.host || !this.host.appendChild)
        throw new TypeError("Provide a valid chart container");
      this.options = this.validateOptions({
        theme: "dark",
        volume: true,
        visibleBars: 70,
        precision: 2,
        ...options,
      });
      this.data = [];
      this.count = this.options.visibleBars;
      this.start = 0;
      this.listeners = [];
      this.svg = document.createElementNS(NS, "svg");
      this.svg.setAttribute("tabindex", "0");
      this.id = "candle-chart-" + ++nextId;
      this.svg.setAttribute("role", "img");
      this.svg.setAttribute(
        "aria-label",
        "Candlestick chart. Arrow keys pan, plus and minus zoom, Home resets.",
      );
      Object.assign(this.svg.style, {
        display: "block",
        width: "100%",
        height: "100%",
        touchAction: "none",
        outlineOffset: "-3px",
      });
      this.host.appendChild(this.svg);
      this.svg.setAttribute("xmlns", NS);
      this.bind(
        "wheel",
        (e) => {
          e.preventDefault();
          this.zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, this.point(e).x);
        },
        { passive: false },
      );
      this.bind("pointerdown", (e) => {
        if (e.button !== 0) return;
        this.svg.focus();
        this.svg.setPointerCapture(e.pointerId);
        this.drag = { x: this.point(e).x, start: this.start };
      });
      this.bind("pointermove", (e) => {
        const p = this.point(e);
        if (this.drag) {
          this.start =
            this.drag.start -
            ((p.x - this.drag.x) / this.plotWidth) * this.count;
          this.clamp();
        }
        this.hover = p;
        if (this.drag) this.schedule();
        else this.drawHover();
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        this.bind(type, () => {
          this.drag = null;
        });
      this.bind("pointerleave", () => {
        this.hover = null;
        this.drawHover();
      });
      this.bind("dblclick", () => this.resetView());
      this.bind("keydown", (e) => {
        if (!["ArrowLeft", "ArrowRight", "+", "=", "-", "Home"].includes(e.key))
          return;
        e.preventDefault();
        if (e.key === "Home") this.resetView();
        else if (["+", "=", "-"].includes(e.key))
          this.zoom(e.key === "-" ? 1.25 : 0.8);
        else {
          this.start += (e.key === "ArrowRight" ? 1 : -1) * this.count * 0.1;
          this.clamp();
          this.schedule();
        }
      });
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(this.host);
      this.resize();
    }
    validateOptions(o) {
      if (!themes[o.theme]) throw new RangeError("theme must be dark or light");
      if (!Number.isInteger(o.precision) || o.precision < 0 || o.precision > 10)
        throw new RangeError("precision must be 0–10");
      if (!Number.isFinite(o.visibleBars) || o.visibleBars < 5)
        throw new RangeError("visibleBars must be at least 5");
      if (o.onCrosshairMove != null && typeof o.onCrosshairMove !== "function")
        throw new TypeError("onCrosshairMove must be a function");
      return o;
    }
    bind(type, fn, options) {
      this.svg.addEventListener(type, fn, options);
      this.listeners.push([type, fn, options]);
    }
    point(e) {
      const r = this.svg.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * this.width) / r.width,
        y: ((e.clientY - r.top) * this.height) / r.height,
      };
    }
    setData(bars) {
      if (!Array.isArray(bars)) throw new TypeError("setData expects an array");
      const next = bars.map(normalize).sort((a, b) => a.time - b.time);
      for (let i = 1; i < next.length; i++)
        if (next[i].time === next[i - 1].time)
          throw new RangeError("Duplicate candle time");
      this.data = next;
      this.resetView();
      return this;
    }
    update(bar) {
      const next = normalize(bar),
        last = this.data[this.data.length - 1];
      if (last && next.time < last.time)
        throw new RangeError(
          "update accepts only the latest candle or a newer candle",
        );
      const follow = this.start + this.count >= this.data.length - 0.5;
      if (last && next.time === last.time)
        this.data[this.data.length - 1] = next;
      else this.data.push(next);
      if (follow) this.start = Math.max(0, this.data.length - this.count);
      this.clamp();
      this.schedule();
      return this;
    }
    setOptions(options) {
      this.options = this.validateOptions({ ...this.options, ...options });
      if ("visibleBars" in options) this.resetView();
      this.schedule();
      return this;
    }
    getData() {
      return this.data.map((bar) => ({ ...bar }));
    }
    resetView() {
      this.count = Math.min(
        this.options.visibleBars,
        Math.max(5, this.data.length),
      );
      this.start = Math.max(0, this.data.length - this.count);
      this.hover = null;
      this.schedule();
      return this;
    }
    fitContent() {
      this.count = Math.max(5, this.data.length);
      this.start = 0;
      this.schedule();
      return this;
    }
    clamp() {
      this.start = Math.max(
        0,
        Math.min(this.start, Math.max(0, this.data.length - this.count)),
      );
    }
    zoom(factor, x = this.plotWidth / 2) {
      if (!Number.isFinite(factor) || factor <= 0)
        throw new RangeError("zoom factor must be positive");
      const ratio = Math.max(0, Math.min(1, x / this.plotWidth)),
        anchor = this.start + ratio * this.count;
      this.count = Math.max(
        5,
        Math.min(Math.max(5, this.data.length), this.count * factor),
      );
      this.start = anchor - ratio * this.count;
      this.clamp();
      this.schedule();
      return this;
    }
    resize() {
      if (this.dead) return;
      const r = this.host.getBoundingClientRect();
      this.width = Math.max(1, r.width);
      this.height = Math.max(1, r.height);
      this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
      this.plotWidth = Math.max(1, this.width - 88);
      this.schedule();
    }
    schedule() {
      if (!this.dead && !this.frame)
        this.frame = requestAnimationFrame(() => {
          this.frame = null;
          this.draw();
        });
    }
    node(tag, attrs = {}, content, parent = this.svg) {
      const el = document.createElementNS(NS, tag);
      for (const [key, value] of Object.entries(attrs))
        el.setAttribute(key, value);
      if (content !== undefined) el.textContent = content;
      parent.appendChild(el);
      return el;
    }
    draw() {
      const w = this.width,
        h = this.height,
        pw = this.plotWidth;
      const t = (this.palette = {
        ...themes[this.options.theme],
        ...this.options.colors,
      });
      this.svg.replaceChildren();
      this.node("rect", { width: w, height: h, fill: t.background });
      const text = (s, x, y, color = t.text, parent = this.svg) =>
        this.node(
          "text",
          {
            x,
            y,
            fill: color,
            "font-size": 11,
            "font-family": "ui-monospace, monospace",
            "dominant-baseline": "middle",
          },
          s,
          parent,
        );
      const line = (x1, y1, x2, y2, color, parent = this.svg, dash) =>
        this.node(
          "line",
          {
            x1,
            y1,
            x2,
            y2,
            stroke: color,
            "stroke-width": 1,
            ...(dash ? { "stroke-dasharray": dash } : {}),
          },
          undefined,
          parent,
        );
      this.text = text;
      this.line = line;
      if (!this.data.length) {
        this.geometry = null;
        this.overlay = null;
        text("No candle data", 24, h / 2);
        return;
      }
      const from = Math.floor(this.start),
        to = Math.min(this.data.length, Math.ceil(this.start + this.count));
      let min = Infinity,
        max = -Infinity,
        maxVol = 1;
      for (let i = from; i < to; i++) {
        const d = this.data[i];
        min = Math.min(min, d.low);
        max = Math.max(max, d.high);
        maxVol = Math.max(maxVol, d.volume);
      }
      const pad = (max - min || Math.abs(max) * 0.01 || 1) * 0.09;
      min -= pad;
      max += pad;
      const top = 48,
        bottom = Math.max(top + 10, h - (this.options.volume ? 110 : 35)),
        step = pw / this.count;
      const y = (p) => top + ((max - p) / (max - min)) * (bottom - top),
        x = (i) => (i - this.start + 0.5) * step;
      this.geometry = { from, to, min, max, top, bottom, step, x, y };
      const defs = this.node("defs");
      const clip = this.node(
        "clipPath",
        { id: this.id + "-plot" },
        undefined,
        defs,
      );
      this.node(
        "rect",
        { x: 0, y: top, width: pw, height: Math.max(0, h - top - 28) },
        undefined,
        clip,
      );
      const headerClip = this.node(
        "clipPath",
        { id: this.id + "-header" },
        undefined,
        defs,
      );
      this.node("rect", { width: pw, height: 44 }, undefined, headerClip);
      for (let i = 0; i <= 5; i++) {
        const yy = top + ((bottom - top) * i) / 5;
        line(0, yy, pw, yy, t.grid);
        text(
          (max - ((max - min) * i) / 5).toFixed(this.options.precision),
          pw + 9,
          yy,
        );
      }
      const every = Math.max(1, Math.ceil(100 / step));
      for (let i = Math.ceil(from / every) * every; i < to; i += every) {
        const xx = x(i);
        line(xx, top, xx, h - 27, t.grid);
        const iso = new Date(this.data[i].time).toISOString();
        const intraday =
          to - from > 1 &&
          this.data[to - 1].time - this.data[from].time < 172800000;
        text(
          intraday ? iso.slice(11, 16) : iso.slice(5, 10),
          Math.max(2, Math.min(pw - 40, xx - 18)),
          h - 13,
        );
      }
      const plot = this.node("g", { "clip-path": `url(#${this.id}-plot)` });
      for (let i = from; i < to; i++) {
        const d = this.data[i],
          xx = x(i),
          color = d.close >= d.open ? t.up : t.down,
          bw = Math.max(1, step * 0.68);
        const group = this.node(
          "g",
          { "data-candle-index": i, "aria-label": this.describe(d) },
          undefined,
          plot,
        );
        line(xx, y(d.high), xx, y(d.low), color, group);
        this.node(
          "rect",
          {
            x: xx - bw / 2,
            y: Math.min(y(d.open), y(d.close)),
            width: bw,
            height: Math.max(1, Math.abs(y(d.open) - y(d.close))),
            fill: color,
          },
          undefined,
          group,
        );
        if (this.options.volume) {
          const vh = (d.volume / maxVol) * 57;
          this.node(
            "rect",
            {
              x: xx - bw / 2,
              y: h - 30 - vh,
              width: bw,
              height: vh,
              fill: color,
              opacity: 0.4,
            },
            undefined,
            group,
          );
        }
      }
      const last = this.data[this.data.length - 1],
        ly = y(last.close),
        lc = last.close >= last.open ? t.up : t.down;
      if (ly >= top && ly <= bottom) {
        line(0, ly, pw, ly, lc, this.svg, "4 4");
        this.node("rect", {
          x: pw,
          y: ly - 10,
          width: 88,
          height: 20,
          fill: lc,
        });
        text(
          last.close.toFixed(this.options.precision),
          pw + 7,
          ly,
          t.background,
        );
      }
      this.overlay = this.node("g", {
        "pointer-events": "none",
        "data-overlay": "",
      });
      this.drawHover();
    }
    describe(d) {
      return (
        new Date(d.time)
          .toISOString()
          .replace("T", " ")
          .replace(".000Z", " UTC") +
        "; " +
        ["open", "high", "low", "close", "volume"]
          .map((k) => k + ": " + d[k])
          .join("; ")
      );
    }
    drawHover() {
      if (!this.overlay || !this.geometry) return;
      this.overlay.replaceChildren();
      const { from, to, min, max, top, bottom, step, x } = this.geometry;
      const t = this.palette,
        p = this.hover,
        pw = this.plotWidth,
        h = this.height;
      let index = to - 1;
      const candidate = p ? Math.floor(this.start + p.x / step) : -1;
      const active =
        p &&
        p.x >= 0 &&
        p.x < pw &&
        p.y >= top &&
        p.y < h - 28 &&
        candidate >= from &&
        candidate < to;
      if (active) index = candidate;
      const d = this.data[index],
        color = d.close >= d.open ? t.up : t.down;
      const header = this.node(
        "g",
        { "clip-path": `url(#${this.id}-header)` },
        undefined,
        this.overlay,
      );
      this.text(
        new Date(d.time).toISOString().slice(0, 16).replace("T", " ") + " UTC",
        12,
        13,
        t.text,
        header,
      );
      this.text(
        ["open", "high", "low", "close"]
          .map(
            (k) =>
              k[0].toUpperCase() + " " + d[k].toFixed(this.options.precision),
          )
          .join("   "),
        12,
        32,
        color,
        header,
      );
      if (this.options.volume)
        this.text(
          "VOL " + d.volume.toLocaleString(),
          12,
          h - 96,
          t.text,
          this.overlay,
        );
      if (!active) return;
      this.node(
        "rect",
        {
          x: Math.max(0, x(index) - step / 2),
          y: top,
          width: Math.min(step, pw - Math.max(0, x(index) - step / 2)),
          height: Math.max(0, h - top - 28),
          fill: color,
          opacity: 0.07,
        },
        undefined,
        this.overlay,
      );
      this.line(
        x(index),
        top,
        x(index),
        h - 28,
        t.crosshair,
        this.overlay,
        "3 4",
      );
      this.line(0, p.y, pw, p.y, t.crosshair, this.overlay, "3 4");
      if (p.y <= bottom) {
        this.node(
          "rect",
          { x: pw, y: p.y - 10, width: 88, height: 20, fill: t.grid },
          undefined,
          this.overlay,
        );
        this.text(
          (max - ((p.y - top) / (bottom - top)) * (max - min)).toFixed(
            this.options.precision,
          ),
          pw + 7,
          p.y,
          t.crosshair,
          this.overlay,
        );
      }
      // Use a neighboring slot's full height as the hover target, including thin dojis.
      const tw = Math.min(224, this.width - 12),
        th = 184;
      const tx = Math.max(
        6,
        Math.min(
          this.width - tw - 6,
          p.x + 18 + tw > pw ? p.x - tw - 18 : p.x + 18,
        ),
      );
      const ty = Math.max(6, Math.min(h - th - 6, p.y - 28));
      const tip = this.node(
        "g",
        {
          "data-tooltip": "",
          role: "tooltip",
          "aria-label": this.describe(d),
          transform: `translate(${tx} ${ty})`,
        },
        undefined,
        this.overlay,
      );
      this.node(
        "rect",
        {
          width: tw,
          height: th,
          rx: 10,
          fill: t.background,
          stroke: t.grid,
          "stroke-width": 1.5,
        },
        undefined,
        tip,
      );
      this.node(
        "rect",
        { x: 12, y: 13, width: 3, height: 15, rx: 1.5, fill: color },
        undefined,
        tip,
      );
      this.text(
        new Date(d.time).toISOString().slice(0, 10),
        24,
        20,
        t.crosshair,
        tip,
      );
      this.text(
        new Date(d.time).toISOString().slice(11, 19) + " UTC",
        12,
        42,
        t.text,
        tip,
      );
      ["open", "high", "low", "close", "volume"].forEach((key, row) => {
        this.text(
          key[0].toUpperCase() + key.slice(1),
          12,
          72 + row * 23,
          t.text,
          tip,
        );
        const value =
          key === "volume"
            ? d[key].toLocaleString()
            : d[key].toFixed(this.options.precision);
        const label = this.text(
          value,
          tw - 12,
          72 + row * 23,
          key === "close" ? color : t.crosshair,
          tip,
        );
        label.setAttribute("text-anchor", "end");
      });
      if (this.options.onCrosshairMove)
        this.options.onCrosshairMove({ ...d }, index);
    }
    toSVG() {
      this.draw();
      return new XMLSerializer().serializeToString(this.svg);
    }
    toDataURL() {
      return (
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(this.toSVG())
      );
    }
    destroy() {
      this.dead = true;
      cancelAnimationFrame(this.frame);
      this.observer.disconnect();
      for (const args of this.listeners) this.svg.removeEventListener(...args);
      this.svg.remove();
      this.listeners = [];
    }
  }
  return CandleChart;
});
