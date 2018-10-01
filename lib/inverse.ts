import { Operation, OpType } from "./jsonPatch";

import * as patches from './patches';

export function inverse(p: ReadonlyArray<Operation>) {
	var pr: Operation[] = [];
	let skip = 0;
	for (let i = p.length - 1; i >= 0; i -= skip) {
		skip = invertOp(pr, p[i], i, p);
	}

	return pr;
}

function invertOp(patch: Operation[], c: Operation, i: number, context: ReadonlyArray<Operation>) {
	switch (c.op) {
		case OpType.Add:
			return patches[c.op].inverse(patch, c, i, context);
		case OpType.Copy:
			return patches[c.op].inverse(patch, c, i, context);
		case OpType.Move:
			return patches[c.op].inverse(patch, c, i, context);
		case OpType.Remove:
			return patches[c.op].inverse(patch, c, i, context);
		case OpType.Replace:
			return patches[c.op].inverse(patch, c, i, context);
		case OpType.Test:
			return patches[c.op].inverse(patch, c, i, context);
		default:
			return 1;
	}
}
