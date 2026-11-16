const pd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const two = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const fmtPD = (n: number) => pd.format(n);
export const fmtGain = (n: number) => `${two.format(n)}x`;
export const fmt2 = (n: number) => two.format(n);
export const fmtUSD = (n: number) => usd.format(Math.round(n));
export const fmt3 = (n: number) => n.toFixed(3);
