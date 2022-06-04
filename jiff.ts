/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */
/** @author Michael Yoon */

import * as lcs from "./lib/lcs";
import * as array from "./lib/array";
import * as inverse from "./lib/inverse";
import { encodeSegment } from "./lib/jsonPointer";
import { Operation, isValidObject, defaultHash, OpType } from "./lib/jsonPatch";

export { inverse };

// Errors
export { TestFailedError } from "./lib/TestFailedError";
export { PatchNotInvertibleError } from "./lib/PatchNotInvertibleError";

export interface PatchOptions {
	findContext?: (index: number, array: any[]) => number;
}

export interface DiffOptions {
	hash?: (x: any) => string | number;
	makeContext?: (index: number, array: any[]) => any;
	invertible?: boolean;
	allowShallow?: boolean;
}

interface State {
	patch: Operation[];
	hash: (x: any) => string | number;
	invertible: boolean;
	allowShallow: boolean;
	makeContext: (index: number, array: any[]) => any;
}

/**
 * Compute a JSON Patch representing the differences between a and b.
 * @param {object|array|string|number|null} a
 * @param {object|array|string|number|null} b
 * @param {?function|?object} options if a function, see options.hash
 * @param {?function(x:*):String|Number} options.hash used to hash array items
 *  in order to recognize identical objects, defaults to JSON.stringify
 * @param {?function(index:Number, array:Array):object} options.makeContext
 *  used to generate patch context. If not provided, context will not be generated
 * @returns {array} JSON Patch such that patch(diff(a, b), a) ~ b
 */
export function diff(a: any, b: any, options: DiffOptions) {
	return appendChanges(a, b, "", initState(options, [])).patch;
}

/**
 * Create initial diff state from the provided options
 * @param {?function|?object} options @see diff options above
 * @param {array} patch an empty or existing JSON Patch array into which
 *  the diff should generate new patch operations
 * @returns {object} initialized diff state
 */
function initState(options: DiffOptions, patch: Operation[]) {
	if (typeof options === "object") {
		return {
			patch: patch,
			hash: orElse(isFunction, options.hash, defaultHash),
			makeContext: orElse(isFunction, options.makeContext, defaultContext),
			invertible: !(options.invertible === false),
			allowShallow: !(options.allowShallow === false)
		};
	} else {
		return {
			patch: patch,
			hash: orElse(isFunction, options, defaultHash),
			makeContext: defaultContext,
			invertible: true,
			allowShallow: false
		};
	}
}

/**
 * Given two JSON values (object, array, number, string, etc.), find their
 * differences and append them to the diff state
 * @param {object|array|string|number|null} a
 * @param {object|array|string|number|null} b
 * @param {string} path
 * @param {object} state
 * @returns {Object} updated diff state
 */
function appendChanges(a: any, b: any, path: string, state: State) {
	if (Array.isArray(a) && Array.isArray(b)) {
		return appendArrayChanges(a, b, path, state);
	}

	if (isValidObject(a) && isValidObject(b)) {
		return appendObjectChanges(a, b, path, state);
	}

	return appendValueChanges(a, b, path, state);
}

/**
 * Given two objects, find their differences and append them to the diff state
 * @param {object} o1
 * @param {object} o2
 * @param {string} path
 * @param {object} state
 * @returns {Object} updated diff state
 */
function appendObjectChanges(o1: any, o2: any, path: string, state: State) {
	const o1Keys = Object.keys(o1);
	const o2Keys = Object.keys(o2);
	const patch = state.patch;

	// If there are too many keys, just shallow diff
	if (state.allowShallow && (o1Keys.length > 100 || o2Keys.length > 100)) {
		if (o1 !== o2) {
			if (o1Keys.length !== o2Keys.length || o1Keys.some((key) => o1[key] !== o2[key])) {
				state.patch.push({
					op: OpType.Replace,
					value: o2,
					path: path
				});
			}
		}

		return state;
	}

	// test all intersecting are equal, if not, then recursively compare
	for (let i = o2Keys.length - 1; i >= 0; --i) {
		const key = o2Keys[i];
		var keyPath = path + "/" + encodeSegment(key);
		if (key in o1 && o1[key] !== o2[key]) {
			appendChanges(o1[key], o2[key], keyPath, state);
		} else if (!(key in o1)) {
			// if the key doesn't exist in o1, then add
			patch.push({ op: OpType.Add, path: keyPath, value: o2[key] });
		}
	}

	// find all keys that are no longer present in o2 and remove them
	for (let i = o1Keys.length - 1; i >= 0; --i) {
		const key = o1Keys[i];
		if (!(key in o2)) {
			var p = path + "/" + encodeSegment(key);
			if (state.invertible) {
				patch.push({ op: OpType.Test, path: p, value: o1[key] });
			}
			patch.push({ op: OpType.Remove, path: p });
		}
	}

	return state;
}

/**
 * Given two arrays, find their differences and append them to the diff state
 * @param {array} a1
 * @param {array} a2
 * @param {string} path
 * @param {object} state
 * @returns {Object} updated diff state
 */
function appendArrayChanges(a1: any[], a2: any[], path: string, state: State) {
	if (state.allowShallow) {
		if (a1 !== a2) {
			if (a1.length !== a2.length || a1.some((val, i) => val !== a2[i])) {
				state.patch.push({
					op: OpType.Replace,
					value: a2,
					path: path
				});
			}
		}

		return state;
	}

	var a1hash = array.map(state.hash, a1);
	var a2hash = array.map(state.hash, a2);

	var lcsMatrix = lcs.compare(a1hash, a2hash);

	return lcsToJsonPatch(a1, a2, path, state, lcsMatrix);
}

/**
 * Transform an lcsMatrix into JSON Patch operations and append
 * them to state.patch, recursing into array elements as necessary
 * @param {array} a1
 * @param {array} a2
 * @param {string} path
 * @param {object} state
 * @param {object} lcsMatrix
 * @returns {object} new state with JSON Patch operations added based
 *  on the provided lcsMatrix
 */
function lcsToJsonPatch(
	a1: any[],
	a2: any[],
	path: string,
	state: State,
	lcsMatrix: lcs.LcsMatrix
) {
	var offset = 0;
	return lcs.reduce(
		function(state, op, i, j) {
			var last, context;
			var patch = state.patch;
			var p = path + "/" + (j + offset);

			if (op === lcs.REMOVE) {
				// Coalesce adjacent remove + add into replace
				last = patch[patch.length - 1];
				context = state.makeContext(j, a1);

				if (state.invertible) {
					patch.push({ op: OpType.Test, path: p, value: a1[j], context: context });
				}

				if (last !== void 0 && last.op === OpType.Add && last.path === p) {
					last.op = OpType.Replace;
					last.context = context;
				} else {
					patch.push({ op: OpType.Remove, path: p, context: context });
				}

				offset -= 1;
			} else if (op === lcs.ADD) {
				// See https://tools.ietf.org/html/rfc6902#section-4.1
				// May use either index===length *or* '-' to indicate appending to array
				patch.push({
					op: OpType.Add,
					path: p,
					value: a2[i],
					context: state.makeContext(j, a1)
				});

				offset += 1;
			} else {
				appendChanges(a1[j], a2[i], p, state);
			}

			return state;
		},
		state,
		lcsMatrix
	);
}

/**
 * Given two number|string|null values, if they differ, append to diff state
 * @param {string|number|null} a
 * @param {string|number|null} b
 * @param {string} path
 * @param {object} state
 * @returns {object} updated diff state
 */
function appendValueChanges(
	a: string | number | null,
	b: string | number | null,
	path: string,
	state: State
) {
	if (a !== b) {
		if (state.invertible) {
			state.patch.push({ op: OpType.Test, path: path, value: a });
		}

		state.patch.push({ op: OpType.Replace, path: path, value: b });
	}

	return state;
}

/**
 * @param {function} predicate
 * @param {*} x
 * @param {*} y
 * @returns {*} x if predicate(x) is truthy, otherwise y
 */
function orElse(predicate: (x: any) => boolean, x: any, y: any) {
	return predicate(x) ? x : y;
}

/**
 * Default patch context generator
 * @returns {undefined} undefined context
 */
function defaultContext() {
	return void 0;
}

/**
 * @param {*} x
 * @returns {boolean} true if x is a function, false otherwise
 */
function isFunction(x: any) {
	return typeof x === "function";
}
