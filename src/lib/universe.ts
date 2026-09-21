/**
 * Universo de símbolos de la plataforma.
 *
 * - `FREE_SYMBOLS`: siempre visibles, sin cuenta ni suscripción (Fase 2).
 * - `PAID_SYMBOLS`: S&P 500 + Nasdaq-100, protegido por
 *   `hasSymbolAccess()` (ver `src/lib/subscription.ts`) — hoy exige
 *   suscripción activa en la portada/`/introduccion`, y solo estar
 *   registrado en la Sala de Trading (decisión temporal de prueba, sept.
 *   2026). Se valida SIEMPRE en el servidor — el navegador nunca decide por
 *   su cuenta qué símbolos puede pedir.
 * - `SECTORS`: la misma lista de acciones, agrupada por sector — para el
 *   buscador "por categorías" de la Sala de Trading (como el "Agregar
 *   símbolo" de TradingView). Solo acciones de EE.UU. por ahora: no hay
 *   Forex ni Cripto todavía, eso implica una fuente de datos aparte.
 *
 * OJO — esta lista es una foto aproximada, no una fuente oficial y viva de
 * los índices: los componentes de S&P 500 y Nasdaq-100 cambian con el tiempo
 * (fusiones, exclusiones, nuevas entradas). Cubre la gran mayoría de las
 * acciones que de verdad se consultan, pero no es matemáticamente exacta ni
 * las 500 al dígito. Pendiente: en algún momento reemplazarla por una lista
 * que se traiga de una fuente que se actualice sola (Twelve Data tiene
 * endpoints de referencia en planes pagos) en vez de vivir hardcodeada aquí.
 */

// QQQ (Nasdaq-100) se agregó como símbolo libre para poder incluirlo en la
// lista de seguimiento por defecto de la Sala de Trading (Alejo lo tiene en
// su "Lista roja"). Es un ETF, igual que SPY y GLD, así que la fuente de
// datos lo trata igual.
export const FREE_SYMBOLS = ["SPY", "QQQ", "META", "GLD"] as const;

// Nasdaq-100, componentes conocidos. No tienen sector propio aquí — varios
// ya aparecen en los sectores de abajo (Tecnología, Consumo, etc.); el
// resto cae en "Otras del Nasdaq" para que el buscador por categorías no
// se los pierda.
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

// S&P 500 por sector — subconjunto amplio (ver nota arriba: no son las 500
// exactas). Esta es la fuente de verdad; `SP500_SYMBOLS` y `PAID_SYMBOLS`
// se derivan de aquí abajo.
export const SECTORS: { name: string; symbols: string[] }[] = [
  {
    name: "Tecnología",
    symbols: [
      "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ACN", "IBM", "ADBE",
      "AMD", "TXN", "QCOM", "INTC", "AMAT", "MU", "LRCX", "KLAC", "SNPS",
      "CDNS", "PANW", "FTNT", "ANET", "NOW", "INTU", "ADI", "MCHP", "ON",
      "HPQ", "DELL", "WDC", "STX", "NTAP", "JNPR", "FFIV", "GEN", "AKAM",
      "EPAM", "PTC", "TYL", "TDY", "KEYS", "TER", "ZBRA", "GLW", "APH",
      "TEL", "MSI", "CRWD", "DDOG", "APP",
    ],
  },
  {
    name: "Comunicaciones",
    symbols: [
      "GOOGL", "GOOG", "META", "NFLX", "DIS", "CMCSA", "TMUS", "VZ", "T",
      "CHTR", "EA", "TTWO", "WBD", "OMC", "IPG", "LYV", "MTCH", "PARA",
      "FOXA", "FOX", "NWSA", "NWS",
    ],
  },
  {
    name: "Consumo discrecional",
    symbols: [
      "AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "BKNG", "TJX",
      "ORLY", "MAR", "GM", "F", "CMG", "ABNB", "YUM", "ROST", "AZO", "HLT",
      "DHI", "LEN", "NVR", "PHM", "EBAY", "ETSY", "BBY", "DG", "DLTR",
      "ULTA", "RL", "TPR", "DECK", "GRMN", "POOL", "LVS", "WYNN", "MGM",
      "CCL", "RCL", "NCLH", "DASH",
    ],
  },
  {
    name: "Consumo básico",
    symbols: [
      "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "MDLZ", "CL", "KMB",
      "GIS", "KHC", "HSY", "STZ", "SYY", "KR", "ADM", "TSN", "CHD", "CLX",
      "MKC", "TAP", "HRL", "CAG", "CPB", "SJM", "EL", "TGT", "MNST", "KDP",
    ],
  },
  {
    name: "Financieras",
    symbols: [
      "JPM", "V", "MA", "BAC", "WFC", "MS", "GS", "SPGI", "BLK", "AXP", "C",
      "SCHW", "CB", "PGR", "MMC", "ICE", "CME", "AON", "USB", "PNC", "TFC",
      "AIG", "MET", "PRU", "TRV", "AFL", "ALL", "BK", "STT", "FITB", "HBAN",
      "RF", "KEY", "CFG", "MTB", "NTRS", "DFS", "SYF", "COF", "PFG", "GL",
      "WTW", "AJG", "BRO", "ACGL", "GPN", "FIS", "FI", "PYPL", "MCO",
    ],
  },
  {
    name: "Salud",
    symbols: [
      "UNH", "JNJ", "LLY", "ABBV", "MRK", "PFE", "TMO", "ABT", "DHR", "BMY",
      "AMGN", "MDT", "GILD", "ISRG", "VRTX", "CVS", "ELV", "CI", "HUM",
      "CNC", "MOH", "ZTS", "SYK", "BSX", "BDX", "BAX", "EW", "IDXX", "IQV",
      "A", "MRNA", "REGN", "BIIB", "HCA", "DXCM", "ALGN", "WAT", "MTD",
      "RMD", "GEHC", "COO", "PODD", "VTRS", "CTLT",
    ],
  },
  {
    name: "Industriales",
    symbols: [
      "GE", "HON", "RTX", "CAT", "DE", "UNP", "UPS", "BA", "LMT", "GD",
      "NOC", "MMM", "ETN", "EMR", "ITW", "PH", "CMI", "PCAR", "ROP", "CSX",
      "NSC", "FDX", "WM", "RSG", "JCI", "CARR", "OTIS", "TT", "IR", "XYL",
      "DOV", "AME", "ROK", "FAST", "PWR", "URI", "EFX", "CTAS", "VRSK",
      "EXPD", "JBHT", "CHRW", "LDOS", "HWM", "TDG", "TXT", "HII", "LHX",
      "ODFL",
    ],
  },
  {
    name: "Energía",
    symbols: [
      "XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY", "WMB",
      "KMI", "OKE", "HES", "DVN", "FANG", "HAL", "BKR", "TRGP", "CTRA",
      "EQT", "APA",
    ],
  },
  {
    name: "Utilities",
    symbols: [
      "NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL", "ED", "PEG",
      "WEC", "ES", "AWK", "DTE", "PPL", "FE", "AEE", "CMS", "CNP", "ATO",
      "NI", "LNT", "EVRG", "PNW",
    ],
  },
  {
    name: "Bienes raíces",
    symbols: [
      "PLD", "AMT", "EQIX", "CCI", "PSA", "O", "WELL", "DLR", "SPG", "AVB",
      "EQR", "VICI", "SBAC", "IRM", "ARE", "VTR", "MAA", "ESS", "UDR",
      "CPT", "KIM", "REG", "HST", "EXR", "INVH", "CSGP",
    ],
  },
  {
    name: "Materiales",
    symbols: [
      "LIN", "APD", "SHW", "ECL", "FCX", "NEM", "DOW", "DD", "PPG", "NUE",
      "VMC", "MLM", "ALB", "IFF", "CTVA", "LYB", "CE", "AVY", "PKG", "IP",
      "BALL", "AMCR", "STLD",
    ],
  },
  {
    name: "Otras del Nasdaq",
    symbols: [
      "ASML", "AZN", "BIIB", "CCEP", "CEG", "CSGP", "CPRT", "EXC", "GEHC",
      "GFS", "ILMN", "LULU", "MELI", "MRVL", "MSTR", "NXPI", "PDD", "TEAM",
      "TTD", "VRSK", "WDAY", "ZS",
    ],
  },
];

// S&P 500 + Nasdaq-100 combinados y sin duplicados — se usa para validar
// acceso (`isPaidSymbol`) y como universo plano en el selector normal del
// gráfico.
export const PAID_SYMBOLS: string[] = Array.from(
  new Set<string>([
    ...NASDAQ100_SYMBOLS,
    ...SECTORS.flatMap((s) => s.symbols),
  ])
).sort();

export function isFreeSymbol(symbol: string): boolean {
  return (FREE_SYMBOLS as readonly string[]).includes(symbol);
}

export function isPaidSymbol(symbol: string): boolean {
  return PAID_SYMBOLS.includes(symbol);
}

// Sector de un símbolo, para la ficha de la Sala de Trading (ver
// Watchlist.tsx) — `null` para lo que no tiene sector propio acá (ETFs como
// SPY/GLD, o acciones del Nasdaq-100 que caen en "Otras del Nasdaq" solo si
// no aparecen ya en otro sector).
export function sectorOf(symbol: string): string | null {
  return SECTORS.find((s) => s.symbols.includes(symbol))?.name ?? null;
}

// Nombres de empresa/fondo — para la ficha de detalle de la Sala de
// Trading. A propósito NO es una lista de las 500: son nombres reales y
// verificados de los símbolos que de verdad se consultan a diario (los
// ETF y las grandes tecnológicas). Un símbolo que no esté aquí
// simplemente no muestra la línea del nombre — nunca se inventa uno. Si
// más adelante se conecta una fuente de referencia (Twelve Data pago la
// tiene), esto se reemplaza por datos vivos.
const COMPANY_NAMES: Record<string, string> = {
  // ETF / índices
  SPY: "SPDR S&P 500 ETF Trust",
  QQQ: "Invesco QQQ Trust (Nasdaq-100)",
  DIA: "SPDR Dow Jones Industrial Average ETF",
  IWM: "iShares Russell 2000 ETF",
  GLD: "SPDR Gold Shares",
  TLT: "iShares 20+ Year Treasury Bond ETF",
  // Grandes tecnológicas y más consultadas
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  AMZN: "Amazon.com, Inc.",
  META: "Meta Platforms, Inc.",
  GOOGL: "Alphabet Inc. (Clase A)",
  GOOG: "Alphabet Inc. (Clase C)",
  TSLA: "Tesla, Inc.",
  AMD: "Advanced Micro Devices, Inc.",
  MU: "Micron Technology, Inc.",
  NFLX: "Netflix, Inc.",
  INTC: "Intel Corporation",
  AVGO: "Broadcom Inc.",
  QCOM: "QUALCOMM Incorporated",
  ADBE: "Adobe Inc.",
  CRM: "Salesforce, Inc.",
  ORCL: "Oracle Corporation",
  IBM: "International Business Machines",
  PYPL: "PayPal Holdings, Inc.",
  DIS: "The Walt Disney Company",
  KO: "The Coca-Cola Company",
  PEP: "PepsiCo, Inc.",
  JPM: "JPMorgan Chase & Co.",
  V: "Visa Inc.",
  MA: "Mastercard Incorporated",
  WMT: "Walmart Inc.",
  COST: "Costco Wholesale Corporation",
  BA: "The Boeing Company",
  XOM: "Exxon Mobil Corporation",
};

export function nameOf(symbol: string): string | null {
  return COMPANY_NAMES[symbol] ?? null;
}
