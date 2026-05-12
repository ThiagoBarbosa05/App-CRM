import { useEffect, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  X,
  Plus,
  Check,
  ChevronsUpDown,
  Rocket,
  Sparkles,
} from "lucide-react";
import { PromptAssistantDialog } from "@/components/telemarketing/prompt-assistant-dialog";
import { cn } from "@/lib/utils";
import { VoiceSelector } from "@/components/voice-selector";
import {
  AppTabs,
  UnderlineTabsList,
  UnderlineTabsTrigger,
  AppTabsContent,
} from "@/components/app-tabs";

// ─── Schema ──────────────────────────────────────────────────────────────────

const agentSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  // Geral
  firstMessage: z.string().default(""),
  language: z.string().default("pt-br"),
  llm: z.string().default("gemini-2.5-flash"),
  prompt: z.string().default(""),
  temperature: z.number().min(0).max(1).default(0),
  maxTokens: z.number().default(-1),
  timezone: z.string().default(""),
  disableFirstMessageInterruptions: z.boolean().default(false),
  ignoreDefaultPersonality: z.boolean().default(false),
  enableParallelToolCalls: z.boolean().default(false),
  cascadeTimeoutSeconds: z.number().default(8),
  // Voz & TTS
  voiceId: z.string().default(""),
  ttsModelId: z.string().default("eleven_v3_conversational"),
  stability: z.number().min(0).max(1).default(0.5),
  similarityBoost: z.number().min(0).max(1).default(0.8),
  speed: z.number().min(0.5).max(2).default(1),
  optimizeStreamingLatency: z.number().min(0).max(4).default(3),
  expressiveMode: z.boolean().default(true),
  agentOutputAudioFormat: z.string().default("pcm_16000"),
  textNormalisationType: z.string().default("system_prompt"),
  // ASR & VAD
  asrQuality: z.string().default("high"),
  asrProvider: z.string().default("scribe_realtime"),
  userInputAudioFormat: z.string().default("pcm_16000"),
  asrKeywords: z.array(z.string()).default([]),
  backgroundVoiceDetection: z.boolean().default(false),
  // Turn detection
  turnTimeout: z.number().default(7),
  silenceEndCallTimeout: z.number().default(-1),
  turnEagerness: z.string().default("normal"),
  turnMode: z.string().default("turn"),
  speculativeTurn: z.boolean().default(true),
  retranscribeOnTurnTimeout: z.boolean().default(false),
  softTimeoutSeconds: z.number().default(-1),
  softTimeoutMessage: z.string().default("Hhmmmm...yeah."),
  useLlmGeneratedMessage: z.boolean().default(false),
  // Conversa
  maxDurationSeconds: z.number().default(600),
  textOnly: z.boolean().default(false),
  monitoringEnabled: z.boolean().default(false),
  fileInputEnabled: z.boolean().default(true),
  fileInputMaxFiles: z.number().default(10),
  backgroundMusicSourceType: z.string().nullable().default(null),
  backgroundMusicSourceId: z.string().default(""),
  backgroundMusicVolume: z.number().min(0).max(1).default(0.6),
  clientEvents: z
    .array(z.string())
    .default([
      "audio",
      "interruption",
      "agent_response",
      "user_transcript",
      "agent_response_correction",
      "agent_tool_response",
    ]),
  // Avançado — Privacidade
  recordVoice: z.boolean().default(true),
  retentionDays: z.number().default(-1),
  deleteAudio: z.boolean().default(false),
  deleteTranscriptAndPii: z.boolean().default(false),
  // Avançado — Limites
  agentConcurrencyLimit: z.number().default(-1),
  dailyLimit: z.number().default(100000),
  burstingEnabled: z.boolean().default(true),
  // Avançado — Guardrails
  guardrailFocusEnabled: z.boolean().default(false),
  guardrailPromptInjectionEnabled: z.boolean().default(false),
  guardrailTriggerAction: z.string().default("end_call"),
  guardrailSexualEnabled: z.boolean().default(false),
  guardrailSexualThreshold: z.string().default("medium"),
  guardrailViolenceEnabled: z.boolean().default(false),
  guardrailViolenceThreshold: z.string().default("medium"),
  guardrailHarassmentEnabled: z.boolean().default(false),
  guardrailHarassmentThreshold: z.string().default("medium"),
  guardrailSelfHarmEnabled: z.boolean().default(false),
  guardrailSelfHarmThreshold: z.string().default("medium"),
  guardrailProfanityEnabled: z.boolean().default(false),
  guardrailProfanityThreshold: z.string().default("medium"),
  guardrailReligionPoliticsEnabled: z.boolean().default(false),
  guardrailReligionPoliticsThreshold: z.string().default("medium"),
  guardrailMedicalLegalEnabled: z.boolean().default(false),
  guardrailMedicalLegalThreshold: z.string().default("medium"),
});

type AgentForm = z.infer<typeof agentSchema>;

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: "pt-br", label: "Português (Brasil)" },
  { value: "pt", label: "Português (Portugal)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
];

const LLM_MODELS = [
  {
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (multilíngue, recomendado)",
  },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (rápido)" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4 (multilíngue)" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (rápido)" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

const TTS_MODELS = [
  {
    value: "eleven_v3_conversational",
    label: "Eleven v3 Conversational (recomendado)",
  },
  {
    value: "eleven_turbo_v2_5",
    label: "Eleven Turbo v2.5 (multilíngue, baixa latência)",
  },
  { value: "eleven_multilingual_v2", label: "Eleven Multilingual v2" },
  { value: "eleven_flash_v2_5", label: "Eleven Flash v2.5 (mais rápido)" },
  { value: "eleven_flash_v2", label: "Eleven Flash v2" },
  {
    value: "eleven_monolingual_v1",
    label: "Eleven Monolingual v1 (somente inglês)",
  },
];

const AUDIO_FORMATS = [
  { value: "pcm_16000", label: "PCM 16kHz" },
  { value: "pcm_22050", label: "PCM 22kHz" },
  { value: "pcm_24000", label: "PCM 24kHz" },
  { value: "mp3_44100_128", label: "MP3 44.1kHz 128kbps" },
];

const INPUT_AUDIO_FORMATS = [
  { value: "pcm_16000", label: "PCM 16kHz" },
  { value: "pcm_8000", label: "PCM 8kHz" },
  { value: "ulaw_8000", label: "µ-law 8kHz (telefone)" },
];

const TURN_EAGERNESS = [
  { value: "low", label: "Baixa — espera mais antes de responder" },
  { value: "normal", label: "Normal (padrão)" },
  { value: "high", label: "Alta — responde mais rápido" },
];

const LATENCY_OPTIONS = [
  { value: 0, label: "0 — Sem otimização" },
  { value: 1, label: "1 — Baixa" },
  { value: 2, label: "2 — Média" },
  { value: 3, label: "3 — Alta (padrão)" },
  { value: 4, label: "4 — Máxima" },
];

const CLIENT_EVENTS = [
  { value: "audio", label: "audio" },
  { value: "interruption", label: "interruption" },
  { value: "agent_response", label: "agent_response" },
  { value: "user_transcript", label: "user_transcript" },
  { value: "agent_response_correction", label: "agent_response_correction" },
  { value: "agent_tool_response", label: "agent_tool_response" },
];

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "América/São Paulo" },
  { value: "America/Manaus", label: "América/Manaus" },
  { value: "America/Belem", label: "América/Belém" },
  { value: "America/Fortaleza", label: "América/Fortaleza" },
  { value: "America/Recife", label: "América/Recife" },
  { value: "America/Maceio", label: "América/Maceió" },
  { value: "America/Bahia", label: "América/Bahia" },
  { value: "America/Cuiaba", label: "América/Cuiabá" },
  { value: "America/Porto_Velho", label: "América/Porto Velho" },
  { value: "America/Boa_Vista", label: "América/Boa Vista" },
  { value: "America/Rio_Branco", label: "América/Rio Branco" },
  { value: "America/Noronha", label: "América/Fernando de Noronha" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "América/Nova York (EST/EDT)" },
  { value: "America/Chicago", label: "América/Chicago (CST/CDT)" },
  { value: "America/Denver", label: "América/Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "América/Los Angeles (PST/PDT)" },
  { value: "America/Phoenix", label: "América/Phoenix (MST)" },
  { value: "America/Anchorage", label: "América/Anchorage" },
  { value: "America/Honolulu", label: "América/Honolulu" },
  { value: "America/Mexico_City", label: "América/Cidade do México" },
  { value: "America/Buenos_Aires", label: "América/Buenos Aires" },
  { value: "America/Santiago", label: "América/Santiago" },
  { value: "America/Lima", label: "América/Lima" },
  { value: "America/Bogota", label: "América/Bogotá" },
  { value: "America/Caracas", label: "América/Caracas" },
  { value: "America/Toronto", label: "América/Toronto" },
  { value: "America/Vancouver", label: "América/Vancouver" },
  { value: "Europe/London", label: "Europa/Londres (GMT/BST)" },
  { value: "Europe/Paris", label: "Europa/Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Europa/Berlim" },
  { value: "Europe/Madrid", label: "Europa/Madrid" },
  { value: "Europe/Rome", label: "Europa/Roma" },
  { value: "Europe/Amsterdam", label: "Europa/Amsterdã" },
  { value: "Europe/Lisbon", label: "Europa/Lisboa" },
  { value: "Europe/Moscow", label: "Europa/Moscou" },
  { value: "Europe/Istanbul", label: "Europa/Istambul" },
  { value: "Europe/Warsaw", label: "Europa/Varsóvia" },
  { value: "Africa/Johannesburg", label: "África/Joanesburgo" },
  { value: "Africa/Lagos", label: "África/Lagos" },
  { value: "Africa/Cairo", label: "África/Cairo" },
  { value: "Asia/Dubai", label: "Ásia/Dubai" },
  { value: "Asia/Kolkata", label: "Ásia/Calcutá" },
  { value: "Asia/Bangkok", label: "Ásia/Bangkok" },
  { value: "Asia/Singapore", label: "Ásia/Singapura" },
  { value: "Asia/Shanghai", label: "Ásia/Xangai" },
  { value: "Asia/Tokyo", label: "Ásia/Tóquio" },
  { value: "Asia/Seoul", label: "Ásia/Seul" },
  { value: "Australia/Sydney", label: "Austrália/Sydney" },
  { value: "Australia/Melbourne", label: "Austrália/Melbourne" },
  { value: "Australia/Perth", label: "Austrália/Perth" },
  { value: "Pacific/Auckland", label: "Pacífico/Auckland" },
];

function TimezoneSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = TIMEZONES.find((tz) => tz.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.label : value || "Selecionar fuso horário..."}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar fuso horário..." />
          <CommandList>
            <CommandEmpty>Nenhum fuso encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 size-4",
                    value === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                Padrão do workspace
              </CommandItem>
              {TIMEZONES.map((tz) => (
                <CommandItem
                  key={tz.value}
                  value={`${tz.label} ${tz.value}`}
                  onSelect={() => {
                    onChange(tz.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === tz.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>{tz.label}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    {tz.value}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const GUARDRAIL_CATEGORIES = [
  {
    key: "Sexual",
    field: "guardrailSexual" as const,
    label: "Conteúdo sexual",
  },
  { key: "Violence", field: "guardrailViolence" as const, label: "Violência" },
  {
    key: "Harassment",
    field: "guardrailHarassment" as const,
    label: "Assédio",
  },
  {
    key: "SelfHarm",
    field: "guardrailSelfHarm" as const,
    label: "Automutilação",
  },
  {
    key: "Profanity",
    field: "guardrailProfanity" as const,
    label: "Palavrões",
  },
  {
    key: "ReligionPolitics",
    field: "guardrailReligionPolitics" as const,
    label: "Religião/Política",
  },
  {
    key: "MedicalLegal",
    field: "guardrailMedicalLegal" as const,
    label: "Médico/Jurídico",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiToForm(data: Record<string, any>): Partial<AgentForm> {
  const cc = data.conversation_config ?? {};
  const agent = cc.agent ?? {};
  const promptCfg = agent.prompt ?? {};
  const tts = cc.tts ?? {};
  const asr = cc.asr ?? {};
  const turn = cc.turn ?? {};
  const conv = cc.conversation ?? {};
  const vad = cc.vad ?? {};
  const soft = turn.soft_timeout_config ?? {};
  const fileInput = conv.file_input ?? {};
  const bgMusic = conv.background_music ?? {};
  const ps = data.platform_settings ?? {};
  const privacy = ps.privacy ?? {};
  const callLimits = ps.call_limits ?? {};
  const guardrails = ps.guardrails ?? {};
  const guardrailContent = guardrails.content ?? {};
  const guardrailConfig = guardrailContent.config ?? {};
  const triggerAction = guardrailContent.trigger_action ?? {};

  return {
    name: data.name ?? "",
    firstMessage: agent.first_message ?? "",
    language: agent.language ?? "pt-br",
    llm: promptCfg.llm ?? "gemini-2.5-flash",
    prompt: promptCfg.prompt ?? "",
    temperature: safeNum(promptCfg.temperature, 0),
    maxTokens: safeNum(promptCfg.max_tokens, -1),
    timezone: agent.timezone ?? "",
    disableFirstMessageInterruptions:
      agent.disable_first_message_interruptions ?? false,
    ignoreDefaultPersonality: agent.ignore_default_personality ?? false,
    enableParallelToolCalls: promptCfg.enable_parallel_tool_calls ?? false,
    cascadeTimeoutSeconds: safeNum(agent.cascade_timeout_seconds, 8),

    voiceId: tts.voice_id ?? "",
    ttsModelId: tts.model_id ?? "eleven_v3_conversational",
    stability: safeNum(tts.stability, 0.5),
    similarityBoost: safeNum(tts.similarity_boost, 0.8),
    speed: safeNum(tts.speed, 1),
    optimizeStreamingLatency: safeNum(tts.optimize_streaming_latency, 3),
    expressiveMode: tts.expressive_mode ?? true,
    agentOutputAudioFormat: tts.agent_output_audio_format ?? "pcm_16000",
    textNormalisationType: tts.text_normalisation_type ?? "system_prompt",

    asrQuality: asr.quality ?? "high",
    asrProvider: asr.provider ?? "scribe_realtime",
    userInputAudioFormat: asr.user_input_audio_format ?? "pcm_16000",
    asrKeywords: Array.isArray(asr.keywords) ? asr.keywords : [],
    backgroundVoiceDetection: vad.background_voice_detection ?? false,

    turnTimeout: safeNum(turn.turn_timeout, 7),
    silenceEndCallTimeout: safeNum(turn.silence_end_call_timeout, -1),
    turnEagerness: turn.turn_eagerness ?? "normal",
    turnMode: turn.mode ?? "turn",
    speculativeTurn: turn.speculative_turn ?? true,
    retranscribeOnTurnTimeout: turn.retranscribe_on_turn_timeout ?? false,
    softTimeoutSeconds: safeNum(soft.timeout_seconds, -1),
    softTimeoutMessage: soft.message ?? "Hhmmmm...yeah.",
    useLlmGeneratedMessage: soft.use_llm_generated_message ?? false,

    maxDurationSeconds: safeNum(conv.max_duration_seconds, 600),
    textOnly: conv.text_only ?? false,
    monitoringEnabled: conv.monitoring_enabled ?? false,
    fileInputEnabled: fileInput.enabled ?? true,
    fileInputMaxFiles: safeNum(fileInput.max_files_per_conversation, 10),
    backgroundMusicSourceType: bgMusic.source_type ?? null,
    backgroundMusicSourceId: bgMusic.source_id ?? "",
    backgroundMusicVolume: safeNum(bgMusic.volume, 0.6),
    clientEvents: Array.isArray(conv.client_events)
      ? conv.client_events
      : [
          "audio",
          "interruption",
          "agent_response",
          "user_transcript",
          "agent_response_correction",
          "agent_tool_response",
        ],

    recordVoice: privacy.record_voice ?? true,
    retentionDays: safeNum(privacy.retention_days, -1),
    deleteAudio: privacy.delete_audio ?? false,
    deleteTranscriptAndPii: privacy.delete_transcript_and_pii ?? false,

    agentConcurrencyLimit: safeNum(callLimits.agent_concurrency_limit, -1),
    dailyLimit: safeNum(callLimits.daily_limit, 100000),
    burstingEnabled: callLimits.bursting_enabled ?? true,

    guardrailFocusEnabled: guardrails.focus?.is_enabled ?? false,
    guardrailPromptInjectionEnabled:
      guardrails.prompt_injection?.is_enabled ?? false,
    guardrailTriggerAction: triggerAction.type ?? "end_call",
    guardrailSexualEnabled: guardrailConfig.sexual?.is_enabled ?? false,
    guardrailSexualThreshold: guardrailConfig.sexual?.threshold ?? "medium",
    guardrailViolenceEnabled: guardrailConfig.violence?.is_enabled ?? false,
    guardrailViolenceThreshold: guardrailConfig.violence?.threshold ?? "medium",
    guardrailHarassmentEnabled: guardrailConfig.harassment?.is_enabled ?? false,
    guardrailHarassmentThreshold:
      guardrailConfig.harassment?.threshold ?? "medium",
    guardrailSelfHarmEnabled: guardrailConfig.self_harm?.is_enabled ?? false,
    guardrailSelfHarmThreshold:
      guardrailConfig.self_harm?.threshold ?? "medium",
    guardrailProfanityEnabled: guardrailConfig.profanity?.is_enabled ?? false,
    guardrailProfanityThreshold:
      guardrailConfig.profanity?.threshold ?? "medium",
    guardrailReligionPoliticsEnabled:
      guardrailConfig.religion_or_politics?.is_enabled ?? false,
    guardrailReligionPoliticsThreshold:
      guardrailConfig.religion_or_politics?.threshold ?? "medium",
    guardrailMedicalLegalEnabled:
      guardrailConfig.medical_and_legal_information?.is_enabled ?? false,
    guardrailMedicalLegalThreshold:
      guardrailConfig.medical_and_legal_information?.threshold ?? "medium",
  };
}

function mapFormToApi(f: AgentForm): {
  name: string;
  conversationConfig: Record<string, unknown>;
  platformSettings: Record<string, unknown>;
} {
  return {
    name: f.name,
    conversationConfig: {
      asr: {
        quality: f.asrQuality,
        provider: f.asrProvider,
        user_input_audio_format: f.userInputAudioFormat,
        keywords: f.asrKeywords,
      },
      turn: {
        turn_timeout: f.turnTimeout,
        silence_end_call_timeout: f.silenceEndCallTimeout,
        mode: f.turnMode,
        turn_eagerness: f.turnEagerness,
        speculative_turn: f.speculativeTurn,
        retranscribe_on_turn_timeout: f.retranscribeOnTurnTimeout,
        soft_timeout_config: {
          timeout_seconds: f.softTimeoutSeconds,
          message: f.softTimeoutMessage,
          use_llm_generated_message: f.useLlmGeneratedMessage,
        },
      },
      conversation: {
        text_only: f.textOnly,
        max_duration_seconds: f.maxDurationSeconds,
        client_events: f.clientEvents,
        file_input: {
          enabled: f.fileInputEnabled,
          max_files_per_conversation: f.fileInputMaxFiles,
        },
        monitoring_enabled: f.monitoringEnabled,
        background_music: {
          source_type: f.backgroundMusicSourceType,
          source_id: f.backgroundMusicSourceId || null,
          volume: f.backgroundMusicVolume,
        },
      },
      vad: {
        background_voice_detection: f.backgroundVoiceDetection,
      },
      tts: {
        model_id: f.ttsModelId,
        voice_id: f.voiceId || undefined,
        expressive_mode: f.expressiveMode,
        agent_output_audio_format: f.agentOutputAudioFormat,
        optimize_streaming_latency: f.optimizeStreamingLatency,
        stability: f.stability,
        speed: f.speed,
        similarity_boost: f.similarityBoost,
        text_normalisation_type: f.textNormalisationType,
      },
      agent: {
        first_message: f.firstMessage,
        language: f.language,
        disable_first_message_interruptions: f.disableFirstMessageInterruptions,
        ignore_default_personality: f.ignoreDefaultPersonality,
        cascade_timeout_seconds: f.cascadeTimeoutSeconds,
        timezone: f.timezone || null,
        prompt: {
          prompt: f.prompt,
          llm: f.llm,
          temperature: f.temperature,
          max_tokens: f.maxTokens,
          enable_parallel_tool_calls: f.enableParallelToolCalls,
        },
      },
    },
    platformSettings: {
      privacy: {
        record_voice: f.recordVoice,
        retention_days: f.retentionDays,
        delete_audio: f.deleteAudio,
        delete_transcript_and_pii: f.deleteTranscriptAndPii,
      },
      call_limits: {
        agent_concurrency_limit: f.agentConcurrencyLimit,
        daily_limit: f.dailyLimit,
        bursting_enabled: f.burstingEnabled,
      },
      guardrails: {
        focus: { is_enabled: f.guardrailFocusEnabled },
        prompt_injection: { is_enabled: f.guardrailPromptInjectionEnabled },
        content: {
          execution_mode: "streaming",
          config: {
            sexual: {
              is_enabled: f.guardrailSexualEnabled,
              threshold: f.guardrailSexualThreshold,
            },
            violence: {
              is_enabled: f.guardrailViolenceEnabled,
              threshold: f.guardrailViolenceThreshold,
            },
            harassment: {
              is_enabled: f.guardrailHarassmentEnabled,
              threshold: f.guardrailHarassmentThreshold,
            },
            self_harm: {
              is_enabled: f.guardrailSelfHarmEnabled,
              threshold: f.guardrailSelfHarmThreshold,
            },
            profanity: {
              is_enabled: f.guardrailProfanityEnabled,
              threshold: f.guardrailProfanityThreshold,
            },
            religion_or_politics: {
              is_enabled: f.guardrailReligionPoliticsEnabled,
              threshold: f.guardrailReligionPoliticsThreshold,
            },
            medical_and_legal_information: {
              is_enabled: f.guardrailMedicalLegalEnabled,
              threshold: f.guardrailMedicalLegalThreshold,
            },
          },
          trigger_action: { type: f.guardrailTriggerAction },
        },
      },
    },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </p>
        {hint && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <FieldRow label={`${label} — ${value}`} hint={hint}>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="mt-1"
      />
    </FieldRow>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AgentConfigModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
  campaignName: string;
}

export function AgentConfigModal({
  open,
  onClose,
  agentId,
  campaignName,
}: AgentConfigModalProps) {
  const [keywordInput, setKeywordInput] = useState("");
  const [promptAssistantOpen, setPromptAssistantOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<AgentForm>({ resolver: zodResolver(agentSchema) });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawConfig, isLoading } = useQuery<Record<string, any>>({
    queryKey: ["/api/elevenlabs/agents", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar agente");
      return res.json();
    },
    enabled: open && !!agentId,
  });

  useEffect(() => {
    if (rawConfig) {
      reset(mapApiToForm(rawConfig));
    }
  }, [rawConfig, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: AgentForm) => {
      const payload = mapFormToApi(data);
      const res = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao salvar");
      }
    },
    onSuccess: () => {
      toast({ title: "Configurações salvas" });
      onClose();
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      }),
  });

  const saveAndPublishMutation = useMutation({
    mutationFn: async (data: AgentForm) => {
      // 1. Salvar configurações
      const payload = mapFormToApi(data);
      const saveRes = await fetch(`/api/elevenlabs/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) {
        const err = (await saveRes.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao salvar");
      }

      // 2. Publicar (deploy branch principal com 100% de tráfego)
      const deployRes = await fetch(
        `/api/elevenlabs/agents/${agentId}/deploy`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      if (!deployRes.ok) {
        const err = (await deployRes.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Erro ao publicar");
      }
    },
    onSuccess: () => {
      toast({
        title: "Agente publicado com sucesso",
        description: "As alterações estão ao vivo.",
      });
      onClose();
    },
    onError: (err: Error) =>
      toast({
        title: "Erro ao publicar",
        description: err.message,
        variant: "destructive",
      }),
  });

  const w = watch();

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    const existing = w.asrKeywords ?? [];
    if (!existing.includes(kw)) {
      setValue("asrKeywords", [...existing, kw]);
    }
    setKeywordInput("");
  };

  const removeKeyword = (kw: string) => {
    setValue(
      "asrKeywords",
      (w.asrKeywords ?? []).filter((k) => k !== kw),
    );
  };

  const toggleClientEvent = (ev: string) => {
    const current = w.clientEvents ?? [];
    if (current.includes(ev)) {
      setValue(
        "clientEvents",
        current.filter((e) => e !== ev),
      );
    } else {
      setValue("clientEvents", [...current, ev]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <SheetTitle className="text-base">
            Configurar Agente IA — {campaignName}
          </SheetTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
            {agentId}
          </p>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center flex-1 py-20">
            <Loader2 className="size-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <AppTabs
              defaultValue="geral"
              className="flex flex-col flex-1 overflow-hidden"
            >
              <UnderlineTabsList className="px-6 shrink-0">
                <UnderlineTabsTrigger value="geral" color="blue">
                  Geral
                </UnderlineTabsTrigger>
                <UnderlineTabsTrigger value="voz" color="blue">
                  Voz & TTS
                </UnderlineTabsTrigger>
                <UnderlineTabsTrigger value="asr" color="blue">
                  ASR & VAD
                </UnderlineTabsTrigger>
                <UnderlineTabsTrigger value="turno" color="blue">
                  Turno
                </UnderlineTabsTrigger>
                <UnderlineTabsTrigger value="conversa" color="blue">
                  Conversa
                </UnderlineTabsTrigger>
                <UnderlineTabsTrigger value="avancado" color="blue">
                  Avançado
                </UnderlineTabsTrigger>
              </UnderlineTabsList>

              {/* ── Tab: Geral ─────────────────────────────────────── */}
              <AppTabsContent
                value="geral"
                className="flex-1 overflow-y-auto px-6 pb-4 mt-0 space-y-4"
              >
                <FieldRow label="Nome do agente">
                  <Input
                    {...register("name")}
                    placeholder="Ex: Agente de vendas"
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500">
                      {errors.name.message}
                    </p>
                  )}
                </FieldRow>

                <FieldRow label="Primeira mensagem">
                  <Input
                    {...register("firstMessage")}
                    placeholder="Ex: Olá, posso te ajudar?"
                  />
                </FieldRow>

                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Idioma">
                    <Select
                      value={w.language}
                      onValueChange={(v) => setValue("language", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <FieldRow label="Modelo LLM">
                    <Select
                      value={w.llm}
                      onValueChange={(v) => setValue("llm", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LLM_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>

                <FieldRow
                  label={
                    <div className="flex items-center justify-between">
                      <span>System Prompt</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-7 text-xs font-normal text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 -mr-1"
                        onClick={() => setPromptAssistantOpen(true)}
                      >
                        <Sparkles className="size-3.5" />
                        Gerar com IA
                      </Button>
                    </div>
                  }
                >
                  <Textarea
                    {...register("prompt")}
                    placeholder="Instruções de comportamento do agente..."
                    rows={10}
                    className="font-mono text-xs"
                  />
                </FieldRow>

                <PromptAssistantDialog
                  open={promptAssistantOpen}
                  onClose={() => setPromptAssistantOpen(false)}
                  agentName={w.name}
                  onApply={(prompt) => setValue("prompt", prompt)}
                />

                <FieldRow
                  label="Temperature"
                  hint="0 = determinístico, 1 = criativo"
                >
                  <div className="flex items-center gap-3 pt-1">
                    <Slider
                      value={[w.temperature ?? 0]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={([v]) => setValue("temperature", v)}
                      className="flex-1"
                    />
                    <span className="text-sm w-8 text-right tabular-nums">
                      {(w.temperature ?? 0).toFixed(2)}
                    </span>
                  </div>
                </FieldRow>

                <div className="grid grid-cols-2 gap-4">
                  <FieldRow
                    label="Cascade Timeout (s)"
                    hint="Tempo máximo de resposta do LLM"
                  >
                    <Controller
                      control={control}
                      name="cascadeTimeoutSeconds"
                      render={({ field }) => (
                        <Input
                          type="number"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      )}
                    />
                  </FieldRow>

                  <FieldRow label="Max Tokens" hint="-1 = ilimitado">
                    <Controller
                      control={control}
                      name="maxTokens"
                      render={({ field }) => (
                        <Input
                          type="number"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      )}
                    />
                  </FieldRow>
                </div>

                <FieldRow
                  label="Fuso horário"
                  hint="Deixe em branco para usar o padrão do workspace"
                >
                  <TimezoneSelector
                    value={w.timezone ?? ""}
                    onChange={(v) => setValue("timezone", v)}
                  />
                </FieldRow>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg px-3">
                  <SwitchRow
                    label="Interrompível"
                    hint="Permite que o usuário interrompa a fala do agente durante a 1ª mensagem"
                    checked={!(w.disableFirstMessageInterruptions ?? false)}
                    onCheckedChange={(v) =>
                      setValue("disableFirstMessageInterruptions", !v)
                    }
                  />
                  <SwitchRow
                    label="Ignorar personalidade padrão do workspace"
                    checked={w.ignoreDefaultPersonality ?? false}
                    onCheckedChange={(v) =>
                      setValue("ignoreDefaultPersonality", v)
                    }
                  />
                  <SwitchRow
                    label="Chamadas de ferramentas em paralelo"
                    hint="Permite que o agente invoque múltiplas tools simultaneamente"
                    checked={w.enableParallelToolCalls ?? false}
                    onCheckedChange={(v) =>
                      setValue("enableParallelToolCalls", v)
                    }
                  />
                </div>
              </AppTabsContent>

              {/* ── Tab: Voz & TTS ─────────────────────────────────── */}
              <AppTabsContent
                value="voz"
                className="flex-1 overflow-y-auto px-6 pb-4 mt-0 space-y-4"
              >
                <FieldRow label="Voz">
                  <VoiceSelector
                    value={w.voiceId}
                    onChange={(id) => setValue("voiceId", id)}
                    placeholder="Usar voz padrão do agente"
                  />
                </FieldRow>

                <FieldRow label="Modelo TTS">
                  <Select
                    value={w.ttsModelId}
                    onValueChange={(v) => setValue("ttsModelId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TTS_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Formato de saída de áudio">
                    <Select
                      value={w.agentOutputAudioFormat}
                      onValueChange={(v) =>
                        setValue("agentOutputAudioFormat", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIO_FORMATS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <FieldRow label="Normalização de texto">
                    <Select
                      value={w.textNormalisationType}
                      onValueChange={(v) =>
                        setValue("textNormalisationType", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system_prompt">
                          Via system prompt
                        </SelectItem>
                        <SelectItem value="post_generation">
                          Pós-geração
                        </SelectItem>
                        <SelectItem value="disabled">Desabilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>

                <FieldRow label="Otimização de latência">
                  <Select
                    value={String(w.optimizeStreamingLatency ?? 3)}
                    onValueChange={(v) =>
                      setValue("optimizeStreamingLatency", Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LATENCY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                <SliderField
                  label="Stability"
                  hint="Consistência da voz. Valores altos = mais estável, valores baixos = mais expressivo"
                  value={w.stability ?? 0.5}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setValue("stability", v)}
                />

                <SliderField
                  label="Similarity Boost"
                  hint="Clareza e semelhança com a voz original"
                  value={w.similarityBoost ?? 0.8}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setValue("similarityBoost", v)}
                />

                <SliderField
                  label="Speed"
                  hint="Velocidade de fala (0.5 = lento, 1 = normal, 2 = rápido)"
                  value={w.speed ?? 1}
                  min={0.5}
                  max={2}
                  step={0.05}
                  onChange={(v) => setValue("speed", v)}
                />

                <SwitchRow
                  label="Modo expressivo"
                  hint="Permite entonação mais natural e emocional"
                  checked={w.expressiveMode ?? true}
                  onCheckedChange={(v) => setValue("expressiveMode", v)}
                />
              </AppTabsContent>

              {/* ── Tab: ASR & VAD ──────────────────────────────────── */}
              <AppTabsContent
                value="asr"
                className="flex-1 overflow-y-auto px-6 pb-4 mt-0 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Qualidade ASR">
                    <Select
                      value={w.asrQuality}
                      onValueChange={(v) => setValue("asrQuality", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <FieldRow label="Provider ASR">
                    <Select
                      value={w.asrProvider}
                      onValueChange={(v) => setValue("asrProvider", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scribe_realtime">
                          Scribe Realtime (padrão)
                        </SelectItem>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>

                <FieldRow label="Formato de entrada de áudio (usuário)">
                  <Select
                    value={w.userInputAudioFormat}
                    onValueChange={(v) => setValue("userInputAudioFormat", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INPUT_AUDIO_FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                <FieldRow
                  label="Keywords ASR"
                  hint="Palavras-chave que melhoram o reconhecimento de fala"
                >
                  <div className="flex gap-2">
                    <Input
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKeyword();
                        }
                      }}
                      placeholder="Digite e pressione Enter"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addKeyword}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(w.asrKeywords ?? []).map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs"
                      >
                        {kw}
                        <button type="button" onClick={() => removeKeyword(kw)}>
                          <X className="size-3 text-slate-400 hover:text-slate-700" />
                        </button>
                      </span>
                    ))}
                  </div>
                </FieldRow>

                <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3">
                  <SwitchRow
                    label="Detecção de voz em segundo plano"
                    hint="Filtra ruído de outras vozes durante a chamada"
                    checked={w.backgroundVoiceDetection ?? false}
                    onCheckedChange={(v) =>
                      setValue("backgroundVoiceDetection", v)
                    }
                  />
                </div>
              </AppTabsContent>

              {/* ── Tab: Detecção de Turno ──────────────────────────── */}
              <AppTabsContent
                value="turno"
                className="flex-1 overflow-y-auto px-6 pb-4 mt-0 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow
                    label="Turn Timeout (s)"
                    hint="Tempo sem fala para encerrar turno do usuário"
                  >
                    <Controller
                      control={control}
                      name="turnTimeout"
                      render={({ field }) => (
                        <Input
                          type="number"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      )}
                    />
                  </FieldRow>

                  <FieldRow
                    label="Silence End Call (s)"
                    hint="-1 = desabilitado"
                  >
                    <Controller
                      control={control}
                      name="silenceEndCallTimeout"
                      render={({ field }) => (
                        <Input
                          type="number"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      )}
                    />
                  </FieldRow>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Modo de turno">
                    <Select
                      value={w.turnMode}
                      onValueChange={(v) => setValue("turnMode", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="turn">Turn (padrão)</SelectItem>
                        <SelectItem value="silence">Silence</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <FieldRow label="Turn Eagerness" hint="Velocidade de reação">
                    <Select
                      value={w.turnEagerness}
                      onValueChange={(v) => setValue("turnEagerness", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TURN_EAGERNESS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldRow>
                </div>

                <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3 divide-y divide-slate-100 dark:divide-slate-800">
                  <SwitchRow
                    label="Speculative Turn"
                    hint="Antecipa o fim do turno para reduzir latência"
                    checked={w.speculativeTurn ?? true}
                    onCheckedChange={(v) => setValue("speculativeTurn", v)}
                  />
                  <SwitchRow
                    label="Re-transcrever no timeout de turno"
                    checked={w.retranscribeOnTurnTimeout ?? false}
                    onCheckedChange={(v) =>
                      setValue("retranscribeOnTurnTimeout", v)
                    }
                  />
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Soft Timeout (filler)
                  </p>
                  <p className="text-xs text-slate-500">
                    Frase reproduzida enquanto o LLM processa uma resposta
                    demorada.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <FieldRow label="Timeout (s)" hint="-1 = desabilitado">
                      <Controller
                        control={control}
                        name="softTimeoutSeconds"
                        render={({ field }) => (
                          <Input
                            type="number"
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        )}
                      />
                    </FieldRow>

                    <FieldRow label="Mensagem filler">
                      <Input
                        {...register("softTimeoutMessage")}
                        placeholder="Hhmmmm...yeah."
                      />
                    </FieldRow>
                  </div>

                  <SwitchRow
                    label="Gerar mensagem via LLM"
                    hint="Quando ativo, o LLM gera uma frase contextual em vez da mensagem fixa"
                    checked={w.useLlmGeneratedMessage ?? false}
                    onCheckedChange={(v) =>
                      setValue("useLlmGeneratedMessage", v)
                    }
                  />
                </div>
              </AppTabsContent>

              {/* ── Tab: Conversa ───────────────────────────────────── */}
              <AppTabsContent
                value="conversa"
                className="flex-1 overflow-y-auto px-6 pb-4 mt-0 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow label="Duração máxima (s)" hint="600 = 10 minutos">
                    <Controller
                      control={control}
                      name="maxDurationSeconds"
                      render={({ field }) => (
                        <Input
                          type="number"
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      )}
                    />
                  </FieldRow>
                </div>

                <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3 divide-y divide-slate-100 dark:divide-slate-800">
                  <SwitchRow
                    label="Modo texto apenas"
                    hint="Desativa áudio — o agente funciona apenas como chatbot"
                    checked={w.textOnly ?? false}
                    onCheckedChange={(v) => setValue("textOnly", v)}
                  />
                  <SwitchRow
                    label="Monitoramento habilitado"
                    checked={w.monitoringEnabled ?? false}
                    onCheckedChange={(v) => setValue("monitoringEnabled", v)}
                  />
                  <SwitchRow
                    label="Entrada de arquivos habilitada"
                    checked={w.fileInputEnabled ?? true}
                    onCheckedChange={(v) => setValue("fileInputEnabled", v)}
                  />
                </div>

                {w.fileInputEnabled && (
                  <FieldRow label="Máximo de arquivos por conversa">
                    <Controller
                      control={control}
                      name="fileInputMaxFiles"
                      render={({ field }) => (
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      )}
                    />
                  </FieldRow>
                )}

                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Música de fundo
                  </p>

                  <FieldRow label="Tipo de fonte">
                    <Select
                      value={w.backgroundMusicSourceType ?? "null"}
                      onValueChange={(v) =>
                        setValue(
                          "backgroundMusicSourceType",
                          v === "null" ? null : v,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">Nenhuma</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  {w.backgroundMusicSourceType && (
                    <FieldRow label="URL da música">
                      <Input
                        {...register("backgroundMusicSourceId")}
                        placeholder="https://..."
                      />
                    </FieldRow>
                  )}

                  <SliderField
                    label="Volume"
                    value={w.backgroundMusicVolume ?? 0.6}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => setValue("backgroundMusicVolume", v)}
                  />
                </div>

                <FieldRow
                  label="Client Events"
                  hint="Eventos enviados ao cliente WebSocket durante a conversa"
                >
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {CLIENT_EVENTS.map((ev) => (
                      <div key={ev.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`ev-${ev.value}`}
                          checked={(w.clientEvents ?? []).includes(ev.value)}
                          onCheckedChange={() => toggleClientEvent(ev.value)}
                        />
                        <label
                          htmlFor={`ev-${ev.value}`}
                          className="text-xs font-mono cursor-pointer"
                        >
                          {ev.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </FieldRow>
              </AppTabsContent>

              {/* ── Tab: Avançado ───────────────────────────────────── */}
              <AppTabsContent
                value="avancado"
                className="flex-1 overflow-y-auto px-6 pb-4 mt-0 space-y-5"
              >
                {/* Privacidade */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Privacidade
                  </p>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3 divide-y divide-slate-100 dark:divide-slate-800">
                    <SwitchRow
                      label="Gravar áudio da chamada"
                      checked={w.recordVoice ?? true}
                      onCheckedChange={(v) => setValue("recordVoice", v)}
                    />
                    <SwitchRow
                      label="Deletar áudio após retenção"
                      checked={w.deleteAudio ?? false}
                      onCheckedChange={(v) => setValue("deleteAudio", v)}
                    />
                    <SwitchRow
                      label="Deletar transcrição e PII"
                      checked={w.deleteTranscriptAndPii ?? false}
                      onCheckedChange={(v) =>
                        setValue("deleteTranscriptAndPii", v)
                      }
                    />
                  </div>
                  <div className="mt-3">
                    <FieldRow
                      label="Retenção (dias)"
                      hint="-1 = manter indefinidamente"
                    >
                      <Controller
                        control={control}
                        name="retentionDays"
                        render={({ field }) => (
                          <Input
                            type="number"
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        )}
                      />
                    </FieldRow>
                  </div>
                </div>

                {/* Limites de chamada */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Limites de chamada
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <FieldRow label="Concorrência máxima" hint="-1 = ilimitado">
                      <Controller
                        control={control}
                        name="agentConcurrencyLimit"
                        render={({ field }) => (
                          <Input
                            type="number"
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        )}
                      />
                    </FieldRow>
                    <FieldRow label="Limite diário de chamadas">
                      <Controller
                        control={control}
                        name="dailyLimit"
                        render={({ field }) => (
                          <Input
                            type="number"
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        )}
                      />
                    </FieldRow>
                  </div>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3 mt-3">
                    <SwitchRow
                      label="Bursting habilitado"
                      hint="Permite picos temporários acima do limite de concorrência"
                      checked={w.burstingEnabled ?? true}
                      onCheckedChange={(v) => setValue("burstingEnabled", v)}
                    />
                  </div>
                </div>

                {/* Guardrails */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Guardrails
                  </p>

                  <div className="border border-slate-100 dark:border-slate-800 rounded-lg px-3 divide-y divide-slate-100 dark:divide-slate-800 mb-3">
                    <SwitchRow
                      label="Foco (bloquear tópicos fora do escopo)"
                      checked={w.guardrailFocusEnabled ?? false}
                      onCheckedChange={(v) =>
                        setValue("guardrailFocusEnabled", v)
                      }
                    />
                    <SwitchRow
                      label="Proteção contra prompt injection"
                      checked={w.guardrailPromptInjectionEnabled ?? false}
                      onCheckedChange={(v) =>
                        setValue("guardrailPromptInjectionEnabled", v)
                      }
                    />
                  </div>

                  <FieldRow label="Ação ao acionar guardrail">
                    <Select
                      value={w.guardrailTriggerAction ?? "end_call"}
                      onValueChange={(v) =>
                        setValue("guardrailTriggerAction", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end_call">
                          Encerrar chamada
                        </SelectItem>
                        <SelectItem value="warn">Avisar usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>

                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Filtros de conteúdo
                    </p>
                    {GUARDRAIL_CATEGORIES.map(({ key, field, label }) => {
                      const enabledKey = `${field}Enabled` as keyof AgentForm;
                      const thresholdKey =
                        `${field}Threshold` as keyof AgentForm;
                      const isEnabled = w[enabledKey] as boolean;
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const setAny = setValue as (k: string, v: any) => void;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5"
                        >
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(v) => setAny(enabledKey, v)}
                          />
                          <span className="text-sm flex-1">{label}</span>
                          {isEnabled && (
                            <Select
                              value={w[thresholdKey] as string}
                              onValueChange={(v) => setAny(thresholdKey, v)}
                            >
                              <SelectTrigger className="w-28 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Baixo</SelectItem>
                                <SelectItem value="medium">Médio</SelectItem>
                                <SelectItem value="high">Alto</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AppTabsContent>
            </AppTabs>

            <SheetFooter className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0 flex-row gap-2 justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={onClose}
                disabled={
                  saveMutation.isPending || saveAndPublishMutation.isPending
                }
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                type="submit"
                disabled={
                  saveMutation.isPending || saveAndPublishMutation.isPending
                }
              >
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Salvar
              </Button>
              <Button
                type="button"
                disabled={
                  saveMutation.isPending || saveAndPublishMutation.isPending
                }
                onClick={handleSubmit((d) => saveAndPublishMutation.mutate(d))}
              >
                {saveAndPublishMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 size-4" />
                )}
                Salvar e Publicar
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
