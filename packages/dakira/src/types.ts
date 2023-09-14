import { ParserOptions } from "@babel/parser";

export interface DakiraOptions {
	path: string;
	extensions?: Array<SupportedExtensions>;
	parserOptions?: ParserOptions;
}

type SupportedExtensions = "js" | "ts";
