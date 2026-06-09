import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly apiKey: string;
    private readonly frontendUrl: string;
    private readonly apiUrl = 'https://api.zeptomail.in/v1.1/email/template';

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('zeptoMail.apiKey') || '';
        this.frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:5173';
    }

    async sendPasswordResetEmail(email: string, name: string, token: string, companyName: string = 'Cloud PBX') {
        if (!this.apiKey) {
            this.logger.warn('ZeptoMail API key not configured. Skipping email send.');
            return;
        }

        const baseUrl = this.frontendUrl.replace(/\/+$/, '');
        const resetUrl = `${baseUrl}/reset?token=${token}`;

        // Format date dynamically e.g. "27 Feb 2026"
        const dateString = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const yearString = new Date().getFullYear().toString();

        const payload = {
            mail_template_key: "pass-reset",
            from: {
                address: "no-reply@telecom-platform.com",
                name: "Cloud PBX Portal"
            },
            to: [
                {
                    email_address: {
                        address: email,
                        name: name || "User",
                    }
                }
            ],
            merge_info: {
                user_name: name || "User",
                company_name: "Cloud PBX",
                reset_url: resetUrl,
                expiry_minutes: "10",
                support_email: "support@telecom-platform.com",
                year: yearString,
                date: dateString
            }
        };

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': this.apiKey, // Note: Provided token looks like "Zoho-enczapikey PHtE..."
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.text();
                this.logger.error(`Failed to send email to ${email}: ${response.status} - ${errorData}`);
            } else {
                this.logger.log(`Password reset email sent successfully to ${email}`);
            }
        } catch (error) {
            this.logger.error(`Error sending email to ${email}`, error);
        }
    }

    async sendSupportInvitationEmail(email: string, name: string, token: string, adminName: string, tenantName: string) {
        if (!this.apiKey) {
            this.logger.warn('ZeptoMail API key not configured. Skipping invite email send.');
            return;
        }

        const baseUrl = this.frontendUrl.replace(/\/+$/, '');
        const inviteUrl = `${baseUrl}/invite/accept?token=${token}`;
        const yearString = new Date().getFullYear().toString();

        const payload = {
            mail_template_key: "sup-user-inv",
            from: {
                address: "no-reply@telecom-platform.com",
                name: "Cloud PBX Portal"
            },
            to: [{
                email_address: {
                    address: email,
                    name: name || "Support Agent",
                }
            }],
            merge_info: {
                user_name: name || "Support Agent",
                admin_name: adminName,
                tenant_name: tenantName || "Your Team",
                invite_url: inviteUrl,
                year: yearString
            }
        };

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.text();
                this.logger.error(`Failed to send invite to ${email}: ${response.status} - ${errorData}`);
            } else {
                this.logger.log(`Support invitation email sent successfully to ${email}`);
            }
        } catch (error) {
            this.logger.error(`Error sending invite email to ${email}`, error);
        }
    }

    async sendOnboardingCompletionEmail(
        email: string,
        name: string,
        customerCode: string,
        phoneNum: string,
        extensionListHtml: string,
        customerEmail: string,
        planName: string = 'N/A',
        quoteNo: string = 'N/A',
        password: string = 'Welcome123!'
    ) {
        if (!this.apiKey) {
            this.logger.warn('ZeptoMail API key not configured. Skipping onboarding completion email send.');
            return;
        }

        const baseUrl = this.frontendUrl.replace(/\/+$/, '');
        const loginUrl = `${baseUrl}/login`;

        const payload = {
            mail_template_key: "ob-post-payment",
            from: {
                address: "no-reply@telecom-platform.com",
                name: "Cloud PBX Portal"
            },
            to: [{
                email_address: {
                    address: email,
                    name: name || "Customer",
                }
            }],
            merge_info: {
                customer_name: name || "Customer",
                customer_email: customerEmail || email,
                Password: password,
                customer_code: customerCode,
                extension_login: customerCode,
                plan_name: planName,
                quote_no: quoteNo,
                phone_num: phoneNum || "N/A",
                login_url: loginUrl,
                onboarding_url: loginUrl, // Button expects this
                extension_list: extensionListHtml,
                current_year: String(new Date().getFullYear())
            }
        };

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.text();
                this.logger.error(`Failed to send onboarding completion email to ${email}: ${response.status} - ${errorData}`);
            } else {
                this.logger.log(`Onboarding completion email sent successfully to ${email}`);
            }
        } catch (error) {
            this.logger.error(`Error sending onboarding completion email to ${email}`, error);
        }
    }
}
