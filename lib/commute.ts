import { Operation, OpType } from "./jsonPatch";

import * as patches from "./patches";

type CommutedPair = [Array<Operation>, Array<Operation>];

/**
 * Given adjacent patch pair p1,p2, commute them to create a new
 * adjacent pair p2',p1'
 * @param {array} p1 JSON Patch
 * @param {array} p2 JSON Patch
 * @returns {array<array>} pair [commutedRight, commutedLeft]
 */
export function commute(
	p1: Array<Operation>,
	p2: Array<Operation>
): CommutedPair {
	return p1.reduceRight(
		function(a, patch) {
			const commuted = commuteOneFully(patch, a[1]);
			a[0].unshift(commuted[0]);
			const b = [a[0], commuted[1]] as CommutedPair;
			return b;
		},
		[[], p2] as CommutedPair
	);
}

function commuteOneFully<T extends Operation>(op: T, p: Array<Operation>) {
	return p.reduce(
		function(a, p) {
			var commuted = commuteOne(a[0], p);
			a[0] = commuted[1];
			a[1].push(commuted[0]);
			return a;
		},
		[op, []] as [T | Operation, Operation[]]
	);
}
/**
 * Commute left and right and return only the newly commuted left, throwing
 * away the newly commuted right.
 * @param p1
 * @param p2
 * @returns {*}
 */
export function commuteRtL(p1, p2) {
	return p2.reduce(function(accum, p2) {
		accum.push(
			p1.reduceRight(function(p2c, p1) {
				return commuteOne(p1, p2c)[0];
			}, p2)
		);
		return accum;
	}, []);
}

function commuteOne<LT extends Operation, RT extends Operation>(p1: LT, p2: RT) {
	const patch = patches[p2.op];
	if (patch === void 0 || typeof patch.commute !== "function") {
		throw new TypeError("patches cannot be commuted");
	}

	return patch.commute(p1, p2);
}
