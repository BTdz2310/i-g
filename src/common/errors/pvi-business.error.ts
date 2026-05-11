export class PviBusinessError extends Error {
  constructor(
    public readonly pviStatus: string,
    public readonly pviMessage: string,
  ) {
    super(`PVI error ${pviStatus}: ${pviMessage}`);
    this.name = 'PviBusinessError';
  }
}
