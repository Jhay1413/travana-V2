// Best-effort WebGL availability check, used to decide whether to attempt
// mounting the 3D globe at all before we pay for the three.js chunk.
//
// Memoised at module level: browsers cap the number of live WebGL contexts
// per page (commonly ~16), so calling this repeatedly (e.g. toggling
// between Globe/List view) without caching would eventually exhaust that
// budget and starve the real globe canvas of a context. The probe context
// itself is also explicitly released via WEBGL_lose_context so it doesn't
// count against that budget while we hold the cached boolean result.
let cachedResult: boolean | null = null;

function probeWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false;

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");

    const available = Boolean(gl);

    if (gl && "getExtension" in gl) {
      const loseContext = gl.getExtension("WEBGL_lose_context");
      loseContext?.loseContext();
    }

    return available;
  } catch {
    return false;
  }
}

export function isWebGLAvailable(): boolean {
  if (cachedResult === null) cachedResult = probeWebGLAvailable();
  return cachedResult;
}
