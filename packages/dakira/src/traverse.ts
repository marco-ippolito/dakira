import { Node, VariableDeclaration } from "@babel/types";
import { randomUUID } from "node:crypto";

type KeysOfUnion<T> = T extends T ? keyof T : never;
type NodeKey = KeysOfUnion<Node>;

export const fieldsToTraverse: NodeKey[] = [
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

export type DakiraNode = Record<NodeKey, unknown> & {
	nodeId: string;
	field: string;
	parentType?: string;
	parentId?: string;
	root?: boolean;
};

const fieldsToPick: NodeKey[] = ["name", "kind", "value", "type", "loc"];

export function traverse(
	node: Node,
	results: DakiraNode[],
	parentId?: string,
	parentType?: Node["type"],
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
			accumulator[field] = node[field as keyof Node];
		}
	}

	const { type } = accumulator;

	let kindInheritable = kindInherited;
	if (type === "VariableDeclaration") {
		kindInheritable = accumulator.kind as VariableDeclaration["kind"];
	} else if (kindInherited) {
		accumulator.kind = kindInherited;
	}

	results.push(accumulator as DakiraNode);

	for (const field of fieldsToTraverse) {
		const child = node[field as keyof Node] as unknown as Node;
		if (child) {
			if (Array.isArray(child)) {
				for (const el of child) {
					traverse(
						el,
						results,
						nodeId,
						type as Node["type"],
						field,
						kindInheritable,
					);
				}
			} else {
				traverse(
					child,
					results,
					nodeId,
					type as Node["type"],
					field,
					kindInheritable,
				);
			}
		}
	}
}
