import { createContext, useContext, type ReactNode } from "react";
import { useTwilioDevice } from "@/hooks/use-twilio-device";

type TwilioDeviceContextValue = ReturnType<typeof useTwilioDevice>;

const TwilioDeviceContext = createContext<TwilioDeviceContextValue | null>(
  null,
);

export function TwilioDeviceProvider({ children }: { children: ReactNode }) {
  const value = useTwilioDevice();
  return (
    <TwilioDeviceContext.Provider value={value}>
      {children}
    </TwilioDeviceContext.Provider>
  );
}

export function useTwilioDeviceContext(): TwilioDeviceContextValue {
  const ctx = useContext(TwilioDeviceContext);
  if (!ctx) {
    throw new Error(
      "useTwilioDeviceContext deve ser usado dentro de TwilioDeviceProvider",
    );
  }
  return ctx;
}
