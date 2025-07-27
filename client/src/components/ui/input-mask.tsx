import { forwardRef } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface InputMaskProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mask: string;
}

export const InputMask = forwardRef<HTMLInputElement, InputMaskProps>(
  ({ className, mask, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const maskedValue = applyMask(value, mask);
      
      // Create a new event with the masked value
      const maskedEvent = {
        ...e,
        target: {
          ...e.target,
          value: maskedValue,
        },
      };
      
      onChange?.(maskedEvent as React.ChangeEvent<HTMLInputElement>);
    };

    return (
      <Input
        className={cn(className)}
        onChange={handleChange}
        ref={ref}
        {...props}
      />
    );
  }
);

InputMask.displayName = "InputMask";

function applyMask(value: string, mask: string): string {
  // Remove all non-digit characters
  const numbers = value.replace(/\D/g, '');
  
  let maskedValue = '';
  let numberIndex = 0;
  
  for (let i = 0; i < mask.length && numberIndex < numbers.length; i++) {
    if (mask[i] === '9') {
      maskedValue += numbers[numberIndex];
      numberIndex++;
    } else {
      maskedValue += mask[i];
    }
  }
  
  return maskedValue;
}
