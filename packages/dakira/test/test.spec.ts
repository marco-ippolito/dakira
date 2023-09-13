import { test, expect } from "bun:test";
import { read } from "../src/parser";
import { removeIdFromNodes } from "./util/utils";

test("read fixture javascript file", async () => {
	const res = await read(
		`${import.meta.dir}/fixtures/javascript/fixture.js`,
		{},
	);
	expect(removeIdFromNodes(res)).toMatchSnapshot();
});
