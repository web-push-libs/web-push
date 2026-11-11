export class WebPushError extends Error {
  /** @type {string} */
  name;
  /** @type {number} */
  statusCode;
  /** @type {Record<string, string>} */
  headers;
  /** @type {string} */
  body;
  /** @type {string} */
  endpoint;

  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {Record<string, string>} headers
   * @param {string} body
   * @param {string} endpoint
   */
  constructor(message, statusCode, headers, body, endpoint) {
    super(message);

    this.name = 'WebPushError';
    this.statusCode = statusCode;
    this.headers = headers;
    this.body = body;
    this.endpoint = endpoint;
  }
}
