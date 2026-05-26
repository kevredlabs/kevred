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
        Subject: "Your sign-in link — kevred",
        TextPart: `Sign in to kevred\n\n${magicUrl}\n\nThis link expires in 15 minutes and can only be used once.\nIf you didn't request this, ignore this email.`,
        HTMLPart: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0">

        <!-- Card -->
        <tr><td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;padding:40px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:8px;">
              <span style="font-size:22px;font-weight:600;color:#0a0a0b;letter-spacing:-0.01em;">Sign in to kevred</span>
            </td></tr>
            <tr><td align="center" style="padding-bottom:32px;">
              <span style="font-size:14px;color:#71717a;line-height:1.6;">Click the button below to sign in. This link expires in <strong style="color:#0a0a0b;">15 minutes</strong> and can only be used once.</span>
            </td></tr>
            <tr><td align="center" style="padding-bottom:32px;">
              <a href="${magicUrl}" style="display:inline-block;padding:13px 32px;background:#006fff;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:-0.01em;">Sign in →</a>
            </td></tr>
            <tr><td style="border-top:1px solid #f4f4f5;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;text-align:center;">If you didn't request this link, you can safely ignore this email.</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;">
          <span style="font-size:12px;color:#a1a1aa;">Protected by kevred</span>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      },
    ],
  });
}
