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
    icon.src = DEFAULT_ICON;

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

setDefaultPathHint();
