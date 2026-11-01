export type ExpiryStatus = "EXPIRED" | "CRITICAL" | "EXPIRING_SOON" | "VALID" | "NONE";

export interface ExpiryCheckResult {
  status: ExpiryStatus;
  daysRemaining: number | null;
  label: string;
  badgeClass: string;
}

export function checkDocumentExpiry(expirationDateStr?: string | null): ExpiryCheckResult {
  if (!expirationDateStr) {
    return {
      status: "NONE",
      daysRemaining: null,
      label: "No Expiration Date",
      badgeClass: "border-border bg-muted/40 text-muted-foreground",
    };
  }

  const expDate = new Date(expirationDateStr);
  if (isNaN(expDate.getTime())) {
    return {
      status: "NONE",
      daysRemaining: null,
      label: "Invalid Date",
      badgeClass: "border-border bg-muted/40 text-muted-foreground",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);

  const diffMs = expDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    const daysAgo = Math.abs(daysRemaining);
    return {
      status: "EXPIRED",
      daysRemaining,
      label: daysAgo === 1 ? "Expired yesterday" : `Expired ${daysAgo} days ago`,
      badgeClass:
        "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400 font-semibold",
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: "CRITICAL",
      daysRemaining,
      label:
        daysRemaining === 0
          ? "Expires today"
          : daysRemaining === 1
          ? "Expires tomorrow"
          : `Expires in ${daysRemaining} days`,
      badgeClass:
        "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400 font-semibold animate-pulse",
    };
  }

  if (daysRemaining <= 180) {
    const months = Math.ceil(daysRemaining / 30);
    return {
      status: "EXPIRING_SOON",
      daysRemaining,
      label: `Expiring soon (~${months} mo)`,
      badgeClass:
        "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium",
    };
  }

  const years = (daysRemaining / 365).toFixed(1);
  return {
    status: "VALID",
    daysRemaining,
    label: `Valid (${years}y)`,
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  };
}

export function calculateAge(birthDateStr?: string | null): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function formatMrzDate(dateStr?: string): string {
  if (!dateStr) return "000000";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "000000";
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/**
 * Standard ICAO Doc 9303 Check Digit Calculator
 * Weights: 7, 3, 1, 7, 3, 1...
 */
export function calculateMrzCheckDigit(data: string): string {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i].toUpperCase();
    let val = 0;
    if (char >= "0" && char <= "9") {
      val = char.charCodeAt(0) - 48;
    } else if (char >= "A" && char <= "Z") {
      val = char.charCodeAt(0) - 55;
    } else if (char === "<") {
      val = 0;
    }
    sum += val * weights[i % 3];
  }
  return String(sum % 10);
}

/**
 * Generate standard 2-line ICAO Doc 9303 TD3 Machine Readable Zone (MRZ)
 */
export function generatePassportMrz(params: {
  countryCode: string;
  fullName: string;
  documentNumber: string;
  birthDate?: string;
  expirationDate?: string;
  gender?: "M" | "F" | "X";
}): { line1: string; line2: string } {
  const country = (params.countryCode || "KHM").toUpperCase().padEnd(3, "<").slice(0, 3);
  
  // Clean names
  const cleanNames = params.fullName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .trim()
    .split(/\s+/);
  const surname = cleanNames[0] || "SURNAME";
  const givenNames = cleanNames.slice(1).join("<") || "NAME";
  const nameSection = `${surname}<<${givenNames}`.padEnd(39, "<").slice(0, 39);
  const line1 = `P<${country}${nameSection}`;

  const docNum = (params.documentNumber || "000000000")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(9, "<")
    .slice(0, 9);
  
  const docCheck = calculateMrzCheckDigit(docNum);
  const bdate = formatMrzDate(params.birthDate);
  const bdateCheck = calculateMrzCheckDigit(bdate);
  const expdate = formatMrzDate(params.expirationDate);
  const expdateCheck = calculateMrzCheckDigit(expdate);
  const genderChar = params.gender || "X";
  const optionalData = "<<<<<<<<<<<<<<";
  
  // Composite checksum over docNum+docCheck + bdate+bdateCheck + expdate+expdateCheck + optionalData
  const compositeData = `${docNum}${docCheck}${bdate}${bdateCheck}${expdate}${expdateCheck}${optionalData}`;
  const compositeCheck = calculateMrzCheckDigit(compositeData);

  const line2 = `${docNum}${docCheck}${country}${bdate}${bdateCheck}${genderChar}${expdate}${expdateCheck}${optionalData}${compositeCheck}`;

  return {
    line1: line1.slice(0, 44).padEnd(44, "<"),
    line2: line2.slice(0, 44).padEnd(44, "<"),
  };
}

export interface CountryRecord {
  code: string;
  name: string;
  flag: string;
}

export const ALL_COUNTRIES: CountryRecord[] = [
  { code: "AFG", name: "Afghanistan", flag: "🇦🇫" },
  { code: "ALB", name: "Albania", flag: "🇦🇱" },
  { code: "DZA", name: "Algeria", flag: "🇩🇿" },
  { code: "AND", name: "Andorra", flag: "🇦🇩" },
  { code: "AGO", name: "Angola", flag: "🇦🇴" },
  { code: "ATG", name: "Antigua and Barbuda", flag: "🇦🇬" },
  { code: "ARG", name: "Argentina", flag: "🇦🇷" },
  { code: "ARM", name: "Armenia", flag: "🇦🇲" },
  { code: "AUS", name: "Australia", flag: "🇦🇺" },
  { code: "AUT", name: "Austria", flag: "🇦🇹" },
  { code: "AZE", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "BHS", name: "Bahamas", flag: "🇧🇸" },
  { code: "BHR", name: "Bahrain", flag: "🇧🇭" },
  { code: "BGD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "BRB", name: "Barbados", flag: "🇧🇧" },
  { code: "BLR", name: "Belarus", flag: "🇧🇾" },
  { code: "BEL", name: "Belgium", flag: "🇧🇪" },
  { code: "BLZ", name: "Belize", flag: "🇧🇿" },
  { code: "BEN", name: "Benin", flag: "🇧🇯" },
  { code: "BTN", name: "Bhutan", flag: "🇧🇹" },
  { code: "BOL", name: "Bolivia", flag: "🇧🇴" },
  { code: "BIH", name: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { code: "BWA", name: "Botswana", flag: "🇧🇼" },
  { code: "BRA", name: "Brazil", flag: "🇧🇷" },
  { code: "BRN", name: "Brunei", flag: "🇧🇳" },
  { code: "BGR", name: "Bulgaria", flag: "🇧🇬" },
  { code: "BFA", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "BDI", name: "Burundi", flag: "🇧🇮" },
  { code: "CPV", name: "Cabo Verde", flag: "🇨🇻" },
  { code: "KHM", name: "Cambodia", flag: "🇰🇭" },
  { code: "CMR", name: "Cameroon", flag: "🇨🇲" },
  { code: "CAN", name: "Canada", flag: "🇨🇦" },
  { code: "CAF", name: "Central African Republic", flag: "🇨🇫" },
  { code: "TCD", name: "Chad", flag: "🇹🇩" },
  { code: "CHL", name: "Chile", flag: "🇨🇱" },
  { code: "CHN", name: "China", flag: "🇨🇳" },
  { code: "COL", name: "Colombia", flag: "🇨🇴" },
  { code: "COM", name: "Comoros", flag: "🇰🇲" },
  { code: "COG", name: "Congo", flag: "🇨🇬" },
  { code: "COD", name: "Congo (DRC)", flag: "🇨🇩" },
  { code: "CRI", name: "Costa Rica", flag: "🇨🇷" },
  { code: "HRV", name: "Croatia", flag: "🇭🇷" },
  { code: "CUB", name: "Cuba", flag: "🇨🇺" },
  { code: "CYP", name: "Cyprus", flag: "🇨🇾" },
  { code: "CZE", name: "Czech Republic", flag: "🇨🇿" },
  { code: "DNK", name: "Denmark", flag: "🇩🇰" },
  { code: "DJI", name: "Djibouti", flag: "🇩🇯" },
  { code: "DMA", name: "Dominica", flag: "🇩🇲" },
  { code: "DOM", name: "Dominican Republic", flag: "🇩🇴" },
  { code: "ECU", name: "Ecuador", flag: "🇪🇨" },
  { code: "EGY", name: "Egypt", flag: "🇪🇬" },
  { code: "SLV", name: "El Salvador", flag: "🇸🇻" },
  { code: "GNQ", name: "Equatorial Guinea", flag: "🇬🇶" },
  { code: "ERI", name: "Eritrea", flag: "🇪🇷" },
  { code: "EST", name: "Estonia", flag: "🇪🇪" },
  { code: "SWZ", name: "Eswatini", flag: "🇸🇿" },
  { code: "ETH", name: "Ethiopia", flag: "🇪🇹" },
  { code: "FJI", name: "Fiji", flag: "🇫🇯" },
  { code: "FIN", name: "Finland", flag: "🇫🇮" },
  { code: "FRA", name: "France", flag: "🇫🇷" },
  { code: "GAB", name: "Gabon", flag: "🇬🇦" },
  { code: "GMB", name: "Gambia", flag: "🇬🇲" },
  { code: "GEO", name: "Georgia", flag: "🇬🇪" },
  { code: "DEU", name: "Germany", flag: "🇩🇪" },
  { code: "GHA", name: "Ghana", flag: "🇬🇭" },
  { code: "GRC", name: "Greece", flag: "🇬🇷" },
  { code: "GRD", name: "Grenada", flag: "🇬🇩" },
  { code: "GTM", name: "Guatemala", flag: "🇬🇹" },
  { code: "GIN", name: "Guinea", flag: "🇬🇳" },
  { code: "GNB", name: "Guinea-Bissau", flag: "🇬🇼" },
  { code: "GUY", name: "Guyana", flag: "🇬🇾" },
  { code: "HTI", name: "Haiti", flag: "🇭🇹" },
  { code: "HND", name: "Honduras", flag: "🇭🇳" },
  { code: "HUN", name: "Hungary", flag: "🇭🇺" },
  { code: "ISL", name: "Iceland", flag: "🇮🇸" },
  { code: "IND", name: "India", flag: "🇮🇳" },
  { code: "IDN", name: "Indonesia", flag: "🇮🇩" },
  { code: "IRN", name: "Iran", flag: "🇮🇷" },
  { code: "IRQ", name: "Iraq", flag: "🇮🇶" },
  { code: "IRL", name: "Ireland", flag: "🇮🇪" },
  { code: "ISR", name: "Israel", flag: "🇮🇱" },
  { code: "ITA", name: "Italy", flag: "🇮🇹" },
  { code: "JAM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JPN", name: "Japan", flag: "🇯🇵" },
  { code: "JOR", name: "Jordan", flag: "🇯🇴" },
  { code: "KAZ", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "KEN", name: "Kenya", flag: "🇰🇪" },
  { code: "KIR", name: "Kiribati", flag: "🇰🇮" },
  { code: "PRK", name: "North Korea", flag: "🇰🇵" },
  { code: "KOR", name: "South Korea", flag: "🇰🇷" },
  { code: "KWT", name: "Kuwait", flag: "🇰🇼" },
  { code: "KGZ", name: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "LAO", name: "Laos", flag: "🇱🇦" },
  { code: "LVA", name: "Latvia", flag: "🇱🇻" },
  { code: "LBN", name: "Lebanon", flag: "🇱🇧" },
  { code: "LSO", name: "Lesotho", flag: "🇱🇸" },
  { code: "LBR", name: "Liberia", flag: "🇱🇷" },
  { code: "LBY", name: "Libya", flag: "🇱🇾" },
  { code: "LIE", name: "Liechtenstein", flag: "🇱🇮" },
  { code: "LTU", name: "Lithuania", flag: "🇱🇹" },
  { code: "LUX", name: "Luxembourg", flag: "🇱🇺" },
  { code: "MDG", name: "Madagascar", flag: "🇲🇬" },
  { code: "MWI", name: "Malawi", flag: "🇲🇼" },
  { code: "MYS", name: "Malaysia", flag: "🇲🇾" },
  { code: "MDV", name: "Maldives", flag: "🇲🇻" },
  { code: "MLI", name: "Mali", flag: "🇲🇱" },
  { code: "MLT", name: "Malta", flag: "🇲🇹" },
  { code: "MHL", name: "Marshall Islands", flag: "🇲🇭" },
  { code: "MRT", name: "Mauritania", flag: "🇲🇷" },
  { code: "MUS", name: "Mauritius", flag: "🇲🇺" },
  { code: "MEX", name: "Mexico", flag: "🇲🇽" },
  { code: "FSM", name: "Micronesia", flag: "🇫🇲" },
  { code: "MDA", name: "Moldova", flag: "🇲🇩" },
  { code: "MCO", name: "Monaco", flag: "🇲🇨" },
  { code: "MNG", name: "Mongolia", flag: "🇲🇳" },
  { code: "MNE", name: "Montenegro", flag: "🇲🇪" },
  { code: "MAR", name: "Morocco", flag: "🇲🇦" },
  { code: "MOZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "MMR", name: "Myanmar", flag: "🇲🇲" },
  { code: "NAM", name: "Namibia", flag: "🇳🇦" },
  { code: "NRU", name: "Nauru", flag: "🇳🇷" },
  { code: "NPL", name: "Nepal", flag: "🇳🇵" },
  { code: "NLD", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZL", name: "New Zealand", flag: "🇳🇿" },
  { code: "NIC", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NER", name: "Niger", flag: "🇳🇪" },
  { code: "NGA", name: "Nigeria", flag: "🇳🇬" },
  { code: "MKD", name: "North Macedonia", flag: "🇲🇰" },
  { code: "NOR", name: "Norway", flag: "🇳🇴" },
  { code: "OMN", name: "Oman", flag: "🇴🇲" },
  { code: "PAK", name: "Pakistan", flag: "🇵🇰" },
  { code: "PLW", name: "Palau", flag: "🇵🇼" },
  { code: "PAN", name: "Panama", flag: "🇵🇦" },
  { code: "PNG", name: "Papua New Guinea", flag: "🇵🇬" },
  { code: "PRY", name: "Paraguay", flag: "🇵🇾" },
  { code: "PER", name: "Peru", flag: "🇵🇪" },
  { code: "PHL", name: "Philippines", flag: "🇵🇭" },
  { code: "POL", name: "Poland", flag: "🇵🇱" },
  { code: "PRT", name: "Portugal", flag: "🇵🇹" },
  { code: "QAT", name: "Qatar", flag: "🇶🇦" },
  { code: "ROU", name: "Romania", flag: "🇷🇴" },
  { code: "RUS", name: "Russia", flag: "🇷🇺" },
  { code: "RWA", name: "Rwanda", flag: "🇷🇼" },
  { code: "KNA", name: "Saint Kitts and Nevis", flag: "🇰🇳" },
  { code: "LCA", name: "Saint Lucia", flag: "🇱🇨" },
  { code: "VCT", name: "Saint Vincent and the Grenadines", flag: "🇻🇨" },
  { code: "WSM", name: "Samoa", flag: "🇼🇸" },
  { code: "SMR", name: "San Marino", flag: "🇸🇲" },
  { code: "STP", name: "Sao Tome and Principe", flag: "🇸🇹" },
  { code: "SAU", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "SEN", name: "Senegal", flag: "🇸🇳" },
  { code: "SRB", name: "Serbia", flag: "🇷🇸" },
  { code: "SYC", name: "Seychelles", flag: "🇸🇨" },
  { code: "SLE", name: "Sierra Leone", flag: "🇸🇱" },
  { code: "SGP", name: "Singapore", flag: "🇸🇬" },
  { code: "SVK", name: "Slovakia", flag: "🇸🇰" },
  { code: "SVN", name: "Slovenia", flag: "🇸🇮" },
  { code: "SLB", name: "Solomon Islands", flag: "🇸🇧" },
  { code: "SOM", name: "Somalia", flag: "🇸🇴" },
  { code: "ZAF", name: "South Africa", flag: "🇿🇦" },
  { code: "SSD", name: "South Sudan", flag: "🇸🇸" },
  { code: "ESP", name: "Spain", flag: "🇪🇸" },
  { code: "LKA", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "SDN", name: "Sudan", flag: "🇸🇩" },
  { code: "SUR", name: "Suriname", flag: "🇸🇷" },
  { code: "SWE", name: "Sweden", flag: "🇸🇪" },
  { code: "CHE", name: "Switzerland", flag: "🇨🇭" },
  { code: "SYR", name: "Syria", flag: "🇸🇾" },
  { code: "TWN", name: "Taiwan", flag: "🇹🇼" },
  { code: "TJK", name: "Tajikistan", flag: "🇹🇯" },
  { code: "TZA", name: "Tanzania", flag: "🇹🇿" },
  { code: "TLS", name: "Timor-Leste", flag: "🇹🇱" },
  { code: "TGO", name: "Togo", flag: "🇹🇬" },
  { code: "TON", name: "Tonga", flag: "🇹🇴" },
  { code: "TTO", name: "Trinidad and Tobago", flag: "🇹🇹" },
  { code: "TUN", name: "Tunisia", flag: "🇹🇳" },
  { code: "TUR", name: "Turkey", flag: "🇹🇷" },
  { code: "TKM", name: "Turkmenistan", flag: "🇹🇲" },
  { code: "TUV", name: "Tuvalu", flag: "🇹🇻" },
  { code: "UGA", name: "Uganda", flag: "🇺🇬" },
  { code: "UKR", name: "Ukraine", flag: "🇺🇦" },
  { code: "ARE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "GBR", name: "United Kingdom", flag: "🇬🇧" },
  { code: "USA", name: "United States", flag: "🇺🇸" },
  { code: "URY", name: "Uruguay", flag: "🇺🇾" },
  { code: "UZB", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "VUT", name: "Vanuatu", flag: "🇻🇺" },
  { code: "VAT", name: "Vatican City", flag: "🇻🇦" },
  { code: "VEN", name: "Venezuela", flag: "🇻🇪" },
  { code: "VNM", name: "Vietnam", flag: "🇻🇳" },
  { code: "YEM", name: "Yemen", flag: "🇾🇪" },
  { code: "ZMB", name: "Zambia", flag: "🇿🇲" },
  { code: "ZWE", name: "Zimbabwe", flag: "🇿🇼" },
];

export const COMMON_COUNTRIES = ALL_COUNTRIES;
export const POPULAR_COUNTRIES = [
  "KHM",
  "USA",
  "GBR",
  "CAN",
  "AUS",
  "DEU",
  "FRA",
  "JPN",
  "SGP",
  "CHE",
  "IDN",
  "MYS",
  "IND",
  "ARE",
  "ESP",
  "ITA",
];
