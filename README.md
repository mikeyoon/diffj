# JSON Diff

Originally forked from: https://github.com/cujojs/jiff

diffj generates [JSON Patch RFC6902](https://tools.ietf.org/html/rfc6902)-compliant patches. It does not include apply
functionality.

It also provides advanced and [experimental APIs](#experimentalapis) based on patch algebra, such as [patch inverses](#inverse) ("reverse" patches), [commutation](#jifflibcommute) (patch reordering).

Modification from the original:

* Converted to Typescript
* Removed the apply code (there are now other great patchers out there now)
* Added option to shallow check arrays (I need to diff datasets that are too large for deep equality)
* Tests are currently broken

## Get it

`npm install --save diffj`

## Example

```js
var a = [
	{ name: 'a' },
	{ name: 'b' },
	{ name: 'c' },
]

var b = a.slice();
b.splice(1, 1);
b.push({ name: 'd' });

// Generate diff (ie JSON Patch) from a to b
var patch = jiff.diff(a, b);

// [{"op":"add","path":"/3","value":{"name":"d"}},{"op":"remove","path":"/1"}]
console.log(JSON.stringify(patch));

```

## API

### diff

```js
var patch = jiff.diff(a, b [, hashFunction | options]);
```

Computes and returns a JSON Patch from `a` to `b`: `a` and `b` must be valid JSON objects/arrays/values. If `patch` is applied to `a`, it will yield `b`.

The optional third parameter can be *either* an `options` object (preferably) or a function (deprecated: allowed backward compatibility).

* `options`:
	* `options.hash : function(x) -> string|number`: used to recognize when two objects are the same.  If not provided, `JSON.stringify` will be used for objects and arrays, and simply returns `x` for all other primitive values.
	* `options.makeContext : function(index, array) -> *`: **Experimental** function that will be called for each item added or removed from an array.  It can return *any* legal JSON value or undefined, which if not `null` or undefined, will be fed directly to the `findContext` function provided to [`jiff.patch`](#patch).
	* `options.invertible : boolean`: by default, jiff generates patches containing extra `test` operations to ensure they are invertible via [`jiff.inverse`](#inverse).  When `options.invertible === false` will omit the extra `test` operations. This will result in smaller patches, but they will not be invertible.
	* `options.allowShallow : boolean`: if true, will only do a shallow equality check on arrays, and objects with more than 100 keys, generating a single replace operation instead.
* `hashFunction(x) -> string|number`: same as `options.hash` above

The diff algorithm currently does not generate `move`, or `copy` operations, only `add`, `remove`, and `replace`.

### inverse

```js
var patchInverse = jiff.inverse(patch);
```

Compute an inverse patch.  Applying the inverse of a patch will undo the effect of the original.

Due to the current JSON Patch format defined in rfc6902, not all patches can be inverted.  To be invertible, a patch must have the following characteristics:

1. Each `remove` and `replace` operation must be preceded by a `test` operation that verifies the `value` at the `path` being removed/replaced.
2. The patch must *not* contain any `copy` operations.  Read [this discussion](https://github.com/cujojs/jiff/issues/9) to understand why `copy` operations are not (yet) invertible. You can achieve the same effect by using `add` instead of `copy`, albeit potentially at the cost of increased patch size.

### Patch context

As of v0.2, `jiff.diff` support [patch contexts](http://en.wikipedia.org/wiki/Diff#Context_format), an extra bit of information carried with each patch operation.  Patch contexts allow smarter patching, especially in the case of arrays, where items may have moved and thus their indices changed.

Using patch contexts can greatly improve patch accuracy for arrays, at the cost of increasing the size of patches.

Patch contexts are entirely opt-in. To use them, you must provide a pair of closely related functions: `makeContext` and `findContext`.  An API for creating default `makeContext` and `findContext` functions is provided in [`jiff/lib/context`](#jifflibcontext), or you can implement your own.

When you supply the optional `makeContext` function to `jiff.diff`, it will be used to generated a context for each change to an array.

Likewise, when you supply the optional `findContext` function to `jiff.patch` (or `jiff.patchInPlace`), it will be used to find adjusted array indices where patches should actually be applied.

The context is opaque, and jiff itself will not attempt to inspect or interpret it: `jiff.diff` will simply add whatever is returned by `makeContext` to patch operations.


## Experimental APIs

These APIs are still considered experimental, signatures may change.

### jiff/lib/context

```js
var context = require('jiff/lib/context');

// Create a makeContext function that can be passed to jiff.diff
var makeContext = context.makeContext(size);

// Create a findContext function that can be passed to jiff.patch
var findContext = context.makeContextFinder(equals);
```

Provides simple, but effective default implementations of `makeContext` and `findContext` functions that can be passed to `jiff.diff` and `jiff.patch` to take advantage of smarter array patching.

`context.makeContext(size)` *returns* a function that can be passed as `options.makeContext` to `jiff.diff`.
	* `size: number` is the number of array items before and after each change to include in the patch.

`context.makeContextFinder(equals)` *returns* a function that can be passed as `options.findContext` to `jiff.patch`.
	* `equals: function(a, b) -> boolean` a function to compare two array items, must return truthy when `a` and `b` are equal, falsy otherwise.

### jiff/lib/commute

```js
var commute = require('jiff/lib/commute');
var [p2c, p1c] = commute(p1, p2);
```

Given two patches `p1` and `p2`, which are intended to be applied in the order `p1` then `p2`, transform them so that they can be safely applied in the order `p2c` and then `p1c`.

 Commutation is currently *highly experimental*.  It works for patch operations whose path refers to a common array ancestor by transforming array indices.  Operations that share a common object ancestor are simply swapped for now, which is likely not the right thing in most cases!

 Commutation does attempt to detect operations that cannot be commuted, and in such cases, will throw a `TypeError`.

## Errors

### InvalidPatchOperationError

Thrown when any invalid patch operation is encountered.  Invalid patch operations are outlined in [sections 4.x](https://tools.ietf.org/html/rfc6902#section-4) [and 5](https://tools.ietf.org/html/rfc6902#section-5) in rfc6902.  For example: non-existent path in a remove operation, array path index out of bounds, etc.

### TestFailedError

Thrown when a [`test` operation](https://tools.ietf.org/html/rfc6902#section-4.6) fails.

## License

MIT
