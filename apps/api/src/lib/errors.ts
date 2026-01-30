export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'ERR_BAD_REQUEST',
  401: 'ERR_UNAUTHORIZED',
  402: 'ERR_PAYMENT_REQUIRED',
  403: 'ERR_FORBIDDEN',
  404: 'ERR_NOT_FOUND',
  409: 'ERR_CONFLICT',
  429: 'ERR_RATE_LIMITED',
  500: 'ERR_INTERNAL',
  502: 'ERR_BAD_GATEWAY',
  503: 'ERR_UNAVAILABLE',
  504: 'ERR_GATEWAY_TIMEOUT',
};

export function errorResponse(
  message: string,
  code = 'ERR_REQUEST',
  details?: unknown
): ErrorEnvelope {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

export function errorResponseForStatus(
  status: number,
  message: string,
  details?: unknown
): ErrorEnvelope {
  const code = STATUS_CODE_MAP[status] ?? 'ERR_REQUEST';
  return errorResponse(message, code, details);
}
