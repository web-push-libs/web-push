export class WebPushError extends Error {
  constructor(message, statusCode, headers, body, endpoint) {
    super(message);

    this.name = 'WebPushError';
    this.statusCode = statusCode;
    this.headers = headers;
    this.body = body;
    this.endpoint = endpoint;
  }
}
