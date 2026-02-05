const fs = require("fs");
const path = require("path");

const ICONS_FOLDER = path.join(__dirname, "icons");
const OUTPUT_FILE = path.join(__dirname, "icons-list.js");
const EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp"];

function generateIconsList() {
  if (!fs.existsSync(ICONS_FOLDER)) {
    console.log("Carpeta icons no existe. Creándola...");
    fs.mkdirSync(ICONS_FOLDER);
  }

  const files = fs.readdirSync(ICONS_FOLDER);
  const iconNames = new Set();

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (EXTENSIONS.includes(ext)) {
      const name = path.basename(file, ext).toLowerCase();
      iconNames.add(name);
    }
  }

  const list = [...iconNames].sort();
  const content = `// Este archivo se genera automáticamente con node generate-icons-list.js\nwindow.AVAILABLE_ICONS = ${JSON.stringify(list, null, 2)};`;
  fs.writeFileSync(OUTPUT_FILE, content);
  console.log(`Generado ${OUTPUT_FILE} con ${list.length} iconos:`);
  console.log(list.join(", "));
}

generateIconsList();
