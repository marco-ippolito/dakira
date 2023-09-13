import { Node, SourceLocation } from "@babel/types";
import { randomUUID } from "node:crypto";

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
];

export interface DakiraNode {
	nodeId: string;
	field: string;
	type: string;
	loc: SourceLocation;
	parentType?: string;
	parentId?: string;
	root?: boolean;
	name?: string;
	kind?: string;
	value?: string;
}

const fieldsToPick: Array<Partial<keyof DakiraNode>> = [
	"name",
	"kind",
	"value",
	"type",
	"loc",
];

export function traverse(
	node: Node,
	results: DakiraNode[],
	parentId?: string,
	parentType?: string,
	field?: string,
	kindInherited?: string,
) {
	const nodeId = randomUUID();

	const accumulator: Partial<DakiraNode> = {
		nodeId,
	};

	if (!parentId) {
		accumulator.root = true;
	} else {
		accumulator.parentId = parentId;
		accumulator.parentType = parentType;
		accumulator.field = field;
	}

	for (const field of fieldsToPick) {
		if (node[field as keyof Node]) {
			// @ts-ignore
			// I know node contains the fields I'm looking for and I'm sure its a keyof DakiraNode
			accumulator[field] = node[field as keyof Node];
		}
	}

	const { type } = accumulator;

	let kindInheritable = kindInherited;
	if (type === "VariableDeclaration") {
		kindInheritable = accumulator.kind;
	} else if (kindInherited) {
		accumulator.kind = kindInherited;
	}

	results.push(accumulator as DakiraNode);

	for (const field of fieldsToTraverse) {
		const child = node[field as keyof Node] as unknown as Node;
		if (child) {
			if (Array.isArray(child)) {
				for (const el of child) {
					traverse(el, results, nodeId, type, field, kindInheritable);
				}
			} else {
				traverse(child, results, nodeId, type, field, kindInheritable);
			}
		}
	}
}
