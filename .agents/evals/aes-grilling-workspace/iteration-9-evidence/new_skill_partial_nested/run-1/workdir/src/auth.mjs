// 已登记的上报方。新增业务方走发版，不走配置。
const REGISTERED = new Set([
  'web-portal',
  'web-admin',
  'ios-app',
  'android-app',
  'crm-sync',
  'billing-worker',
  'loadtest-runner',
  'loadtest-soak',
]);

export function isRegistered(appId) {
  return typeof appId === 'string' && REGISTERED.has(appId);
}

export function listRegistered() {
  return [...REGISTERED].sort();
}
