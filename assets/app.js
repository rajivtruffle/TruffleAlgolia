// app.js
(function(){
  const REPO = "TruffleAlgolia"; // GitHub Pages project repo name
  function getBasePath(){
    const parts = location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf(REPO);
    if(idx !== -1){
      return "/" + parts.slice(0, idx+1).join("/") + "/";
    }
    // Fallback (e.g., running locally)
    return "/";
  }
  function currentLang(){
    const parts = location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf(REPO);
    const lang = (idx !== -1 && parts[idx+1]) ? parts[idx+1] : null;
    if(["en","fr","de"].includes(lang)) return lang;
    return "en";
  }
  function langUrl(lang){
    const base = getBasePath();
    return base + lang + "/";
  }

  // Initialize selector
  const sel = document.getElementById("langSelect");
  if (sel){
    sel.value = currentLang();
    sel.addEventListener("change", (e)=>{
      const chosen = e.target.value;
      window.location.assign(langUrl(chosen));
    });
  }

  // Replace hero image + caption based on language (if the page uses a shared template)
  const hero = document.querySelector("img.hero");
  const caption = document.querySelector(".caption");
  if (hero && caption){
    const lang = currentLang();
    if (lang === "en"){
      hero.src = "../assets/img1.png";
      hero.alt = "English Image";
      caption.textContent = "English page";
    } else if (lang === "fr"){
      hero.src = "../assets/img2.png";
      hero.alt = "Page Française";
      caption.textContent = "Page française";
    } else if (lang === "de"){
      hero.src = "../assets/img3.png";
      hero.alt = "Deutsche Seite";
      caption.textContent = "Deutsche Seite";
    }
  }

  // Optional: expose helpers globally (useful for Embedded Messaging)
  window.TruffleContext = {
    getSiteLang: currentLang,
    getPageUrl: () => window.location.href
  };
})();
