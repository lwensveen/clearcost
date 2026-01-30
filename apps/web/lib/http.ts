import { NextResponse } from 'next/server';

function statusCode(status: number): string {
  switch (status) {
    case 400:
      return 'bad_request';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'validation_failed';
    case 500:
      return 'internal_error';
    default:
      return 'error';
  }
}

export function errorJson(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, status, code: code ?? statusCode(status) },
    { status }
  );
}
