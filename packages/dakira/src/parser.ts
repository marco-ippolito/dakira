import { ParserOptions, parse } from "@babel/parser";
import { lstat, readFile, readdir } from "node:fs/promises";
import { DakiraNode, traverse } from "./traverse.js";

const DEFAULT_SETTINGS = {
	errorRecovery: true,
};

export async function isDirectory(path: string): Promise<boolean> {
	const stat = await lstat(path);
	return stat.isDirectory();
}

export async function read(
	path: string,
	parseOpts: ParserOptions = {},
): Promise<DakiraNode[]> {
	const settings = { ...DEFAULT_SETTINGS, ...parseOpts };
	const isDir = await isDirectory(path);
	if (!isDir) {
		const nodes = await parseFile(path, settings);
		return nodes;
	}
	const output: DakiraNode[] = [];
	await parseFilesRecursively(path, output, settings);
	return output;
}

export async function parseFilesRecursively(
	path: string,
	output: DakiraNode[],
	parseOpts: ParserOptions,
) {
	const items = await readdir(path, { withFileTypes: true });

	for (const item of items) {
		const subpath = `${path}/${item.name}`;
		if (item.isDirectory()) {
			await parseFilesRecursively(subpath, output, parseOpts);
		} else {
			const nodes = await parseFile(subpath, parseOpts);
			output.push(...nodes);
		}
	}
}

export async function parseFile(path: string, parseOpts: ParserOptions) {
	const file = await readFile(path, { encoding: "utf-8" });
	// root node we convert it to Node
	const ast = parse(file, {
		...parseOpts,
		sourceFilename: path,
	});
	const result: DakiraNode[] = [];
	traverse(ast, result);
	return result;
}
