import { inherits } from 'node:util';

export function WebPushError(message, statusCode, headers, body, endpoint) {
  Error.captureStackTrace(this, this.constructor);

  this.name = this.constructor.name;
  this.message = message;
  this.statusCode = statusCode;
  this.headers = headers;
  this.body = body;
  this.endpoint = endpoint;
}

inherits(WebPushError, Error);
