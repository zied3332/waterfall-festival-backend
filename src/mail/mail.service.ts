import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import type { Transporter } from 'nodemailer';

type ContactMessageEmailData = {
  contactMessageId: number;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  createdAt: Date;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  private readonly adminEmail: string;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.getRequiredConfig('SMTP_HOST');
    const port = Number(
      this.getRequiredConfig('SMTP_PORT'),
    );
    const secure =
      this.configService.get<string>('SMTP_SECURE') ===
      'true';

    const user = this.getRequiredConfig('SMTP_USER');
    const password = this.getRequiredConfig(
      'SMTP_PASSWORD',
    );

    this.adminEmail =
      this.getRequiredConfig('ADMIN_EMAIL');

    this.fromAddress =
      this.configService.get<string>(
        'MAIL_FROM_ADDRESS',
      ) ?? user;

    this.fromName =
      this.configService.get<string>('MAIL_FROM_NAME') ??
      'Waterfall Festival';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.transporter.verify();

      this.logger.log(
        'SMTP connection verified successfully',
      );
    } catch (error: unknown) {
      this.logger.error(
        'SMTP connection verification failed',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }

  async sendNewContactMessageEmail(
    data: ContactMessageEmailData,
  ): Promise<void> {
    const safeName = this.escapeHtml(data.name);
    const safeEmail = this.escapeHtml(data.email);
    const safePhone = data.phone
      ? this.escapeHtml(data.phone)
      : 'Not provided';
    const safeSubject = this.escapeHtml(data.subject);
    const safeMessage = this.escapeHtml(
      data.message,
    ).replace(/\n/g, '<br />');

    await this.transporter.sendMail({
      from: {
        name: this.fromName,
        address: this.fromAddress,
      },

      to: this.adminEmail,

      replyTo: {
        name: data.name,
        address: data.email,
      },

      subject: `New contact message: ${data.subject}`,

      text: [
        'A new contact message was submitted.',
        '',
        `Message ID: ${data.contactMessageId}`,
        `Name: ${data.name}`,
        `Email: ${data.email}`,
        `Phone: ${data.phone ?? 'Not provided'}`,
        `Subject: ${data.subject}`,
        `Submitted at: ${data.createdAt.toISOString()}`,
        '',
        'Message:',
        data.message,
      ].join('\n'),

      html: `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
          </head>

          <body
            style="
              margin: 0;
              padding: 24px;
              background: #f4f4f5;
              font-family: Arial, sans-serif;
              color: #18181b;
            "
          >
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
            >
              <tr>
                <td align="center">
                  <table
                    role="presentation"
                    width="100%"
                    cellspacing="0"
                    cellpadding="0"
                    style="
                      max-width: 640px;
                      background: #ffffff;
                      border: 1px solid #e4e4e7;
                      border-radius: 12px;
                      overflow: hidden;
                    "
                  >
                    <tr>
                      <td
                        style="
                          padding: 24px;
                          background: #18181b;
                          color: #ffffff;
                        "
                      >
                        <div
                          style="
                            margin-bottom: 8px;
                            font-size: 12px;
                            font-weight: 700;
                            letter-spacing: 0.08em;
                            text-transform: uppercase;
                            color: #a1a1aa;
                          "
                        >
                          Waterfall Festival
                        </div>

                        <h1
                          style="
                            margin: 0;
                            font-size: 24px;
                            line-height: 1.3;
                          "
                        >
                          New contact message
                        </h1>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding: 24px">
                        <table
                          role="presentation"
                          width="100%"
                          cellspacing="0"
                          cellpadding="0"
                          style="
                            margin-bottom: 24px;
                            border-collapse: collapse;
                          "
                        >
                          ${this.createDetailRow(
                            'Message ID',
                            String(data.contactMessageId),
                          )}

                          ${this.createDetailRow(
                            'Name',
                            safeName,
                          )}

                          ${this.createDetailRow(
                            'Email',
                            safeEmail,
                          )}

                          ${this.createDetailRow(
                            'Phone',
                            safePhone,
                          )}

                          ${this.createDetailRow(
                            'Subject',
                            safeSubject,
                          )}

                          ${this.createDetailRow(
                            'Submitted',
                            this.escapeHtml(
                              data.createdAt.toISOString(),
                            ),
                          )}
                        </table>

                        <div
                          style="
                            padding: 18px;
                            background: #fafafa;
                            border: 1px solid #e4e4e7;
                            border-radius: 8px;
                          "
                        >
                          <div
                            style="
                              margin-bottom: 10px;
                              font-size: 12px;
                              font-weight: 700;
                              letter-spacing: 0.06em;
                              text-transform: uppercase;
                              color: #71717a;
                            "
                          >
                            Message
                          </div>

                          <div
                            style="
                              font-size: 15px;
                              line-height: 1.7;
                              color: #27272a;
                            "
                          >
                            ${safeMessage}
                          </div>
                        </div>

                        <p
                          style="
                            margin: 24px 0 0;
                            font-size: 13px;
                            line-height: 1.6;
                            color: #71717a;
                          "
                        >
                          Reply to this email to respond directly
                          to ${safeName}.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });
  }

  private getRequiredConfig(key: string): string {
    const value =
      this.configService.get<string>(key);

    if (!value) {
      throw new Error(
        `Missing required environment variable: ${key}`,
      );
    }

    return value;
  }

  private createDetailRow(
    label: string,
    value: string,
  ): string {
    return `
      <tr>
        <td
          style="
            width: 130px;
            padding: 8px 12px 8px 0;
            border-bottom: 1px solid #f4f4f5;
            font-size: 13px;
            font-weight: 700;
            color: #71717a;
            vertical-align: top;
          "
        >
          ${label}
        </td>

        <td
          style="
            padding: 8px 0;
            border-bottom: 1px solid #f4f4f5;
            font-size: 14px;
            color: #18181b;
            vertical-align: top;
          "
        >
          ${value}
        </td>
      </tr>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}