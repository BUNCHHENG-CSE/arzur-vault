import type {
  PasswordSecretPayload,
  PaymentCardSecretPayload,
  SecureNoteSecretPayload,
  VaultItemType,
} from "@/types/vault";

export interface DecoyTemplateItem {
  type: VaultItemType;
  title: string;
  subtitle: string;
  url: string;
  category: string;
  payload:
    | PasswordSecretPayload
    | PaymentCardSecretPayload
    | SecureNoteSecretPayload;
}

export const DEFAULT_DECOY_ITEMS: DecoyTemplateItem[] = [
  {
    type: "PASSWORD",
    title: "Google Workspace / Gmail",
    subtitle: "personal.inbox@gmail.com",
    url: "https://accounts.google.com",
    category: "Personal",
    payload: {
      username: "personal.inbox@gmail.com",
      password: "P@ssword2025!Sunshine",
      notes: "Standard personal inbox",
    },
  },
  {
    type: "PASSWORD",
    title: "Spotify Music",
    subtitle: "musicfan99@gmail.com",
    url: "https://open.spotify.com",
    category: "Entertainment",
    payload: {
      username: "musicfan99@gmail.com",
      password: "Rock&RollForever#88",
      notes: "Family plan subscriber",
    },
  },
  {
    type: "PASSWORD",
    title: "Amazon Prime Store",
    subtitle: "buyer.orders@gmail.com",
    url: "https://amazon.com",
    category: "Shopping",
    payload: {
      username: "buyer.orders@gmail.com",
      password: "PrimeDelivery*2024",
      notes: "Household delivery orders",
    },
  },
  {
    type: "PAYMENT_CARD",
    title: "Chase Sapphire Everyday",
    subtitle: "Visa ending in 4112",
    url: "https://chase.com",
    category: "Banking",
    payload: {
      cardholderName: "Alex Mercer",
      cardNumber: "4112345678904112",
      expiryMonth: "08",
      expiryYear: "2028",
      cvv: "382",
      brand: "Visa",
      notes: "Daily contactless debit card",
    },
  },
  {
    type: "SECURE_NOTE",
    title: "Home Wi-Fi & Apartment Keycodes",
    subtitle: "Front gate, building code, guest SSID",
    url: "",
    category: "Home",
    payload: {
      content:
        "Front Gate Intercom: #4092\nGuest Wi-Fi SSID: Skyline-Guest-5G\nPassword: CoffeeMorningBlue44\nBike room storage locker: 14-32-09",
    },
  },
];
