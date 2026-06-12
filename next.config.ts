import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",

  webpack(config, { isServer }) {
    if (!isServer) {
      // satellite.js v7 uses Node.js Package Imports (#wasm-single-thread,
      // #wasm-multi-thread) to load its WASM builds. These imports resolve to
      // wasm-build/*/index.js files that use node:module and node:worker_threads
      // — Node.js built-ins that cannot be bundled for the browser.
      //
      // We alias these package imports to a no-op stub so webpack doesn't try
      // to bundle WASM at all. The pure-JS SGP4 functions (twoline2satrec,
      // propagate, gstime etc.) live in satellite.js/dist/*.js and are fully
      // browser-compatible — they are NOT affected by this alias.
      const wasmStub = path.resolve(__dirname, "src/wasm-stub.js");

      config.resolve.alias = {
        ...config.resolve.alias,
        // Override the two WASM package import specifiers
        "#wasm-single-thread": wasmStub,
        "#wasm-multi-thread": wasmStub,
        // Also cover the resolved paths directly (belt-and-suspenders)
        [path.resolve(
          __dirname,
          "node_modules/satellite.js/wasm-build/base-release/index.js"
        )]: wasmStub,
        [path.resolve(
          __dirname,
          "node_modules/satellite.js/wasm-build/pthreads-release/index.js"
        )]: wasmStub,
      };
    }

    return config;
  },
};

export default nextConfig;


