import { test, expect } from "bun:test";
import { read } from "../src/parser";
import { removeIdFromDocument, removeIdFromNodes } from "./util/utils";
import { createIndex } from "../src/search";
import { search } from "@orama/orama";

test("read fixture javascript file", async () => {
	const res = await read(
		`${import.meta.dir}/fixtures/javascript/fixture.js`,
		{},
	);
	expect(removeIdFromNodes(res)).toMatchSnapshot();
});

test("search const", async () => {
	const db = await createIndex({
		path: `${import.meta.dir}/fixtures/javascript/fixture.js`,
	});

	const {
		hits: [classDeclaration],
	} = await search(db, {
		term: "sayHello",
		properties: ["name"],
		where: {
			parentType: "ClassDeclaration",
		},
	});

	expect(removeIdFromDocument(classDeclaration)).toMatchSnapshot();

	// find where SayHello Class is called
	const {
		hits: [classCalled],
	} = await search(db, {
		term: "sayHello",
		properties: ["name"],
		where: {
			parentType: "NewExpression",
		},
	});

	expect(removeIdFromDocument(classCalled)).toMatchSnapshot();

	// find where sayHello function is declared
	const {
		hits: [functionDeclaration],
	} = await search(db, {
		term: "sayHello",
		properties: ["name"],
		where: {
			parentType: "FunctionDeclaration",
		},
	});

	expect(removeIdFromDocument(functionDeclaration)).toMatchSnapshot();

	// find where sayHello function is called
	const {
		hits: [functionCalled],
	} = await search(db, {
		term: "sayHello",
		properties: ["name"],
		where: {
			parentType: "CallExpression",
		},
	});

	expect(removeIdFromDocument(functionCalled)).toMatchSnapshot();

	// find where sayHello class property is defined
	const {
		hits: [propertyDefinition],
	} = await search(db, {
		term: "sayHello",
		properties: ["name"],
		where: {
			parentType: "ClassProperty",
		},
	});
	expect(removeIdFromDocument(propertyDefinition)).toMatchSnapshot();

	// search a variable that is let
	const {
		hits: [greetLet],
	} = await search(db, {
		term: "greet",
		where: {
			parentType: "VariableDeclarator",
			kind: "let",
		},
	});

	expect(removeIdFromDocument(greetLet)).toMatchSnapshot();

	// filter variable that is const
	const {
		hits: [greetConst],
	} = await search(db, {
		term: "greet",
		where: {
			parentType: "VariableDeclarator",
			kind: "const",
		},
	});

	expect(removeIdFromDocument(greetConst)).toMatchSnapshot();
});
