// src/index.ts
window.addEventListener("load", () => {
  setupMobileMenu();
  setupQuickSearch();
  let needsUpdate = true;
  const update = () => {
    if (needsUpdate) {
      needsUpdate = false;
      updateShadowImages();
    }
  };
  const debouncedUpdate = () => {
    needsUpdate = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", debouncedUpdate);
  window.addEventListener("resize", debouncedUpdate);
  update();
});
var SHADOW_DISTANCE = 20;
var updateShadowImages = () => {
  const viewH = window.innerHeight;
  document.querySelectorAll(".shadow-image").forEach((img, i) => {
    const shadow = img.querySelector(".bg");
    const { top, height } = img.getBoundingClientRect();
    const topDistance = top + height / 2;
    const center = topDistance / viewH;
    const size = center * SHADOW_DISTANCE;
    const yShift = Math.log(size) * SHADOW_DISTANCE;
    shadow.style.transform = `translateY(${yShift - SHADOW_DISTANCE}px)`;
  });
};
var setupMobileMenu = () => {
  const menu = document.querySelector("#mobile-menu");
  const nav = document.querySelector("nav");
  const [closedMenu, openMenu] = [
    document.querySelector("#menu-closed"),
    document.querySelector("#menu-open")
  ];
  let prevOp;
  const toggleMenu = (open) => {
    if (prevOp) {
      clearTimeout(prevOp);
    }
    if (!open) {
      prevOp = setTimeout(() => {
        menu?.classList.toggle("hidden", true);
      }, 500);
    } else {
      menu?.classList.toggle("hidden", false);
    }
    setTimeout(() => {
      closedMenu?.classList.toggle("hidden", open);
      openMenu?.classList.toggle("hidden", !open);
      menu.classList.toggle("translate-y-full", !open);
      menu.classList.toggle("opacity-0", !open);
      nav.classList.toggle("shadow-up", !open);
    }, 25);
  };
  closedMenu?.addEventListener("click", () => {
    toggleMenu(true);
  });
  openMenu?.addEventListener("click", () => {
    toggleMenu(false);
  });
};
var MAX_RESULTS = 5;
var SNIPPET_PREFIX = 10;
var SNIPPPET_SIZE = 100;
var stripHTML = (s) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = s;
  return tmp.textContent || tmp.innerText || "";
};
var setupQuickSearch = async () => {
  const searchResults = await (await fetch("/api/docs.json")).json();
  const sections = searchResults.sections.map((_s) => {
    const s = {
      ..._s,
      oTitle: _s.docTitle,
      oSection: _s.sectionTitle
    };
    s.content = stripHTML(decodeURIComponent(s.content).toLowerCase());
    s.docTitle = s.docTitle.toLowerCase();
    s.sectionTitle = s.sectionTitle?.toLowerCase() || null;
    return s;
  });
  const showSearch = () => {
    modal.classList.toggle("hidden", false);
    input.focus();
  };
  const hideSearch = () => {
    modal.classList.toggle("hidden", true);
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "k" && e.metaKey) {
      showSearch();
    }
    if (e.key === "Escape") {
      hideSearch();
    }
  });
  window.addEventListener("hashchange", hideSearch);
  const modal = document.querySelector("#quick-search");
  const resultsEl = document.querySelector("#results");
  const emptyResult = document.querySelector("#results-empty");
  const notFoundResult = document.querySelector(
    "#results-none"
  );
  const result = document.querySelector("#results-result");
  const input = document.querySelector(
    "#quick-search-input"
  );
  document.querySelector("#quick-search-button")?.addEventListener("click", () => {
    if (modal.classList.contains("hidden")) {
      showSearch();
    } else {
      hideSearch();
    }
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      hideSearch();
    }
  });
  let selectedIndex = -1;
  let currentResults = [];
  input.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "Enter":
        hideSearch();
        if (selectedIndex > -1) {
          window.location.href = currentResults[selectedIndex].path;
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        selectedIndex = (selectedIndex - 1) % currentResults.length;
        break;
      case "ArrowDown":
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentResults.length;
        break;
      default:
        return;
    }
    resultsEl.querySelectorAll(".result").forEach((r, idx) => {
      r.classList.toggle("bg-gray-light", idx === selectedIndex);
    });
  });
  input.addEventListener("input", () => {
    resultsEl.innerHTML = "";
    selectedIndex = -1;
    const terms = input.value.split(/\s+/).map((t) => t.toLowerCase());
    if (!terms.length) {
      const r = emptyResult.cloneNode(true);
      r.classList.toggle("hidden", false);
      resultsEl.appendChild(r);
      return;
    }
    const results = [];
    const getMatchIdx = (t, s) => {
      const idx = s.indexOf(t);
      if (idx === -1) {
        return [false, ""];
      }
      const snipStart = Math.max(idx - SNIPPET_PREFIX, 0);
      const snippet = s.slice(snipStart, snipStart + SNIPPPET_SIZE);
      return [idx - snipStart, snippet];
    };
    for (const s of sections) {
      for (const t of terms) {
        let [startIndex, snippet] = getMatchIdx(t, s.docTitle);
        if (!startIndex && s.sectionTitle) {
          [startIndex, snippet] = getMatchIdx(t, s.sectionTitle);
        }
        if (!startIndex && s.content) {
          [startIndex, snippet] = getMatchIdx(t, s.content);
        }
        if (startIndex !== false) {
          results.push({
            ...s,
            startIndex,
            snippet,
            matchLen: t.length
          });
          break;
        }
      }
      if (results.length >= MAX_RESULTS) {
        break;
      }
    }
    currentResults = results;
    if (results.length === 0) {
      const r = notFoundResult.cloneNode(true);
      r.classList.toggle("hidden", false);
      resultsEl.appendChild(r);
      return;
    }
    results.forEach((r) => {
      const rEl = result.cloneNode(true);
      rEl.classList.toggle("hidden", false);
      rEl.querySelector(".doc-page").innerText = r.oTitle;
      const sectionEl = rEl.querySelector(".doc-section");
      if (r.oSection) {
        sectionEl.innerText = r.oSection;
      } else {
        rEl.querySelector(".match")?.removeChild(sectionEl);
      }
      rEl.querySelector(".link").href = r.path;
      const pre = r.snippet.slice(0, r.startIndex);
      const hl = r.snippet.slice(r.startIndex, r.startIndex + r.matchLen);
      const rest = r.snippet.slice(r.startIndex + r.matchLen);
      rEl.querySelector(".snippet-pre").innerHTML = pre;
      rEl.querySelector(".snippet-hl").innerHTML = hl;
      rEl.querySelector(".snippet-rest").innerHTML = rest;
      resultsEl.appendChild(rEl);
    });
  });
};
if (false) {
  console.log("Dev Mode enabled");
  new EventSource("/esbuild").addEventListener(
    "change",
    () => location.reload()
  );
}
