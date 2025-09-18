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

export async function startBirthdayBot(data: {
  chatId: string;
  botId: string;
  triggerName: string;
}) {
  try {
    const response = await fetch(`${apiEndpoint}/chats/start-bot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...data, organizationId }),
    });

    if (!response.ok) {
      throw new Error("Failed to start bot" + (await response.json()));
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

export async function createFile(data: CreateFileRequest): Promise<CreateFileResponse | null> {
  try {
    const formData = new FormData();

    // Criar um Blob a partir do buffer/Uint8Array
    const fileBlob = new Blob([new Uint8Array(data.file)], { type: data.contentType });
    formData.append('File', fileBlob, data.filename);

    if (data.thumbnail) {
      formData.append('Thumbnail', data.thumbnail);
    }

    formData.append('OrganizationId', data.organizationId);

    const response = await fetch(`${apiEndpoint}/organization-files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        "Failed to create file: " + JSON.stringify(error)
      );
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
    const response = await fetch(`${apiEndpoint}/organization-files/${fileId}?organizationId=${organizationId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        "Failed to delete file: " + error
      );
    }

    console.log("File deleted successfully", fileId);
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
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
