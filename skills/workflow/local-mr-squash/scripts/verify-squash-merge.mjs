// verify-squash-merge.mjs — local-mr-squash 硬门禁（R3 最小形态）
//
// CLI 契约：
//   node verify-squash-merge.mjs <source-branch> [--keep]
//   退出码 0 = 四项全绿，合并算完成；1 = 有 FAIL（含用法错）。
//   用法错两态（均 exit 1，不输出四项检查）：未给 source；当前检出 == source
//   （门禁必须在目标分支的检出上运行，源检出上四项检查同义反复假绿）。
//   --keep = 显式跳过第 4 项（分支收口），用于「明知未收口仍放行」，
//            调用方必须把用了 --keep 这件事说进最终报告。
//
// 四项硬检查（零配置，任意 git 仓通用）：
//   1. 树净     — git status --porcelain 为空（无未提交/未跟踪残留）
//   2. 单笔     — HEAD 恰有一个父提交（非 merge commit，squash 形态）
//   3. 全包含   — git diff HEAD...<source> 为空（源分支内容已全部在 HEAD，
//                 顺带捕获「squash 后源分支又前进」的漂移）
//   4. 已收口   — 源分支 tip == HEAD（前滚到位）或分支已删；否则 FAIL
//
// 仅 Node 内置模块，无任何仓内配置依赖。

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const source = args.find((a) => !a.startsWith("--"));

if (!source) {
	console.error("用法: node verify-squash-merge.mjs <source-branch> [--keep]");
	process.exit(1);
}

const git = (...gitArgs) =>
	execFileSync("git", gitArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

// 前置校验（用法错）：门禁必须在目标分支的检出上运行。
// 在源分支检出上四项检查会同义反复假绿（合并前实测全绿 exit 0），必须拒绝。
try {
	const currentBranch = git("rev-parse", "--abbrev-ref", "HEAD").trim();
	if (currentBranch === source) {
		console.error(
			`用法错：当前检出就是源分支 ${source}——门禁必须在目标分支的检出上运行（源检出上四项检查同义反复假绿）`,
		);
		process.exit(1);
	}
} catch (error) {
	console.error(`FAIL  门禁无法执行：${error.message.split("\n")[0]}`);
	process.exit(1);
}

const results = [];
const check = (name, pass, failHint) => {
	results.push({ name, pass });
	console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : ` — ${failHint}`}`);
};

try {
	// 1. 树净
	const dirty = git("status", "--porcelain").trim();
	check(
		"树净（无未提交/未跟踪残留）",
		dirty === "",
		"提交或清理后重跑；merge --squash 的暂存内容必须先 commit",
	);

	// 2. 单笔（HEAD 非merge commit）
	const parents = git("rev-list", "--parents", "-n", "1", "HEAD").trim().split(/\s+/);
	check(
		"单笔提交（HEAD 非merge commit）",
		parents.length === 2,
		"HEAD 应为 squash 产生的普通提交（恰一个父提交）；true merge 会留下两个父提交",
	);

	// 3. 全包含（源内容已全在 HEAD）
	let contained = false;
	try {
		git("diff", "--quiet", `HEAD...${source}`);
		contained = true;
	} catch {
		contained = false;
	}
	check(
		`全包含（${source} 内容已全部进入 HEAD）`,
		contained,
		"git diff HEAD..." + source + " 非空：源分支有内容未并入，或 squash 后源分支又前进了",
	);

	// 4. 已收口（分支前滚到位或已删；--keep 显式跳过）
	if (keep) {
		console.log("SKIP  已收口（--keep 显式放行——必须写进合并报告）");
	} else {
		let branchExists = true;
		try {
			git("rev-parse", "--verify", "--quiet", `refs/heads/${source}`);
		} catch {
			branchExists = false;
		}
		if (!branchExists) {
			check(`已收口（${source} 已删除）`, true);
		} else {
			const srcTip = git("rev-parse", source).trim();
			const head = git("rev-parse", "HEAD").trim();
			check(
				`已收口（${source} tip == HEAD，前滚到位）`,
				srcTip === head,
				`收口三选一：git branch -f ${source} HEAD（未被 worktree 检出时）/ 在其 worktree 里 git reset --hard <target>（彼处树净且 tip 未前进）/ git branch -D ${source}（短命流，源被 worktree 检出时先拆该 worktree）；或 --keep 显式放行`,
			);
		}
	}
} catch (error) {
	console.error(`FAIL  门禁无法执行：${error.message.split("\n")[0]}`);
	process.exit(1);
}

const failed = results.filter((r) => !r.pass).length;
console.log(
	failed === 0
		? "门禁全绿：squash 合并收口完成。"
		: `门禁未过：${failed} 项 FAIL，按提示修复后重跑。`,
);
process.exit(failed === 0 ? 0 : 1);
