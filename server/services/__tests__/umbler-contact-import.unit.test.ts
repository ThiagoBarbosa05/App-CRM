import { describe, expect, it, vi, beforeEach } from "vitest";
import { dedupeContactsFromChats } from "../../integrations/umbler";

describe("dedupeContactsFromChats", () => {
  it("keeps the first contact found for each contact id", () => {
    const chats = [
      {
        contact: {
          id: "contact-1",
          name: "João",
          phoneNumber: "+5511999999999",
          tags: [{ id: "tag-1", name: "VIP", emoji: "⭐", color: "#fff" }],
        },
      },
      {
        contact: {
          id: "contact-1",
          name: "João (segundo chat)",
          phoneNumber: "+5511999999999",
          tags: [],
        },
      },
      {
        contact: {
          id: "contact-2",
          name: "Maria",
          phoneNumber: null,
          tags: [],
        },
      },
    ];

    const result = dedupeContactsFromChats(chats);

    expect(result).toEqual([
      {
        id: "contact-1",
        name: "João",
        phoneNumber: "+5511999999999",
        tags: [{ id: "tag-1", name: "VIP", emoji: "⭐", color: "#fff" }],
      },
      {
        id: "contact-2",
        name: "Maria",
        phoneNumber: null,
        tags: [],
      },
    ]);
  });

  it("ignores chats without a contact reference", () => {
    const chats = [{ contact: undefined }, { contact: { id: "", name: "sem id" } }];

    expect(dedupeContactsFromChats(chats)).toEqual([]);
  });

  it("defaults missing tags to an empty array", () => {
    const chats = [{ contact: { id: "contact-1", name: "João" } }];

    const result = dedupeContactsFromChats(chats);

    expect(result).toEqual([
      { id: "contact-1", name: "João", phoneNumber: null, tags: [] },
    ]);
  });
});

const {
  getChatsByMemberMock,
  getAllClientsWithPhoneMock,
  getContactByIdMock,
  createClientMock,
  linkWhatsappTagToClientMock,
  updateUserMock,
} = vi.hoisted(() => ({
  getChatsByMemberMock: vi.fn(),
  getAllClientsWithPhoneMock: vi.fn(),
  getContactByIdMock: vi.fn(),
  createClientMock: vi.fn(),
  linkWhatsappTagToClientMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock("../../integrations/umbler", async () => {
  const actual = await vi.importActual<typeof import("../../integrations/umbler")>(
    "../../integrations/umbler",
  );
  return {
    ...actual,
    getChatsByMember: getChatsByMemberMock,
    getContactById: getContactByIdMock,
  };
});

vi.mock("../../repositories/clients.repository", () => ({
  ClientsRepository: vi.fn().mockImplementation(() => ({
    getAllClientsWithPhone: getAllClientsWithPhoneMock,
    createClient: createClientMock,
    linkWhatsappTagToClient: linkWhatsappTagToClientMock,
  })),
}));

vi.mock("../../repositories/users.repository", () => ({
  usersRepository: { updateUser: updateUserMock },
}));

describe("listContactsForMember", () => {
  beforeEach(() => {
    getChatsByMemberMock.mockReset();
    getAllClientsWithPhoneMock.mockReset();
  });

  it("marks contacts whose phone already exists as a CRM client", async () => {
    const { listContactsForMember } = await import("../umbler-contact-import.service");

    getChatsByMemberMock.mockResolvedValue([
      { id: "contact-1", name: "João", phoneNumber: "11999999999", tags: [] },
      { id: "contact-2", name: "Maria", phoneNumber: "11888888888", tags: [] },
    ]);
    getAllClientsWithPhoneMock.mockResolvedValue([
      { id: "client-1", name: "João", phone: "+5511999999999", fixedPhone: null },
    ]);

    const result = await listContactsForMember("member-1");

    expect(result).toEqual([
      {
        id: "contact-1",
        name: "João",
        phoneNumber: "11999999999",
        tags: [],
        alreadyImported: true,
        existingClientId: "client-1",
      },
      {
        id: "contact-2",
        name: "Maria",
        phoneNumber: "11888888888",
        tags: [],
        alreadyImported: false,
        existingClientId: undefined,
      },
    ]);
  });
});

describe("startImport", () => {
  beforeEach(() => {
    getContactByIdMock.mockReset();
    createClientMock.mockReset();
    linkWhatsappTagToClientMock.mockReset();
    updateUserMock.mockReset();
    getAllClientsWithPhoneMock.mockReset();
    getAllClientsWithPhoneMock.mockResolvedValue([]);
    updateUserMock.mockResolvedValue(undefined);
  });

  it("enriches the client with details fetched from getContactById (email, address, gender, tags)", async () => {
    const { startImport, getStatus } = await import(
      "../umbler-contact-import.service"
    );

    getContactByIdMock.mockResolvedValue({
      id: "contact-1",
      name: "João Detalhado",
      phoneNumber: "+5511999999999",
      email: "joao@example.com",
      gender: "Male",
      landline: null,
      address: {
        addressLine1: "Rua A, 123",
        addressLine2: "Apto 4",
        city: "Rio de Janeiro",
        state: "RJ",
        zipCode: "20000-000",
        country: "BR",
      },
      tags: [{ id: "tag-1", name: "VIP", emoji: null, color: null }],
    });
    createClientMock.mockResolvedValue({ id: "new-client-1" });

    await startImport("member-1", "Ana", "vendor-1", [
      {
        id: "contact-1",
        name: "João",
        phoneNumber: "+5511999999999",
        tags: [],
        alreadyImported: false,
      },
    ]);

    await vi.waitFor(() => {
      expect(getStatus().status).toBe("completed");
    });

    expect(getContactByIdMock).toHaveBeenCalledWith("contact-1");
    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "João Detalhado",
        email: "joao@example.com",
        sexo: "M",
        cep: "20000-000",
        address: "Rua A, 123",
        complement: "Apto 4",
        city: "Rio de Janeiro",
        state: "RJ",
        umblerContactId: "contact-1",
        responsavelId: "vendor-1",
      }),
    );
    expect(linkWhatsappTagToClientMock).toHaveBeenCalledWith(
      "new-client-1",
      "tag-1",
      "VIP",
      null,
      null,
    );
    expect(getStatus().imported).toBe(1);
  });

  it("falls back to the chat-derived contact when getContactById fails", async () => {
    const { startImport, getStatus } = await import(
      "../umbler-contact-import.service"
    );

    getContactByIdMock.mockRejectedValue(new Error("network error"));
    createClientMock.mockResolvedValue({ id: "new-client-2" });

    await startImport("member-1", "Ana", "vendor-1", [
      {
        id: "contact-2",
        name: "Maria",
        phoneNumber: "+5511888888888",
        tags: [{ id: "tag-2", name: "Comercial", emoji: null, color: null }],
        alreadyImported: false,
      },
    ]);

    await vi.waitFor(() => {
      expect(getStatus().status).toBe("completed");
    });

    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Maria", email: null, sexo: null }),
    );
    expect(linkWhatsappTagToClientMock).toHaveBeenCalledWith(
      "new-client-2",
      "tag-2",
      "Comercial",
      null,
      null,
    );
    expect(getStatus().imported).toBe(1);
  });
});
