import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStaticPixBrCode,
  COFFEE_TIERS,
  computeCrc16Ccitt,
  CRYPTO_DONATION_OPTIONS,
  getCryptoOptionById,
  PIX_RANDOM_KEY
} from './donations';

test('donation keys and addresses match exact configured values', () => {
  assert.equal(PIX_RANDOM_KEY, 'c2b1341d-cf5c-4119-a616-a5463a57b39a');
  assert.equal(
    getCryptoOptionById('bitcoin').address,
    'bc1qdvkajy8mflqmajc7zf70ym3g86dcd9zyd62e4r'
  );
  assert.equal(
    getCryptoOptionById('evm').address,
    '0x04B83F257eAE8eD9e23fe6F14aBA154975722b6F'
  );
  assert.equal(
    getCryptoOptionById('cardano').address,
    'addr1q8tduwu4k26kpfzhx7amd8da69f7z9z0h6um4dc05j5xr8ml6fjt9zzrtjgnvalcdz5el3k87hj2u7ln2hfpatgkyppsl03dyc'
  );
  assert.equal(
    getCryptoOptionById('tron').address,
    'TDzDyRN4LsSEfN3DGHjeNmdjpA1huDMvJt'
  );
  assert.equal(
    getCryptoOptionById('solana').address,
    '9roo4C8sEGQuNRkNW1Xgene4vqivYfhsWgyNZ61btxbA'
  );
  assert.equal(CRYPTO_DONATION_OPTIONS.length, 5);
});

test('computeCrc16Ccitt matches standard CCITT-FALSE check vector', () => {
  assert.equal(computeCrc16Ccitt('123456789'), '29B1');
});

test('buildStaticPixBrCode embeds exact random key, optional amount, and valid CRC16', () => {
  const openPayload = buildStaticPixBrCode({ amountBrl: null });
  assert.ok(openPayload.startsWith('000201'));
  assert.ok(openPayload.includes(`0136${PIX_RANDOM_KEY}`));
  assert.ok(!openPayload.includes('5405'));

  const bodyWithoutCrc = openPayload.slice(0, -4);
  const crc = openPayload.slice(-4);
  assert.equal(crc, computeCrc16Ccitt(bodyWithoutCrc));

  const tenReaisPayload = buildStaticPixBrCode({ amountBrl: 10 });
  assert.ok(tenReaisPayload.includes('540510.00'));
  assert.equal(
    tenReaisPayload.slice(-4),
    computeCrc16Ccitt(tenReaisPayload.slice(0, -4))
  );
  assert.equal(COFFEE_TIERS.length, 4);
});
