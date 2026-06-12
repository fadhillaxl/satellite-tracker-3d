// Browser stub for satellite.js WASM single-thread runtime
// satellite.js will gracefully skip WASM when this stub returns no-op
module.exports = function () {
  return {
    // Return a no-op WASM module — satellite.js detects absence and falls back
    // to its pure-JavaScript SGP4 implementation automatically.
  };
};
