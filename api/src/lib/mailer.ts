import Mailjet from "node-mailjet";

let client: ReturnType<typeof Mailjet.apiConnect> | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.MAILJET_API_KEY;
    const secretKey = process.env.MAILJET_SECRET_KEY;
    if (!apiKey || !secretKey) throw new Error("MAILJET_API_KEY or MAILJET_SECRET_KEY is not set");
    client = Mailjet.apiConnect(apiKey, secretKey);
  }
  return client;
}

export async function sendMagicLink(email: string, magicUrl: string): Promise<void> {
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  const fromName = process.env.MAIL_FROM_NAME ?? "Kevred";
  if (!fromEmail) throw new Error("MAIL_FROM_EMAIL is not set");

  await getClient().post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: fromEmail, Name: fromName },
        To: [{ Email: email }],
        Subject: "Your sign-in link",
        TextPart: `Click to sign in: ${magicUrl}\n\nThis link expires in 15 minutes and can only be used once.`,
        HTMLPart: `<p>Click the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.</p><p><a href="${magicUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px">Sign in</a></p><p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>`,
      },
    ],
  });
}
