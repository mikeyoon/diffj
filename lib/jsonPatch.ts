/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

export type Operation =
	| TestOperation
	| AddOperation
	| RemoveOperation
	| ReplaceOperation
	| MoveOperation
	| CopyOperation;

export interface TestOperation {
	op: OpType.Test;
	path: string;
	context?: any;
	value: any;
}

export interface AddOperation {
	op: OpType.Add;
	path: string;
	context?: any;
	value: any;
}

export interface RemoveOperation {
	op: OpType.Remove;
	path: string;
	context?: any;
}

export interface ReplaceOperation {
	op: OpType.Replace;
	path: string;
	context?: any;
	value: any;
}

export interface MoveOperation {
	op: OpType.Move;
	path: string;
	context?: any;
	from: any;
	fromContext?: any;
}

export interface CopyOperation {
	op: OpType.Copy;
	path: string;
	context?: any;
	from: any;
}

export enum OpType {
	Test = "test",
	Add = "add",
	Remove = "remove",
	Replace = "replace",
	Move = "move",
	Copy = "copy"
}

import * as patches from './patches'; 
import { clone } from './clone';
import { InvalidPatchOperationError } from './InvalidPatchOperationError';

let defaultOptions = {};

/**
 * Apply the supplied JSON Patch to x
 * @param {array} changes JSON Patch
 * @param {object|array|string|number} x object/array/value to patch
 * @param {object} options
 * @param {function(index:Number, array:Array, context:object):Number} options.findContext
 *  function used adjust array indexes for smarty/fuzzy patching, for
 *  patches containing context
 * @returns {object|array|string|number} patched version of x. If x is
 *  an array or object, it will be mutated and returned. Otherwise, if
 *  x is a value, the new value will be returned.
 */
export function apply(changes: Operation | Operation[], x: any, options: any) {
	return applyInPlace(changes, clone(x), options);
}

export function applyInPlace(changes: Operation | Operation[], x: any, options: any) {
	if (!options) {
		options = defaultOptions;
	}

	// TODO: Consider throwing if changes is not an array
	if (!Array.isArray(changes)) {
		return x;
	}

	var patch, p;
	for (var i = 0; i < changes.length; ++i) {
		p = changes[i];
		patch = patches[p.op];

		if (patch === void 0) {
			throw new InvalidPatchOperationError("invalid op " + JSON.stringify(p));
		}

		x = patch.apply(x, p, options);
	}

	return x;
}

export function defaultHash(x) {
	return isValidObject(x) || isArray(x) ? JSON.stringify(x) : x;
}

export function isValidObject(x) {
	return x !== null && Object.prototype.toString.call(x) === "[object Object]";
}

export { clone } from './clone';

function isArray(x) {
	return Object.prototype.toString.call(x) === "[object Array]";
}
