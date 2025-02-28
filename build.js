import { redirectErrorsToConsole } from "@oliversalzburg/js-utils/errors/console.js";
import esbuild from "esbuild";

esbuild
  .build({
    bundle: true,
    entryPoints: ["source/main.ts"],
    external: ["os"],
    format: "esm",
    inject: ["source/cjs-shim.ts"],
    outfile: "lib/main.js",
    platform: "node",
    target: "node20",
  })
  .catch(redirectErrorsToConsole(console));
