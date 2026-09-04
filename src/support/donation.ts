/**
 * Official CBS donation wallet, copied from CBS Token Builder
 * (`cbs-coin-creator/src/main.ts`) and matching tools.cbs-coin.com / cbs-coin-main.
 * Copy-only: this address is never used to send a transaction from the Donate button.
 */
export const DONATION_WALLET_ADDRESS =
  'ManGofryUWC5VWk7t4ATP32qJtGVBBNoVi2AQ9HyR9J';

export const DONATION_WALLET_SHORT = 'ManGofry...HyR9J';

export function shortenDonationAddress(address: string): string {
  if (address.length < 14) {
    return address;
  }

  return `${address.slice(0, 8)}...${address.slice(-5)}`;
}

export function renderDonationSectionMarkup(): string {
  return `
    <section class="cbs-support-block support-section page-section" aria-labelledby="support-title">
      <h2 class="cbs-support-title" id="support-title">
        Support CBS Ecosystem
      </h2>
      <p class="cbs-support-text">
        Optional donations help fund development and infrastructure.
      </p>
      <div class="cbs-support-wallet">
        <code
          id="donationWalletDisplay"
          class="support-footer-address"
          title="${DONATION_WALLET_ADDRESS}"
        >${DONATION_WALLET_SHORT}</code>
        <button
          id="copyDonationAddress"
          type="button"
          class="support-footer-copy"
        >
          Copy address
        </button>
      </div>
      <p id="donationCopyConfirm" class="support-confirm helper-text" hidden aria-live="polite">
        Address copied.
      </p>
    </section>
  `;
}

export async function copyDonationAddress(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(DONATION_WALLET_ADDRESS);
    return true;
  } catch {
    return false;
  }
}
