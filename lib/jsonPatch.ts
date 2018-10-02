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
	fromContext?: any;
}

export enum OpType {
	Test = "test",
	Add = "add",
	Remove = "remove",
	Replace = "replace",
	Move = "move",
	Copy = "copy"
}


export function defaultHash(x: any) {
	return isValidObject(x) || isArray(x) ? JSON.stringify(x) : x;
}

export function isValidObject(x: any) {
	return x != null && Object.prototype.toString.call(x) === "[object Object]";
}

export { clone } from './clone';

function isArray(x: any[]) {
	return Object.prototype.toString.call(x) === "[object Array]";
}
