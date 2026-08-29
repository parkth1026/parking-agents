// #13: 所有 headless/background 子进程共用的 Windows 隐藏窗口策略。
// detached、stdio 重定向与 unref 只处理生命周期与 I/O；
// 只有 CREATE_NO_WINDOW（windowsHide: true）能阻止无控制台上下文里的子进程弹出可见控制台。
// 新增 spawn/spawnSync/execFile/execFileSync 启动点必须从这里取 options，
// selftest 的 windows-hide 域会机械扫描所有调用点。
export const HEADLESS_CHILD_OPTIONS = Object.freeze({ windowsHide: true });
