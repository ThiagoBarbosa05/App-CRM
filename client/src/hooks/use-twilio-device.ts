import { useState, useEffect, useRef, useCallback } from "react";
import { Device, Call } from "@twilio/voice-sdk";

type DeviceStatus = "offline" | "registering" | "registered" | "error";
type CallStatus =
  | "idle"
  | "connecting"
  | "ringing"
  | "in-progress"
  | "disconnected";

interface UseTwilioDeviceReturn {
  deviceStatus: DeviceStatus;
  callStatus: CallStatus;
  callSid: string | null;
  connectedAt: Date | null;
  isMuted: boolean;
  errorMessage: string | null;
  isConfigured: boolean;
  isCheckingConfig: boolean;
  connect: (to: string, callerId: string, extraParams?: Record<string, string>) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
}

export function useTwilioDevice(): UseTwilioDeviceReturn {
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("offline");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const statusRes = await fetch("/api/twilio/voice-sdk-status", {
          credentials: "include",
        });
        if (!statusRes.ok) { setIsCheckingConfig(false); return; }
        const { configured } = await statusRes.json() as { configured: boolean };
        setIsConfigured(configured);
        if (!configured) { setIsCheckingConfig(false); return; }

        const tokenRes = await fetch("/api/twilio/token", {
          credentials: "include",
        });
        if (!tokenRes.ok) {
          setErrorMessage("Falha ao obter token do Voice SDK");
          return;
        }
        const { token } = await tokenRes.json() as { token: string };

        const device = new Device(token, { logLevel: 1 });
        deviceRef.current = device;

        device.on("registered", () => setDeviceStatus("registered"));
        device.on("registering", () => setDeviceStatus("registering"));
        device.on("unregistered", () => setDeviceStatus("offline"));
        device.on("error", (err) => {
          setDeviceStatus("error");
          setErrorMessage(err.message);
        });

        device.register();
        setDeviceStatus("registering");
      } catch (err) {
        setErrorMessage("Erro ao inicializar Twilio Device");
      } finally {
        setIsCheckingConfig(false);
      }
    }

    init();

    return () => {
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, []);

  const connect = useCallback(async (to: string, callerId: string, extraParams?: Record<string, string>) => {
    if (!deviceRef.current) {
      setErrorMessage("Device não inicializado");
      return;
    }
    setCallStatus("connecting");
    setErrorMessage(null);

    try {
      const call = await deviceRef.current.connect({
        params: { To: to, callerId, ...extraParams },
      });
      callRef.current = call;

      call.on("ringing", () => setCallStatus("ringing"));
      call.on("accept", (acceptedCall: Call) => {
        setCallStatus("in-progress");
        setConnectedAt(new Date());
        const sid = acceptedCall.parameters?.CallSid ?? null;
        console.log("[twilio-device] accept | parameters:", JSON.stringify(acceptedCall.parameters));
        setCallSid(sid);
      });
      call.on("disconnect", () => {
        setCallStatus("disconnected");
        setConnectedAt(null);
        setIsMuted(false);
        setCallSid(null);
        callRef.current = null;
      });
      call.on("error", (err) => {
        setErrorMessage(err.message);
        setCallStatus("disconnected");
      });
    } catch (err: unknown) {
      setCallStatus("idle");
      setErrorMessage(err instanceof Error ? err.message : "Erro na chamada");
    }
  }, []);

  const disconnect = useCallback(() => {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
    // Não forçamos "idle" aqui — o evento call.on("disconnect") cuida do estado.
    // Forçar "idle" causava race condition com o evento disparando depois e
    // sobrescrevendo o estado antes que o componente pai pudesse reagir ao desligamento.
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const next = !isMuted;
    callRef.current.mute(next);
    setIsMuted(next);
  }, [isMuted]);

  return {
    deviceStatus,
    callStatus,
    callSid,
    connectedAt,
    isMuted,
    errorMessage,
    isConfigured,
    isCheckingConfig,
    connect,
    disconnect,
    toggleMute,
  };
}
