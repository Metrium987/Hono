import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { includeIgnoreFile } from "@eslint/compat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

// eslint-config-next v16 exports a flat config array natively
const nextRaw = require("eslint-config-next");
const nextConfig = typeof nextRaw === "function" ? nextRaw() : nextRaw;

const eslintConfig = [
  includeIgnoreFile(path.resolve(__dirname, ".gitignore")),
  { ignores: ["scripts/"] },
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),
];

export default eslintConfig;
