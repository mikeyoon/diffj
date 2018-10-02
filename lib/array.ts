/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */
/** @author Michael Yoon */

/**
 * Prepend x to a, without mutating a. Faster than a.unshift(x)
 * @param {*} x
 * @param {Array} a array-like
 * @returns {Array} new Array with x prepended
 */
export function cons<T>(x: T, a: ArrayLike<T>): ArrayLike<T> {
	const l = a.length;
	const b = new Array<T>(l + 1);
	b[0] = x;
	for (let i = 0; i < l; ++i) {
		b[i + 1] = a[i];
	}

	return b;
}

/**
 * Create a new Array containing all elements in a, except the first.
 *  Faster than a.slice(1)
 * @param {Array} a array-like
 * @returns {Array} new Array, the equivalent of a.slice(1)
 */
export function tail<T>(a: ArrayLike<T>): ArrayLike<T> {
	const l = a.length - 1;
	const b = new Array<T>(l);
	for (let i = 0; i < l; ++i) {
		b[i] = a[i + 1];
	}

	return b;
}

/**
 * Map any array-like. Faster than Array.prototype.map
 * @param {function} f
 * @param {Array} a array-like
 * @returns {Array} new Array mapped by f
 */
export function map<T, U>(f: (e: T) => U, a: ArrayLike<T>): ArrayLike<U> {
	const b = new Array<U>(a.length);
	for (var i = 0; i < a.length; ++i) {
		b[i] = f(a[i]);
	}
	return b;
}
