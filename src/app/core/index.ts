export { CryptoApiService } from './crypto.api.service';
export { FundsApiService } from './funds.api.service';

export const isDefined = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined;
