/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */
/** @author Michael Yoon */

const parseRx = /\/|~1|~0/g;
const separator = "/";
const escapeChar = "~";
const encodedSeparator = "~1";

/**
 * Parse through an encoded JSON Pointer string, decoding each path segment
 * and passing it to an onSegment callback function.
 * @see https://tools.ietf.org/html/rfc6901#section-4
 * @param {string} path encoded JSON Pointer string
 * @param {{function(segment:string):boolean}} onSegment callback function
 * @returns {string} original path
 */
export function jsonPointerParse(
	path: string,
	onSegment: (segment: string) => boolean
) {
	let pos = path.charAt(0) === separator ? 1 : 0;
	let accum = "";
	let matches: RegExpExecArray | null;
	parseRx.lastIndex = pos;

	while ((matches = parseRx.exec(path))) {
		const match = matches[0];
		accum += path.slice(pos, parseRx.lastIndex - match.length);
		pos = parseRx.lastIndex;

		if (match === separator) {
			if (onSegment(accum) === false) return path;
			accum = "";
		} else {
			accum += match === encodedSeparator ? separator : escapeChar;
		}
	}

	accum += path.slice(pos);
	onSegment(accum);

	return path;
}
