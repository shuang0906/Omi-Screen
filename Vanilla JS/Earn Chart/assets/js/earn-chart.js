(() => {
  const root = document.querySelector("[data-ec]");
  if (!root) return;
  // Touch-style pointer, scoped to this widget. Native touch keeps its normal behavior.
  const touchCircle = document.createElement('span');
  touchCircle.className = 'ec-touch-circle';
  touchCircle.setAttribute('aria-hidden', 'true');
  root.appendChild(touchCircle);
  root.classList.add('has-touch-cursor');
  let cursorPointer = null;
  function moveTouchCircle(event) {
    if (cursorPointer !== null && event.pointerId !== cursorPointer) return;
    const rect = root.getBoundingClientRect();
    const x = (event.clientX - rect.left) * root.offsetWidth / rect.width;
    const y = (event.clientY - rect.top) * root.offsetHeight / rect.height;
    touchCircle.style.transform = 'translate3d(' + (x - 18) + 'px,' + (y - 18) + 'px,0)';
    touchCircle.classList.toggle('is-visible', event.pointerType !== 'touch' || cursorPointer !== null);
  }
  function releaseTouchCircle(event) {
    if (cursorPointer !== null && event.pointerId !== cursorPointer) return;
    cursorPointer = null;
    touchCircle.classList.remove('is-pressed');
    if (event.pointerType === 'touch') touchCircle.classList.remove('is-visible');
  }
  root.addEventListener('pointerenter', moveTouchCircle);
  root.addEventListener('pointermove', moveTouchCircle);
  root.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    cursorPointer = event.pointerId;
    moveTouchCircle(event);
    touchCircle.classList.add('is-pressed');
  });
  root.addEventListener('pointerleave', () => touchCircle.classList.remove('is-visible'));
  window.addEventListener('pointerup', releaseTouchCircle);
  window.addEventListener('pointercancel', releaseTouchCircle);
  window.addEventListener('blur', () => {
    cursorPointer = null;
    touchCircle.classList.remove('is-visible', 'is-pressed');
  });


  const $ = (name) => root.querySelector(`[data-ec="${name}"]`);

  const barsEl = $("bars");
  const xaxisEl = $("xaxis");
  const chipsEl = $("chips");
  const marker = $("marker");
  const tagEl = $("tag");
  const apyEl = $("apy");

  // Chart geometry (Figma px). Y axis spans 35% → 45% over the plot height.
  const PLOT_H = 198.497;
  const PAD_X = 4;
  const STEP = 1.4 + 4.563;
  const Y_MIN = 35;
  const Y_MAX = 45;
  const CURRENT = 42.5;
  const CURRENT_H = 150.654;

  // 1W uses the original Figma bar heights.
  const DESIGN_HEIGHTS = [
    21.377, 13.233, 14.251, 21.377, 20.359, 22.395, 34.61, 41.735, 38.681, 8.143, 6.108, 4.072,
    4.072, 10.179, 11.197, 11.197, 19.341, 21.377, 19.341, 11.197, 18.323, 20.359, 25.448, 21.377,
    18.323, 46.825, 36.646, 41.735, 46.825, 57.004, 46.825, 50.897, 57.004, 85.506, 81.435, 80.417,
    81.435, 83.47, 75.327, 75.327, 94.668, 105.865, 158.797, 157.78, 150.654, 166.941, 180.174, 183.228,
  ];

  // Deterministic sample history for the other periods.
  function series(seed, start, volatility) {
    let s = seed;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const out = [];
    const n = DESIGN_HEIGHTS.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const trend = start + (CURRENT_H + 15 - start) * t * t;
      const h = trend + (rand() - 0.5) * volatility * (0.4 + t);
      out.push(Math.max(4.072, Math.min(PLOT_H, h)));
    }
    return out;
  }

  const PERIODS = {
    "1W":  { heights: DESIGN_HEIGHTS, labels: ["2", "3", "4", "5", "6", "7"] },
    "1M":  { heights: series(11, 30, 40), labels: ["Sep 9", "Sep 15", "Sep 21", "Sep 27", "Oct 3", "Oct 8"] },
    "3M":  { heights: series(29, 60, 50), labels: ["Jul", "Aug", "Aug", "Sep", "Sep", "Oct"] },
    "YTD": { heights: series(47, 90, 60), labels: ["Jan", "Mar", "May", "Jun", "Aug", "Oct"] },
    "1Y":  { heights: series(83, 110, 60), labels: ["Nov", "Jan", "Mar", "May", "Jul", "Sep"] },
    "5Y":  { heights: series(131, 20, 70), labels: ["2021", "2022", "2023", "2024", "2025", "2026"] },
    "ALL": { heights: series(173, 8, 70), labels: ["2019", "2020", "2022", "2023", "2025", "2026"] },
  };

  const valueOf = (h) => Y_MIN + (h / PLOT_H) * (Y_MAX - Y_MIN);

  // Build bars once; period changes only animate heights. The last bar is "now" (CURRENT).
  const bars = [...DESIGN_HEIGHTS, CURRENT_H].map((h, i) => {
    const el = document.createElement("span");
    el.className = "ec-bar";
    el.style.setProperty("--i", i);
    el.style.height = `${h}px`;
    // Solid light-to-dark grays; alpha stays at 100% for every bar.
    const shade = Math.round(238 + (153 - 238) * (i / DESIGN_HEIGHTS.length));
    el.style.setProperty("--bar", "rgb(" + shade + ", " + shade + ", " + shade + ")");
    el.style.opacity = 1;
    barsEl.appendChild(el);
    return el;
  });
  const LAST = bars.length - 1;

  // Fractional 1.4px bars at fractional x anti-alias to different apparent widths.
  // Snap each bar's left edge and width to whole device pixels.
  let centers = bars.map((_, i) => PAD_X + i * STEP + 0.7);
  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const origin = barsEl.getBoundingClientRect().left;
    const w = Math.max(1, Math.round(1.4 * dpr)) / dpr;
    centers = bars.map((el, i) => {
      const left = Math.round((origin + PAD_X + i * STEP) * dpr) / dpr - origin;
      el.style.left = `${left}px`;
      el.style.width = `${w}px`;
      return left + w / 2;
    });
  }

  let heights = DESIGN_HEIGHTS;
  let active = null;

  function setLabels(labels) {
    xaxisEl.replaceChildren(...labels.map((t) => {
      const s = document.createElement("span");
      s.textContent = t;
      return s;
    }));
  }

  function setPeriod(key) {
    heights = PERIODS[key].heights;
    heights.forEach((h, i) => {
      bars[i].style.setProperty("--delay", `${i * 6}ms`);
      bars[i].style.height = `${h}px`;
    });
    setLabels(PERIODS[key].labels);
    for (const chip of chipsEl.children) chip.setAttribute("aria-checked", String(chip.dataset.period === key));
    select(null);
  }

  // index null → idle: marker rests on the current (last) bar, no bar highlighted.
  function select(index) {
    if (active) active.classList.remove("is-active");
    const i = index === null ? LAST : index;
    const h = i === LAST ? CURRENT_H : heights[i];
    const v = i === LAST ? CURRENT : valueOf(h);
    active = index === null ? null : bars[i];
    if (active) active.classList.add("is-active");
    marker.style.setProperty("--ec-x", `${centers[i]}px`);
    marker.style.setProperty("--ec-y", `${PLOT_H - h}px`);
    marker.classList.toggle("is-hover", index !== null);
    tagEl.textContent = `${v.toFixed(1)}%`;
    setApy(v);
  }

  // Big APY: NumberFlow (https://number-flow.barvian.me), loaded as a module in the HTML.
  // Until it is ready (or if it fails to load) it just shows plain text.
  const APY_FORMAT = { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const FLOW_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  let flowReady = false;
  let shownApy = CURRENT;

  function setApy(v) {
    if (flowReady && v === shownApy) return;
    shownApy = v;
    if (flowReady) apyEl.update(v / 100);
    else apyEl.textContent = `${v.toFixed(2)}%`;
  }

  function initFlow() {
    if (flowReady || !window.NumberFlowPlugins) return;
    flowReady = true;
    apyEl.textContent = "";
    apyEl.locales = "en-US";
    apyEl.format = APY_FORMAT;
    apyEl.plugins = [window.NumberFlowPlugins.continuous];
    apyEl.transformTiming = { duration: 450, easing: FLOW_EASE };
    apyEl.spinTiming = { duration: 450, easing: FLOW_EASE };
    apyEl.opacityTiming = { duration: 300, easing: "ease-out" };
    apyEl.animated = false;
    apyEl.update(shownApy / 100);
    apyEl.animated = true;
  }

  function indexAt(clientX) {
    const x = clientX - barsEl.getBoundingClientRect().left - PAD_X;
    return Math.max(0, Math.min(LAST, Math.round(x / STEP)));
  }

  barsEl.addEventListener("pointermove", (e) => select(indexAt(e.clientX)));
  barsEl.addEventListener("pointerdown", (e) => {
    barsEl.setPointerCapture(e.pointerId);
    select(indexAt(e.clientX));
  });
  barsEl.addEventListener("pointerleave", () => select(null));
  barsEl.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") select(null); });


  // Accumulate presses in a low-resolution density field, then colorize the
  // combined field so overlapping strokes merge into a continuous heatmap.
  const heatCanvas = document.createElement("canvas");
  heatCanvas.className = "ec-press-heatmap";
  heatCanvas.setAttribute("aria-hidden", "true");
  barsEl.after(heatCanvas);
  const heatContext = heatCanvas.getContext("2d");
  const HEAT_W = 148;
  const HEAT_H = 100;
  heatCanvas.width = HEAT_W;
  heatCanvas.height = HEAT_H;
  const density = new Float32Array(HEAT_W * HEAT_H);
  const heatPixels = heatContext?.createImageData(HEAT_W, HEAT_H);
  const heatColors = [
    [195, 228, 245], // #C3E4F5: low heat
    [229, 255, 232], // #E5FFE8: medium heat
    [248, 248, 218], // #F8F8DA: high heat
  ];
  let press = null;
  let heatFrame = 0;
  let heatTime = 0;

  function heatPoint(e) {
    const rect = barsEl.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(HEAT_W - 1, (e.clientX - rect.left) / rect.width * HEAT_W)),
      y: Math.max(0, Math.min(HEAT_H - 1, (e.clientY - rect.top) / rect.height * HEAT_H)),
      pressure: e.pointerType === "pen" ? Math.max(0.25, e.pressure) : 0.65,
    };
  }

  function deposit(point, amount) {
    const radius = 24;
    for (let y = Math.max(0, Math.floor(point.y - radius)); y <= Math.min(HEAT_H - 1, Math.ceil(point.y + radius)); y++) {
      for (let x = Math.max(0, Math.floor(point.x - radius)); x <= Math.min(HEAT_W - 1, Math.ceil(point.x + radius)); x++) {
        const distance = ((x - point.x) ** 2 + (y - point.y) ** 2) / (radius * radius);
        if (distance < 1) {
          const i = y * HEAT_W + x;
          density[i] = Math.min(1.6, density[i] + Math.exp(-distance * 5) * (1 - distance) * amount);
        }
      }
    }
  }

  function drawHeat(time) {
    const dt = Math.min(64, time - heatTime || 16);
    heatTime = time;
    if (press) deposit(press, dt / 55 * (0.5 + press.pressure));
    // Keep heat close to the current press; old positions disappear in ~0.2s.
    const fade = Math.exp(-dt / 200);
    let visible = false;
    for (let i = 0; i < density.length; i++) {
      const value = density[i] *= fade;
      const p = i * 4;
      if (value < 0.008) {
        density[i] = 0;
        heatPixels.data[p + 3] = 0;
        continue;
      }
      visible = true;
      const color = Math.min(1, value) * (heatColors.length - 1);
      const lo = Math.floor(color);
      const hi = Math.min(heatColors.length - 1, lo + 1);
      for (let c = 0; c < 3; c++) {
        heatPixels.data[p + c] = heatColors[lo][c] + (heatColors[hi][c] - heatColors[lo][c]) * (color - lo);
      }
      heatPixels.data[p + 3] = Math.min(0.8, value * 4) * 255;
    }
    heatContext.putImageData(heatPixels, 0, 0);
    heatFrame = visible || press ? requestAnimationFrame(drawHeat) : 0;
  }

  function startHeat() {
    if (!heatContext || heatFrame) return;
    heatTime = performance.now();
    heatFrame = requestAnimationFrame(drawHeat);
  }

  barsEl.addEventListener("pointerdown", (e) => {
    if (!heatContext || press || e.button !== 0) return;
    press = { ...heatPoint(e), id: e.pointerId };
    deposit(press, 0.4);
    startHeat();
  });
  barsEl.addEventListener("pointermove", (e) => {
    if (!press || press.id !== e.pointerId) return;
    const next = heatPoint(e);
    const steps = Math.ceil(Math.hypot(next.x - press.x, next.y - press.y) / 3);
    for (let i = 1; i <= steps; i++) {
      deposit({ x: press.x + (next.x - press.x) * i / steps, y: press.y + (next.y - press.y) * i / steps }, 0.1);
    }
    press = { ...next, id: e.pointerId };
  });
  const endPress = (e) => { if (press?.id === e.pointerId) press = null; };
  barsEl.addEventListener("pointerup", endPress);
  barsEl.addEventListener("pointercancel", endPress);
  barsEl.addEventListener("lostpointercapture", endPress);
  window.addEventListener("blur", () => { press = null; });

  barsEl.tabIndex = 0;
  let kbIndex = LAST;
  barsEl.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    kbIndex = Math.max(0, Math.min(LAST, kbIndex + (e.key === "ArrowLeft" ? -1 : 1)));
    select(kbIndex);
  });
  barsEl.addEventListener("blur", () => { kbIndex = LAST; select(null); });

  chipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-period]");
    if (chip) setPeriod(chip.dataset.period);
  });

  window.addEventListener("numberflow-ready", initFlow);
  initFlow();

  setLabels(PERIODS["1W"].labels);
  layout();
  select(null);
  window.addEventListener("resize", () => { layout(); select(active ? bars.indexOf(active) : null); });
  document.fonts?.ready.then(() => { layout(); select(null); });
})();
