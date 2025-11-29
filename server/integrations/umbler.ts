import { formatPhoneToDigits } from "@/lib/format-phone-number";
import { serviceChannels } from "@shared/schema";
// import "dotenv/config";
import { db } from "server/db";
import z from "zod";
import {
  CreateContactResponse,
  CustomField,
} from "./interfaces/create-contact";
import { CreateChatResponse } from "./interfaces/create-chat";
import { ChatResponse } from "./interfaces/chat";
import { CustomFields } from "./interfaces/custom-fields";
import { BotResponse } from "./interfaces/bot";

// Template Message Interfaces
export interface SendTemplateMessageRequest {
  templateId: string;
  chatId: string;
  organizationId: string;
  params?: string[];
  skipReassign?: boolean;
  bulkSession?: string;
  fileId?: string;
  carousel?: string;
  postbackTexts?: string;
}

// Template Interfaces
export interface TemplateVariable {
  name: string;
  example: string;
}

export interface TemplateButton {
  _t: string;
  text: string;
  type: string;
  phoneNumber: string;
  url: string;
  variable: TemplateVariable;
  selected?: boolean;
  copyCode?: string;
  postbackText?: string;
}

export interface TemplateHeader {
  content: string;
  variables: TemplateVariable[];
}

export interface TemplateCarouselItem {
  headerType: string;
  body: string;
  buttons: TemplateButton[];
}

export interface TemplateChannel {
  _t: string;
  id: string;
}

export interface Template {
  _t: string;
  id: string;
  createdAtUTC: string;
  channel: TemplateChannel;
  label: string;
  category: string;
  status: string;
  header: TemplateHeader;
  content: string;
  footer: string;
  buttons: TemplateButton[];
  variables: TemplateVariable[];
  templateType: string;
  approvedAtUTC: string;
  rejectErrorReason: string;
  groupIds: string[];
  carousel: TemplateCarouselItem[];
}

export interface TemplatesPage {
  totalItems: number;
  skipped: number;
  took: number;
  maxTake: number;
  searchEngine: string;
}

export interface GetTemplatesResponse {
  page: TemplatesPage;
  items: Template[];
}

export interface FileData {
  url: string;
  contentType: string;
  originalName: string;
  originalSizeBytes: number;
  data: string;
  failDownload: boolean;
  caption: string;
}

export interface ContactAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ContactData {
  name: string;
  addresses: ContactAddress[];
  phoneNumbers: string[];
  company: string;
  emails: string[];
  profilePictureBlob: string;
}

export interface Location {
  latitude: string;
  longitude: string;
  name: string;
  address: string;
}

export interface Variable {
  name: string;
  example: string;
}

export interface Button {
  _t: string;
  text: string;
  type: string;
  phoneNumber: string;
  url: string;
  variable: Variable;
  selected: boolean;
  copyCode: string;
  postbackText: string;
}

export interface Question {
  _t: string;
  id: string;
  key: string;
}

export interface InReplyTo {
  _t: string;
  id: string;
  chatId: string;
  button: Button;
}

export interface OrganizationMember {
  _t: string;
  id: string;
}

export interface Chat {
  _t: string;
  id: string;
}

export interface Contact {
  _t: string;
  id: string;
}

export interface LatestEdit {
  content: string;
  senderAtUTC: string;
  msgKey: string;
}

export interface BotInstance {
  _t: string;
  id: string;
  botName: string;
}

export interface ForwardedFrom {
  _t: string;
  id: string;
  eventAtUTC: string;
}

export interface ScheduledMessage {
  _t: string;
  id: string;
}

export interface BulkSendSession {
  _t: string;
  id: string;
}

export interface Mention {
  id: string;
  source: string;
}

export interface Ad {
  conversionSource: string;
  sourceUrl: string;
  description: string;
  title: string;
  thumbnailUrl: string;
  mediaUrl: string;
  sourceType: string;
  sourceId: string;
  fileId: string;
  ctWaCLId: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  source: string;
  eventAtUTC: string;
  messageId: string;
}

export interface CarouselItem {
  headerType: string;
  body: string;
  buttons: Button[];
  fileUrl: string;
}

export interface Billable {
  billable: boolean;
  singlePackageId: string;
  deductedCredits: number;
  billingConversationWindowId: string;
}

export interface SendTemplateMessageResponse {
  _t: string;
  id: string;
  createdAtUTC: string;
  prefix: string;
  headerContent: string;
  content: string;
  footer: string;
  file: FileData;
  thumbnail: FileData;
  quotedStatusUpdate: FileData;
  contacts: ContactData[];
  messageType: string;
  sentByOrganizationMember: OrganizationMember;
  isPrivate: boolean;
  location: Location;
  question: Question;
  source: string;
  inReplyTo: InReplyTo;
  messageState: string;
  eventAtUTC: string;
  chat: Chat;
  fromContact: Contact;
  templateId: string;
  buttons: Button[];
  latestEdit: LatestEdit;
  botInstance: BotInstance;
  forwardedFrom: ForwardedFrom;
  scheduledMessage: ScheduledMessage;
  bulkSendSession: BulkSendSession;
  elements: string;
  mentions: Mention[];
  ad: Ad;
  fileId: string;
  reactions: Reaction[];
  deductedAiCredits: number;
  carousel: CarouselItem[];
  billable: Billable;
  contactId: string;
}

export interface CreateFileRequest {
  file: Buffer | Uint8Array;
  filename: string;
  contentType: string;
  thumbnail?: string;
  organizationId: string;
}

export interface CreateFileResponse {
  id: string;
  organization: {
    id: string;
  };
  url: string;
  contentType: string;
  originalName: string;
  originalSizeBytes: number;
  data: string;
  fileType: string;
  useCount: number;
  botIds: string[];
  createdAtUTC: string;
  thumbnail: string | null;
  deletedAtUTC: string | null;
  organizationMember: {
    id: string;
  };
  visibility: string;
}

// Contact Note Interfaces
export interface CreateContactNoteRequest {
  content: string;
  organizationId: string;
  elements?: string;
  mentions?: string;
}

export interface NoteMention {
  id: string;
  source: string;
}

export interface ContactNote {
  _t: string;
  id: string;
  createdAtUTC: string;
  content: string;
  pinned: boolean;
  createdBy: string;
  elements: string;
  mentions: NoteMention[];
}

export interface ContactTag {
  _t: string;
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  description?: string;
  order?: number;
  createdAtUTC?: string;
  groupIds?: string[];
}

export interface TagsPage {
  totalItems: number;
  skipped: number;
  took: number;
  maxTake: number;
  searchEngine: string;
}

export interface GetTagsResponse {
  page: TagsPage;
  items: ContactTag[];
}

// Bot Flowchart Manual Starts Interfaces
export interface BotVariable {
  _t: string;
  name: string;
  example: string;
  minValue?: number;
  maxValue?: number;
  minTime?: string;
  maxTime?: string;
  minDate?: string;
  maxDate?: string;
}

export interface BotManualStart {
  botId: string;
  stepId: string;
  triggerName: string;
  hidden: boolean;
  botTitle: string;
  variables: BotVariable[];
}

export interface BotsPage {
  totalItems: number;
  skipped: number;
  took: number;
  maxTake: number;
  searchEngine: string;
}

export interface GetBotsResponse {
  page: BotsPage;
  items: BotManualStart[];
}

// Bulk Send Session Interfaces
export interface CreateBulkSendSessionRequest {
  organizationId: string;
  channelId: string;
  title: string;
  expectedMessages: number;
  botId: string;
  triggerName: string;
  templateId?: string;
}

export interface CreateBulkSendSessionResponse {
  id: string;
  organizationId: string;
  channelId: string;
  title: string;
  expectedMessages: number;
  botId: string;
  triggerName: string;
  templateId?: string;
  createdAtUTC: string;
}

// Scheduled Message Interfaces
export interface ScheduleMessageRequest {
  BotId: string;
  BotTriggerName: string;
  BulkSession: string;
  CancelUpon: string[];
  ChannelId?: string | null;
  ContactId?: string | null;
  ContactName: string;
  DateSendAtUTC: string;
  FromPhone: string;
  InitialData: Record<string, any>;
  IsPrivate: boolean;
  Message?: string | null;
  OrganizationId: string;
  Params?: any | null;
  PostbackTexts?: any | null;
  Prefix?: string | null;
  TemplateId?: string | null;
  TemplateLabel?: string | null;
  ToPhone: string;
}

export interface ScheduleMessageResponse {
  id: string;
  createdAtUTC: string;
  dateSendAtUTC: string;
  toPhone: string;
  fromPhone: string;
  contactName: string;
  bulkSession: string;
  organizationId: string;
}

export interface ContactAddress {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ContactCustomField {
  _t: string;
  id: string;
  customFieldDefinitionId: string;
  value?: string | boolean | number;
}

export interface CreateContactNoteResponse {
  _t: string;
  id: string;
  createdAtUTC: string;
  name: string;
  phoneNumber: string;
  email: string;
  profilePictureUrl: string;
  isBlocked: boolean;
  groupIdentifier: string;
  contactType: string;
  organizationMembers: string[];
  channelIds: string[];
  tags: ContactTag[];
  lastActiveUTC: string;
  gender: string;
  landline: string;
  address: ContactAddress;
  notes: ContactNote[];
  customFields: ContactCustomField[];
}

const apiEndpoint = process.env.UMBLER_ENDPOINT || "";
const organizationId = process.env.UMBLER_ORGANIZATION_ID || "";
const apiKey = process.env.UMBLER_API_KEY || "";

export const createContactSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  organizationId: z.string().min(1, "Organization ID is required"),
});

export interface BirthdayBotsResponse {
  items: Item[];
}

export interface Item {
  _t: string;
  triggers: string[];
  manualTriggers: string[];
  steps: any[];
  channels: any[];
  title: string;
  order: number;
  final: boolean;
  active: boolean;
  groupIds: any[];
  updatedAtUTC: string;
  executionsCount: number;
  executionsDateUTC: string;
  id: string;
  createdAtUTC: string;
}

export async function getChannels() {
  const response = await fetch(
    `${apiEndpoint}/channels?organizationId=${organizationId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch channels");
  }

  const data = await response.json();

  // data.forEach(async (channel) => {
  //   if (channel.state === "Live") {
  //     await db.insert(serviceChannels).values({
  //       id: channel.id,
  //       name: channel.name,
  //       phoneNumber: channel.phoneNumber,
  //     });
  //   }
  // });

  return data;
}

export async function getContactByPhone(phone: string) {
  try {
    const formattedPhone = formatPhoneToDigits(phone);
    const response = await fetch(
      `${apiEndpoint}/contacts/phone?phoneNumber=${formattedPhone}&organizationId=${organizationId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch contact by phone");
    }
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Error fetching contact by phone:", error);
    return null;
  }
}

/**
 * Busca contatos na organização com filtro de query
 * @param query - String de busca para filtrar contatos (opcional)
 * @param tagIds - Array de IDs de tags para filtrar (opcional)
 * @param exclusiveTag - Se true, filtra contatos que têm APENAS as tags especificadas (opcional)
 * @returns Promise com a lista de contatos ou null em caso de erro
 */
export async function getContacts(
  query?: string,
  tagIds?: string[],
  exclusiveTag?: boolean
): Promise<any | null> {
  try {
    const params = new URLSearchParams();
    params.append("organizationId", organizationId);
    params.append("Skip", "0");
    params.append("Take", "50");
    params.append("Behavior", "GetSliceOnly");

    if (query) {
      params.append("query", query);
    }

    if (tagIds && tagIds.length > 0) {
      // Se exclusiveTag for true, usa ContainsAll para filtrar contatos que têm exatamente essas tags
      // Caso contrário, usa ContainsAny para filtrar contatos que têm pelo menos uma das tags
      params.append("Tags.Rule", exclusiveTag ? "ContainsAll" : "ContainsAny");
      tagIds.forEach((tagId) => {
        params.append("Tags.Values", tagId);
      });
    }

    const response = await fetch(
      `${apiEndpoint}/contacts?${params.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to fetch contacts: " + JSON.stringify(error));
    }

    let responseData = await response.json();

    // Se exclusiveTag for true e houver tags selecionadas, filtrar contatos que têm APENAS essas tags
    if (exclusiveTag && tagIds && tagIds.length > 0 && responseData.items) {
      responseData.items = responseData.items.filter((contact: any) => {
        if (!contact.tags || contact.tags.length === 0) return false;

        // Verifica se o contato tem exatamente as mesmas tags (não mais, não menos)
        const contactTagIds = contact.tags.map((tag: any) => tag.id);

        // Se o número de tags for diferente, não é exclusivo
        if (contactTagIds.length !== tagIds.length) return false;

        // Verifica se todas as tags do contato estão na lista de tags selecionadas
        return contactTagIds.every((tagId: string) => tagIds.includes(tagId));
      });
    }

    console.log("Contacts fetched successfully", responseData);

    return responseData;
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return null;
  }
}

export async function syncContact(customerData: {
  phoneNumber: string;
  name?: string;
  email?: string;
  organizationId: string;
}) {
  try {
    const response = await fetch(`${apiEndpoint}/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(customerData),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to sync contact" + error);
    }

    const data = (await response.json()) as CreateContactResponse;

    return data;
  } catch (error) {
    console.error("Error syncing contact:", error);
    return null;
  }
}

export async function getChat(data: {
  customerPhone: string;
  selectedChannel: string;
}) {
  try {
    const response = await fetch(
      `${apiEndpoint}/chats/?organizationId=aGx7Jh43-au36EGi&PhoneNumbers=${data.customerPhone}&ChatState=Open&LastMessage=All&Order=Desc&ChatOrderBy=LastMessage&IncludePinneds=true&LastMessage=Member&Messages=All&Channels.Rule=ContainsAny&Channels.Values=${data.selectedChannel}&Skip=0&Take=50&Behavior=GetSliceOnly`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch chat");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching chat:", error);
    return null;
  }
}

export async function getChatById(id: string) {
  try {
    const response = await fetch(
      `${apiEndpoint}/chats/${id}?organizationId=${organizationId}`,
      {
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch chat");
    }

    return (await response.json()) as ChatResponse;
  } catch (error) {
    console.error("Error fetching chat:", error);
    return null;
  }
}

export async function createChat(data: {
  contactId: string;
  channelId: string;
}) {
  try {
    const response = await fetch(`${apiEndpoint}/chats`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        contactId: data.contactId,
        channelId: data.channelId,
        organizationId: organizationId,
      }),
    });

    return (await response.json()) as CreateChatResponse;
  } catch (error) {
    console.error("Error creating chat:", error);
    return null;
  }
}

export async function sendMessage(data: { message: string; chatId: string }) {
  try {
    const response = await fetch(`${apiEndpoint}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        message: data.message,
        chatId: data.chatId,
        organizationId: organizationId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message" + (await response.json()));
    }

    const result = await response.json();

    return result;
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
}

export async function getBirthdayBots() {
  try {
    const response = await fetch(
      "https://app-utalk.umbler.com/api/v1/bots/?organizationId=aGx7Jh43-au36EGi&query=niver&Skip=0&Take=50&Behavior=GetSliceOnly",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch bots");
    }

    return (await response.json()) as BirthdayBotsResponse;
  } catch (error) {
    console.error("Error fetching bots:", error);
    return null;
  }
}

export async function getBirthdayTodayBotsAutomation() {
  try {
    const response = await fetch(
      "https://app-utalk.umbler.com/api/v1/bots/?organizationId=aGx7Jh43-au36EGi&query=(TESTE) ANIVERSÁRIO&Skip=0&Take=50&Behavior=GetSliceOnly",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch bots");
    }

    return (await response.json()) as BirthdayBotsResponse;
  } catch (error) {
    console.error("Error fetching bots:", error);
    return null;
  }
}

export async function getBirthdayDaysBeforeBotAutomation() {
  try {
    const response = await fetch(
      "https://app-utalk.umbler.com/api/v1/bots/?organizationId=aGx7Jh43-au36EGi&query=(TESTE) ANIVERSÁRIO DIAS ANTES&Skip=0&Take=50&Behavior=GetSliceOnly",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch bots");
    }

    return (await response.json()) as BirthdayBotsResponse;
  } catch (error) {
    console.error("Error fetching bots:", error);
    return null;
  }
}

export async function startBirthdayBot(data: {
  chatId: string;
  botId: string;
  triggerName: string;
}) {
  try {
    console.log("Starting bot with data:", data);
    const response = await fetch(`${apiEndpoint}/chats/start-bot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...data, organizationId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Error starting bot:", error);
      throw new Error("Failed to start bot" + error);
    }

    return response.json();
  } catch (error) {
    console.error("Error starting bot:", error);
    return null;
  }
}

export async function getBot(query: string) {
  try {
    const response = await fetch(
      `https://app-utalk.umbler.com/api/v1/bots/?organizationId=aGx7Jh43-au36EGi&query=${query}&Skip=0&Take=50&Behavior=GetSliceOnly`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch bots");
    }

    return (await response.json()) as BirthdayBotsResponse;
  } catch (error) {
    console.error("Error fetching bots:", error);
    return null;
  }
}

export async function getCashbackField(contactId: string) {
  try {
    const response = await fetch(
      `https://app-utalk.umbler.com/api/v1/contacts/${contactId}/custom-fields?organizationId=aGx7Jh43-au36EGi`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch custom fields");
    }

    return (await response.json()) as CustomFields;
  } catch (error) {
    console.error("Error fetching bots:", error);
    return null;
  }
}

export async function getBotCashback() {
  try {
    const response = await fetch(
      "https://app-utalk.umbler.com/api/v1/bots/aI0JfqYybpBr4ie-?organizationId=aGx7Jh43-au36EGi",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch bots");
    }

    return (await response.json()) as BotResponse;
  } catch (error) {
    console.error("Error fetching bots:", error);
    return null;
  }
}

export async function createCashback(data: {
  value: string;
  contactId: string;
}) {
  try {
    const response = await fetch(
      `${apiEndpoint}/contacts/${data.contactId}/custom-fields`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _t: "CreateContactTextCustomFieldModel",
          Value: data.value,
          OrganizationId: "aGx7Jh43-au36EGi",
          CustomFieldDefinitionId: "aIpL5QxBcwmaXxEo",
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to create cashback" + error);
    }

    return await response.json();
  } catch (error) {
    console.error("Error create cashback:", error);
    return null;
  }
}

export async function updateCashback(data: {
  value: string;
  contactId: string;
  customFieldId: string;
}) {
  try {
    const response = await fetch(
      `${apiEndpoint}/contacts/${data.contactId}/custom-fields/${data.customFieldId}?organizationId=${organizationId}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          _t: "EditContactTextCustomFieldModel",
          value: data.value,
          organizationId: "aGx7Jh43-au36EGi",
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to update cashback" + error);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching bots:", error);
    return null;
  }
}

export async function sendTemplateMessage(data: SendTemplateMessageRequest) {
  try {
    const requestBody: SendTemplateMessageRequest = {
      templateId: data.templateId,
      chatId: data.chatId,
      organizationId: data.organizationId,
      ...(data.params && { params: data.params }),
      ...(data.skipReassign !== undefined && {
        skipReassign: data.skipReassign,
      }),
      ...(data.bulkSession && { bulkSession: data.bulkSession }),
      ...(data.fileId && { fileId: data.fileId }),
      ...(data.carousel && { carousel: data.carousel }),
      ...(data.postbackTexts && { postbackTexts: data.postbackTexts }),
    };

    const response = await fetch(`${apiEndpoint}/template-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        "Failed to send template message: " + JSON.stringify(error)
      );
    }

    const responseData = await response.json();
    console.log("Template message sent successfully", responseData);

    return responseData as SendTemplateMessageResponse;
  } catch (error) {
    console.error("Error sending template message:", error);
    return null;
  }
}

export async function createFile(
  data: CreateFileRequest
): Promise<CreateFileResponse | null> {
  try {
    const formData = new FormData();

    // Criar um Blob a partir do buffer/Uint8Array
    const fileBlob = new Blob([new Uint8Array(data.file)], {
      type: data.contentType,
    });
    formData.append("File", fileBlob, data.filename);

    if (data.thumbnail) {
      formData.append("Thumbnail", data.thumbnail);
    }

    formData.append("OrganizationId", data.organizationId);

    const response = await fetch(`${apiEndpoint}/organization-files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to create file: " + JSON.stringify(error));
    }

    const responseData = await response.json();
    console.log("File created successfully", responseData);

    return responseData as CreateFileResponse;
  } catch (error) {
    console.error("Error creating file:", error);
    return null;
  }
}

export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${apiEndpoint}/organization-files/${fileId}?organizationId=${organizationId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error("Failed to delete file: " + error);
    }

    console.log("File deleted successfully", fileId);
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
}

/**
 * Busca todos os templates da organização na API do Umbler
 * @returns Promise com a resposta completa dos templates ou null em caso de erro
 */
export async function getTemplates(): Promise<GetTemplatesResponse | null> {
  try {
    const response = await fetch(
      `${apiEndpoint}/templates?organizationId=${organizationId}&queryString=ANIVERSARIO`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to fetch templates: " + JSON.stringify(error));
    }

    const responseData = await response.json();
    console.log("Templates fetched successfully");

    return responseData as GetTemplatesResponse;
  } catch (error) {
    console.error("Error fetching templates:", error);
    return null;
  }
}

/**
 * Busca apenas os templates aprovados da organização
 * @returns Promise com array de templates aprovados ou null em caso de erro
 */
export async function getApprovedTemplates(): Promise<Template[] | null> {
  try {
    const templatesResponse = await getTemplates();

    if (!templatesResponse) {
      return null;
    }

    // Filtrar apenas templates aprovados
    const approvedTemplates = templatesResponse.items.filter(
      (template) => template.status === "APPROVED"
    );

    return approvedTemplates;
  } catch (error) {
    console.error("Error fetching approved templates:", error);
    return null;
  }
}

/**
 * Cria uma observação para um contato no Umbler
 * @param contactId - ID do contato que receberá a observação
 * @param data - Dados da observação a ser criada
 * @returns Promise com a resposta da criação ou null em caso de erro
 */
export async function createContactNote(
  contactId: string,
  data: CreateContactNoteRequest
): Promise<CreateContactNoteResponse | null> {
  try {
    if (!contactId || !contactId.trim()) {
      throw new Error("Contact ID is required");
    }

    if (!data.content || !data.content.trim()) {
      throw new Error("Note content is required");
    }

    if (!data.organizationId || !data.organizationId.trim()) {
      throw new Error("Organization ID is required");
    }

    const requestBody: CreateContactNoteRequest = {
      content: data.content,
      organizationId: data.organizationId,
      ...(data.elements && { elements: data.elements }),
      ...(data.mentions && { mentions: data.mentions }),
    };

    const response = await fetch(`${apiEndpoint}/contacts/${contactId}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        "Failed to create contact note: " + JSON.stringify(error)
      );
    }

    const responseData = await response.json();
    console.log("Contact note created successfully");

    return responseData as CreateContactNoteResponse;
  } catch (error) {
    console.error("Error creating contact note:", error);
    return null;
  }
}

/**
 * Atualiza as informações de um contato no Umbler
 * @param contactId - ID do contato a ser atualizado
 * @param data - Dados a serem atualizados no contato
 * @returns Promise com a resposta da atualização ou null em caso de erro
 */
export async function updateContact(
  contactId: string,
  data: Partial<{
    name: string;
    email: string;
    phoneNumber: string;
    gender: string;
    landline: string;
    address: ContactAddress;
  }>
): Promise<CreateContactNoteResponse | null> {
  try {
    if (!contactId || !contactId.trim()) {
      throw new Error("Contact ID is required");
    }

    const response = await fetch(
      `${apiEndpoint}/contacts/${contactId}?organizationId=${organizationId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to update contact: " + JSON.stringify(error));
    }

    const responseData = await response.json();
    console.log("Contact updated successfully");

    return responseData as CreateContactNoteResponse;
  } catch (error) {
    console.error("Error updating contact:", error);
    return null;
  }
}

/**
 * Deleta um contato no Umbler
 * @param contactId - ID do contato a ser deletado
 * @returns Promise com boolean indicando sucesso ou falha
 */
export async function deleteContact(contactId: string): Promise<boolean> {
  try {
    if (!contactId || !contactId.trim()) {
      throw new Error("Contact ID is required");
    }

    const response = await fetch(
      `${apiEndpoint}/contacts/${contactId}?organizationId=${organizationId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error("Failed to delete contact: " + error);
    }

    console.log("Contact deleted successfully", contactId);
    return true;
  } catch (error) {
    console.error("Error deleting contact:", error);
    return false;
  }
}

/**
 * Busca as tags de um contato no Umbler
 * @param contactId - ID do contato
 * @returns Promise com array de tags ou null em caso de erro
 */
export async function getContactTags(
  contactId: string
): Promise<ContactTag[] | null> {
  try {
    if (!contactId || !contactId.trim()) {
      throw new Error("Contact ID is required");
    }

    const response = await fetch(
      `${apiEndpoint}/contacts/${contactId}/tags?organizationId=${organizationId}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to fetch contact tags: " + JSON.stringify(error));
    }

    const responseData = await response.json();
    console.log("Contact tags fetched successfully");

    return responseData as ContactTag[];
  } catch (error) {
    console.error("Error fetching contact tags:", error);
    return null;
  }
}

/**
 * Busca as conversas/chats de um contato no Umbler
 * @param contactId - ID do contato
 * @returns Promise com as conversas ou null em caso de erro
 */
export async function getContactConversations(
  contactId: string
): Promise<any | null> {
  try {
    if (!contactId || !contactId.trim()) {
      throw new Error("Contact ID is required");
    }

    const response = await fetch(
      `${apiEndpoint}/chats/?organizationId=${organizationId}&ContactIds=${contactId}&Skip=0&Take=50&Behavior=GetSliceOnly`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        "Failed to fetch contact conversations: " + JSON.stringify(error)
      );
    }

    const responseData = await response.json();
    console.log("Contact conversations fetched successfully");

    return responseData;
  } catch (error) {
    console.error("Error fetching contact conversations:", error);
    return null;
  }
}

/**
 * Lista todas as tags cadastradas na organização do Umbler
 * @returns Promise com a resposta contendo as tags ou null em caso de erro
 */
export async function getTags(): Promise<GetTagsResponse | null> {
  try {
    const response = await fetch(
      `${apiEndpoint}/tags?organizationId=${organizationId}&Take=100`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to fetch tags: " + JSON.stringify(error));
    }

    const responseData = await response.json();
    console.log("Tags fetched successfully");

    return responseData as GetTagsResponse;
  } catch (error) {
    console.error("Error fetching tags:", error);
    return null;
  }
}

/**
 * Cria uma sessão de envio em lote (bulk send session) para campanhas
 * @param data - Dados da sessão de envio em lote
 * @returns Promise com a resposta da criação ou null em caso de erro
 */
export async function createBulkSendSession(
  data: CreateBulkSendSessionRequest
): Promise<CreateBulkSendSessionResponse | null> {
  try {
    const response = await fetch(`${apiEndpoint}/bulk-send-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        "Failed to create bulk send session: " + JSON.stringify(error)
      );
    }

    const responseData = await response.json();
    console.log("Bulk send session created successfully", responseData);

    return responseData as CreateBulkSendSessionResponse;
  } catch (error) {
    console.error("Error creating bulk send session:", error);
    return null;
  }
}

/**
 * Agenda uma mensagem individual para um contato
 * @param data - Dados da mensagem agendada
 * @returns Promise com a resposta do agendamento ou null em caso de erro
 */
export async function scheduleMessage(
  data: ScheduleMessageRequest
): Promise<ScheduleMessageResponse | null> {
  try {
    const response = await fetch(`${apiEndpoint}/scheduled-messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to schedule message: " + JSON.stringify(error));
    }

    const responseData = await response.json();
    console.log("Message scheduled successfully", {
      id: responseData.id,
      toPhone: responseData.toPhone,
      dateSendAtUTC: responseData.dateSendAtUTC,
    });

    return responseData as ScheduleMessageResponse;
  } catch (error) {
    console.error("Error scheduling message:", error);
    return null;
  }
}

/**
 * Busca bots flowchart com manual-starts disponíveis na organização
 * @param query - String de busca para filtrar bots pelo título (opcional)
 * @param skip - Número de itens a pular para paginação (default: 0)
 * @param take - Número de itens a retornar (default: 34)
 * @param hidden - Se true, retorna bots ocultos; se false, apenas visíveis (default: false)
 * @returns Promise com a resposta contendo os bots ou null em caso de erro
 */
export async function getBots(
  query?: string,
  skip: number = 0,
  take: number = 34,
  hidden: boolean = false
): Promise<GetBotsResponse | null> {
  try {
    const params = new URLSearchParams();
    params.append("organizationId", organizationId);
    params.append("Skip", skip.toString());
    params.append("Take", take.toString());
    params.append("Behavior", "CountAllAndGetSlice");
    params.append("hidden", hidden.toString());

    if (query) {
      params.append("query", query);
    }

    const response = await fetch(
      `${apiEndpoint}/bots/flowchart/manual-starts/?${params.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error("Failed to fetch bots: " + JSON.stringify(error));
    }

    const responseData = await response.json();
    console.log("Bots fetched successfully", {
      total: responseData.page?.totalItems,
      returned: responseData.items?.length,
    });

    return responseData as GetBotsResponse;
  } catch (error) {
    console.error("Error fetching bots:", error);
    return null;
  }
}

// export async function getBots() {
//   try {
//      const response = await fetch(
//         "https://app-utalk.umbler.com/api/v1/bots/?organizationId=aGx7Jh43-au36EGi&query=niver&Skip=0&Take=50&Behavior=GetSliceOnly",
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization:
//               "Bearer crm-integracao-2025-08-19-2093-09-06--149E63C849F8BCB5592608AD389BF0E4DB13FCB478F902B0B3CD488E88E5A784",
//           },
//         },
//       );
//       return response.json();
//   } catch (error) {
//     console.error("Error fetching bots:", error);
//     return null;
//   }
// }
