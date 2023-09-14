import { create, insertMultiple } from "@orama/orama";
import { read } from "./parser";
import { DakiraOptions } from "./types";

export async function createIndex(dakiraOptions: DakiraOptions) {
	const { path, parserOptions } = dakiraOptions;
	const nodes = await read(path, parserOptions);

	const db = await create({
		schema: {
			parentType: "string",
			parentId: "string",
			nodeId: "string",
			field: "string",
			name: "string",
			type: "string",
			kind: "string",
		},
	});

	await insertMultiple(db, nodes);
	return db;
}
