/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */
/** @author Michael Yoon */

/**
 * Create a deep copy of x which must be a legal JSON object/array/value
 * @param {object|array|string|number|null} x object/array/value to clone
 * @returns {object|array|string|number|null} clone of x
 */
export function clone<T>(x: Array<T>): Array<T>;
export function clone<T>(x: T): T;
export function clone<T>(x: T) {
	if(x == null || typeof x !== 'object') {
		return x;
	}

	if(Array.isArray(x)) {
		return cloneArray(x);
	}

	return cloneObject(x);
}

function cloneArray<T, U extends Array<T>>(x: U) {
	const l = x.length;
	let y = new Array<T>(l);

	for (var i = 0; i < l; ++i) {
		y[i] = clone(x[i]);
	}

	return y;
}

function cloneObject<T>(x: T) {
	const keys = Object.keys(x);
	let y = {} as T;

	for (let k: keyof T, i = 0, l = keys.length; i < l; ++i) {
		k = keys[i] as keyof T;
		y[k] = clone(x[k]);
	}

	return y;
}
