const input = document.getElementById("bookmarksInput");
const grid = document.getElementById("linksGrid");
const status = document.getElementById("status");
const loadSample = document.getElementById("loadSample");
const dropZone = document.getElementById("dropZone");
const DEFAULT_BOOKMARKS_PATH =
  "C:\\Users\\javiyack\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Bookmarks";

const sample = {
  roots: {
    bookmark_bar: {
      children: [
        {
          name: "TV",
          type: "folder",
          children: [
            { name: "Stream 1", type: "url", url: "https://example.com" },
            { name: "Stream 2", type: "url", url: "https://example.org" },
            { name: "Stream 3", type: "url", url: "https://example.net" }
          ]
        }
      ]
    }
  }
};

const DEFAULT_ICON = "youtube-play.png";
const ICONS_FOLDER = "icons/";
const ICON_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp"];

// Lista de iconos disponibles (se manejará globalmente)
let AVAILABLE_ICONS = window.AVAILABLE_ICONS || [];

/**
 * Recarga el archivo icons-list.js dinámicamente para obtener cambios
 * sin necesidad de refrescar la página completa.
 */
function refreshIconsList() {
  return new Promise((resolve) => {
    // Eliminar script previo si existe
    const oldScript = document.getElementById("dynamic-icons-list");
    if (oldScript) oldScript.remove();

    const script = document.createElement("script");
    script.id = "dynamic-icons-list";
    // Forzamos la recarga ignorando el cache con un timestamp
    script.src = `icons-list.js?t=${Date.now()}`;
    
    script.onload = () => {
      AVAILABLE_ICONS = window.AVAILABLE_ICONS || [];
      console.log("🔄 Lista de iconos recargada:", AVAILABLE_ICONS);
      resolve();
    };
    
    script.onerror = () => {
      console.error("❌ No se pudo cargar icons-list.js");
      resolve(); // Continuamos aunque falle
    };
    
    document.body.appendChild(script);
  });
}

const FAVICON_PROVIDERS = [
  (host) => `https://www.google.com/s2/favicons?domain=${host}&sz=128`,
  (host) => `https://icons.duckduckgo.com/ip3/${host}.ico`,
  (host) => `https://www.google.com/s2/favicons?domain=${host}&sz=64`
];

// Proveedores de iconos por título (buscan logos relacionados con el nombre)
const TITLE_ICON_PROVIDERS = [
  (title) => `https://logo.clearbit.com/${encodeURIComponent(title.toLowerCase().replace(/\s+/g, ""))}.com`,
  (title) => `https://logo.clearbit.com/${encodeURIComponent(title.toLowerCase().split(" ")[0])}.com`,
  (title) => `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(title)}`
];

// Busca si el título contiene alguno de los nombres de iconos disponibles
function findMatchingLocalIcon(title) {
  const normalizedTitle = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  
  console.log(`🔍 Buscando icono para título: "${title}" (normalizado: "${normalizedTitle}")`);
  console.log(`   Iconos disponibles: [${AVAILABLE_ICONS.join(", ")}]`);
  
  for (const iconName of AVAILABLE_ICONS) {
    const match = normalizedTitle.includes(iconName);
    console.log(`   ¿"${normalizedTitle}" contiene "${iconName}"? ${match ? "✅ SÍ" : "❌ NO"}`);
    if (match) {
      const paths = ICON_EXTENSIONS.map(ext => `${ICONS_FOLDER}${iconName}${ext}`);
      console.log(`   📁 Rutas a probar: ${paths.join(", ")}`);
      return paths;
    }
  }
  console.log(`   ⚠️ No se encontró coincidencia en iconos locales`);
  return [];
}

// Genera posibles rutas de iconos locales basándose en el título
function getLocalIconPaths(title) {
  // Primero buscar coincidencia parcial con iconos disponibles
  const matchingPaths = findMatchingLocalIcon(title);
  if (matchingPaths.length > 0) {
    return matchingPaths;
  }
  
  // Fallback: intentar con el nombre exacto del título
  const baseName = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9]/g, ""); // solo alfanumérico
  
  const paths = [];
  for (const ext of ICON_EXTENSIONS) {
    paths.push(`${ICONS_FOLDER}${baseName}${ext}`);
  }
  return paths;
}

async function fetchLogoByTitle(title) {
  try {
    const response = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(title)}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.length > 0 && data[0].logo) {
      return data[0].logo;
    }
  } catch (error) {
    // Ignorar errores de red
  }
  return null;
}

function findFolderByName(node, folderName) {
  if (!node) {
    return null;
  }

  if (node.type === "folder" && node.name === folderName) {
    return node;
  }

  const children = node.children || [];
  for (const child of children) {
    const match = findFolderByName(child, folderName);
    if (match) {
      return match;
    }
  }

  return null;
}

function collectUrls(node) {
  const urls = [];
  if (!node) {
    return urls;
  }

  const children = node.children || [];
  for (const child of children) {
    if (child.type === "url") {
      urls.push(child);
    } else if (child.type === "folder") {
      urls.push(...collectUrls(child));
    }
  }

  return urls;
}

function renderLinks(links) {
  grid.innerHTML = "";

  if (!links.length) {
    status.textContent = "No se encontraron links en la carpeta TV.";
    return;
  }

  status.textContent = `Mostrando ${links.length} links de TV.`;

  links.forEach((link, index) => {
    let hostname = "";
    if (link.url) {
      try {
        hostname = new URL(link.url).hostname;
      } catch (error) {
        hostname = "";
      }
    }

    const faviconUrls = hostname && !hostname.includes("teleonline.org")
      ? FAVICON_PROVIDERS.map((provider) => provider(hostname))
      : [];
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${index * 40}ms`;
    card.draggable = true;
    card.dataset.index = index;

    card.addEventListener("dragstart", (e) => {
      card.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      document.querySelectorAll(".card.drag-over").forEach((c) => c.classList.remove("drag-over"));
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const dragging = document.querySelector(".card.is-dragging");
      if (dragging && dragging !== card) {
        card.classList.add("drag-over");
      }
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      const dragging = document.querySelector(".card.is-dragging");
      if (dragging && dragging !== card) {
        const allCards = [...grid.querySelectorAll(".card")];
        const fromIndex = allCards.indexOf(dragging);
        const toIndex = allCards.indexOf(card);
        if (fromIndex < toIndex) {
          card.after(dragging);
        } else {
          card.before(dragging);
        }
      }
    });

    const title = document.createElement("h3");
    const rawTitle = link.name || "Sin titulo";
    title.textContent =
      rawTitle.length > 40 ? `${rawTitle.slice(0, 37)}...` : rawTitle;

    const action = document.createElement("a");
    action.href = link.url;
    action.target = "_blank";
    action.rel = "noreferrer";
    action.title = link.url || "";

    const icon = document.createElement("img");
    icon.className = "card__icon";
    icon.alt = "";
    icon.loading = "lazy";
    
    // Orden de búsqueda: 1) iconos locales, 2) logo por título, 3) favicon, 4) default
    const localIconPaths = getLocalIconPaths(rawTitle);
    let localIconIndex = 0;
    let faviconIndex = 0;
    let triedTitleLogo = false;
    
    const setNextFavicon = () => {
      if (faviconIndex >= faviconUrls.length) {
        console.log(`   🎬 Usando icono por defecto para "${rawTitle}"`);
        icon.src = DEFAULT_ICON;
        return;
      }
      console.log(`   🌐 Probando favicon [${faviconIndex + 1}/${faviconUrls.length}]: ${faviconUrls[faviconIndex]}`);
      icon.src = faviconUrls[faviconIndex];
      faviconIndex += 1;
    };

    const tryTitleLogoThenFavicons = async () => {
      if (!triedTitleLogo) {
        triedTitleLogo = true;
        const titleLogo = await fetchLogoByTitle(rawTitle);
        if (titleLogo) {
          icon.src = titleLogo;
          icon.onerror = () => setNextFavicon();
          return;
        }
      }
      setNextFavicon();
    };

    const tryNextLocalIcon = () => {
      if (localIconIndex >= localIconPaths.length) {
        // No hay más iconos locales, probar con logo por título
        console.log(`   🔄 Sin más iconos locales para "${rawTitle}", probando logo por título...`);
        tryTitleLogoThenFavicons();
        return;
      }
      const path = localIconPaths[localIconIndex];
      console.log(`   🖼️ Probando icono local [${localIconIndex + 1}/${localIconPaths.length}]: ${path}`);
      icon.src = path;
      localIconIndex += 1;
    };

    icon.onerror = () => {
      console.log(`   ❌ Error cargando: ${icon.src}`);
      if (localIconIndex < localIconPaths.length) {
        tryNextLocalIcon();
      } else if (!triedTitleLogo) {
        tryTitleLogoThenFavicons();
      } else {
        setNextFavicon();
      }
    };

    icon.onload = () => {
      console.log(`   ✅ Cargado: ${icon.src} (${icon.naturalWidth}x${icon.naturalHeight})`);
      // Si la imagen es muy pequeña (icono genérico de 16x16 o menos), usar fallback
      if (icon.naturalWidth <= 16 || icon.naturalHeight <= 16) {
        console.log(`   ⚠️ Icono muy pequeño, probando siguiente...`);
        if (localIconIndex < localIconPaths.length) {
          tryNextLocalIcon();
        } else if (faviconIndex < faviconUrls.length) {
          setNextFavicon();
        } else if (icon.src !== DEFAULT_ICON) {
          icon.src = DEFAULT_ICON;
        }
      }
    };

    // Intentar iconos locales primero
    tryNextLocalIcon();

    action.append(icon);

    const header = document.createElement("div");
    header.className = "card__header";
    header.append(action, title);

    card.append(header);
    grid.append(card);
  });
}

function handleBookmarksData(data) {
  const roots = data?.roots || data;
  const folder =
    findFolderByName(roots.bookmark_bar, "TV") ||
    findFolderByName(roots.other, "TV") ||
    findFolderByName(roots.synced, "TV");

  if (!folder) {
    status.textContent = "No se encontro la carpeta TV.";
    grid.innerHTML = "";
    return;
  }

  const links = collectUrls(folder);
  renderLinks(links);
}

async function readBookmarksFile(file) {
  try {
    status.textContent = "Leyendo archivo...";
    // Recargar la lista de iconos antes de procesar para pescar nuevos archivos
    await refreshIconsList();
    const text = await file.text();
    const data = JSON.parse(text);
    handleBookmarksData(data);
  } catch (error) {
    status.textContent = "No se pudo leer el archivo. Revisa que sea JSON.";
    grid.innerHTML = "";
  }
}

function extractFileFromDataTransfer(dataTransfer) {
  if (!dataTransfer) {
    return null;
  }

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return dataTransfer.files[0];
  }

  const item = dataTransfer.items && dataTransfer.items[0];
  if (item && item.kind === "file") {
    return item.getAsFile();
  }

  return null;
}

function setDefaultPathHint() {
  status.textContent =
    "Selecciona el archivo Bookmarks desde: " + DEFAULT_BOOKMARKS_PATH;
}

input.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    readBookmarksFile(file);
  }
});

loadSample.addEventListener("click", async () => {
  await refreshIconsList();
  handleBookmarksData(sample);
});

if (dropZone) {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
      status.textContent = "Suelta el archivo Bookmarks aqui...";
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    const file = extractFileFromDataTransfer(event.dataTransfer);
    if (!file) {
      status.textContent =
        "No se detecto un archivo. Arrastra el archivo Bookmarks.";
      return;
    }

    readBookmarksFile(file);
  });
}

// Cargar iconos y mostrar ruta al inicio
refreshIconsList();
setDefaultPathHint();
