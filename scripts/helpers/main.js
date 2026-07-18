import { initLightbox } from "./lightbox.js";
import { initGallery, initScrollToTop, render } from "./gallery.js";

const grid = document.getElementById("grid");

initLightbox({
  frame: document.querySelector(".lightbox__frame"),
  lightbox: document.getElementById("lightbox"),
  canvas: document.getElementById("lightbox-image"),
  gifImg: document.getElementById("lightbox-image-gif"),
  close: document.getElementById("lightbox-close"),
  prev: document.getElementById("lightbox-prev"),
  next: document.getElementById("lightbox-next"),
});

initGallery(grid);
initScrollToTop();

document.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".card") || event.target.closest(".lightbox")) {
    event.preventDefault();
  }
});

async function loadManifest() {
  try {
    const res = await fetch("manifest.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entries = Array.isArray(data) ? data : data.entries || [];
    const layouts = data.layouts || {};
    render(entries, layouts);
  } catch (err) {
    console.error("Failed to load manifest.json:", err);
    render([], {});
  }
}

loadManifest();
