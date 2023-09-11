import test from "node:test";
import { read } from "../src/parser";

test("read fixture javascript file", async (t) => {
	const res = await read("./test/fixtures/javascript/fixture.js");
	console.log(res);
});
