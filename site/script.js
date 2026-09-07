// DRIFT/30 site: the drift tally (scroll = days survived), click-to-load game, reveals.

(() => {
  const NS = "http://www.w3.org/2000/svg";

  // --- the drift tally ---------------------------------------------------
  const groups = 6; // 30 days, scratched in fives
  const svg = document.querySelector(".drift-tally");
  const dayLabel = document.getElementById("drift-day");
  const lines = [];
  for (let g = 0; g < groups; g++) {
    for (let i = 0; i < 4; i++) {
      lines.push(mkLine(g, i, false));
    }
    lines.push(mkLine(g, 0, true)); // the slash that closes a five
  }

  function mkLine(g, i, slash) {
    const x = g * 26;
    const el = document.createElementNS(NS, "line");
    if (slash) {
      el.setAttribute("x1", x + 1.4);
      el.setAttribute("y1", 16.4);
      el.setAttribute("x2", x + 20.4);
      el.setAttribute("y2", 3.4);
      el.classList.add("slash");
    } else {
      el.setAttribute("x1", x + 3 + i * 5.2);
      el.setAttribute("y1", 2.5 + (i % 2) * 0.6);
      el.setAttribute("x2", x + 4.1 + i * 5.2);
      el.setAttribute("y2", 17.5 - (i % 3) * 0.5);
    }
    svg.appendChild(el);
    return el;
  }

  const marks = 30; // 4 ticks + slash per group, but we count 30 days
  function updateDrift() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const frac = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    const day = Math.max(1, Math.ceil(frac * 30));
    dayLabel.textContent = String(day).padStart(2, "0");
    // 30 days spread over the 24 ticks + 6 slashes: each day lights ~1 mark
    const lit = Math.round((day / 30) * marks);
    lines.forEach((el, idx) => el.classList.toggle("cut", idx < lit));
  }
  document.addEventListener("scroll", updateDrift, { passive: true });
  window.addEventListener("resize", updateDrift);
  updateDrift();

  // --- click to load the game -------------------------------------------
  const frame = document.getElementById("frame");
  const load = document.getElementById("frame-load");
  if (frame && load) {
    load.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.title = "DRIFT/30 — playable build";
      iframe.src = "game/index.html";
      iframe.allow = "autoplay";
      frame.textContent = "";
      frame.appendChild(iframe);
    });
  }

  // --- gentle reveals ----------------------------------------------------
  const revealables = document.querySelectorAll(
    ".card, .ending, .ladder li, .still, .frame"
  );
  revealables.forEach((el) => el.classList.add("reveal"));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("in"));
  }
})();
