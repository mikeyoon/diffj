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

import { find, parseArrayIndex, contains, Pointer } from "./jsonPointer";
import { clone } from "./clone";
import { deepEquals } from "./deepEquals";
import { commutePaths } from "./commutePaths";
import * as array from "./array";

import { TestFailedError } from "./TestFailedError";
import { InvalidPatchOperationError } from "./InvalidPatchOperationError";
import { PatchNotInvertibleError } from "./PatchNotInvertibleError";

export const test = {
	apply: applyTest,
	inverse: invertTest,
	commute: commuteTest
};

export const add = {
	apply: applyAdd,
	inverse: invertAdd,
	commute: commuteAddOrCopy
};

export const remove = {
	apply: applyRemove,
	inverse: invertRemove,
	commute: commuteRemove
};

export const replace = {
	apply: applyReplace,
	inverse: invertReplace,
	commute: commuteReplace
};

export const move = {
	apply: applyMove,
	inverse: invertMove,
	commute: commuteMove
};

export const copy = {
	apply: applyCopy,
	inverse: notInvertible,
	commute: commuteAddOrCopy
};

/**
 * Apply a test operation to x
 * @param {object|array} x
 * @param {object} test test operation
 * @throws {TestFailedError} if the test operation fails
 */

function applyTest(x: any, test: TestOperation, options: any) {
	let pointer = find(x, test.path, options.findContext, test.context);
	let value: any;

	if (pointer != null) {
		let target = pointer.target;
		let index: number;

		if (Array.isArray(target) && pointer.key != null) {
			index = parseArrayIndex(pointer.key);
			//index = findIndex(options.findContext, index, target, test.context);
			value = target[index];
		} else {
			value =
				pointer.key === void 0 ? pointer.target : pointer.target[pointer.key];
		}
	}

	if (!deepEquals(value, test.value)) {
		throw new TestFailedError("test failed " + JSON.stringify(test));
	}

	return x;
}

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

/**
 * Apply an add operation to x
 * @param {object|array} x
 * @param {object} change add operation
 */
function applyAdd(x: any, change: AddOperation, options: any) {
	var pointer = find(x, change.path, options.findContext, change.context);

	if (pointer == null || notFound(pointer)) {
		throw new InvalidPatchOperationError("path does not exist " + change.path);
	}

	if (change.value === void 0) {
		throw new InvalidPatchOperationError("missing value");
	}

	var val = clone(change.value);

	// If pointer refers to whole document, replace whole document
	if (pointer && pointer.key === void 0) {
		return val;
	}

	_add(pointer, val);
	return x;
}

function _add(pointer: Pointer, value: any) {
	var target = pointer.target;

	if (Array.isArray(target)) {
		// '-' indicates 'append' to array
		if (pointer.key === "-") {
			target.push(value);
		} else if (typeof pointer.key === 'number') {
			if (pointer.key > target.length) {
				throw new InvalidPatchOperationError(
					"target of add outside of array bounds"
				);
			} else if (Array.isArray(pointer.key)) {
				target.splice(pointer.key, 0, value);
			}
		}
	} else if (isValidObject(target) && pointer.key != null) {
		target[pointer.key] = value;
	} else {
		throw new InvalidPatchOperationError(
			"target of add must be an object or array " + pointer.key
		);
	}
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

/**
 * Apply a replace operation to x
 * @param {object|array} x
 * @param {object} change replace operation
 */
function applyReplace(x: any, change: ReplaceOperation, options: any) {
	var pointer = find(x, change.path, options.findContext, change.context);

	if (pointer == null || notFound(pointer) || missingValue(pointer)) {
		throw new InvalidPatchOperationError("path does not exist " + change.path);
	}

	if (change.value === void 0) {
		throw new InvalidPatchOperationError("missing value");
	}

	var value = clone(change.value);

	// If pointer refers to whole document, replace whole document
	if (pointer.key === void 0) {
		return value;
	}

	var target = pointer.target;

	if (Array.isArray(target)) {
		target[parseArrayIndex(pointer.key)] = value;
	} else {
		target[pointer.key] = value;
	}

	return x;
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

/**
 * Apply a remove operation to x
 * @param {object|array} x
 * @param {object} change remove operation
 */
function applyRemove(x: any, change: RemoveOperation, options: any) {
	var pointer = find(x, change.path, options.findContext, change.context);

	// key must exist for remove
	if (pointer == null || notFound(pointer) || pointer.key == null || pointer.target[pointer.key] === void 0) {
		throw new InvalidPatchOperationError("path does not exist " + change.path);
	}

	_remove(pointer);
	return x;
}

function _remove(pointer: Pointer) {
	var target = pointer.target;

	var removed;
	if (Array.isArray(target) && typeof pointer.key === 'string') {
		removed = target.splice(parseArrayIndex(pointer.key), 1);
		return removed[0];
	} else if (isValidObject(target) && pointer.key != null) {
		removed = target[pointer.key];
		delete target[pointer.key];
		return removed;
	} else {
		throw new InvalidPatchOperationError(
			"target of remove must be an object or array"
		);
	}
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

/**
 * Apply a move operation to x
 * @param {object|array} x
 * @param {object} change move operation
 */
function applyMove(x: any, change: MoveOperation, options: any) {
	if (contains(change.path, change.from)) {
		throw new InvalidPatchOperationError(
			"move.from cannot be ancestor of move.path"
		);
	}

	var pto = find(x, change.path, options.findContext, change.context);
	var pfrom = find(x, change.from, options.findContext, change.fromContext);

	if (pto != null && pfrom != null) {
		_add(pto, _remove(pfrom));
	}

	return x;
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

/**
 * Apply a copy operation to x
 * @param {object|array} x
 * @param {object} change copy operation
 */
function applyCopy(x: any, change: CopyOperation, options: any) {
	var pto = find(x, change.path, options.findContext, change.context);
	var pfrom = find(x, change.from, options.findContext, change.fromContext);

	if (pfrom == null || notFound(pfrom) || missingValue(pfrom)) {
		throw new InvalidPatchOperationError("copy.from must exist");
	}

	var target = pfrom.target;
	var value;

	if (pfrom.key != null) {
		if (Array.isArray(target)) {
			value = target[parseArrayIndex(pfrom.key)];
		} else {
			value = target[pfrom.key];
		}
	}

	if (pto != null) {
		_add(pto, clone(value));
	}

	return x;
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

function notFound(pointer: Pointer | undefined) {
	return pointer == null || (pointer.target == null && pointer.key !== void 0);
}

function missingValue(pointer: Pointer) {
	return pointer.key !== void 0 && pointer.target[pointer.key] === void 0;
}

/**
 * Return true if x is a non-null object
 * @param {*} x
 * @returns {boolean}
 */
function isValidObject(x: any) {
	return x !== null && typeof x === "object";
}
