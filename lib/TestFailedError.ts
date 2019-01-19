export class TestFailedError extends Error {
  constructor(msg: string) {
    super(msg);

    Object.setPrototypeOf(this, TestFailedError.prototype);
  }
}
