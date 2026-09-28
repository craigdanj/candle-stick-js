// Dependency-free API regression tests: node test.cjs
const assert = require("node:assert/strict");
const CandleChart = require("./candle-chart.js");
class Element {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.style = {};
    this.children = [];
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
  }
  appendChild(el) {
    this.children.push(el);
    return el;
  }
  replaceChildren() {
    this.children = [];
  }
  addEventListener() {}
  removeEventListener() {}
  remove() {
    this.removed = true;
  }
}
global.document = { createElementNS: (ns, tag) => new Element(tag) };
global.window = { devicePixelRatio: 2 };
global.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
const host = {
  appendChild() {},
  getBoundingClientRect: () => ({ width: 800, height: 450 }),
};
const chart = new CandleChart(host);
const b = { time: 1000, open: 10, high: 12, low: 9, close: 11, volume: 50 };
chart.setData([{ ...b, time: 2000 }, b]);
assert.equal(chart.getData()[0].time, 1000);
for (const invalid of [
  [b, b],
  [{ ...b, high: 5 }],
  [{ ...b, close: NaN }],
  [{ ...b, volume: -1 }],
  [{ ...b, time: Infinity }],
]) {
  assert.throws(() => chart.setData(invalid));
  assert.equal(chart.getData().length, 2);
}
chart.update({ ...b, time: 2000, close: 12 });
assert.equal(chart.getData().length, 2);
assert.equal(chart.getData()[1].close, 12);
chart.update({ ...b, time: 3000 });
assert.equal(chart.getData().length, 3);
assert.throws(() => chart.update(b));
const copy = chart.getData();
copy[0].open = 999;
assert.equal(chart.getData()[0].open, 10);
chart.setData(
  Array.from({ length: 200 }, (_, i) => ({ ...b, time: 1000 + i })),
);
assert.equal(chart.start, 130);
chart.update({ ...b, time: 1200 });
assert.equal(chart.start, 131);
chart.start = 20;
chart.update({ ...b, time: 1201 });
assert.equal(chart.start, 20);
chart.zoom(0.5);
assert.equal(chart.count, 35);
assert(chart.start >= 0);
assert.throws(() => chart.zoom(0));
chart.fitContent();
assert.equal(chart.count, 202);
chart.draw();
chart.setData([{ ...b, open: 0, high: 0, low: 0, close: 0 }]);
chart.draw();
chart.setData([]);
chart.draw();
assert.throws(() => chart.setOptions({ precision: 20 }));
assert.equal(chart.options.precision, 2);
chart.setData([
  { ...b, time: 1000 },
  { ...b, time: 2000, close: 12 },
]);
chart.draw();
chart.hover = { x: chart.geometry.x(0), y: 100 };
chart.drawHover();
const find = (el, key) =>
  el.attrs[key] !== undefined
    ? el
    : el.children.map((c) => find(c, key)).find(Boolean);
let tip = find(chart.svg, "data-tooltip");
assert(tip);
assert(tip.attrs["aria-label"].includes("close: 11"));
assert.equal(tip.children.filter((c) => c.tag === "text").length, 12);
chart.hover = { x: chart.geometry.x(1), y: 100 };
chart.drawHover();
tip = find(chart.svg, "data-tooltip");
assert(tip.attrs["aria-label"].includes("close: 12"));
chart.hover = { x: chart.plotWidth + 1, y: 100 };
chart.drawHover();
assert(!find(chart.svg, "data-tooltip"));
chart.hover = { x: chart.geometry.x(4), y: 100 };
chart.drawHover();
assert(!find(chart.svg, "data-tooltip"));
chart.hover = null;
chart.drawHover();
assert(!find(chart.svg, "data-tooltip"));
const other = new CandleChart(host);
assert.notEqual(chart.id, other.id);
other.destroy();
chart.destroy();
assert.equal(chart.svg.removed, true);
console.log(
  "PASS: sorting, validation/atomicity, updates, copies, viewport following, zoom, flat/empty SVG drawing, tooltip values/bounds, multiple instances, cleanup",
);
