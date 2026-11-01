import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Copies sensitive material (passwords, seed phrases, private keys) to clipboard
 * and schedules an automatic wipe after 30 seconds.
 */
export async function copySecretToClipboard(
  secretValue: string,
  label = "Secret"
): Promise<boolean> {
  if (!secretValue) return false;

  try {
    await navigator.clipboard.writeText(secretValue);

    if (clipboardClearTimer) {
      clearTimeout(clipboardClearTimer);
    }

    toast.success("Copied to clipboard — auto-clearing in 30s", {
      description: `${label} will be automatically wiped from your clipboard.`,
    });

    clipboardClearTimer = setTimeout(async () => {
      const wipe = async () => {
        try {
          await navigator.clipboard.writeText("");
          toast.info("Clipboard cleared for security.");
        } catch {
          // Browser may block clipboard write while window is unfocused; wipe on next focus
          const wipeOnFocus = async () => {
            window.removeEventListener("focus", wipeOnFocus);
            try {
              await navigator.clipboard.writeText("");
              toast.info("Clipboard cleared for security.");
            } catch {
              // Ignore if permission denied
            }
          };
          window.addEventListener("focus", wipeOnFocus, { once: true });
        }
      };

      await wipe();
      clipboardClearTimer = null;
    }, 30_000);

    return true;
  } catch {
    toast.error("Failed to access system clipboard.");
    return false;
  }
}

/**
 * Copies non-secret metadata (e.g., username, public wallet address, URL) to clipboard.
 */
export async function copyPublicToClipboard(
  value: string,
  label = "Value"
): Promise<boolean> {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
    return true;
  } catch {
    toast.error("Failed to copy to clipboard.");
    return false;
  }
}
