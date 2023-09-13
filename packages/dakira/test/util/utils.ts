import { DakiraNode } from "../../src/traverse";

export function removeIdFromNodes(nodes: DakiraNode[]) {
	return nodes.map((node) => {
		node.parentId = "";
		node.nodeId = "";
		return node;
	});
}
