import { ParserOptions, parse } from "@babel/parser";
import { lstat, readFile, readdir } from "node:fs/promises";
import { DakiraNode, GenericBabelNode, traverse } from "./traverse.js";

export async function isDirectory(path: string): Promise<boolean> {
	const stat = await lstat(path);
	return stat.isDirectory();
}

export async function read(
	path: string,
	parseOpts: ParserOptions,
): Promise<DakiraNode[] | undefined> {
	try {
		const isDir = await isDirectory(path);
		if (!isDir) {
			const nodes = await parseFile(path, parseOpts);
			return nodes;
		}
		const output: DakiraNode[] = [];
		await parseFilesRecursively(path, output, parseOpts);
		return output;
	} catch (error) {
		console.log(error);
	}
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
	// root node we convert it to GenericBabelNode
	const ast = parse(file, parseOpts) as unknown as GenericBabelNode;
	const result: DakiraNode[] = [];
	traverse(ast, result);
	return result;
}
