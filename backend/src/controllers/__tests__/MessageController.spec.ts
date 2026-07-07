jest.mock("../../helpers/SetTicketMessagesAsRead", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/TicketServices/FindOrCreateTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/TicketServices/UpdateTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/WbotServices/SendWhatsAppMedia", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/WbotServices/SendWhatsAppMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/WbotServices/CheckNumber", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/WbotServices/CheckIsValidContact", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/WbotServices/DeleteWhatsAppMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/WbotServices/GetProfilePicUrl", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../services/ContactServices/CreateOrUpdateContactService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../libs/socket", () => ({
  __esModule: true,
  getIO: jest.fn()
}));

// eslint-disable-next-line import/first
import { Request, Response } from "express";
// eslint-disable-next-line import/first
import Whatsapp from "../../models/Whatsapp";
// eslint-disable-next-line import/first
import ShowTicketService from "../../services/TicketServices/ShowTicketService";
// eslint-disable-next-line import/first
import FindOrCreateTicketService from "../../services/TicketServices/FindOrCreateTicketService";
// eslint-disable-next-line import/first
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";
// eslint-disable-next-line import/first
import SendWhatsAppMessage from "../../services/WbotServices/SendWhatsAppMessage";
// eslint-disable-next-line import/first
import CheckContactNumber from "../../services/WbotServices/CheckNumber";
// eslint-disable-next-line import/first
import GetProfilePicUrl from "../../services/WbotServices/GetProfilePicUrl";
// eslint-disable-next-line import/first
import CreateOrUpdateContactService from "../../services/ContactServices/CreateOrUpdateContactService";
// eslint-disable-next-line import/first
import { send, store } from "../MessageController";

const mockRes = (): Response => {
  const res: Partial<Response> = {};
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe("MessageController.send", () => {
  it("sends a text message even though multer populates req.files as an empty array", async () => {
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue({
      id: 4,
      companyId: 1
    });
    (CheckContactNumber as jest.Mock).mockResolvedValue({
      jid: "554388515951@s.whatsapp.net"
    });
    (GetProfilePicUrl as jest.Mock).mockResolvedValue("");
    (CreateOrUpdateContactService as jest.Mock).mockResolvedValue({
      id: 21,
      number: "554388515951"
    });
    const ticket = { id: 22, update: jest.fn() };
    (FindOrCreateTicketService as jest.Mock).mockResolvedValue(ticket);

    const req = {
      params: { whatsappId: "4" },
      body: { number: "554388515951", body: "boa noite" },
      files: [] // what multer's upload.array("medias") sets when no file is attached
    } as unknown as Request;

    await send(req, mockRes());

    expect(SendWhatsAppMessage).toHaveBeenCalled();
    expect(SendWhatsAppMedia).not.toHaveBeenCalled();
  });
});

describe("MessageController.store", () => {
  it("sends a text message even though multer populates req.files as an empty array", async () => {
    const ticket = { id: 22 };
    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);

    const req = {
      params: { ticketId: "22" },
      body: { body: "boa noite" },
      files: [], // what multer's upload.array("medias") sets when no file is attached
      user: { companyId: 1 }
    } as unknown as Request;

    await store(req, mockRes());

    expect(SendWhatsAppMessage).toHaveBeenCalled();
    expect(SendWhatsAppMedia).not.toHaveBeenCalled();
  });
});
