export class ErrorBadRequest extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = "ErrorBadRequest";
    this.statusCode = 400;
  }
}
