import { Operation, OpType } from "./jsonPatch";
import * as jsonPointer from "./jsonPointer";

/**
 * commute the patch sequence a,b to b,a
 * @param {object} a patch operation
 * @param {object} b patch operation
 */
export function commutePaths<LT extends Operation, RT extends Operation>(
	a: LT,
	b: RT
): [RT, LT] {
	// TODO: cases for special paths: '' and '/'
	const left = jsonPointer.parse(a.path);
	const right = jsonPointer.parse(b.path);
	const prefix = getCommonPathPrefix(left, right);
	const isArray = isArrayPath(left, right, prefix.length);

	// Never mutate the originals
	var ac = copyPatch(a);
	var bc = copyPatch(b);

	if (prefix.length === 0 && !isArray) {
		// Paths share no common ancestor, simple swap
		return [bc, ac];
	}

	if (isArray) {
		return commuteArrayPaths(ac, left, bc, right);
	} else {
		return commuteTreePaths(ac, left, bc, right);
	}
}

function commuteTreePaths<LT extends Operation, RT extends Operation>(
	a: LT,
	_left: any[],
	b: RT,
	_right: any[]
): [RT, LT] {
	if (a.path === b.path) {
		throw new TypeError(
			"cannot commute " + a.op + "," + b.op + " with identical object paths"
		);
	}
	// FIXME: Implement tree path commutation
	return [b, a];
}

/**
 * Commute two patches whose common ancestor (which may be the immediate parent)
 * is an array
 * @param a
 * @param left
 * @param b
 * @param right
 * @returns {*}
 */
function commuteArrayPaths<LT extends Operation, RT extends Operation>(
	a: LT,
	left: any[],
	b: RT,
	right: any[]
): [RT, LT] {
	if (left.length === right.length) {
		return commuteArraySiblings(a, left, b, right);
	}

	if (left.length > right.length) {
		// left is longer, commute by "moving" it to the right
		left = commuteArrayAncestor(b, right, a, left, -1);
		a.path = jsonPointer.absolute(jsonPointer.join(left));
	} else {
		// right is longer, commute by "moving" it to the left
		right = commuteArrayAncestor(a, left, b, right, 1);
		b.path = jsonPointer.absolute(jsonPointer.join(right));
	}

	return [b, a];
}

function isArrayPath(left: string[], right: string[], index: number) {
	return (
		jsonPointer.isValidArrayIndex(left[index]) &&
		jsonPointer.isValidArrayIndex(right[index])
	);
}

/**
 * Commute two patches referring to items in the same array
 * @param l
 * @param lpath
 * @param r
 * @param rpath
 * @returns {*[]}
 */
function commuteArraySiblings<LT extends Operation, RT extends Operation>(
	l: LT,
	lpath: any[],
	r: RT,
	rpath: any[]
): [RT, LT] {
	var target = lpath.length - 1;
	var lindex = +lpath[target];
	var rindex = +rpath[target];

	var commuted;

	if (lindex < rindex) {
		// Adjust right path
		if (l.op === "add" || l.op === "copy") {
			commuted = rpath.slice();
			commuted[target] = Math.max(0, rindex - 1);
			r.path = jsonPointer.absolute(jsonPointer.join(commuted));
		} else if (l.op === "remove") {
			commuted = rpath.slice();
			commuted[target] = rindex + 1;
			r.path = jsonPointer.absolute(jsonPointer.join(commuted));
		}
	} else if (r.op === "add" || r.op === "copy") {
		// Adjust left path
		commuted = lpath.slice();
		commuted[target] = lindex + 1;
		l.path = jsonPointer.absolute(jsonPointer.join(commuted));
	} else if (lindex > rindex && r.op === "remove") {
		// Adjust left path only if remove was at a (strictly) lower index
		commuted = lpath.slice();
		commuted[target] = Math.max(0, lindex - 1);
		l.path = jsonPointer.absolute(jsonPointer.join(commuted));
	}

	return [r, l];
}

/**
 * Commute two patches with a common array ancestor
 * @param l
 * @param lpath
 * @param r
 * @param rpath
 * @param direction
 * @returns {*}
 */
function commuteArrayAncestor(
	l: Operation,
	lpath: any[],
	_r: Operation,
	rpath: any[],
	direction: 1 | -1
) {
	// rpath is longer or same length

	var target = lpath.length - 1;
	var lindex = +lpath[target];
	var rindex = +rpath[target];

	// Copy rpath, then adjust its array index
	var rc = rpath.slice();

	if (lindex > rindex) {
		return rc;
	}

	if (l.op === OpType.Add || l.op === OpType.Copy) {
		rc[target] = Math.max(0, rindex - direction);
	} else if (l.op === OpType.Remove) {
		rc[target] = Math.max(0, rindex + direction);
	}

	return rc;
}

function getCommonPathPrefix(p1: string[], p2: string[]) {
	var p1l = p1.length;
	var p2l = p2.length;
	if (p1l === 0 || p2l === 0 || (p1l < 2 && p2l < 2)) {
		return [];
	}

	// If paths are same length, the last segment cannot be part
	// of a common prefix.  If not the same length, the prefix cannot
	// be longer than the shorter path.
	var l = p1l === p2l ? p1l - 1 : Math.min(p1l, p2l);

	var i = 0;
	while (i < l && p1[i] === p2[i]) {
		++i;
	}

	return p1.slice(0, i);
}

function copyPatch<T extends Operation>(p: T): T {
	const patch = p as Operation;

	if (patch.op === OpType.Remove) {
		return { op: patch.op, path: patch.path } as T;
	}

	if (patch.op === OpType.Copy || patch.op === OpType.Move) {
		return { op: patch.op, path: patch.path, from: patch.from } as T;
	}

	// test, add, replace
	return { op: patch.op, path: patch.path, value: patch.value } as T;
}
