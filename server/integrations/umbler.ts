import { formatPhoneToDigits } from "@/lib/format-phone-number";
import { serviceChannels } from "@shared/schema";
// import "dotenv/config";
import { db } from "server/db";
import z from "zod";
import { CreateContactResponse } from "./interfaces/create-contact";
import { CreateChatResponse } from "./interfaces/create-chat";
import { ChatResponse } from "./interfaces/chat";

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
