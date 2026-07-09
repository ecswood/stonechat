jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));

// eslint-disable-next-line import/first
import User from "../../../models/User";
// eslint-disable-next-line import/first
import FindOrCreateAiUserService, {
  AI_USER_NAME
} from "../FindOrCreateAiUserService";

describe("FindOrCreateAiUserService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna o usuário IA já existente da empresa, sem criar outro", async () => {
    const existingUser = { id: 42, name: "IA", companyId: 1 };
    (User.findOne as jest.Mock).mockResolvedValue(existingUser);

    const result = await FindOrCreateAiUserService(1);

    expect(User.findOne).toHaveBeenCalledWith({
      where: { email: "ia-1@stonechat.internal", companyId: 1 }
    });
    expect(User.create).not.toHaveBeenCalled();
    expect(result).toBe(existingUser);
  });

  it("cria o usuário IA quando ainda não existe, com nome IA e senha aleatória", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    const createdUser = { id: 99, name: AI_USER_NAME, companyId: 1 };
    (User.create as jest.Mock).mockResolvedValue(createdUser);

    const result = await FindOrCreateAiUserService(1);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "IA",
        email: "ia-1@stonechat.internal",
        profile: "user",
        companyId: 1,
        password: expect.any(String)
      })
    );
    expect((User.create as jest.Mock).mock.calls[0][0].password.length).toBeGreaterThan(20);
    expect(result).toBe(createdUser);
  });

  it("usa um email diferente pra cada empresa (multi-tenant)", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (User.create as jest.Mock).mockResolvedValue({ id: 1 });

    await FindOrCreateAiUserService(7);

    expect(User.findOne).toHaveBeenCalledWith({
      where: { email: "ia-7@stonechat.internal", companyId: 7 }
    });
  });
});
