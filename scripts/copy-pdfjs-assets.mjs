// Copies the pdf.js worker and its data files into /public/pdfjs so the version always matches
// the installed react-pdf. Runs on `npm install` (postinstall). The folder is gitignored.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pdfjsDir = path.dirname(require.resolve("pdfjs-dist/package.json", { paths: [require.resolve("react-pdf")] }));
const out = path.resolve(import.meta.dirname, "..", "public", "pdfjs");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(pdfjsDir, "build", "pdf.worker.min.mjs"), path.join(out, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(path.join(pdfjsDir, dir), path.join(out, dir), { recursive: true });
}
console.log("pdf.js assets copied to public/pdfjs");
