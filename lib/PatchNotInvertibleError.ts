export class PatchNotInvertibleError extends Error {
  constructor(msg: string) {
    super(msg);

    Object.setPrototypeOf(this, PatchNotInvertibleError.prototype);
  }
}
