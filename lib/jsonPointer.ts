/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

import { jsonPointerParse as _parse } from "./jsonPointerParse";

interface FindContext {
	(index: number, a: any[], context: any): number;
}

export interface Pointer {
	target: any;
	key: string | number | undefined;
}

// http://tools.ietf.org/html/rfc6901#page-2
const separator = "/";
const separatorRx = /\//g;
const encodedSeparator = "~1";
const encodedSeparatorRx = /~1/g;

const escapeChar = "~";
const escapeRx = /~/g;
const encodedEscape = "~0";
const encodedEscapeRx = /~0/g;

/**
 * Find the parent of the specified path in x and return a descriptor
 * containing the parent and a key.  If the parent does not exist in x,
 * return undefined, instead.
 * @param {object|array} x object or array in which to search
 * @param {string} path JSON Pointer string (encoded)
 * @param {?function(index:Number, array:Array, context:object):Number} findContext
 *  optional function used adjust array indexes for smarty/fuzzy patching, for
 *  patches containing context.  If provided, context MUST also be provided.
 * @param {?{before:Array, after:Array}} context optional patch context for
 *  findContext to use to adjust array indices.  If provided, findContext MUST
 *  also be provided.
 * @returns {{target:object|array|number|string, key:string}|undefined}
 */
export function find(x: any, path: string, findContext?: FindContext, context?: any) {
	if (typeof path !== "string") {
		return;
	}

	if (path === "") {
		// whole document
		return { target: x, key: void 0 };
	}

	if (path === separator) {
		return { target: x, key: "" };
	}

	var parent = x,
		key;
	var hasContext = context !== void 0;

	_parse(path, function(segment) {
		// hm... this seems like it should be if(typeof x === 'undefined')
		if (x == null) {
			// Signal that we prematurely hit the end of the path hierarchy.
			parent = null;
			return false;
		}

		if (Array.isArray(x)) {
			key = hasContext
				? findIndex(findContext, parseArrayIndex(segment), x, context)
				: segment === "-"
					? segment
					: parseArrayIndex(segment);
		} else {
			key = segment;
		}

		parent = x;
		x = x[key];

		return true;
	});

	return parent === null ? void 0 : { target: parent, key: key };
}

export function absolute(path: string) {
	return path[0] === separator ? path : separator + path;
}

export function join(segments: string[]) {
	return segments.join(separator);
}

export function parse(path: string) {
	const segments: string[] = [];
	_parse(path, segments.push.bind(segments));
	return segments;
}

export function contains(a: string, b: string) {
	return b.indexOf(a) === 0 && b[a.length] === separator;
}

/**
 * Decode a JSON Pointer path segment
 * @see http://tools.ietf.org/html/rfc6901#page-3
 * @param {string} s encoded segment
 * @returns {string} decoded segment
 */
export function decodeSegment(s: string) {
	// See: http://tools.ietf.org/html/rfc6901#page-3
	return s
		.replace(encodedSeparatorRx, separator)
		.replace(encodedEscapeRx, escapeChar);
}

/**
 * Encode a JSON Pointer path segment
 * @see http://tools.ietf.org/html/rfc6901#page-3
 * @param {string} s decoded segment
 * @returns {string} encoded segment
 */
export function encodeSegment(s: string) {
	return s
		.replace(escapeRx, encodedEscape)
		.replace(separatorRx, encodedSeparator);
}

const arrayIndexRx = /^(0|[1-9]\d*)$/;

/**
 * Return true if s is a valid JSON Pointer array index
 * @param {String} s
 * @returns {boolean}
 */
export function isValidArrayIndex(s: string) {
	return arrayIndexRx.test(s);
}

/**
 * Safely parse a string into a number >= 0. Does not check for decimal numbers
 * @param {string} s numeric string
 * @returns {number} number >= 0
 */
export function parseArrayIndex(s: string) {
	if (isValidArrayIndex(s)) {
		return +s;
	}

	throw new SyntaxError("invalid array index " + s);
}

function findIndex(findContext: FindContext | undefined, start: number, array, context) {
	let index = start;

	if (index < 0) {
		throw new Error("array index out of bounds " + index);
	}

	if (context !== void 0 && typeof findContext === "function") {
		index = findContext(start, array, context);
		if (index < 0) {
			throw new Error("could not find patch context " + context);
		}
	}

	return index;
}
