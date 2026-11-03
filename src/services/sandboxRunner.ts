export interface SandboxExecutionResult {
  logs: string[];
  returnValue?: string;
  error?: string;
  durationMs: number;
}

/**
 * Strips TypeScript syntax constructs (interfaces, type aliases, parameter/return annotations,
 * `as` assertions, generics, and module keywords) so code can run directly in a JS Worker.
 */
export function transpileTypeScriptToJS(tsCode: string): string {
  return (
    tsCode
      // Remove import type and standard ES imports
      .replace(/^\s*import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
      .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, "")
      // Remove interface declarations
      .replace(/\b(?:export\s+)?interface\s+\w+(?:<[^>]+>)?\s*\{[\s\S]*?\}/g, "")
      // Remove type alias declarations
      .replace(/\b(?:export\s+)?type\s+\w+(?:<[^>]+>)?\s*=\s*[^;]+;/g, "")
      // Convert export keywords to plain declarations
      .replace(/\bexport\s+default\s+/g, "")
      .replace(/\bexport\s+(async\s+)?(function|const|let|var|class)\b/g, "$1$2")
      // Remove generic type parameters on functions e.g. function foo<T extends string>(
      .replace(/\bfunction\s+(\w+)\s*<[^>]+>\s*\(/g, "function $1(")
      // Remove return type annotations before `{` or `=>`
      .replace(/\)\s*:\s*[A-Za-z0-9_<>[\]|&\s.,?]+(?=\s*(?:\{|=>))/g, ")")
      // Remove variable type annotations e.g. const x: Record<string, number> =
      .replace(/\b(const|let|var)\s+(\w+)\s*:\s*[^=]+=/g, "$1 $2 =")
      // Remove parameter type annotations e.g. (a: string, b?: number)
      .replace(
        /(\w+)\??\s*:\s*(?:Record<[^>]+>|Array<[^>]+>|Promise<[^>]+>|[A-Za-z0-9_[\]|&<>]+)(?=\s*[,)=])/g,
        "$1",
      )
      // Remove `as Type` assertions
      .replace(/\s+as\s+(?:const|[A-Za-z0-9_<>[\]|&]+)/g, "")
  );
}

/**
 * Executes JavaScript/TypeScript code inside an isolated Web Worker with async/await support
 * and a strict timeout guard (default 3000ms) so infinite loops cannot freeze the main UI thread.
 */
export function executeInSandboxWorker(
  code: string,
  language: "typescript" | "javascript",
  timeoutMs = 3000,
): Promise<SandboxExecutionResult> {
  const start = performance.now();
  const jsBody = language === "typescript" ? transpileTypeScriptToJS(code) : code;

  return new Promise((resolve) => {
    const workerSource = `
      self.onmessage = async function(e) {
        const code = e.data.code;
        const logs = [];
        const formatArg = (a) => {
          if (a === null) return 'null';
          if (a === undefined) return 'undefined';
          if (typeof a === 'object') {
            try { return JSON.stringify(a, null, 2); } catch { return String(a); }
          }
          return String(a);
        };
        const customConsole = {
          log: (...args) => logs.push(args.map(formatArg).join(' ')),
          info: (...args) => logs.push('[INFO] ' + args.map(formatArg).join(' ')),
          warn: (...args) => logs.push('[WARN] ' + args.map(formatArg).join(' ')),
          error: (...args) => logs.push('[ERROR] ' + args.map(formatArg).join(' ')),
        };

        try {
          const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
          const runner = new AsyncFunction('console', code);
          const result = await runner(customConsole);
          let returnValue = undefined;
          if (result !== undefined) {
            returnValue = formatArg(result);
          }
          self.postMessage({ ok: true, logs, returnValue });
        } catch (err) {
          self.postMessage({
            ok: false,
            logs,
            error: err && err.message ? err.message : String(err),
          });
        }
      };
    `;

    let settled = false;
    let worker: Worker | null = null;
    let blobUrl = "";

    const cleanup = () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = "";
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        logs: [],
        error: `Execution timed out after ${timeoutMs}ms (possible infinite loop terminated safely)`,
        durationMs: Number((performance.now() - start).toFixed(2)),
      });
    }, timeoutMs);

    try {
      const blob = new Blob([workerSource], { type: "application/javascript" });
      blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);

      worker.onmessage = (event) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        const durationMs = Number((performance.now() - start).toFixed(2));
        const data = event.data;
        if (data.ok) {
          resolve({
            logs: data.logs || [],
            returnValue: data.returnValue,
            durationMs,
          });
        } else {
          resolve({
            logs: data.logs || [],
            error: data.error || "Unknown runtime error",
            durationMs,
          });
        }
      };

      worker.onerror = (errEvent) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve({
          logs: [],
          error: errEvent.message || "Worker execution failed",
          durationMs: Number((performance.now() - start).toFixed(2)),
        });
      };

      worker.postMessage({ code: jsBody });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve({
        logs: [],
        error: err instanceof Error ? err.message : String(err),
        durationMs: Number((performance.now() - start).toFixed(2)),
      });
    }
  });
}
