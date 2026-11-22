// Mobile menu, active-section highlighting and the mailto contact form.
(function () {
  var btn = document.querySelector(".menu-btn");
  var menu = document.getElementById("menu");
  btn.addEventListener("click", function () {
    var open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  menu.addEventListener("click", function (e) {
    if (e.target.tagName === "A") { menu.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
  });

  var links = Array.prototype.slice.call(menu.querySelectorAll("a"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id); });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main section[id]").forEach(function (s) { io.observe(s); });
  }

  document.getElementById("year").textContent = new Date().getFullYear();

  var form = document.getElementById("contact-form");
  var note = form.querySelector(".form-note");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = form.name.value.trim(), email = form.email.value.trim(), msg = form.message.value.trim();
    if (!name || !msg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      note.textContent = "Please fill in your name, a valid email and a message.";
      note.classList.add("err");
      return;
    }
    note.classList.remove("err");
    note.textContent = "Opening your email app…";
    var subject = "Portfolio contact from " + name;
    var body = msg + "\n\n— " + name + " (" + email + ")";
    window.location.href = "mailto:zawadallah@lamar.edu?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  });
})();
