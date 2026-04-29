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
  isMuted: boolean;
  errorMessage: string | null;
  isConfigured: boolean;
  connect: (to: string, callerId: string) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
}

export function useTwilioDevice(): UseTwilioDeviceReturn {
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>("offline");
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const statusRes = await fetch("/api/twilio/voice-sdk-status", {
          credentials: "include",
        });
        if (!statusRes.ok) return;
        const { configured } = await statusRes.json() as { configured: boolean };
        setIsConfigured(configured);
        if (!configured) return;

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
      }
    }

    init();

    return () => {
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, []);

  const connect = useCallback(async (to: string, callerId: string) => {
    if (!deviceRef.current) {
      setErrorMessage("Device não inicializado");
      return;
    }
    setCallStatus("connecting");
    setErrorMessage(null);

    try {
      const call = await deviceRef.current.connect({
        params: { To: to, callerId },
      });
      callRef.current = call;

      call.on("ringing", () => setCallStatus("ringing"));
      call.on("accept", () => setCallStatus("in-progress"));
      call.on("disconnect", () => {
        setCallStatus("disconnected");
        setIsMuted(false);
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
    setCallStatus("idle");
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
    isMuted,
    errorMessage,
    isConfigured,
    connect,
    disconnect,
    toggleMute,
  };
}
