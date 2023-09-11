import { ParseResult } from "@babel/parser";
import { File as BabelFile, Node as BabelNode } from "@babel/types";
import { randomUUID } from "node:crypto";

export type ParsedFile = ParseResult<BabelFile>;

export const fieldsToTraverse = [
	"body",
	"declarations",
	"arguments",
	"expressions",
	"quasis",
	"property",
	"object",
	"id",
	"init",
	"expression",
	"callee",
	"params",
	"key",
	"value",
	"left",
	"right",
	"program",
] as const;

interface BaseNode {
	nodeId: string;
	field: string;
	parentType?: string;
	parentId?: string;
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

type MagicType<U> = UnionToIntersection<U> extends infer O
	? { [K in keyof O]: O[K] }
	: never;

const fieldsToPick = ["name", "kind", "value", "type", "loc"] as const;

export type GenericBabelNode = Pick<
	MagicType<BabelNode>,
	typeof fieldsToPick[number] | typeof fieldsToTraverse[number]
>;

export type DakiraNode = BaseNode & GenericBabelNode;

export function traverse(
	node: GenericBabelNode,
	results: DakiraNode[],
	parentId?: string,
	parentType?: string,
	field?: string,
) {
	const nodeId = randomUUID();

	const accumulator: Partial<DakiraNode> = {
		nodeId,
		...(parentId && { parentId }),
		...(parentType && { parentType }),
		...(field && { field }),
	};

	for (const field of fieldsToPick) {
		if (node[field]) {
			accumulator[field] = node[field];
		}
	}

	results.push(accumulator as DakiraNode);

	const { type } = accumulator;

	for (const field of fieldsToTraverse) {
		const child = node[field] as GenericBabelNode;
		if (child) {
			if (Array.isArray(child)) {
				for (const el of child) {
					traverse(el, results, nodeId, type, field);
				}
			} else {
				traverse(child, results, nodeId, type, field);
			}
		}
	}
}
