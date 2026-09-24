/* Guide page behavior: copy buttons, reading progress, scroll-spy, checklists. */
(function () {
  "use strict";
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function slug(s) {
    return s.toLowerCase().replace(/`/g, "").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "").slice(0, 60);
  }
  var KEY = document.body.getAttribute("data-key") || "g";

  /* ---- copy buttons ---- */
  var COPY_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>';
  var CHECK_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>';
  document.querySelectorAll("pre").forEach(function (pre) {
    var wrap = pre.closest(".codewrap"); if (!wrap) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copybtn";
    btn.innerHTML = COPY_ICON + "<span>Copy</span>";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.addEventListener("click", function () {
      var txt = pre.innerText;
      function done() {
        btn.innerHTML = CHECK_ICON + "<span>Copied</span>"; btn.classList.add("copied");
        setTimeout(function () { btn.innerHTML = COPY_ICON + "<span>Copy</span>"; btn.classList.remove("copied"); }, 1400);
      }
      function fb() {
        var ta = document.createElement("textarea"); ta.value = txt;
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta); done();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(done, fb);
      } else { fb(); }
    });
    wrap.appendChild(btn);
  });

  /* ---- contents rail: collapsed disclosure on narrow screens ---- */
  var toc = document.getElementById("toc");
  if (toc) {
    var wide = window.matchMedia("(min-width: 961px)");
    function syncToc() { toc.open = wide.matches; }
    syncToc();
    if (wide.addEventListener) wide.addEventListener("change", syncToc);
    else if (wide.addListener) wide.addListener(syncToc);
    toc.addEventListener("click", function (e) {
      if (e.target.closest("a") && !wide.matches) toc.open = false;
    });
  }

  /* ---- reading progress bar ---- */
  var fill = document.getElementById("readbarFill");
  var doc = document.documentElement;
  function updateRead() {
    if (!fill) return;
    var max = doc.scrollHeight - doc.clientHeight;
    var pct = max > 0 ? Math.min(100, Math.max(0, (doc.scrollTop || document.body.scrollTop) / max * 100)) : 100;
    fill.style.transform = "scaleX(" + (pct / 100) + ")";
  }
  window.addEventListener("scroll", updateRead, { passive: true });
  window.addEventListener("resize", updateRead);
  updateRead();

  /* ---- sidebar scroll-spy ---- */
  var navLinks = [].slice.call(document.querySelectorAll("nav#side a[data-sec]"));
  var linkById = {}; navLinks.forEach(function (a) { linkById[a.getAttribute("data-sec")] = a; });
  var sections = [].slice.call(document.querySelectorAll("main section[id]"));
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          navLinks.forEach(function (a) { a.classList.remove("active"); });
          var a = linkById[en.target.id]; if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-15% 0px -75% 0px", threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---- checklist persistence ---- */
  var state = {};
  try { state = JSON.parse(load(KEY + "-tasks") || "{}"); } catch (e) { state = {}; }
  document.querySelectorAll("main input[type=checkbox]").forEach(function (cb) {
    var li = cb.closest("li"); if (!li) return;
    li.classList.add("task");
    var ul = li.closest("ul"); if (ul) ul.classList.add("tasks");
    cb.disabled = false; cb.removeAttribute("disabled");
    var span = document.createElement("span");
    while (cb.nextSibling) span.appendChild(cb.nextSibling);
    li.appendChild(span);
    var id = slug(span.textContent.trim()) || ("task-" + Math.random().toString(36).slice(2, 8));
    cb.setAttribute("data-ck", id);
    if (state[id]) { cb.checked = true; li.classList.add("done"); }
    cb.addEventListener("change", function () {
      state[id] = cb.checked; store(KEY + "-tasks", JSON.stringify(state));
      li.classList.toggle("done", cb.checked);
    });
  });
})();
