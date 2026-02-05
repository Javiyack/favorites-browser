const input = document.getElementById("bookmarksInput");
const grid = document.getElementById("linksGrid");
const status = document.getElementById("status");
const loadSample = document.getElementById("loadSample");
const dropZone = document.getElementById("dropZone");
const DEFAULT_BOOKMARKS_PATH =
  "C:\\Users\\javiyack\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Bookmarks";
const POLL_INTERVAL_MS = 2000; // Comprobar cada 2 segundos

let currentFileHandle = null;
let lastBookmarksHash = null;
let pollIntervalId = null;

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
    
    // Primero intentar buscar logo por título, luego favicon, luego default
    let faviconIndex = 0;
    let triedTitleLogo = false;
    
    const setNextFavicon = () => {
      if (faviconIndex >= faviconUrls.length) {
        icon.src = DEFAULT_ICON;
        return;
      }
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

    icon.onerror = () => {
      setNextFavicon();
    };

    icon.onload = () => {
      // Si la imagen es muy pequeña (icono genérico de 16x16 o menos), usar fallback
      if (icon.naturalWidth <= 16 || icon.naturalHeight <= 16) {
        if (faviconIndex < faviconUrls.length) {
          setNextFavicon();
        } else if (icon.src !== DEFAULT_ICON) {
          icon.src = DEFAULT_ICON;
        }
      }
    };

    // Intentar logo por título primero
    tryTitleLogoThenFavicons();

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

async function readBookmarksFile(file, isPolling = false) {
  try {
    if (!isPolling) {
      status.textContent = "Leyendo archivo...";
    }
    const text = await file.text();
    const newHash = simpleHash(text);
    
    // Si es polling y no hay cambios, no hacer nada
    if (isPolling && newHash === lastBookmarksHash) {
      return;
    }
    
    lastBookmarksHash = newHash;
    const data = JSON.parse(text);
    handleBookmarksData(data);
    
    if (isPolling) {
      status.textContent = `Actualizado automaticamente. ${new Date().toLocaleTimeString()}`;
    }
  } catch (error) {
    if (!isPolling) {
      status.textContent = "No se pudo leer el archivo. Revisa que sea JSON.";
      grid.innerHTML = "";
    }
  }
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

function startPolling(fileHandle) {
  stopPolling();
  currentFileHandle = fileHandle;
  
  pollIntervalId = setInterval(async () => {
    if (currentFileHandle) {
      try {
        // Si es un FileSystemFileHandle (API moderna)
        if (currentFileHandle.getFile) {
          const file = await currentFileHandle.getFile();
          await readBookmarksFile(file, true);
        }
      } catch (error) {
        // Silenciar errores de polling
      }
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
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

input.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (file) {
    await readBookmarksFile(file);
    // Intentar usar File System Access API para polling
    if (window.showOpenFilePicker && input.files[0]) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ accept: { "application/json": [".json", ""] } }],
          startIn: input.files[0]
        });
        startPolling(handle);
      } catch (err) {
        // El usuario canceló o no hay soporte
      }
    }
  }
});

loadSample.addEventListener("click", () => {
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

  dropZone.addEventListener("drop", async (event) => {
    const file = extractFileFromDataTransfer(event.dataTransfer);
    if (!file) {
      status.textContent =
        "No se detecto un archivo. Arrastra el archivo Bookmarks.";
      return;
    }

    await readBookmarksFile(file);
    
    // Intentar obtener handle para polling (solo Chromium)
    const items = event.dataTransfer?.items;
    if (items && items[0]?.getAsFileSystemHandle) {
      try {
        const handle = await items[0].getAsFileSystemHandle();
        if (handle.kind === "file") {
          startPolling(handle);
        }
      } catch (err) {
        // No hay soporte o falló
      }
    }
  });
}

setDefaultPathHint();
