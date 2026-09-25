/* Dashboard: search, category filter/sort, pagination, read-more. */
(function () {
  "use strict";
  var PAGE_SIZE = parseInt(document.body.getAttribute("data-page-size"), 10) || 8;

  var list = document.getElementById("list");
  var cards = [].slice.call(list.querySelectorAll(".card"));
  var cats = {};
  cards.forEach(function (c) { var k = c.getAttribute("data-cat"); cats[k] = (cats[k] || 0) + 1; });
  var catNames = Object.keys(cats).sort();

  var state = { q: "", cat: "All", sort: "order", page: 1 };

  var pillsBox = document.getElementById("pills");
  pillsBox.innerHTML = '<button class="pill active" data-cat="All">All <span class="cnt">' + cards.length + '</span></button>' +
    catNames.map(function (c) { return '<button class="pill" data-cat="' + c.replace(/"/g, "&quot;") + '">' + c + ' <span class="cnt">' + cats[c] + '</span></button>'; }).join("");

  function matches(c) {
    if (state.cat !== "All" && c.getAttribute("data-cat") !== state.cat) return false;
    if (state.q && c.textContent.toLowerCase().indexOf(state.q) === -1) return false;
    return true;
  }
  function sortCards(arr) {
    if (state.sort === "az") arr.sort(function (a, b) { return a.getAttribute("data-title").localeCompare(b.getAttribute("data-title")); });
    else if (state.sort === "time") arr.sort(function (a, b) { return (+b.getAttribute("data-mins")) - (+a.getAttribute("data-mins")); });
    else arr.sort(function (a, b) { return (+b.getAttribute("data-order")) - (+a.getAttribute("data-order")); });
    return arr;
  }

  function render() {
    var visible = sortCards(cards.filter(matches));
    var pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = visible.slice(start, start + PAGE_SIZE);

    cards.forEach(function (c) { c.classList.add("hide"); });
    pageItems.forEach(function (c) { list.appendChild(c); c.classList.remove("hide"); });

    var rc = document.getElementById("resultCount");
    if (visible.length === 0) { rc.textContent = "No guides found"; }
    else { rc.textContent = "Showing " + (start + 1) + "–" + Math.min(start + PAGE_SIZE, visible.length) + " of " + visible.length + " guide" + (visible.length === 1 ? "" : "s"); }
    document.getElementById("empty").hidden = visible.length > 0;
    document.getElementById("clearBtn").hidden = !(state.q || state.cat !== "All");

    var pager = document.getElementById("pager");
    pager.innerHTML = "";
    if (pages > 1) {
      function mk(label, page, opts) {
        opts = opts || {};
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        if (opts.active) b.className = "active";
        if (opts.disabled) b.disabled = true;
        if (!opts.disabled) b.addEventListener("click", function () { state.page = page; render(); window.scrollTo({ top: 0, behavior: "smooth" }); });
        return b;
      }
      pager.appendChild(mk("‹", state.page - 1, { disabled: state.page === 1 }));
      var shown = [1, pages, state.page - 1, state.page, state.page + 1].filter(function (p) { return p >= 1 && p <= pages; });
      shown = shown.filter(function (p, idx) { return shown.indexOf(p) === idx; }).sort(function (a, b) { return a - b; });
      var prev = 0;
      shown.forEach(function (p) {
        if (p - prev > 1) { var s = document.createElement("span"); s.className = "gap"; s.textContent = "…"; pager.appendChild(s); }
        pager.appendChild(mk(String(p), p, { active: p === state.page }));
        prev = p;
      });
      pager.appendChild(mk("›", state.page + 1, { disabled: state.page === pages }));
    }

    [].forEach.call(pillsBox.children, function (b) { b.classList.toggle("active", b.getAttribute("data-cat") === state.cat); });
  }

  document.getElementById("searchInput").addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); state.page = 1; render(); });
  document.getElementById("sortSelect").addEventListener("change", function (e) { state.sort = e.target.value; state.page = 1; render(); });
  pillsBox.addEventListener("click", function (e) { var b = e.target.closest(".pill"); if (!b) return; state.cat = b.getAttribute("data-cat"); state.page = 1; render(); });
  document.getElementById("clearBtn").addEventListener("click", function () { state.q = ""; state.cat = "All"; state.page = 1; document.getElementById("searchInput").value = ""; render(); });

  list.addEventListener("click", function (e) {
    var rm = e.target.closest(".readmore");
    if (rm) { var c = rm.closest(".card"); var open = c.classList.toggle("expanded"); rm.textContent = open ? "Read less" : "Read more"; return; }
    if (e.target.closest("a") || e.target.closest("button")) return;
    var card = e.target.closest(".card");
    if (card) window.location.href = card.getAttribute("data-href");
  });

  render();
})();
