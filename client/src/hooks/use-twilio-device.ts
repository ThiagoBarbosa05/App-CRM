import { useState, useEffect, useRef, useCallback } from "react";
import { Device, Call } from "@twilio/voice-sdk";

// ─── Ringback tone (440Hz + 480Hz, padrão PSTN) ─────────────────────────────
function createRingback() {
  let ctx: AudioContext | null = null;
  let osc1: OscillatorNode | null = null;
  let osc2: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function schedule(playing: boolean) {
    if (stopped) return;
    if (playing) {
      gain!.gain.setValueAtTime(0.15, ctx!.currentTime);
      timer = setTimeout(() => schedule(false), 2000);
    } else {
      gain!.gain.setValueAtTime(0, ctx!.currentTime);
      timer = setTimeout(() => schedule(true), 4000);
    }
  }

  function start() {
    stopped = false;
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);

    osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 440;
    osc1.connect(gain);
    osc1.start();

    osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 480;
    osc2.connect(gain);
    osc2.start();

    schedule(true);
  }

  function stop() {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    try {
      osc1?.stop();
      osc2?.stop();
      ctx?.close();
    } catch {
      // silencioso
    }
    osc1 = null;
    osc2 = null;
    gain = null;
    ctx = null;
    timer = null;
  }

  return { start, stop };
}

type DeviceStatus = "offline" | "registering" | "registered" | "error";
type CallStatus =
  | "idle"
  | "connecting"
  | "ringing"
  | "in-progress"
  | "disconnected"
  | "permission-denied";

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
  clearError: () => void;
  resetCall: () => void;
}

/**
 * Solicita permissão de microfone. Retorna null se concedida, ou mensagem de erro.
 */
async function requestMicrophonePermission(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "Navegador não suporta captura de áudio";
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Libera imediatamente — o Twilio SDK fará sua própria captura.
    stream.getTracks().forEach((t) => t.stop());
    return null;
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Permissão de microfone negada. Habilite-a nas configurações do navegador.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Nenhum microfone encontrado no dispositivo.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Microfone está em uso por outro aplicativo.";
    }
    if (name === "OverconstrainedError") {
      return "Dispositivo de áudio não atende às restrições.";
    }
    return "Erro ao acessar o microfone.";
  }
}

export function useTwilioDevice(): UseTwilioDeviceReturn {
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const ringbackRef = useRef<ReturnType<typeof createRingback> | null>(null);

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
          setIsCheckingConfig(false);
          return;
        }
        const { token } = await tokenRes.json() as { token: string };

        const device = new Device(token, { logLevel: 1, enableRingingState: true });
        deviceRef.current = device;

        device.on("registered", () => setDeviceStatus("registered"));
        device.on("registering", () => setDeviceStatus("registering"));
        device.on("unregistered", () => setDeviceStatus("offline"));
        device.on("error", (err) => {
          setDeviceStatus("error");
          setErrorMessage(err.message);
        });

        // Renova o token antes de expirar (~3min de antecedência pelo SDK)
        device.on("tokenWillExpire", async () => {
          try {
            const res = await fetch("/api/twilio/token", { credentials: "include" });
            if (res.ok) {
              const { token: newToken } = await res.json() as { token: string };
              deviceRef.current?.updateToken(newToken);
            }
          } catch {
            // silencioso — o device continuará funcionando até expirar
          }
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

    // Verifica permissão de microfone antes de tentar conectar.
    const micError = await requestMicrophonePermission();
    if (micError) {
      setCallStatus("permission-denied");
      setErrorMessage(micError);
      return;
    }

    setCallStatus("connecting");
    setErrorMessage(null);

    try {
      const call = await deviceRef.current.connect({
        params: { To: to, callerId, ...extraParams },
      });
      callRef.current = call;

      call.on("ringing", () => {
        setCallStatus("ringing");
        ringbackRef.current = createRingback();
        ringbackRef.current.start();
      });
      call.on("accept", (acceptedCall: Call) => {
        ringbackRef.current?.stop();
        ringbackRef.current = null;
        setCallStatus("in-progress");
        setConnectedAt(new Date());
        const sid = acceptedCall.parameters?.CallSid ?? null;
        console.log("[twilio-device] accept | parameters:", JSON.stringify(acceptedCall.parameters));
        setCallSid(sid);
      });
      call.on("disconnect", () => {
        ringbackRef.current?.stop();
        ringbackRef.current = null;
        setCallStatus("disconnected");
        setConnectedAt(null);
        setIsMuted(false);
        setCallSid(null);
        callRef.current = null;
        // Após 2s no estado "disconnected" (para o componente pai mostrar resumo / form de nota),
        // volta a "idle" automaticamente — permitindo nova ligação sem reload.
        setTimeout(() => {
          setCallStatus((s) => (s === "disconnected" ? "idle" : s));
        }, 2000);
      });
      call.on("cancel", () => {
        ringbackRef.current?.stop();
        ringbackRef.current = null;
      });
      call.on("reject", () => {
        ringbackRef.current?.stop();
        ringbackRef.current = null;
      });
      call.on("error", (err) => {
        ringbackRef.current?.stop();
        ringbackRef.current = null;
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

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const resetCall = useCallback(() => {
    setCallStatus("idle");
    setErrorMessage(null);
    setCallSid(null);
    setConnectedAt(null);
    setIsMuted(false);
  }, []);

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
    clearError,
    resetCall,
  };
}
