import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

export interface TestServer {
  url: string;
  close: () => Promise<void>;
  redirectCount: number;
  redirectTargetCount: number;
  lastRequestPath: string | null;
  setAssetResponse: (response: AssetResponse) => void;
  /** F5 diagnostic: delayed-response timers scheduled but not yet fired or cancelled. */
  pendingTimerCount: number;
  /** F5 diagnostic: delayed callbacks skipped because their response was already dead. */
  lateCallbackSkips: number;
}

export interface AssetResponse {
  status: number;
  body?: string;
  delayMs?: number;
}

export interface CreateTestServerOptions {
  port?: number;
}

export async function createTestServer(options: CreateTestServerOptions = {}): Promise<TestServer> {
  const { port = 0 } = options;
  let redirectCount = 0;
  let redirectTargetCount = 0;
  let lastRequestPath: string | null = null;
  let assetResponse: AssetResponse = { status: 200, body: 'API_BASE_URL=http://localhost:3000/api\n' };
  let assetRedirectLocation = '/assets/env/redirect-target';

  // F5: every delayed-response timer is owned here so close() can cancel
  // pending ones. Handles are removed from the set when they fire.
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  let lateCallbackSkips = 0;

  /**
   * Schedule a delayed response write. The timer is tracked in pendingTimers
   * (deleted when it fires) and the write is skipped — and counted — if the
   * response was destroyed or already ended by the time the callback runs
   * (e.g. the client aborted while the timer was pending).
   */
  const scheduleResponse = (
    response: ServerResponse,
    delayMs: number,
    respond: () => void,
  ): void => {
    const timer = setTimeout(() => {
      pendingTimers.delete(timer);
      if (response.destroyed || response.writableEnded) {
        lateCallbackSkips++;
        return;
      }
      respond();
    }, delayMs);
    pendingTimers.add(timer);
  };

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    lastRequestPath = req.url ?? null;

    const parsedUrl = new URL(req.url ?? '/', `http://localhost`);
    const path = parsedUrl.pathname;

    if (path === '/redirect') {
      redirectCount++;
      res.writeHead(302, { Location: '/asset' });
      res.end();
      return;
    }

    if (path === '/delay') {
      scheduleResponse(res, 10_000, () => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('API_BASE_URL=http://localhost:3000/api\n');
      });
      return;
    }

    if (path === '/asset') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=http://localhost:3000/api\n');
      return;
    }

    if (path === '/asset-missing') {
      res.writeHead(404);
      res.end();
      return;
    }

    if (path.startsWith('/status/')) {
      const code = parseInt(path.slice(8), 10);
      if (!Number.isNaN(code)) {
        res.writeHead(code);
        if (code === 200) {
          res.end('API_BASE_URL=http://localhost:3000/api\n');
        } else {
          res.end();
        }
        return;
      }
    }

    if (path === '/asset-empty') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('\n');
      return;
    }

    if (path === '/asset-duplicate') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=http://localhost:3000/api\nAPI_BASE_URL=http://evil.com\n');
      return;
    }

    if (path === '/asset-https') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=https://localhost:3000/api\n');
      return;
    }

    if (path === '/asset-nonloopback') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=http://evil.com/api\n');
      return;
    }

    if (path === '/asset-badport') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=http://localhost:0/api\n');
      return;
    }

    if (path === '/asset-credentials') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=http://user:pass@localhost:3000/api\n');
      return;
    }

    if (path === '/asset-controlchar') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=http://localhost:3000/api\t\n');
      return;
    }

    // Exact path that resolveApiBase requests: /assets/env/.env.e2e
    if (path === '/assets/env/.env.e2e') {
      if (assetResponse.delayMs) {
        scheduleResponse(res, assetResponse.delayMs, () => {
          const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
          if (assetResponse.status >= 300 && assetResponse.status < 400) {
            headers['Location'] = assetRedirectLocation;
          }
          res.writeHead(assetResponse.status, headers);
          res.end(assetResponse.body ?? '');
        });
      } else {
        const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
        if (assetResponse.status >= 300 && assetResponse.status < 400) {
          headers['Location'] = assetRedirectLocation;
        }
        res.writeHead(assetResponse.status, headers);
        res.end(assetResponse.body ?? '');
      }
      return;
    }

    // Redirect target tracking endpoint
    if (path === '/assets/env/redirect-target') {
      redirectTargetCount++;
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=http://localhost:3000/api\n');
      return;
    }

    // Configurable redirect endpoint
    if (path === '/assets/env/redirect') {
      redirectCount++;
      res.writeHead(302, { Location: '/assets/env/.env.e2e' });
      res.end();
      return;
    }

    // Configurable delay endpoint
    if (path === '/assets/env/delay') {
      scheduleResponse(res, 10_000, () => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('API_BASE_URL=http://localhost:3000/api\n');
      });
      return;
    }

    // Configurable status endpoints
    if (path.startsWith('/assets/env/status/')) {
      const code = parseInt(path.slice(17), 10);
      if (!Number.isNaN(code)) {
        res.writeHead(code);
        if (code === 200) {
          res.end('API_BASE_URL=http://localhost:3000/api\n');
        } else {
          res.end();
        }
        return;
      }
    }

    // Default asset content for any other /assets/env/ path
    if (path.startsWith('/assets/env/')) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('API_BASE_URL=http://localhost:3000/api\n');
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise<TestServer>((resolve, reject) => {
    // D: bind failures (e.g. EADDRINUSE) surface as an 'error' event.
    // 'once' guarantees at most one rejection (no double settlement) and
    // guarantees a listener is attached when the event fires (no unhandled
    // late error). The listener is removed on successful bind.
    const onListenError = (error: Error): void => {
      reject(error);
    };
    server.once('error', onListenError);

    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onListenError);
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind test server'));
        return;
      }
      const actualPort = address.port;
      const url = `http://127.0.0.1:${actualPort}`;

      // A/C: idempotent close. Concurrent and repeated callers share the
      // same cached shutdown promise; if shutdown fails, callers receive
      // that same rejection rather than a falsely-fulfilled promise.
      let closePromise: Promise<void> | undefined;
      const close = (): Promise<void> => {
        if (!closePromise) {
          // A: cancel every pending delayed-response timer BEFORE initiating
          // server shutdown, so no ref'ed timer survives close().
          for (const timer of pendingTimers) {
            clearTimeout(timer);
          }
          pendingTimers.clear();
          closePromise = new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) rejectClose(err);
              else resolveClose();
            });
          });
        }
        return closePromise;
      };

      resolve({
        url,
        close,
        get redirectCount() {
          return redirectCount;
        },
        get redirectTargetCount() {
          return redirectTargetCount;
        },
        get lastRequestPath() {
          return lastRequestPath;
        },
        get pendingTimerCount() {
          return pendingTimers.size;
        },
        get lateCallbackSkips() {
          return lateCallbackSkips;
        },
        setAssetResponse(response: AssetResponse) {
          assetResponse = response;
        },
      });
    });
  });
}