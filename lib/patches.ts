import {
	Operation,
	OpType,
	TestOperation,
	AddOperation,
	MoveOperation,
	ReplaceOperation,
	RemoveOperation,
	CopyOperation
} from "./jsonPatch";


import { commutePaths } from "./commutePaths";
import * as array from "./array";

import { PatchNotInvertibleError } from "./PatchNotInvertibleError";

export const test = {
	inverse: invertTest,
	commute: commuteTest
};

export const add = {
	inverse: invertAdd,
	commute: commuteAddOrCopy
};

export const remove = {
	inverse: invertRemove,
	commute: commuteRemove
};

export const replace = {
	inverse: invertReplace,
	commute: commuteReplace
};

export const move = {
	inverse: invertMove,
	commute: commuteMove
};

export const copy = {
	inverse: notInvertible,
	commute: commuteAddOrCopy
};

/**
 * Invert the provided test and add it to the inverted patch sequence
 * @param pr
 * @param test
 * @returns {number}
 */
function invertTest(
	pr: Array<Operation>,
	test: TestOperation,
	_i: number,
	_context: ReadonlyArray<Operation>
): number {
	pr.push(test);
	return 1;
}

function commuteTest<T1 extends Operation, T2 extends Operation>(
	test: T1,
	b: T2
) {
	if (test.path === b.path && b.op === OpType.Remove) {
		throw new TypeError(
			"Can't commute test,remove -> remove,test for same path"
		);
	}

	if (b.op === "test" || b.op === OpType.Replace) {
		return [b, test];
	}

	return commutePaths(test, b);
}

function invertAdd(
	pr: Array<Operation>,
	add: AddOperation,
	_i: number,
	_c: ReadonlyArray<Operation>
) {
	let context = add.context;
	if (context !== void 0) {
		context = {
			before: context.before,
			after: array.cons(add.value, context.after)
		};
	}
	pr.push({
		op: OpType.Add,
		path: add.path,
		value: add.value,
		context: context
	});
	pr.push({ op: OpType.Remove, path: add.path, context: context });
	return 1;
}

function commuteAddOrCopy<A extends Operation, T extends Operation>(
	add: A,
	b: T
) {
	if (add.path === b.path && b.op === OpType.Remove) {
		throw new TypeError("Can't commute add,remove -> remove,add for same path");
	}

	return commutePaths(add, b);
}

function invertReplace(
	pr: Operation[],
	c: ReplaceOperation,
	i: number,
	patch: ReadonlyArray<Operation>
) {
	var prev = patch[i - 1];
	if (prev === void 0 || prev.op !== "test" || prev.path !== c.path) {
		throw new PatchNotInvertibleError("cannot invert replace w/o test");
	}

	var context = prev.context;
	if (context !== void 0) {
		context = {
			before: context.before,
			after: array.cons(prev.value, array.tail(context.after))
		};
	}

	pr.push({ op: OpType.Test, path: prev.path, value: c.value });
	pr.push({ op: OpType.Replace, path: prev.path, value: prev.value });
	return 2;
}

function commuteReplace<R extends Operation, T extends Operation>(
	replace: R,
	b: T
) {
	if (replace.path === b.path && b.op === "remove") {
		throw new TypeError(
			"Can't commute replace,remove -> remove,replace for same path"
		);
	}

	if (b.op === "test" || b.op === "replace") {
		return [b, replace];
	}

	return commutePaths(replace, b);
}

function invertRemove(
	pr: Operation[],
	c: RemoveOperation,
	i: number,
	patch: ReadonlyArray<Operation>
) {
	var prev = patch[i - 1];
	if (prev === void 0 || prev.op !== "test" || prev.path !== c.path) {
		throw new PatchNotInvertibleError("cannot invert remove w/o test");
	}

	var context = prev.context;
	if (context !== void 0) {
		context = {
			before: context.before,
			after: array.tail(context.after)
		};
	}

	pr.push({
		op: OpType.Add,
		path: prev.path,
		value: prev.value,
		context: context
	});
	return 2;
}

function commuteRemove<R extends Operation, T extends Operation>(
	remove: R,
	b: T
) {
	if (remove.path === b.path && b.op === OpType.Remove) {
		return [b, remove];
	}

	return commutePaths(remove, b);
}

function invertMove(
	pr: Operation[],
	c: MoveOperation,
	_i: number,
	_context: ReadonlyArray<Operation>
) {
	pr.push({
		op: OpType.Move,
		path: c.from,
		context: c.fromContext,
		from: c.path,
		fromContext: c.context
	});
	return 1;
}

function commuteMove<M extends Operation, T extends Operation>(move: M, b: T) {
	if (move.path === b.path && b.op === OpType.Remove) {
		throw new TypeError(
			"Can't commute move,remove -> move,replace for same path"
		);
	}

	return commutePaths(move, b);
}

// NOTE: Copy is not invertible
// See https://github.com/cujojs/jiff/issues/9
// This needs more thought. We may have to extend/amend JSON Patch.
// At first glance, this seems like it should just be a remove.
// However, that's not correct.  It violates the involution:
// invert(invert(p)) ~= p.  For example:
// invert(copy) -> remove
// invert(remove) -> add
// thus: invert(invert(copy)) -> add (DOH! this should be copy!)

function notInvertible(
	_: any,
	c: CopyOperation,
	_i: number,
	_context: ReadonlyArray<Operation>
): number {
	throw new PatchNotInvertibleError("cannot invert " + c.op);
}
