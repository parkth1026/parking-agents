// 现行优惠规则：满 300 减 40。member 字段目前未参与计算。
export function finalPrice(cart) {
  const total = cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return total >= 300 ? total - 40 : total;
}
