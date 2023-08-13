import { ParseResult } from "@babel/parser";
import { File as BabelFile } from "@babel/types";

export type ParsedFile = ParseResult<BabelFile>;

export type Node = unknown[];

export function traverse(node: ParsedFile): Node[] {
  return [];
}
