import { forwardRef } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface InputMaskProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mask: string;
}

export const InputMask = forwardRef<HTMLInputElement, InputMaskProps>(
  ({ className, mask, onChange, value, defaultValue, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const maskedValue = applyMask(e.target.value, mask);
      const maskedEvent = {
        ...e,
        target: { ...e.target, value: maskedValue },
      };
      onChange?.(maskedEvent as React.ChangeEvent<HTMLInputElement>);
    };

    const maskedValue =
      value !== undefined ? applyMask(String(value), mask) : undefined;
    const maskedDefault =
      defaultValue !== undefined
        ? applyMask(String(defaultValue), mask)
        : undefined;

    return (
      <Input
        className={cn(className)}
        onChange={handleChange}
        value={maskedValue}
        defaultValue={maskedDefault}
        ref={ref}
        {...props}
      />
    );
  },
);

InputMask.displayName = "InputMask";

export function applyMask(value: string, mask: string): string {
  let digits = value.replace(/\D/g, "");

  // Remove prefixo Brasil +55 quando o número tiver 12 ou 13 dígitos
  if ((digits.length === 13 || digits.length === 12) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  let masked = "";
  let i = 0;
  for (let m = 0; m < mask.length && i < digits.length; m++) {
    if (mask[m] === "9") {
      masked += digits[i++];
    } else {
      masked += mask[m];
    }
  }
  return masked;
}
