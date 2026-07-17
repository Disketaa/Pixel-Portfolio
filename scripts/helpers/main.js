import { initLightbox } from "./lightbox.js";
import { initGallery, render } from "./gallery.js";
import { initHeaderScroll, renderHeaderTags } from "./header-scroll.js";

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
initHeaderScroll();

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
    const { orderedSections } = render(entries, layouts);
    renderHeaderTags(orderedSections);
  } catch (err) {
    console.error("Failed to load manifest.json:", err);
    render([], {});
  }
}

async function loadVersion() {
  try {
    const res = await fetch("version.json");
    if (!res.ok) return;
    const data = await res.json();
    if (data.version) {
      document.getElementById("site-version").textContent = `0.${data.version}`;
    }
  } catch {
    // version.json absent in local dev — ignore
  }
}

loadManifest();
loadVersion();
