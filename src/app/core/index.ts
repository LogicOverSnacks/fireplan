export { CryptoApiService } from './crypto.api.service';
export { FundsApiService } from './funds.api.service';

export const isDefined = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;

export const mapRecord = <T extends Record<any, any>, R = T[keyof T]>(
  record: T,
  projection: (pair: [keyof T, T[keyof T]]) => [keyof T, R]
): Record<keyof T, R> => Object.fromEntries(Object.entries(record).map(([k, v]) => projection([k, v]))) as any;
