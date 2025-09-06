import { serviceChannels } from "@shared/schema";
// import "dotenv/config";
import { db } from "server/db";

const apiEndpoint = process.env.UMBLER_ENDPOINT || "";
const organizationId = process.env.UMBLER_ORGANIZATION_ID || "";
const apiKey = process.env.UMBLER_API_KEY || "";

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
