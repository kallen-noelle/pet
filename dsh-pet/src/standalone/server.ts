<<<<<<< HEAD
/** Standalone loopback HTTP boundary. Desktop bridge requests never pass through this listener. */
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http';
import type { RegisteredRoute, StandaloneLogger } from './context';
import { createRequestSecurity, rejectRequest, secureResponse } from './request-security';
import type { RequestSecurity } from './request-security';
import { boundedRequest, MAX_REQUEST_BYTES, MAX_SETTINGS_BYTES } from './request-body';
import { publicSettings, validateSettings } from './settings';
import type { StandaloneSettingsService } from './settings';
import { settingsPage, settingsScript, settingsStyle } from './settings-page';

export const DEFAULT_STANDALONE_PORT = 3080;
export const PORT_SCAN_LIMIT = 25;
export interface StandaloneServerOptions {
  routes: RegisteredRoute[];
  logger: StandaloneLogger;
  port?: number;
  status?: () => unknown;
  onShutdown?: () => void;
  security?: RequestSecurity;
  ai?: StandaloneSettingsService;
  /** Override only for deterministic timeout tests. */
  bodyTimeoutMs?: number;
}
export interface StandaloneServer {
  port: number;
  security: RequestSecurity;
  close(): Promise<void>;
}

=======
/**
 * 独立模式的 HTTP 监听器：接管 DSH WebServer 原本扮演的角色。
 *
 * 这里**没有路由表** —— 路由表属于插件自己的宿主半边（`apply` 注册在 `ctx.webServer` 上的
 * prefix handler，见 `./context`）。本模块只做四件事：
 *   1. 绑定 127.0.0.1（端口被占用则顺延，独立模式没有 DSH 指定的固定端口）；
 *   2. 把落在插件路由前缀上的请求原样交给那份 handler（它自己写响应头与 body）；
 *   3. 提供 `/` 与 `/health`（运维信息）和 `/shutdown`（脚本化停机）；
 *   4. 兜住 handler 的异常，按插件自身的口径回 500 JSON。
 *
 * 为什么这里不补 `Access-Control-Allow-Origin`：独立模式的桌面渲染端经 bridge 管道
 * 取数据（不是 HTTP 跨源请求），CORS 对它无意义；而由本服务直接写的响应（`/`、`/shutdown`、
 * 未匹配路由）都带上了跨源头，供浏览器/第三方工具直接消费。
 */
import { createServer } from 'node:http';
import type { IncomingMessage, Server as HttpServer, ServerResponse } from 'node:http';

import type { RegisteredRoute, StandaloneLogger } from './context';

/** 独立模式默认端口（与插件 helper 的内置默认一致） */
export const DEFAULT_STANDALONE_PORT = 3080;
/** 端口被占用时向后顺延的个数上限 */
export const PORT_SCAN_LIMIT = 25;

export interface StandaloneServerOptions {
  /** 插件注册的路由（与 `createStandaloneContext` 共用同一个数组） */
  routes: RegisteredRoute[];
  logger: StandaloneLogger;
  /** 首选端口，默认 {@link DEFAULT_STANDALONE_PORT} */
  port?: number;
  /** `/` 与 `/health` 的运维信息提供者 */
  status?: () => unknown;
  /** `/shutdown` 被请求时通知调用方收尾（独立模式的脚本化停机） */
  onShutdown?: () => void;
}

export interface StandaloneServer {
  /** 实际监听的端口（首选端口被占用时会大于请求值） */
  port: number;
  close(): Promise<void>;
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '600',
};

/** 只取 pathname（不解码，避免 %2F 一类输入在校验之前被改写）；非法 URL 落回 '/' */
function pathnameOf(rawUrl: string | undefined): string {
  try {
    return new URL(rawUrl ?? '/', 'http://127.0.0.1').pathname;
  } catch {
    return '/';
  }
}

>>>>>>> yellow-hair
function matches(route: RegisteredRoute, pathname: string): boolean {
  if (route.kind === 'exact') return pathname === route.path;
  return pathname === route.path || pathname.startsWith(`${route.path}/`);
}
<<<<<<< HEAD
function sendJson(res: ServerResponse, status: number, body: unknown, cors = false): void {
=======

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
>>>>>>> yellow-hair
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
<<<<<<< HEAD
    ...(cors ? { 'access-control-allow-origin': '*' } : {}),
  });
  res.end(payload);
}
function sendAsset(res: ServerResponse, body: string, type: string): void {
  res.writeHead(200, {
    'content-type': `${type}; charset=utf-8`,
    'content-length': Buffer.byteLength(body),
    'content-security-policy':
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'x-frame-options': 'DENY',
  });
  res.end(body);
}
function fail(res: ServerResponse, _error: unknown, logger: StandaloneLogger): void {
  // Never echo or log provider errors: they may contain API keys or credential-bearing URLs.
  logger.error('独立模式路由处理失败（详细内容已省略以保护凭据）');
  if (res.headersSent) res.destroy();
  else sendJson(res, 500, { error: '本机服务暂时无法处理请求' });
}

function settingsHandler(
  ai: StandaloneSettingsService | undefined,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  let windowStart = Date.now();
  let count = 0;
  return async (req, res) => {
    if (!ai) {
      rejectRequest(res, 503, '本机 AI 设置尚未就绪');
      return;
    }
    if (req.method === 'GET') {
      sendJson(res, 200, publicSettings(ai.getSettings()));
      return;
    }
    if (req.method !== 'POST') {
      rejectRequest(res, 405, '仅支持 GET 或 POST');
      return;
    }
    if (Date.now() - windowStart >= 60000) {
      windowStart = Date.now();
      count = 0;
    }
    count += 1;
    if (count > 20) {
      rejectRequest(res, 429, '保存过于频繁，请稍后再试');
      return;
    }
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      rejectRequest(res, 415, '请使用 JSON 保存设置');
      return;
    }
    try {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        req.once('end', resolve);
        req.once('error', reject);
      });
      const input = validateSettings(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      sendJson(res, 200, publicSettings(await ai.saveSettings(input)));
    } catch {
      rejectRequest(res, 400, '设置未保存：请检查接口地址、模型名称、密钥和数值范围');
    }
  };
}

function testHandler(
  ai: StandaloneSettingsService | undefined,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (req.method !== 'POST') {
      rejectRequest(res, 405, '仅支持 POST');
      return;
    }
    try {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        req.once('end', resolve);
        req.once('error', reject);
      });
      const bodyStr = Buffer.concat(chunks).toString('utf8');
      const input = bodyStr ? JSON.parse(bodyStr) : {};
      if (ai?.testConnection) {
        const result = await ai.testConnection(input);
        sendJson(res, 200, result);
      } else {
        sendJson(res, 200, { ok: false, message: '当前环境未配置测试能力' });
      }
    } catch {
      sendJson(res, 400, { ok: false, message: '请求格式无效' });
    }
  };
}

function dispatch(
  options: StandaloneServerOptions,
  shutdownSecurity?: RequestSecurity,
): (req: IncomingMessage, res: ServerResponse, pathname: string) => void {
  const settings = settingsHandler(options.ai);
  const tester = testHandler(options.ai);
  return (req, res, pathname) => {
    const method = req.method ?? 'GET';
    if (method === 'OPTIONS') {
      res.writeHead(204);
=======
    ...CORS_HEADERS,
    ...headers,
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...CORS_HEADERS,
  });
  res.end(body);
}

/** handler 抛错时的收口：头已发出就断连（与插件 sendFile 的错误口径一致），否则 500 JSON */
function fail(res: ServerResponse, error: unknown, logger: StandaloneLogger): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`路由处理异常：${message}`);
  if (res.headersSent) {
    res.destroy();
    return;
  }
  sendJson(res, 500, { error: message });
}

/** 建一个请求监听器（导出以便单测直接驱动，不必真的起 socket） */
export function createRequestListener(
  options: StandaloneServerOptions,
): (req: IncomingMessage, res: ServerResponse) => void {
  const { routes, logger, status, onShutdown } = options;
  return (req, res) => {
    const method = req.method ?? 'GET';
    const pathname = pathnameOf(req.url);
    logger.debug(`${method} ${pathname}`);

    if (method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
>>>>>>> yellow-hair
      res.end();
      return;
    }
    if (pathname === '/' || pathname === '/health') {
<<<<<<< HEAD
      if (method !== 'GET' && method !== 'HEAD') {
        rejectRequest(res, 405, '仅支持 GET');
        return;
      }
      sendJson(res, 200, options.status?.() ?? { name: 'dsh-pet-standalone' }, true);
      return;
    }
    if (pathname === '/shutdown') {
      if (method !== 'POST') {
        rejectRequest(res, 405, '停机请使用 POST');
        return;
      }
      if (shutdownSecurity) {
        const supplied = req.headers['x-dsh-pet-token'];
        if (
          typeof supplied !== 'string' ||
          !/^[A-Za-z0-9_-]{43}$/.test(supplied) ||
          !timingSafeEqual(Buffer.from(supplied), Buffer.from(shutdownSecurity.token))
        ) {
          rejectRequest(res, 403, '停机需要提供令牌');
          return;
        }
      }
      sendJson(res, 200, { ok: true, stopping: true });
      queueMicrotask(() => options.onShutdown?.());
      return;
    }
    const assets: Record<string, readonly [string, string]> = {
      '/standalone-ai/': [settingsPage, 'text/html'],
      '/standalone-ai/settings.js': [settingsScript, 'text/javascript'],
      '/standalone-ai/settings.css': [settingsStyle, 'text/css'],
    };
    const asset = assets[pathname];
    if (asset) {
      if (method !== 'GET' && method !== 'HEAD') {
        rejectRequest(res, 405, '仅支持 GET');
        return;
      }
      sendAsset(res, asset[0], asset[1]);
      return;
    }
    if (pathname === '/standalone-ai/settings') {
      void settings(req, res).catch((error: unknown) => fail(res, error, options.logger));
      return;
    }
    if (pathname === '/standalone-ai/test') {
      void tester(req, res).catch((error: unknown) => fail(res, error, options.logger));
      return;
    }
    const route = options.routes.find((candidate) => matches(candidate, pathname));
    if (!route) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(
        `dsh-pet-standalone: 没有匹配的路由（已注册：${options.routes.map((item) => item.path).join(', ') || '无'}）`,
=======
      sendJson(res, 200, status?.() ?? { name: 'dsh-pet-standalone' });
      return;
    }
    if (pathname === '/shutdown') {
      // 先回话再收尾：调用方要能拿到 200，而不是被自己的停机动作打断
      sendJson(res, 200, { ok: true, stopping: true });
      queueMicrotask(() => onShutdown?.());
      return;
    }

    const route = routes.find((candidate) => matches(candidate, pathname));
    if (route === undefined) {
      sendText(
        res,
        404,
        `dsh-pet-standalone: 没有匹配的路由（已注册：${routes.map((item) => item.path).join(', ') || '无'}）`,
>>>>>>> yellow-hair
      );
      return;
    }
    try {
<<<<<<< HEAD
      void Promise.resolve(route.handler(req, res)).catch((error: unknown) => fail(res, error, options.logger));
    } catch (error) {
      fail(res, error, options.logger);
=======
      void Promise.resolve(route.handler(req, res)).catch((error: unknown) => fail(res, error, logger));
    } catch (error) {
      fail(res, error, logger);
>>>>>>> yellow-hair
    }
  };
}

<<<<<<< HEAD
export function createRequestListener(
  options: StandaloneServerOptions,
  injectedSecurity?: RequestSecurity,
): (req: IncomingMessage, res: ServerResponse) => void {
  const security = options.security ?? injectedSecurity;
  const route = dispatch(options, security);
  return (req, res) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    } catch {
      rejectRequest(res, 400, '请求地址无效');
      return;
    }
    secureResponse(res, pathname);
    if (security && !security.authorize(req, res)) return;
    // Do not log paths, fragments, query parameters, request bodies or authorization headers.
    options.logger.debug('收到本机 HTTP 请求');
    const hasBody = req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length'] ?? 0) > 0;
    const bodyMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '');
    if ((hasBody || bodyMethod) && typeof req.on === 'function') {
      const limit = pathname === '/standalone-ai/settings' ? MAX_SETTINGS_BYTES : MAX_REQUEST_BYTES;
      void boundedRequest(req, res, limit, options.bodyTimeoutMs)
        .then((bounded) => {
          if (bounded) route(bounded, res, pathname);
        })
        .catch((error: unknown) => fail(res, error, options.logger));
    } else route(req, res, pathname);
  };
}

=======
/** 从 preferred 起找一个能绑上的 127.0.0.1 端口；`preferred = 0` 表示交给系统分配 */
>>>>>>> yellow-hair
async function bindFirstFree(server: HttpServer, preferred: number, logger: StandaloneLogger): Promise<number> {
  for (let port = preferred; port < preferred + PORT_SCAN_LIMIT; port += 1) {
    try {
      await new Promise<void>((accept, reject) => {
        const onError = (error: Error): void => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = (): void => {
          server.off('error', onError);
          accept();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '127.0.0.1');
      });
<<<<<<< HEAD
=======
      // 真实端口必须回读 address()：传 0 时监听端口由系统分配，不等于请求值
>>>>>>> yellow-hair
      const address = server.address();
      const bound = typeof address === 'object' && address !== null ? address.port : port;
      if (preferred > 0 && bound !== preferred) logger.warn(`端口 ${preferred} 被占用，改用 ${bound}`);
      return bound;
    } catch (error) {
<<<<<<< HEAD
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
=======
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EADDRINUSE') throw error;
>>>>>>> yellow-hair
    }
  }
  throw new Error(`从 ${preferred} 起连续 ${PORT_SCAN_LIMIT} 个端口都被占用`);
}
<<<<<<< HEAD
export async function listenStandaloneServer(options: StandaloneServerOptions): Promise<StandaloneServer> {
  const security = options.security;
  const server = createServer(createRequestListener(options, security));
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
=======

/**
 * 起独立模式服务。
 * @param options 路由、日志器、首选端口与运维回调
 * @returns 实际端口与关闭函数
 */
export async function listenStandaloneServer(options: StandaloneServerOptions): Promise<StandaloneServer> {
  const server = createServer(createRequestListener(options));
  // 客户端半截请求（扫描器、被中断的连接）不该变成未捕获异常刷屏
>>>>>>> yellow-hair
  server.on('clientError', (_error, socket) => socket.destroy());
  const port = await bindFirstFree(server, options.port ?? DEFAULT_STANDALONE_PORT, options.logger);
  options.logger.info(`独立模式服务已监听 http://127.0.0.1:${port}/`);
  return {
    port,
<<<<<<< HEAD
    security: security ?? createRequestSecurity(),
    async close() {
=======
    async close(): Promise<void> {
      // keep-alive 连接会让 close() 一直等：先断开全部连接再关（脚本化停机不能挂住）
>>>>>>> yellow-hair
      server.closeAllConnections();
      await new Promise<void>((accept) => server.close(() => accept()));
    },
  };
}
