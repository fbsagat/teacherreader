export type DonationMethodTab = 'pix' | 'crypto';

export type CryptoNetworkId = 'bitcoin' | 'evm' | 'cardano' | 'tron' | 'solana';

export interface CryptoDonationOption {
  id: CryptoNetworkId;
  name: string;
  symbol: string;
  networkLabel: string;
  address: string;
  note: string;
}

export interface CoffeeTierOption {
  id: string;
  cups: number;
  label: string;
  amountBrl: number | null;
}

export const PIX_RANDOM_KEY = 'c2b1341d-cf5c-4119-a616-a5463a57b39a';

export const COFFEE_TIERS: readonly CoffeeTierOption[] = [
  { id: '1cup', cups: 1, label: '1 Café', amountBrl: 10 },
  { id: '2cups', cups: 2, label: '2 Cafés', amountBrl: 20 },
  { id: '5cups', cups: 5, label: '5 Cafés', amountBrl: 50 },
  { id: 'custom', cups: 1, label: 'Valor livre', amountBrl: null }
] as const;

export const CRYPTO_DONATION_OPTIONS: readonly CryptoDonationOption[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    networkLabel: 'Rede Bitcoin (Native SegWit)',
    address: 'bc1qdvkajy8mflqmajc7zf70ym3g86dcd9zyd62e4r',
    note: 'Envie apenas BTC pela rede Bitcoin principal.'
  },
  {
    id: 'evm',
    name: 'ETH EVM',
    symbol: 'EVM',
    networkLabel: 'BSC · Polygon (POL) · Ethereum (ETH)',
    address: '0x04B83F257eAE8eD9e23fe6F14aBA154975722b6F',
    note: 'Mesmo endereço compatível com BNB Smart Chain (BEP-20), Polygon e Ethereum (ERC-20).'
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ADA',
    networkLabel: 'Rede Cardano',
    address:
      'addr1q8tduwu4k26kpfzhx7amd8da69f7z9z0h6um4dc05j5xr8ml6fjt9zzrtjgnvalcdz5el3k87hj2u7ln2hfpatgkyppsl03dyc',
    note: 'Envie ADA ou tokens nativos pela rede Cardano.'
  },
  {
    id: 'tron',
    name: 'Tron',
    symbol: 'TRX',
    networkLabel: 'Rede Tron (TRC-20)',
    address: 'TDzDyRN4LsSEfN3DGHjeNmdjpA1huDMvJt',
    note: 'Compatível com TRX e USDT/tokens na rede Tron (TRC-20).'
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    networkLabel: 'Rede Solana',
    address: '9roo4C8sEGQuNRkNW1Xgene4vqivYfhsWgyNZ61btxbA',
    note: 'Compatível com SOL e tokens SPL na rede Solana.'
  }
] as const;

function formatEmvField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

export function computeCrc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildStaticPixBrCode(options?: {
  pixKey?: string;
  amountBrl?: number | null;
  merchantName?: string;
  merchantCity?: string;
  txid?: string;
}): string {
  const pixKey = (options?.pixKey || PIX_RANDOM_KEY).trim();
  const merchantName = (options?.merchantName || 'Teacher Reader').slice(0, 25);
  const merchantCity = (options?.merchantCity || 'Brasil').slice(0, 15);
  const txid = (options?.txid || '***').slice(0, 25);

  const gui = formatEmvField('00', 'br.gov.bcb.pix');
  const keyField = formatEmvField('01', pixKey);
  const merchantAccountInfo = formatEmvField('26', `${gui}${keyField}`);

  const parts = [
    formatEmvField('00', '01'),
    merchantAccountInfo,
    formatEmvField('52', '0000'),
    formatEmvField('53', '986')
  ];

  if (
    typeof options?.amountBrl === 'number' &&
    Number.isFinite(options.amountBrl) &&
    options.amountBrl > 0
  ) {
    parts.push(formatEmvField('54', options.amountBrl.toFixed(2)));
  }

  parts.push(
    formatEmvField('58', 'BR'),
    formatEmvField('59', merchantName),
    formatEmvField('60', merchantCity),
    formatEmvField('62', formatEmvField('05', txid))
  );

  const withoutCrc = `${parts.join('')}6304`;
  return `${withoutCrc}${computeCrc16Ccitt(withoutCrc)}`;
}

export function getCryptoOptionById(id: CryptoNetworkId): CryptoDonationOption {
  return CRYPTO_DONATION_OPTIONS.find(opt => opt.id === id) || CRYPTO_DONATION_OPTIONS[0];
}
