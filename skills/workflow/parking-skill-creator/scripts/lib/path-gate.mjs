// path-gate.mjs — 机器盘树出厂门禁（2026-09-11 绝对路径审计的系统性对策）。
// 分发件 .md/.mjs 不得携带本机真实工程树绝对路径（个人 GIT 树、异机 GIT_dev、
// 用户配置树、UE 工作区/引擎树）。豁免口径：占位符（… / <user> / <你的用户名>）、
// 刻意省略的示例（...）、带降级句的设计内引用（「文件不存在时跳过」）。
// fixtures* 语料目录不入扫描（冻结语料记录当时素材路径是本分）。
// run-tests.mjs 自检与 quick-validate.mjs 出厂校验共用此单源。
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const MACHINE_TREE = new RegExp(
  "(?:[A-Za-z]:[\\\\/])?" +
  "(?:" +
  "GIT[\\\\/]AI_WorkFlow(?=[\\\\/_]|$)" +
  "|GIT_dev(?=[\\\\/]|$)" +
  "|(?:Users|Documents and Settings)[\\\\/][^\\\\/\\s]+[\\\\/](?:AppData|\\.claude|\\.agents|\\.zcode|\\.config|memory)(?=[\\\\/]|$)" +
  "|ws_[A-Za-z0-9]+_ci" +
  "|Epic[\\\\/]UE_" +
  ")",
  "i"
);
const EXEMPT_LINE = /不存在时跳过|\.\.\.|…|<user>|<你的用户名>/;
// 溯源载体豁免：迭代记录（design.md）、证据文档（evidence*/*report*）记录当时环境是本分，
// 不属于功能面泄漏（2026-09-11 审计裁决口径）。
const PROVENANCE_DOC = /(?:^|\/)references\/(?:design|evidence[^/]*|[^/]*report[^/]*)\.md$/i;

export function machineTreeOffenders(skillDir) {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && (/^fixtures/.test(e.name) || e.name === "node_modules" || e.name === "eval-graders")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(md|mjs)$/.test(e.name)) continue;
      const rel = relative(skillDir, p).replaceAll("\\", "/");
      // run-tests.mjs 豁免：门禁正例夹具必然内含真实签名才能测门禁本身（自指），测试载体同夹具类。
      // eval-graders 豁免：冻结的零漂移评分尺（如 karpathy v2），改动会毁其证据效力，硬编码属其年代。
      if (PROVENANCE_DOC.test("/" + rel) || /(^|\/)run-tests\.mjs$/.test(rel)) continue;
      readFileSync(p, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (EXEMPT_LINE.test(line)) return;
        const m = line.match(MACHINE_TREE);
        if (m) out.push(`${rel}:${i + 1} ${m[0]}`);
      });
    }
  })(skillDir);
  return out;
}
