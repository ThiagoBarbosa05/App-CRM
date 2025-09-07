import { formatPhoneToDigits } from "@/lib/format-phone-number";
import { serviceChannels } from "@shared/schema";
// import "dotenv/config";
import { db } from "server/db";
import z from "zod";

const apiEndpoint = process.env.UMBLER_ENDPOINT || "";
const organizationId = process.env.UMBLER_ORGANIZATION_ID || "";
const apiKey = process.env.UMBLER_API_KEY || "";

export const createContactSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  name: z.string().optional(),
  email: z.string().optional(),
  organizationId: z.string().min(1, "Organization ID is required"),
});

export async function getChannels() {
  const response = await fetch(
    `${apiEndpoint}/channels?organizationId=${organizationId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
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
      },
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
      },
      body: JSON.stringify(customerData),
    });
    if (!response.ok) {
      throw new Error("Failed to sync contact");
    }

    const data = await response.json();

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
      `${apiEndpoint}/chats/?organizationId=aGx7Jh43-au36EGi&PhoneNumbers=${data.customerPhone}&ChatState=Open&LastMessage=All&Order=Desc&ChatOrderBy=LastMessage&IncludePinneds=true&Messages=All&Channels.Rule=ContainsAny&Channels.Values=${data.selectedChannel}&Skip=0&Take=50&Behavior=GetSliceOnly`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
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
