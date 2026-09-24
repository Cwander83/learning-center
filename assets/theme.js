/* Shared light/dark theme toggle. Key "lc-theme" persists across all pages. */
(function () {
  "use strict";
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var KEY = "lc-theme";
  var btn = document.getElementById("themeToggle");
  function apply(t) {
    document.documentElement.setAttribute("data-theme", t);
    if (btn) btn.textContent = t === "dark" ? "☀️ Light" : "🌙 Dark";
  }
  apply(load(KEY) || "light");
  if (btn) {
    btn.addEventListener("click", function () {
      var t = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(t); store(KEY, t);
    });
  }
})();
