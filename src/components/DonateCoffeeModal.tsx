import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  buildStaticPixBrCode,
  COFFEE_TIERS,
  CRYPTO_DONATION_OPTIONS,
  CryptoNetworkId,
  DonationMethodTab,
  getCryptoOptionById,
  PIX_RANDOM_KEY
} from '../utils/donations';
import { CoffeeCupIcon } from './CoffeeCupIcon';

interface DonateCoffeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

async function copyTextSafe(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback to textarea copy below
  }

  try {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export const DonateCoffeeModal: React.FC<DonateCoffeeModalProps> = ({
  isOpen,
  onClose,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<DonationMethodTab>('pix');
  const [selectedTierId, setSelectedTierId] = useState<string>('1cup');
  const [selectedCryptoId, setSelectedCryptoId] = useState<CryptoNetworkId>('bitcoin');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrFailed, setQrFailed] = useState<boolean>(false);

  const activeTier = useMemo(
    () => COFFEE_TIERS.find(t => t.id === selectedTierId) || COFFEE_TIERS[0],
    [selectedTierId]
  );

  const activeCrypto = useMemo(
    () => getCryptoOptionById(selectedCryptoId),
    [selectedCryptoId]
  );

  const pixBrCode = useMemo(
    () =>
      buildStaticPixBrCode({
        pixKey: PIX_RANDOM_KEY,
        amountBrl: activeTier.amountBrl
      }),
    [activeTier.amountBrl]
  );

  const activeQrPayload = activeTab === 'pix' ? pixBrCode : activeCrypto.address;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setQrFailed(false);

    QRCode.toDataURL(activeQrPayload, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeQrPayload]);

  useEffect(() => {
    if (!copiedKeyId) return;
    const timer = window.setTimeout(() => setCopiedKeyId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copiedKeyId]);

  if (!isOpen) return null;

  const handleCopy = async (id: string, value: string, feedbackLabel: string) => {
    const ok = await copyTextSafe(value);
    if (ok) {
      setCopiedKeyId(id);
      onShowToast(feedbackLabel);
    } else {
      onShowToast('Selecione e copie o código manualmente.');
    }
  };

  return (
    <div
      id="modalDonateCoffee"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-3 sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="donateCoffeeTitle"
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg sm:max-w-xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl p-4 sm:p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FFDD00] text-[#18181b] flex items-center justify-center shadow-sm shrink-0">
              <CoffeeCupIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="donateCoffeeTitle"
                className="text-sm sm:text-base font-extrabold text-white leading-tight"
              >
                Pague um café para o projeto
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                Apoie o desenvolvimento contínuo via Pix ou criptomoedas.
              </p>
            </div>
          </div>

          <button
            id="btnCloseDonateModal"
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de doação"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer shrink-0 transition"
          >
            ✕
          </button>
        </div>

        {/* Method Tabs (Pix / Criptomoedas) */}
        <div
          role="tablist"
          aria-label="Forma de apoio"
          className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-800"
        >
          <button
            id="tabDonatePix"
            type="button"
            role="tab"
            aria-selected={activeTab === 'pix'}
            onClick={() => setActiveTab('pix')}
            className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'pix'
                ? 'bg-[#FFDD00] text-[#18181b] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.4 7.3 7.1a2.6 2.6 0 0 0 0 3.7l4.7 4.7 4.7-4.7a2.6 2.6 0 0 0 0-3.7L12 2.4Zm0 19.2 4.7-4.7a2.6 2.6 0 0 0 0-3.7L12 8.5l-4.7 4.7a2.6 2.6 0 0 0 0 3.7l4.7 4.7Z" />
            </svg>
            <span>Pix (Brasil)</span>
          </button>
          <button
            id="tabDonateCrypto"
            type="button"
            role="tab"
            aria-selected={activeTab === 'crypto'}
            onClick={() => setActiveTab('crypto')}
            className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'crypto'
                ? 'bg-[#FFDD00] text-[#18181b] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 8h4a2 2 0 0 1 0 4h-4Zm0 4h4.5a2 2 0 0 1 0 4H9.5Z" />
              <path d="M11 6.5v1.5m2-1.5v1.5m-2 8v1.5m2-1.5v1.5" />
            </svg>
            <span>Criptomoedas</span>
          </button>
        </div>

        {/* PIX TAB */}
        {activeTab === 'pix' && (
          <div id="panelDonatePix" className="space-y-4">
            {/* Buy Me a Coffee Cup Selector */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">
                Escolha quantos cafés deseja pagar
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COFFEE_TIERS.map(tier => {
                  const isSelected = tier.id === selectedTierId;
                  return (
                    <button
                      key={tier.id}
                      id={`btnCoffeeTier_${tier.id}`}
                      type="button"
                      onClick={() => setSelectedTierId(tier.id)}
                      className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-center transition cursor-pointer tabular-nums flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-[#FFDD00]/15 border-[#FFDD00] text-white'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-bold whitespace-nowrap">{tier.label}</span>
                      <span className="text-[11px] text-slate-400">
                        {tier.amountBrl !== null ? `R$ ${tier.amountBrl}` : 'Qualquer valor'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QR Code & Key */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl bg-slate-800/45 border border-slate-800">
              <div className="w-[148px] h-[148px] rounded-xl bg-[#ffffff] p-2 flex items-center justify-center shrink-0 shadow-sm">
                {!qrFailed && qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code Pix (${activeTier.label})`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-[#18181b] text-center font-medium px-2">
                    Copie a chave Pix ao lado
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 w-full space-y-2.5">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    Pix · Chave Aleatória
                  </span>
                  <code
                    id="pixRandomKeyValue"
                    className="mt-1 block w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-700/80 text-xs font-mono text-slate-100 break-all select-all"
                  >
                    {PIX_RANDOM_KEY}
                  </code>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    id="btnCopyPixKey"
                    type="button"
                    onClick={() =>
                      handleCopy('pix-key', PIX_RANDOM_KEY, 'Chave aleatória Pix copiada!')
                    }
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#FFDD00] hover:bg-[#FFE63B] active:scale-[0.99] text-[#18181b] text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                  >
                    <CoffeeCupIcon className="w-4 h-4" />
                    <span>
                      {copiedKeyId === 'pix-key' ? 'Chave Pix copiada!' : 'Copiar chave Pix'}
                    </span>
                  </button>

                  <button
                    id="btnCopyPixBrCode"
                    type="button"
                    onClick={() =>
                      handleCopy('pix-brcode', pixBrCode, 'Código Pix Copia e Cola copiado!')
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
                  >
                    {copiedKeyId === 'pix-brcode'
                      ? 'Copia e Cola copiado!'
                      : 'Copiar Pix Copia e Cola (QR)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CRYPTO TAB */}
        {activeTab === 'crypto' && (
          <div id="panelDonateCrypto" className="space-y-4">
            {/* Network selector */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">
                Selecione a rede / criptomoeda
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CRYPTO_DONATION_OPTIONS.map((option, idx) => {
                  const isSelected = option.id === activeCrypto.id;
                  const spanClass =
                    idx === CRYPTO_DONATION_OPTIONS.length - 1 ? 'col-span-2 sm:col-span-1' : '';
                  return (
                    <button
                      key={option.id}
                      id={`btnCryptoNet_${option.id}`}
                      type="button"
                      onClick={() => setSelectedCryptoId(option.id)}
                      className={`${spanClass} min-h-[44px] px-2.5 py-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-center ${
                        isSelected
                          ? 'bg-[#FFDD00]/15 border-[#FFDD00] text-white'
                          : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <span className="text-xs font-bold whitespace-nowrap">{option.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{option.symbol}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* QR Code & Wallet Address */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl bg-slate-800/45 border border-slate-800">
              <div className="w-[148px] h-[148px] rounded-xl bg-[#ffffff] p-2 flex items-center justify-center shrink-0 shadow-sm">
                {!qrFailed && qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code ${activeCrypto.name}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[11px] text-[#18181b] text-center font-medium px-2">
                    Copie o endereço ao lado
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 w-full space-y-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span id="cryptoActiveName" className="text-xs font-bold text-white">
                      {activeCrypto.name}
                    </span>
                    <span className="text-[11px] font-mono text-amber-300">
                      {activeCrypto.symbol}
                    </span>
                  </div>
                  <p id="cryptoNetworkLabel" className="text-[11px] text-slate-400 mt-0.5">
                    {activeCrypto.networkLabel}
                  </p>
                  <code
                    id="cryptoAddressValue"
                    className="mt-1.5 block w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-700/80 text-xs font-mono text-slate-100 break-all select-all"
                  >
                    {activeCrypto.address}
                  </code>
                </div>

                <p className="text-[11px] text-slate-400 leading-snug">{activeCrypto.note}</p>

                <button
                  id="btnCopyCryptoAddress"
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `crypto-${activeCrypto.id}`,
                      activeCrypto.address,
                      `Endereço ${activeCrypto.name} copiado!`
                    )
                  }
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#FFDD00] hover:bg-[#FFE63B] active:scale-[0.99] text-[#18181b] text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                >
                  <CoffeeCupIcon className="w-4 h-4" />
                  <span>
                    {copiedKeyId === `crypto-${activeCrypto.id}`
                      ? `Endereço ${activeCrypto.symbol} copiado!`
                      : `Copiar endereço ${activeCrypto.name}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
