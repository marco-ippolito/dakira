import { Result } from "@orama/orama";
import { DakiraNode } from "../../src/traverse";

export function removeIdFromNodes(nodes: DakiraNode[] = []) {
	return nodes.map((node) => {
		node.parentId = "";
		node.nodeId = "";
		return node;
	});
}

export function removeIdFromDocument(
	doc: Result = {
		id: "",
		document: {},
		score: 0,
	},
) {
	doc.id = "";
	doc.document.parentId = "";
	doc.document.nodeId = "";
	return doc;
}
