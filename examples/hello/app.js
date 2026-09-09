(function () {
  var set = function (id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("origin", location.host || "file://");
  set("path", location.pathname);
  set("loaded", new Date().toLocaleString());

  var greetings = ["Hello.", "Still here.", "Dropped and served.", "No build step in sight."];
  var i = 0;

  document.getElementById("ping").addEventListener("click", function () {
    var reply = document.getElementById("reply");
    reply.hidden = false;
    reply.textContent = greetings[i % greetings.length];
    i++;
  });
})();
