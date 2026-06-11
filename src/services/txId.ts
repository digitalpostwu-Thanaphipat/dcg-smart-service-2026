type TransactionType = 'run' | 'sort' | 'ext';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const pad2 = (value: number) => String(value).padStart(2, '0');

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }

  throw new Error('crypto.getRandomValues is required to generate transaction IDs');
};

export const generateTxId = (type: TransactionType, now = new Date()): string => {
  const prefix = type.toUpperCase();
  const datePart = [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
  ].join('');
  const timePart = [
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
  ].join('');
  const randomPart = Array.from(randomBytes(8), (byte) => ALPHABET[byte % ALPHABET.length]).join('');

  return `${prefix}-${datePart}-${timePart}-${randomPart}`;
};
