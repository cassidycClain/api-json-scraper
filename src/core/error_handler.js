lass ErrorHandler {
  /**
   * Centralized error logging.
   * Accepts an error and a context object to give hints about where it happened.
   */
  static handle(error, context = {}) {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [Error] ${error.message || error}`;

    const contextString =
      context && Object.keys(context).length > 0
        ? ` | context=${JSON.stringify(context)}`
        : '';

    console.error(baseMessage + contextString);

    if (error.stack) {
      console.error(error.stack);
    }
  }

  /**
   * Very small retry policy helper. Returns true if we should retry the request.
   */
  static shouldRetry(error, attempt, maxAttempts) {
    if (attempt >= maxAttempts) return false;

    // Network-ish errors or 5xx HTTP responses are worth retrying.
    const message = (error && error.message) || '';
    const isNetworkError =
      /ECONNRESET|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(message);

    const status = error.status || error.statusCode;
    const isServerError = status && status >= 500 && status < 600;

    return isNetworkError || isServerError;
  }

  /**
   * Simple delay utility for retry backoff.
   */
  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = {
  ErrorHandler
};