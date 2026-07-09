import { randomBytes } from "crypto";
import User from "../../models/User";

export const AI_USER_NAME = "IA";

const FindOrCreateAiUserService = async (
  companyId: number
): Promise<User> => {
  const email = `ia-${companyId}@stonechat.internal`;

  const existing = await User.findOne({ where: { email, companyId } });
  if (existing) {
    return existing;
  }

  const user = await User.create({
    name: AI_USER_NAME,
    email,
    password: randomBytes(32).toString("hex"),
    profile: "user",
    companyId
  } as any);

  return user;
};

export default FindOrCreateAiUserService;
