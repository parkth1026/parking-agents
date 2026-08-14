// stats.mjs — 统计口径（官方 aggregate_benchmark 口径移植）
// mean/stddev（样本方差 n-1）/min/max，round 4；空列表全 0。

export function calcStats(values) {
  if (!values || values.length === 0) {
    return { mean: 0.0, stddev: 0.0, min: 0.0, max: 0.0 };
  }
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let stddev = 0.0;
  if (n > 1) {
    const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
    stddev = Math.sqrt(variance);
  }
  return {
    mean: round4(mean),
    stddev: round4(stddev),
    min: round4(Math.min(...values)),
    max: round4(Math.max(...values)),
  };
}

export function round4(x) {
  return Math.round(x * 10000) / 10000;
}
