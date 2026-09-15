/**
 * Universo de símbolos de la plataforma.
 *
 * - `FREE_SYMBOLS`: siempre visibles, sin cuenta ni suscripción (Fase 2).
 * - `PAID_SYMBOLS`: S&P 500 + Nasdaq-100, solo para quien tenga
 *   `getAccess().allowed === true` (ver `src/lib/subscription.ts`). Se valida
 *   SIEMPRE en el servidor (`/api/universe`, `/api/candles`) — el navegador
 *   nunca decide por su cuenta qué símbolos puede pedir.
 *
 * OJO — esta lista es una foto aproximada, no una fuente oficial y viva de
 * los índices: los componentes de S&P 500 y Nasdaq-100 cambian con el tiempo
 * (fusiones, exclusiones, nuevas entradas). Cubre la gran mayoría de las
 * acciones que de verdad se consultan, pero no es matemáticamente exacta ni
 * las 500 al dígito. Pendiente: en algún momento reemplazarla por una lista
 * que se traiga de una fuente que se actualice sola (Twelve Data tiene
 * endpoints de referencia en planes pagos) en vez de vivir hardcodeada aquí.
 */

export const FREE_SYMBOLS = ["SPY", "META", "GLD"] as const;

// Nasdaq-100, componentes conocidos.
export const NASDAQ100_SYMBOLS = [
  "AAPL", "ABNB", "ADBE", "ADI", "ADP", "ADSK", "AEP", "AMAT", "AMD", "AMGN",
  "AMZN", "ANSS", "APP", "ARM", "ASML", "AVGO", "AXON", "AZN", "BIIB", "BKNG",
  "BKR", "CCEP", "CDNS", "CDW", "CEG", "CHTR", "CMCSA", "COST", "CPRT", "CRWD",
  "CSCO", "CSGP", "CSX", "CTAS", "CTSH", "DASH", "DDOG", "DXCM", "EA", "EXC",
  "FANG", "FAST", "FTNT", "GEHC", "GFS", "GILD", "GOOG", "GOOGL", "HON",
  "IDXX", "ILMN", "INTC", "INTU", "ISRG", "KDP", "KHC", "KLAC", "LIN", "LRCX",
  "LULU", "MAR", "MCHP", "MDLZ", "MELI", "META", "MNST", "MRVL", "MSFT",
  "MSTR", "MU", "NFLX", "NVDA", "NXPI", "ODFL", "ON", "ORLY", "PANW", "PAYX",
  "PCAR", "PDD", "PEP", "PYPL", "QCOM", "REGN", "ROP", "ROST", "SBUX", "SNPS",
  "TEAM", "TMUS", "TSLA", "TTD", "TTWO", "TXN", "VRSK", "VRTX", "WBD",
  "WDAY", "XEL", "ZS",
] as const;

// S&P 500 — subconjunto amplio (ver nota arriba: no son las 500 exactas).
export const SP500_SYMBOLS = [
  // Tecnología
  "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ACN", "IBM", "ADBE", "AMD",
  "TXN", "QCOM", "INTC", "AMAT", "MU", "LRCX", "KLAC", "SNPS", "CDNS", "PANW",
  "FTNT", "ANET", "NOW", "INTU", "ADI", "MCHP", "ON", "HPQ", "DELL", "WDC",
  "STX", "NTAP", "JNPR", "FFIV", "GEN", "AKAM", "EPAM", "PTC", "TYL", "TDY",
  "KEYS", "TER", "ZBRA", "GLW", "APH", "TEL", "MSI",
  // Comunicaciones
  "GOOGL", "GOOG", "META", "NFLX", "DIS", "CMCSA", "TMUS", "VZ", "T", "CHTR",
  "EA", "TTWO", "WBD", "OMC", "IPG", "LYV", "MTCH", "PARA", "FOXA", "FOX",
  "NWSA", "NWS",
  // Consumo discrecional
  "AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "BKNG", "TJX", "ORLY",
  "MAR", "GM", "F", "CMG", "ABNB", "YUM", "ROST", "AZO", "HLT", "DHI", "LEN",
  "NVR", "PHM", "EBAY", "ETSY", "BBY", "DG", "DLTR", "ULTA", "RL", "TPR",
  "DECK", "GRMN", "POOL", "LVS", "WYNN", "MGM", "CCL", "RCL", "NCLH",
  // Consumo básico
  "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ", "CL", "KMB", "GIS",
  "KHC", "HSY", "STZ", "SYY", "KR", "ADM", "TSN", "CHD", "CLX", "MKC", "TAP",
  "HRL", "CAG", "CPB", "SJM", "EL", "TGT",
  // Financieras
  "JPM", "V", "MA", "BAC", "WFC", "MS", "GS", "SPGI", "BLK", "AXP", "C",
  "SCHW", "CB", "PGR", "MMC", "ICE", "CME", "AON", "USB", "PNC", "TFC", "AIG",
  "MET", "PRU", "TRV", "AFL", "ALL", "BK", "STT", "FITB", "HBAN", "RF", "KEY",
  "CFG", "MTB", "NTRS", "DFS", "SYF", "COF", "PFG", "GL", "WTW", "AJG", "BRO",
  "ACGL", "GPN", "FIS", "FI", "PYPL", "MCO",
  // Salud
  "UNH", "JNJ", "LLY", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "BMY",
  "AMGN", "MDT", "GILD", "ISRG", "VRTX", "CVS", "ELV", "CI", "HUM", "CNC",
  "MOH", "ZTS", "SYK", "BSX", "BDX", "BAX", "EW", "IDXX", "IQV", "A", "MRNA",
  "REGN", "BIIB", "HCA", "DXCM", "ALGN", "WAT", "MTD", "RMD", "GEHC", "COO",
  "PODD", "VTRS", "CTLT",
  // Industriales
  "GE", "HON", "RTX", "CAT", "DE", "UNP", "UPS", "BA", "LMT", "GD", "NOC",
  "MMM", "ETN", "EMR", "ITW", "PH", "CMI", "PCAR", "ROP", "CSX", "NSC", "FDX",
  "WM", "RSG", "JCI", "CARR", "OTIS", "TT", "IR", "XYL", "DOV", "AME", "ROK",
  "FAST", "PWR", "URI", "EFX", "CTAS", "VRSK", "EXPD", "JBHT", "CHRW", "LDOS",
  "HWM", "TDG", "TXT", "HII", "LHX",
  // Energía
  "XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY", "WMB", "KMI",
  "OKE", "HES", "DVN", "FANG", "HAL", "BKR", "TRGP", "CTRA", "EQT", "APA",
  // Utilities
  "NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL", "ED", "PEG", "WEC",
  "ES", "AWK", "DTE", "PPL", "FE", "AEE", "CMS", "CNP", "ATO", "NI", "LNT",
  "EVRG", "PNW",
  // Bienes raíces
  "PLD", "AMT", "EQIX", "CCI", "PSA", "O", "WELL", "DLR", "SPG", "AVB", "EQR",
  "VICI", "SBAC", "IRM", "ARE", "VTR", "MAA", "ESS", "UDR", "CPT", "KIM",
  "REG", "HST", "EXR", "INVH",
  // Materiales
  "LIN", "APD", "SHW", "ECL", "FCX", "NEM", "DOW", "DD", "PPG", "NUE", "VMC",
  "MLM", "ALB", "IFF", "CTVA", "LYB", "CE", "AVY", "PKG", "IP", "BALL",
  "AMCR", "STLD",
] as const;

export const PAID_SYMBOLS: string[] = Array.from(
  new Set<string>([...NASDAQ100_SYMBOLS, ...SP500_SYMBOLS])
).sort();

export function isFreeSymbol(symbol: string): boolean {
  return (FREE_SYMBOLS as readonly string[]).includes(symbol);
}

export function isPaidSymbol(symbol: string): boolean {
  return PAID_SYMBOLS.includes(symbol);
}
