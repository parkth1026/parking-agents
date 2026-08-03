#!/usr/bin/env node
/**
 * Keep the version in lockstep across every platform manifest.
 *
 * Each platform has its own manifest, and a manifest that misses a bump ships a
 * stale version to that platform's users. Registering a manifest in
 * .version-bump.json is what makes it participate.
 *
 * Upstream superpowers implements this in bash with jq. This repo is
 * Windows-first and jq is not present in Git Bash, so it is Node instead —
 * matching the rest of the tooling, which is already .mjs.
 *
 * Usage:
 *   node scripts/bump-version.mjs <version>   set every registered field
 *   node scripts/bump-version.mjs --check     report drift between registered fields
 *   node scripts/bump-version.mjs --audit     find files carrying a version but NOT registered
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(repoRoot, ".version-bump.json");

let config;
try {
	config = JSON.parse(readFileSync(configPath, "utf8"));
} catch {
	console.error(`error: cannot read ${configPath}`);
	process.exit(1);
}

const toPosix = (p) => p.replace(/\\/g, "/");

/** Resolve a dotted path with numeric indices, e.g. "plugins.0.version". */
function getField(obj, field) {
	return field.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function setField(obj, field, value) {
	const keys = field.split(".");
	const last = keys.pop();
	const parent = keys.reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
	if (parent == null) throw new Error(`path '${field}' does not exist`);
	parent[last] = value;
}

const entries = config.files.map((f) => ({ ...f, full: join(repoRoot, f.path) }));
const mode = process.argv[2];

// --- --check -----------------------------------------------------------------

if (mode === "--check") {
	const versions = new Set();
	let problems = 0;

	for (const e of entries) {
		let json;
		try {
			json = JSON.parse(readFileSync(e.full, "utf8"));
		} catch {
			console.log(`MISSING  ${e.path} (registered but unreadable)`);
			problems++;
			continue;
		}
		const v = getField(json, e.field);
		if (v == null || v === "") {
			console.log(`EMPTY    ${e.path} :: ${e.field}`);
			problems++;
			continue;
		}
		console.log(`  ${`${e.path} :: ${e.field}`.padEnd(46)} ${v}`);
		versions.add(v);
	}

	if (versions.size > 1) {
		console.log(`\nDRIFT: registered manifests disagree: ${[...versions].join(", ")}`);
		process.exit(1);
	}
	if (problems > 0) process.exit(1);
	console.log(`\nOK — all registered manifests agree on ${[...versions][0]}`);
	process.exit(0);
}

// --- --audit -----------------------------------------------------------------
// A new manifest that carries a version but was never registered will silently
// ship a stale version forever. This finds those.

if (mode === "--audit") {
	const current = getField(JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")), "version");
	if (!current) {
		console.error("error: cannot read current version from package.json");
		process.exit(1);
	}

	const registered = new Set(entries.map((e) => toPosix(e.path)));
	const excludes = new Set([...(config.audit?.exclude ?? []), ".git", "node_modules"]);

	const hits = [];
	(function walk(dir) {
		for (const name of readdirSync(dir)) {
			if (excludes.has(name)) continue;
			const p = join(dir, name);
			if (statSync(p).isDirectory()) {
				walk(p);
			} else if (name.endsWith(".json")) {
				const rel = toPosix(relative(repoRoot, p));
				if (excludes.has(rel) || registered.has(rel)) continue;
				if (readFileSync(p, "utf8").includes(current)) hits.push(rel);
			}
		}
	})(repoRoot);

	if (hits.length > 0) {
		for (const h of hits) {
			console.log(`UNREGISTERED  ${h} carries version ${current} but is not in .version-bump.json`);
		}
		process.exit(1);
	}
	console.log(`OK — no unregistered files carry version ${current}`);
	process.exit(0);
}

// --- set version --------------------------------------------------------------

const newVersion = mode;
if (!newVersion) {
	console.error("usage: node scripts/bump-version.mjs <version> | --check | --audit");
	process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[A-Za-z0-9.]+)?$/.test(newVersion)) {
	console.error(`error: '${newVersion}' is not a semver version`);
	process.exit(1);
}

for (const e of entries) {
	let json;
	try {
		json = JSON.parse(readFileSync(e.full, "utf8"));
	} catch {
		console.error(`error: registered file ${e.path} not found or invalid`);
		process.exit(1);
	}
	setField(json, e.field, newVersion);
	writeFileSync(e.full, `${JSON.stringify(json, null, 2)}\n`);
	console.log(`  ${`${e.path} :: ${e.field}`.padEnd(46)} -> ${newVersion}`);
}

console.log(`\nBumped to ${newVersion}. Run '--audit' to check for unregistered manifests.`);
