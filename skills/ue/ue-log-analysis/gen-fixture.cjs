// 一次性 fixture 生成器（跑完即弃）
const fs = require('fs');
const path = require('path');
const FX = path.join(__dirname, 'fixtures');
const pad = (n, w = 2) => String(n).padStart(w, '0');

// ---- struggle-freeze: 60fps 20 帧 → ~3fps 挣扎 8.3s → 冻结 + 心跳 ----
const lines = ['Log file open, 08/26/26 10:00:00'];
for (let i = 0; i < 20; i++) {
  const ms = i * 16;
  lines.push(`[2026.08.26-10.00.${pad(Math.floor(ms / 1000))}:${pad(ms % 1000, 3)}][${pad(i + 1, 3)}]LogTemp: render ok (${i + 1})`);
}
let f = 21;
for (let j = 0; j < 24; j++) {
  const t = 1000 + j * 333;
  lines.push(`[2026.08.26-10.00.${pad(Math.floor(t / 1000))}:${pad(t % 1000, 3)}][${pad(f, 3)}]LogTemp: slow frame (${f})`);
  f++;
}
const lastF = f - 1;
for (const t of [20000, 40000, 59000]) {
  lines.push(`[2026.08.26-10.00.${pad(t / 1000)}:000][${pad(lastF, 3)}]LogPixelStreaming51CloudSSOverGRPC: -> SS: KeepAlive`);
  lines.push('Data: 1787727147');
}
fs.writeFileSync(path.join(FX, 'fixture-struggle-freeze.log'), lines.join('\r\n') + '\r\n');

// ---- crash-loop 目录: 5 个等大小 6s 间隔死循环 + 2 个正常 ----
const dir = path.join(FX, 'crash-loop');
fs.mkdirSync(dir, { recursive: true });
const loopOpens = ['14:48:51', '14:48:57', '14:49:03', '14:49:09', '14:49:15'];
loopOpens.forEach((open, i) => {
  const secs = 51 + i * 6;
  const abslog = `D:/WDP/dev/Log/14-48-${secs}.log`;
  const body = [
    `Log file open, 08/26/26 ${open}`,
    "LogWindows: Failed to load 'aqProf.dll' (GetLastError=126)",
    `LogCsvProfiler: Display: Metadata set : commandline="" -TaskId=t000${i}-aaaa-bbbb -RenderOffScreen -GraphicsAdapter=6 -ABSLOG=${abslog}""`,
    'LogRHI: Using Default RHI: D3D12',
    'LogD3D12RHI: Found D3D12 adapter 6: Microsoft Basic Render Driver (VendorId: 1414',
    'LogD3D12RHI: Error: Failed to choose a D3D12 Adapter.',
    'LogD3D12RHI: Adapter was not found',
    'LogWindows: FPlatformMisc::RequestExit(1, HandleUnsupportedRHI.D3D12)',
    'LogCore: Engine exit requested (reason: Win RequestExit)',
  ];
  fs.writeFileSync(path.join(dir, `14-48-${secs}.log`), body.join('\r\n') + '\r\n');
});
fs.writeFileSync(path.join(dir, '14-13-00.log'), [
  'Log file open, 08/26/26 14:13:01',
  'LogCsvProfiler: Display: Metadata set : commandline="" -RenderOffScreen -GraphicsAdapter=2 -ABSLOG=D:/WDP/dev/Log/14-13-00.log""',
  '[2026.08.26-14.13.02:000][  0]LogInit: Display: Starting Game.',
  '[2026.08.26-15.00.00:000][812]LogPixelStreaming51CloudSSOverGRPC: -> SS: KeepAlive',
  'Data: 1787727147',
  '[2026.08.26-15.01.00:000][812]LogPixelStreaming51CloudSSOverGRPC: OnMessage: <- SS: pong',
  'Data: ',
].join('\r\n') + '\r\n');
fs.writeFileSync(path.join(dir, '14-13-00_2.log'), [
  'Log file open, 08/26/26 14:13:01',
  'LogCsvProfiler: Display: Metadata set : commandline="" -RenderOffScreen -GraphicsAdapter=3 -ABSLOG=D:/WDP/dev/Log/14-13-00_2.log""',
  '[2026.08.26-14.13.02:000][  0]LogInit: Display: Starting Game.',
  '[2026.08.26-14.20.00:000][300]LogWorld: BeginTearingDown',
  '[2026.08.26-14.20.01:000][301]LogExit: Exiting',
].join('\r\n') + '\r\n');
console.log('generated');
