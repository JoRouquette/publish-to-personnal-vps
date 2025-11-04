const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcMain = path.join(root, 'dist', 'obsidian-plugin', 'src', 'main.js');
const dstDir = path.join(root, 'dist', 'PublishToPersonnalVps');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function cleanDir(p) {
  fs.rmSync(p, { recursive: true, force: true });
}
function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

(function main() {
  cleanDir(dstDir);
  ensureDir(dstDir);

  if (!fs.existsSync(srcMain)) {
    console.error('❌ main.js introuvable :', srcMain);
    console.error('Avez-vous un fichier obsidian-plugin/src/main.ts ?');
    process.exit(1);
  }

  const manifestSrc = path.join(root, 'obsidian-plugin', 'manifest.json');
  if (!fs.existsSync(manifestSrc)) {
    console.error('❌ manifest.json introuvable dans obsidian-plugin/');
    process.exit(1);
  }

  const stylesSrc = path.join(root, 'obsidian-plugin', 'styles.css');

  copyFile(srcMain, path.join(dstDir, 'main.js'));
  copyFile(manifestSrc, path.join(dstDir, 'manifest.json'));
  if (fs.existsSync(stylesSrc))
    copyFile(stylesSrc, path.join(dstDir, 'styles.css'));

  console.log('✅ Plugin packagé dans dist/publish-to-personal-vps/');
  console.log("   Vous pouvez maintenant l'installer dans Obsidian.");
  console.log(
    '   Copiez/collez ce dossier dans votre vault : .obsidian/plugins/publish-to-personal-vps'
  );
})();
