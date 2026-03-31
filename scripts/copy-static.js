const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

["index.html", "v2.html", "llms.txt", "robots.txt", "sitemap.xml"].forEach(
  (f) => {
    const src = path.join(root, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(dist, f));
      console.log(`  ${f}`);
    }
  },
);
console.log("✓ Landing page files copied to dist/");
