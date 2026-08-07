export async function handle(event) {
  if (!event.amount || event.amount <= 0) {
    throw new Error('invalid amount');
  }
  // 省略：写下游台账系统，偶发网络抖动会抛错
}
