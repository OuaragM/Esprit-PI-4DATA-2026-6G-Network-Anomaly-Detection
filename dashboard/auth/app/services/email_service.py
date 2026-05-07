"""
Async email delivery for user invitations.
Works with MailHog (dev) or real SMTP (Gmail, etc.) via env-var config.
"""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.config import settings

log = logging.getLogger(__name__)

# ── HTML email template ───────────────────────────────────────────────────────

_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your RESINET 6G IDS Account</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

          <!-- Header bar -->
          <tr>
            <td style="padding:0 0 24px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;text-align:center;vertical-align:middle;">
                          <span style="font-size:18px;font-weight:800;color:#fff;line-height:36px;">R</span>
                        </td>
                        <td style="padding-left:10px;vertical-align:middle;">
                          <span style="font-size:16px;font-weight:700;color:#f8fafc;letter-spacing:-0.3px;">RESINET 6G IDS</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">AI-Powered Security Platform</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:#1a1d27;border:1px solid #2a2d3a;border-radius:12px;overflow:hidden;">

              <!-- Accent gradient bar -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Welcome copy -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:32px 32px 8px;">
                    <h1 style="margin:0 0 10px;font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.5px;">
                      Welcome{greeting}
                    </h1>
                    <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.65;">
                      Your account on <strong style="color:#e2e8f0;">RESINET 6G IDS</strong> has been created
                      by an administrator. Use the credentials below to sign in for the first time.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0"
                           style="background:#0f1117;border:1px solid #2a2d3a;border-radius:8px;">
                      <tr>
                        <td style="padding:20px 24px;">
                          <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#6366f1;
                                    text-transform:uppercase;letter-spacing:0.8px;">Your Credentials</p>
                          <!-- Email row -->
                          <table width="100%" cellpadding="0" cellspacing="0"
                                 style="border-bottom:1px solid #2a2d3a;padding-bottom:10px;margin-bottom:10px;">
                            <tr>
                              <td>
                                <span style="display:block;font-size:11px;color:#64748b;margin-bottom:3px;">
                                  Email address
                                </span>
                                <span style="font-size:14px;color:#f8fafc;font-family:'Courier New',Courier,monospace;">
                                  {email}
                                </span>
                              </td>
                            </tr>
                          </table>
                          <!-- Password row -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <span style="display:block;font-size:11px;color:#64748b;margin-bottom:3px;">
                                  Temporary password
                                </span>
                                <span style="font-size:18px;color:#f8fafc;font-family:'Courier New',Courier,monospace;
                                            font-weight:700;letter-spacing:2px;background:#1a1d27;
                                            padding:6px 12px;border-radius:6px;border:1px solid #374151;
                                            display:inline-block;margin-top:2px;">
                                  {password}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Must-change warning -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 32px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0"
                           style="background:#1e1a2e;border:1px solid #4c1d95;border-radius:8px;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <span style="font-size:13px;color:#a78bfa;line-height:1.55;">
                            &#9888;&#xFE0F;&nbsp;
                            <strong>You will be asked to change this password immediately after your first login.</strong>
                            Choose a strong, unique password.
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 32px 28px;text-align:center;">
                    <a href="{login_url}"
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                              color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;
                              padding:13px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Sign in to RESINET &rarr;
                    </a>
                    <p style="margin:10px 0 0;font-size:11px;color:#475569;">
                      Or copy:&nbsp;<span style="color:#6366f1;">{login_url}</span>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Role + divider -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-top:1px solid #2a2d3a;">
                <tr>
                  <td style="padding:20px 32px 28px;">
                    <span style="font-size:12px;color:#64748b;">Your role:&nbsp;</span>
                    <span style="font-size:12px;font-weight:600;color:#6366f1;background:#1e1b4b;
                                padding:3px 12px;border-radius:999px;border:1px solid #3730a3;">
                      {role}
                    </span>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#334155;line-height:1.7;">
                RESINET 6G IDS &nbsp;&bull;&nbsp; Esprit School of Engineering &nbsp;&bull;&nbsp; 4th Year PI Project<br>
                This email was sent because an admin created an account for you.<br>
                If you did not expect this, please contact your system administrator.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

_TEXT_TEMPLATE = """\
Welcome to RESINET 6G IDS
=========================

Your account has been created by an administrator.

Email:    {email}
Password: {password}
Role:     {role}

Sign in at: {login_url}

You will be required to change your password on first login.

---
RESINET 6G IDS · Esprit School of Engineering
"""


async def send_invite_email(
    *,
    to_email: str,
    full_name: str,
    role: str,
    temp_password: str,
) -> None:
    """
    Send a welcome / credential email to a newly invited user.
    Raises on SMTP failure so the caller can decide whether to surface the error.
    """
    greeting = f", {full_name.split()[0]}" if full_name.strip() else ""
    role_label = role.replace("_", " ").title()
    login_url = settings.APP_LOGIN_URL

    html_body = _HTML_TEMPLATE.format(
        greeting=greeting,
        email=to_email,
        password=temp_password,
        role=role_label,
        login_url=login_url,
    )
    text_body = _TEXT_TEMPLATE.format(
        email=to_email,
        password=temp_password,
        role=role_label,
        login_url=login_url,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your RESINET 6G IDS account credentials"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Port 465 → direct SSL (use_tls=True)
    # Port 587 → STARTTLS (start_tls=True) — Gmail standard
    smtp_kwargs: dict = {"hostname": settings.SMTP_HOST, "port": settings.SMTP_PORT}
    if settings.SMTP_TLS:
        if settings.SMTP_PORT == 465:
            smtp_kwargs["use_tls"] = True
        else:
            smtp_kwargs["start_tls"] = True

    if settings.SMTP_USER:
        smtp_kwargs["username"] = settings.SMTP_USER
        smtp_kwargs["password"] = settings.SMTP_PASSWORD

    await aiosmtplib.send(msg, **smtp_kwargs)
    log.info("Invite email sent to %s", to_email)
