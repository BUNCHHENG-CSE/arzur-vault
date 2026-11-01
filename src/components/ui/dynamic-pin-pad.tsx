"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Delete,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldCheck,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateScrambledKeypad,
  validateDynamicPin,
  type PinValidationResult,
} from "@/lib/pin-validator";
import { Button } from "@/components/ui/button";

export interface DynamicPinPadProps {
  /**
   * Title displayed at top of the PIN interface (e.g. "Set Pay PIN")
   */
  title?: string;
  /**
   * Subtitle explaining the PIN purpose
   */
  subtitle?: string;
  /**
   * Field header label (e.g. "Create Pay PIN", "Enter Pay PIN")
   */
  label?: string;
  /**
   * Initial or controlled PIN value
   */
  value?: string;
  /**
   * Callback fired whenever the entered PIN changes
   */
  onChange?: (pin: string) => void;
  /**
   * Callback fired when Confirm is clicked or full PIN is submitted
   */
  onConfirm?: (pin: string) => void;
  /**
   * Callback fired when Back arrow is clicked
   */
  onBack?: () => void;
  /**
   * Target PIN length (defaults to 6)
   */
  defaultLength?: 4 | 6;
  /**
   * Allow user to switch between 4 and 6 digit lengths dynamically
   */
  allowLengthToggle?: boolean;
  /**
   * Confirm button label
   */
  confirmLabel?: string;
  /**
   * Terms text or legal disclaimer
   */
  termsText?: string;
  /**
   * Terms highlight keyword
   */
  termsHighlight?: string;
  /**
   * Optional custom error message
   */
  externalError?: string | null;
  /**
   * Whether to show the dynamic scramble mode toggle
   */
  enableScrambleToggle?: boolean;
  /**
   * Whether to enforce strict fintech rules (simple/reverse order & max 2 repeating digits)
   */
  enforceFintechRules?: boolean;
  /**
   * Loading state for the confirm action
   */
  isLoading?: boolean;
  /**
   * Custom CSS class for the root wrapper
   */
  className?: string;
}

export function DynamicPinPad({
  title = "Set Pay PIN",
  subtitle = "Your Pay PIN will be used to authorise pay transactions",
  label = "Create Pay PIN",
  value = "",
  onChange,
  onConfirm,
  onBack,
  defaultLength = 6,
  allowLengthToggle = true,
  confirmLabel = "Confirm",
  termsText = "By continuing, I accept the",
  termsHighlight = "Terms of Use",
  externalError = null,
  enableScrambleToggle = true,
  enforceFintechRules = true,
  isLoading = false,
  className,
}: DynamicPinPadProps) {
  const [pinLength, setPinLength] = useState<4 | 6>(defaultLength);
  const [localPin, setLocalPin] = useState<string>(value || "");
  const [revealPin, setRevealPin] = useState<boolean>(true);
  const [isScrambled, setIsScrambled] = useState<boolean>(false);
  const [scrambledLayout, setScrambledLayout] = useState<number[]>([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 0,
  ]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Controlled vs uncontrolled: prioritize value from parent when provided
  const pin = value !== undefined ? value : localPin;

  // When scramble is enabled, shuffle the numbers
  const refreshKeypadScramble = useCallback(() => {
    setScrambledLayout(generateScrambledKeypad());
  }, []);

  const handleToggleScramble = () => {
    const nextState = !isScrambled;
    setIsScrambled(nextState);
    if (nextState) {
      refreshKeypadScramble();
    }
  };

  const handlePinUpdate = useCallback(
    (newPin: string) => {
      setLocalPin(newPin);
      onChange?.(newPin);
    },
    [onChange]
  );

  const handleLengthChange = (length: 4 | 6) => {
    setPinLength(length);
    if (pin.length > length) {
      const trimmed = pin.slice(0, length);
      handlePinUpdate(trimmed);
    }
  };

  const handleDigitPress = useCallback(
    (digit: number) => {
      if (pin.length < pinLength) {
        const nextPin = pin + digit.toString();
        handlePinUpdate(nextPin);

        // Flash key animation
        setActiveKey(digit.toString());
        setTimeout(() => setActiveKey(null), 150);

        // If scramble is active, reshuffle optionally for maximum security
        if (isScrambled) {
          refreshKeypadScramble();
        }
      }
    },
    [pin, pinLength, handlePinUpdate, isScrambled, refreshKeypadScramble]
  );

  const handleBackspace = useCallback(() => {
    if (pin.length > 0) {
      const nextPin = pin.slice(0, -1);
      handlePinUpdate(nextPin);
      setActiveKey("backspace");
      setTimeout(() => setActiveKey(null), 150);
    }
  }, [pin, handlePinUpdate]);

  const handleClear = useCallback(() => {
    handlePinUpdate("");
  }, [handlePinUpdate]);

  // Validate the current PIN
  const validation: PinValidationResult = useMemo(() => {
    if (!enforceFintechRules) {
      const isComplete = pin.length === pinLength;
      return {
        isValid: isComplete,
        isComplete,
        errors: [],
        isSimpleOrder: false,
        isReverseOrder: false,
        hasOverusedDigits: false,
        overusedDigits: [],
        isAllSame: false,
      };
    }
    return validateDynamicPin(pin, pinLength);
  }, [pin, pinLength, enforceFintechRules]);

  // Handle physical keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in another input element
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigitPress(Number.parseInt(e.key, 10));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (validation.isValid && onConfirm && !isLoading) {
          onConfirm(pin);
        }
      } else if (e.key === "Escape" && onBack) {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleDigitPress,
    handleBackspace,
    validation.isValid,
    pin,
    onConfirm,
    onBack,
    isLoading,
  ]);

  const canConfirm = validation.isValid && !isLoading;

  const handleConfirmClick = () => {
    if (canConfirm && onConfirm) {
      onConfirm(pin);
    }
  };

  // Determine standard vs scrambled 3x3 + 1 layout
  const keypadDigits = useMemo(() => {
    if (!isScrambled) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    }
    return scrambledLayout.slice(0, 9);
  }, [isScrambled, scrambledLayout]);

  const bottomZeroDigit = isScrambled ? scrambledLayout[9] : 0;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between w-full max-w-sm mx-auto p-5 sm:p-6 rounded-2xl bg-[#181a20] text-white shadow-2xl select-none font-sans overflow-hidden",
        className
      )}
    >
      {/* Top Header Section */}
      <div>
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 text-zinc-300 hover:text-white rounded-lg transition-colors focus:outline-none"
              aria-label="Go back"
            >
              <ArrowLeft className="size-6 text-white" />
            </button>
          ) : (
            <div className="size-6" />
          )}

          {/* Dynamic Length Toggle (4 or 6 Digits) */}
          {allowLengthToggle && (
            <div className="flex items-center gap-1 bg-[#22262E] p-0.5 rounded-lg text-[10px] sm:text-[11px] font-mono">
              <button
                type="button"
                onClick={() => handleLengthChange(4)}
                className={cn(
                  "px-2 sm:px-2.5 py-0.5 rounded-md transition-all font-semibold",
                  pinLength === 4
                    ? "bg-[#FCD535] text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                4 Digits
              </button>
              <button
                type="button"
                onClick={() => handleLengthChange(6)}
                className={cn(
                  "px-2 sm:px-2.5 py-0.5 rounded-md transition-all font-semibold",
                  pinLength === 6
                    ? "bg-[#FCD535] text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                6 Digits
              </button>
            </div>
          )}
        </div>

        {/* Title & Subtitle */}
        <div className="mt-3 space-y-1">
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-white font-sans">
            {title}
          </h1>
          <p className="text-xs sm:text-[13px] text-[#848E9C] leading-relaxed font-sans font-normal">
            {subtitle}
          </p>
        </div>

        {/* Field Label & Eye Toggle */}
        <div className="mt-5 sm:mt-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs sm:text-sm font-medium text-white/90 font-sans">
              {label}
            </span>
            <button
              type="button"
              onClick={() => setRevealPin((prev) => !prev)}
              className="text-[#848E9C] hover:text-white transition-colors focus:outline-none p-0.5"
              aria-label={revealPin ? "Hide PIN" : "Reveal PIN"}
            >
              {revealPin ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>

          {/* Dynamic PIN Digit Boxes (Reference Design Flat Charcoal Cards) */}
          <div
            className={cn(
              "grid gap-2 sm:gap-2.5 justify-center items-center",
              pinLength === 6 ? "grid-cols-6" : "grid-cols-4 max-w-[260px] mx-auto"
            )}
          >
            {Array.from({ length: pinLength }).map((_, index) => {
              const digit = pin[index];
              const isFilled = digit !== undefined;

              return (
                <div
                  key={`pin-slot-${index}`}
                  onClick={() => {
                    if (index < pin.length) {
                      handlePinUpdate(pin.slice(0, index));
                    }
                  }}
                  className={cn(
                    "h-12 sm:h-13 w-full max-w-[44px] sm:max-w-[48px] mx-auto flex items-center justify-center rounded-lg sm:rounded-xl font-sans font-bold text-xl sm:text-2xl transition-all cursor-pointer",
                    isFilled
                      ? "bg-[#2B313A] text-white shadow-inner"
                      : "bg-[#22262E] text-transparent"
                  )}
                >
                  {isFilled ? (
                    revealPin ? (
                      digit
                    ) : (
                      <span className="inline-block size-2.5 sm:size-3 rounded-full bg-white shadow-xs" />
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Security Rule / Validation Notice & Terms */}
        <div className="mt-3 space-y-1.5 text-[11px] sm:text-xs text-[#848E9C] leading-relaxed font-sans">
          {validation.errors.length > 0 ? (
            <p className="text-amber-400 font-medium">{validation.errors[0]}</p>
          ) : externalError ? (
            <p className="text-rose-400 font-medium">{externalError}</p>
          ) : (
            <p>
              PIN cannot be in simple/reverse order (e.g 123456, 987654) and
              the same number cannot appear more than 2 times.
            </p>
          )}

          <p>
            {termsText}{" "}
            <span className="text-[#FCD535] font-medium hover:underline cursor-pointer">
              {termsHighlight}
            </span>
          </p>
        </div>
      </div>

      {/* Dynamic Keypad Section (Seamless Borderless Dialer) */}
      <div className="mt-6 sm:mt-7">
        {/* 3x4 Virtual Keypad Grid */}
        <div className="grid grid-cols-3 gap-y-1 sm:gap-y-1.5">
          {keypadDigits.map((digit) => (
            <button
              key={`key-${digit}`}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className={cn(
                "h-12 sm:h-13 flex items-center justify-center font-sans font-medium text-2xl sm:text-3xl text-white rounded-xl hover:bg-white/5 active:bg-white/10 active:scale-95 transition-all select-none focus:outline-none",
                activeKey === digit.toString() && "bg-white/15 scale-95"
              )}
            >
              {digit}
            </button>
          ))}

          {/* Bottom Row: Dot / Scramble, 0, Backspace */}
          <button
            type="button"
            onClick={enableScrambleToggle ? handleToggleScramble : undefined}
            className={cn(
              "h-12 sm:h-13 flex items-center justify-center text-white/70 hover:text-white rounded-xl hover:bg-white/5 active:bg-white/10 active:scale-95 transition-all select-none focus:outline-none",
              isScrambled && "text-[#FCD535]"
            )}
            aria-label="Toggle Scramble Keypad"
            title={isScrambled ? "Scrambled keypad active" : "Shuffle keypad"}
          >
            <span className="text-2xl font-bold leading-none">•</span>
          </button>

          <button
            type="button"
            onClick={() => handleDigitPress(bottomZeroDigit)}
            className={cn(
              "h-12 sm:h-13 flex items-center justify-center font-sans font-medium text-2xl sm:text-3xl text-white rounded-xl hover:bg-white/5 active:bg-white/10 active:scale-95 transition-all select-none focus:outline-none",
              activeKey === bottomZeroDigit.toString() && "bg-white/15 scale-95"
            )}
          >
            {bottomZeroDigit}
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className={cn(
              "h-12 sm:h-13 flex items-center justify-center text-white/80 hover:text-white rounded-xl hover:bg-white/5 active:bg-white/10 active:scale-95 transition-all select-none focus:outline-none",
              activeKey === "backspace" && "bg-white/15 scale-95"
            )}
            aria-label="Backspace"
          >
            <Delete className="size-6 text-zinc-300 hover:text-white" />
          </button>
        </div>

        {/* Action Confirm Button (Binance Gold) */}
        <div className="mt-5 sm:mt-6 pb-1">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirmClick}
            className={cn(
              "w-full h-12 rounded-xl font-sans font-bold text-base transition-all select-none shadow-md focus:outline-none",
              canConfirm
                ? "bg-[#FCD535] hover:bg-[#F0B90B] text-zinc-950 shadow-[0_4px_16px_rgba(252,213,53,0.3)] active:scale-[0.99] cursor-pointer"
                : "bg-[#2B313A] text-zinc-500 cursor-not-allowed"
            )}
          >
            {isLoading ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
