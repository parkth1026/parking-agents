// parse-html.mjs — GitHub Trending 页解析。纯函数，无 IO，供 fetch-trending 与回归测试复用。
// 解析锚点（2026-09 固化于 fixtures/trending-weekly.html）：
//   每仓库一个 <article class="Box-row">…</article> 区块；
//   仓库链接 <h2 …><a … href="/owner/repo"；
//   总星数  href="/o/r/stargazers"…>​<svg…></svg> 41,614；
//   周增星  "N,NNN stars this week"；
//   语言    itemprop="programmingLanguage">JavaScript<
//   描述    <p class="col-9 …">…</p>
import { NAME_RE, parseNum, stripTags } from "./util.mjs";

export class ParseError extends Error {}

function one(re, block, what, fullName) {
  const m = re.exec(block);
  if (!m) throw new ParseError(`仓库 ${fullName ?? "(未知)"} 缺少 ${what}`);
  return m;
}

// 从 stargazers/forks 链接内容取数字：先截到 </a> 防回溯跨界，再剥 svg 标签防属性数字干扰
function linkNumber(block, fullName, kind) {
  const esc = fullName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`href="/${esc}/${kind}"[^>]*>([\\s\\S]*?)</a>`).exec(block);
  if (!m) return null;
  const text = m[1].replace(/<svg[\s\S]*?<\/svg>/g, "");
  const num = /([\d,]+)/.exec(text);
  if (!num) return null;
  const n = parseNum(num[1]);
  return Number.isSafeInteger(n) ? n : null;
}

export function parseTrending(html, expectedCount = 20) {
  if (!html.includes("Box-row")) {
    throw new ParseError('页面不含 Box-row 区块——trending 页面改版或返回了错误页（限流/登录墙）');
  }
  const blocks = html.match(/<article class="Box-row"[\s\S]*?<\/article>/g) ?? [];
  // 少于期望=页面异常/存档残缺，拒绝；多于期望（Wayback 存档常见 21-22 行）取前 N，
  // 与 live 榜单「取 top 20」语义一致
  if (blocks.length < expectedCount) {
    throw new ParseError(`解析到 ${blocks.length} 个仓库区块，少于期望的 ${expectedCount} 个——页面结构异常或存档残缺`);
  }
  const rows = blocks.slice(0, expectedCount);

  const repos = rows.map((block, i) => {
    const rank = i + 1;
    const h = one(/<h2[^>]*>\s*<a[^>]*href="\/([^"?]+)"/, block, "仓库标题链接");
    const fullName = h[1];
    if (!NAME_RE.test(fullName)) {
      throw new ParseError(`第 ${rank} 名仓库全名不合法: ${fullName}`);
    }
    const starsTotal = linkNumber(block, fullName, "stargazers");
    if (!(starsTotal > 0)) throw new ParseError(`仓库 ${fullName} 总星数解析失败`);
    const weekM = one(/([\d,]+) stars this week/, block, "周增星数", fullName);
    const starsWeek = parseNum(weekM[1]);
    if (!(starsWeek > 0)) throw new ParseError(`仓库 ${fullName} 周增星数解析失败: ${weekM[1]}`);

    const langM = /itemprop="programmingLanguage">([^<]+)</.exec(block);
    const descM = /<p class="col-9[^"]*">\s*([\s\S]*?)\s*<\/p>/.exec(block);
    const forks = linkNumber(block, fullName, "forks");

    return {
      rank,
      full_name: fullName,
      url: `https://github.com/${fullName}`,
      description: descM ? stripTags(descM[1]) : "",
      language: langM ? langM[1].trim() : null,
      stars_total: starsTotal,
      stars_week: starsWeek,
      forks: forks ?? null,
    };
  });
  return repos;
}
