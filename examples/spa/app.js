// Hash-free client routing. Deep links only work when the site is deployed with --spa,
// because the gateway has to fall back to index.html for unknown routes.
(function () {
  var view = document.getElementById("view");
  var where = document.getElementById("where");
  var links = Array.prototype.slice.call(document.querySelectorAll("nav a"));

  // The site is served under /<path>/, so derive the app base from the first link.
  var base = new URL("./", document.baseURI).pathname;

  function route() {
    var rest = location.pathname.slice(base.length).replace(/^\/+|\/+$/g, "");
    return rest === "" ? "/" : "/" + rest;
  }

  function render() {
    var current = route();
    if (current === "/about") {
      view.innerHTML =
        "<h1>About</h1><p>This page is rendered client-side at <strong>/about</strong>. " +
        "Reload it: with <code>--spa</code> the gateway serves index.html and you stay here.</p>";
    } else {
      view.innerHTML =
        "<h1>Home</h1><p>A two-route SPA with no hash and relative assets. " +
        "Click About, then reload the page.</p>";
    }
    where.textContent = "route " + current + "  ·  url " + location.pathname;
    links.forEach(function (a) {
      if (a.dataset.route === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  links.forEach(function (a) {
    a.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      history.pushState({}, "", a.getAttribute("href"));
      render();
    });
  });

  window.addEventListener("popstate", render);
  render();
})();
