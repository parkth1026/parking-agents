#!/usr/bin/env node
// 零依赖 Chrome DevTools Protocol 客户端。仓库约定「.mjs + Node 内置模块」，
// 所以截图与像素 diff 不引入 puppeteer/playwright：Node 24 自带全局 WebSocket，
// 直接说 CDP 就够用了。
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { HEADLESS_CHILD_OPTIONS } from './headless.mjs';

const CHROME_ENV = 'AES_WORKTREE_BOARD_CHROME';

// 优先用 playwright 缓存里的固定版本 Chromium：AC-006 要求「固定 Chromium/DPR/字体」，
// 系统 Chrome 会自动升级，钉不住。
// headless shell 排在前面：它本身就是无头二进制，不需要 --headless 开关，
// 也没有完整 Chrome 那套会在无头下自己退出的启动逻辑。
function chromeCandidates() {
  const local = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const builds = [1223, 1222, 1221, 1220, 1181];
  return [
    process.env[CHROME_ENV] ? { path: process.env[CHROME_ENV], shell: /headless[-_]shell/i.test(process.env[CHROME_ENV]) } : null,
    ...builds.flatMap((build) => [
      { path: join(local, 'ms-playwright', `chromium_headless_shell-${build}`, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'), shell: true },
      { path: join(home, '.cache', 'ms-playwright', `chromium_headless_shell-${build}`, 'chrome-headless-shell-linux64', 'chrome-headless-shell'), shell: true },
      { path: join(local, 'ms-playwright', `chromium-${build}`, 'chrome-win64', 'chrome.exe'), shell: false },
      { path: join(home, '.cache', 'ms-playwright', `chromium-${build}`, 'chrome-linux', 'chrome'), shell: false },
    ]),
    { path: 'C:/Program Files/Google/Chrome/Application/chrome.exe', shell: false },
    { path: '/usr/bin/google-chrome', shell: false },
    { path: '/usr/bin/chromium', shell: false },
  ].filter(Boolean);
}

export function findChrome() {
  for (const candidate of chromeCandidates()) {
    if (existsSync(candidate.path)) return candidate;
  }
  const error = new Error(`未找到可用 Chromium；设置 ${CHROME_ENV} 指向 chrome-headless-shell 或 chrome 可执行文件`);
  error.code = 'CHROME_NOT_FOUND';
  throw error;
}

function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function fetchJson(url, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch { /* 端口尚未监听，继续等 */ }
    await wait(100);
  }
  throw new Error(`CDP 端点未就绪: ${url}`);
}

export class CdpSession {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolve(message.result);
        return;
      }
      const handlers = this.listeners.get(message.method);
      if (handlers) for (const handler of handlers) handler(message.params);
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(handler);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  // 页面里的 JS 求值。返回值必须可 JSON 序列化。
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression: `(() => { const value = (${expression}); return JSON.stringify(value === undefined ? null : value); })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`页面求值失败: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
    }
    return JSON.parse(result.result.value);
  }

  async screenshot() {
    const shot = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    return Buffer.from(shot.data, 'base64');
  }
}

export async function launchChrome({ width = 700, height = 1000, deviceScaleFactor = 1 } = {}) {
  const executable = findChrome();
  const profile = mkdtempSync(join(tmpdir(), 'aes-cdp-'));
  const child = spawn(executable.path, [
    ...(executable.shell ? [] : ['--headless=new']),
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${deviceScaleFactor}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-lcd-text',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
    'about:blank',
  ], { ...HEADLESS_CHILD_OPTIONS, stdio: ['ignore', 'pipe', 'pipe'] });

  // headless Chrome 把实际端口写在 stderr 的 DevTools listening 行上。
  const port = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`Chromium 启动超时: ${buffer.slice(0, 400)}`)), 30_000);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      buffer += chunk;
      const match = buffer.match(/ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.on('error', reject);
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chromium 退出 ${code}: ${buffer.slice(0, 400)}`)); });
  });

  const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new Error('CDP 未返回可用 page target');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const session = new CdpSession(socket);
  // 控制台错误与未捕获异常必须真实采集：靠页面里自己挂的全局变量做断言等于没断言。
  const consoleErrors = [];
  session.on('Runtime.consoleAPICalled', (params) => {
    if (params.type !== 'error') return;
    consoleErrors.push((params.args || []).map((arg) => arg.value ?? arg.description ?? arg.type).join(' '));
  });
  session.on('Runtime.exceptionThrown', (params) => {
    consoleErrors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'uncaught');
  });
  await session.send('Page.enable');
  await session.send('Runtime.enable');
  await session.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor, mobile: false,
  });
  // 动画会让截图不稳定；对照物本身也是在 reduce 下取的证据。
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  return {
    session,
    executable: executable.path,
    browserVersion: version.Browser,
    userAgent: version['User-Agent'],
    deviceScaleFactor,
    consoleErrors,
    takeConsoleErrors() { return consoleErrors.splice(0, consoleErrors.length); },
    async setViewport(next) {
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: next.width, height: next.height, deviceScaleFactor, mobile: false,
      });
    },
    async goto(url) {
      const loaded = new Promise((resolve) => session.on('Page.loadEventFired', resolve));
      await session.send('Page.navigate', { url });
      await loaded;
      await session.evaluate('document.fonts.ready.then(() => true)');
      // 布局与字体就绪后再多让一帧，避免首帧过渡入镜。
      await session.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
    },
    async close() {
      try { socket.close(); } catch { /* 已关闭 */ }
      child.kill();
      await wait(120);
      rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    },
  };
}

// ------------------------------------------------------------------ PNG 解码与 diff

// 只支持自己截出来的 PNG：8-bit RGBA、无隔行。够用，且不引入依赖。
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let offset = 8;
  let width = 0; let height = 0; let bitDepth = 0; let colorType = 0; let interlace = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) {
    throw new Error(`不支持的 PNG 格式: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let position = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[position++];
    const line = raw.subarray(position, position + stride);
    position += stride;
    const target = pixels.subarray(row * stride, (row + 1) * stride);
    const previous = row ? pixels.subarray((row - 1) * stride, row * stride) : null;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? target[index - channels] : 0;
      const up = previous ? previous[index] : 0;
      const upLeft = previous && index >= channels ? previous[index - channels] : 0;
      let value = line[index];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upLeft);
        value += (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
      }
      target[index] = value & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

// 逐像素比较，返回不同像素数与最大通道差。tolerance 吸收抗锯齿的 ±1 抖动。
export function diffPng(aBuffer, bBuffer, { tolerance = 2 } = {}) {
  const a = decodePng(aBuffer);
  const b = decodePng(bBuffer);
  if (a.width !== b.width || a.height !== b.height) {
    return { comparable: false, reason: `尺寸不同: ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  let different = 0;
  let maxDelta = 0;
  const total = a.width * a.height;
  for (let index = 0; index < total; index += 1) {
    const aOffset = index * a.channels;
    const bOffset = index * b.channels;
    let delta = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      delta = Math.max(delta, Math.abs(a.pixels[aOffset + channel] - b.pixels[bOffset + channel]));
    }
    if (delta > tolerance) different += 1;
    maxDelta = Math.max(maxDelta, delta);
  }
  return {
    comparable: true,
    width: a.width,
    height: a.height,
    totalPixels: total,
    differentPixels: different,
    ratio: different / total,
    maxDelta,
  };
}
