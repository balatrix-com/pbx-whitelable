import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType, Prisma } from '@prisma/client';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class WalletService {
    private readonly logger = new Logger(WalletService.name);
    public readonly subBillingUrl: string;

    constructor(
        private prisma: PrismaService,
        private billingService: BillingService,
        private notificationsService: NotificationsService,
        private httpService: HttpService,
        private configService: ConfigService
    ) {
        this.subBillingUrl = this.configService.get<string>('SUB_BILLING_API_URL') || 'http://localhost:5005/api';
    }

    async getSubBillingCustomerId(tenantId: string): Promise<string> {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { subBillingCustomerId: true }
        });

        if (!tenant || !tenant.subBillingCustomerId) {
            throw new BadRequestException('Tenant not linked to a billing system customer');
        }

        return tenant.subBillingCustomerId;
    }

    async getBalance(tenantId: string) {
        const customerId = await this.getSubBillingCustomerId(tenantId);
        
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/pbx/balance/${customerId}`)
            );
            
            const data = response.data;
            // Parse "USD 189.00" into ["USD", "189.00"]
            const [currency, balanceStr] = data.f_balance.split(' ');
            
            return {
                balance: parseFloat(balanceStr),
                currency: currency || 'USD',
                freeMins: data["mins Balance"] !== undefined ? data["mins Balance"] : (data.freeMins || 0),
                creditLimit: data.credit_limit !== undefined ? parseFloat(data.credit_limit) : 0,
                autoRecharge: {
                    enabled: false,
                    threshold: 0,
                    amount: 0
                }
            };
        } catch (error) {
            this.logger.warn(`Sub Billing fetch failed for ${customerId}, checking local DB fallback...`);
            
            // Fallback to local Wallet and Subscription data
            const wallet = await this.prisma.wallet.findUnique({ where: { tenantId } });
            const subscription = await this.prisma.subscription.findFirst({ 
                where: { tenantId, status: 'ACTIVE' } 
            });
 
            return {
                balance: wallet?.balance || 0,
                currency: wallet?.currency || 'USD',
                freeMins: subscription?.remainingFreeMinutes || 0,
                creditLimit: 0,
                autoRecharge: {
                    enabled: false,
                    threshold: 0,
                    amount: 0
                }
            };
        }
    }

    async getTransactions(tenantId: string) {
        const customerId = await this.getSubBillingCustomerId(tenantId);
        
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/pbx/transactions/${customerId}`)
            );
            
            // Sub Billing /api/pbx/transactions returns mapped array directly
            return response.data.map((tx: any) => ({
                id: tx.id,
                amount: tx.amount,
                type: tx.type === 'payment' ? 'CREDIT' : 'DEBIT',
                description: tx.description,
                createdAt: tx.date,
                status: 'SUCCESS'
            }));
        } catch (error) {
            this.logger.error(`Failed to fetch transactions from Sub Billing for ${customerId}: ${error.message}`);
            return [];
        }
    }

    async adjustBalance(tenantId: string, amount: number, type: TransactionType, description: string, referenceId?: string, tx?: Prisma.TransactionClient) {
        const customerId = await this.getSubBillingCustomerId(tenantId);
        const signedAmount = type === 'DEBIT' ? -Math.abs(amount) : Math.abs(amount);
        
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.subBillingUrl}/payments/manual`, {
                    customer_id: customerId,
                    amount: signedAmount,
                    currency: 'usd',
                    tx_id: referenceId ? `${referenceId}-${Date.now()}` : `MANUAL-${Date.now()}`,
                    payment_type: 'pbx_admin_adjust',
                    description: description || `Admin adjustment: ${type}`
                })
            );
            return { success: true, data: response.data };
        } catch (error) {
            this.logger.error(`Failed to adjust balance for ${customerId}: ${error.response?.data?.message || error.message}`);
            throw new BadRequestException(`Failed to adjust balance: ${error.response?.data?.message || error.message}`);
        }
    }

    async topUpWallet(tenantId: string, amount: number) {
        if (amount <= 0) throw new BadRequestException('Amount must be positive');

        const customerId = await this.getSubBillingCustomerId(tenantId);
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.subBillingUrl}/payments/initiate`, {
                    customer_id: customerId,
                    amount: amount,
                    Initiate_by: 'pbx',
                    description: `Wallet Top-up for ${tenantId}`,
                    success_url: `${frontendUrl}/wallet?success=true&session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${frontendUrl}/wallet?canceled=true`
                })
            );

            const data = response.data;
            return {
                checkoutUrl: data.data.checkout_url,
                paymentId: data.data.payment_id
            };
        } catch (error) {
            this.logger.error(`Failed to initiate payment with Sub Billing for ${customerId}: ${error.response?.data?.message || error.message}`);
            throw new BadRequestException('Payment initiation failed');
        }
    }

    async getAllBalances() {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/pbx/all`)
            );
            const billingBalances = response.data;

            const tenants = await this.prisma.tenant.findMany({
                select: {
                    id: true,
                    name: true,
                    subBillingCustomerId: true
                }
            });

            return tenants.map(tenant => {
                const billingData = billingBalances.find((b: any) => b.customer_id === tenant.subBillingCustomerId);
                return {
                    tenantId: tenant.id,
                    tenantName: tenant.name,
                    subBillingCustomerId: tenant.subBillingCustomerId,
                    balance: billingData ? billingData.balance : 0,
                    freeMins: billingData ? billingData.freeMins : 0,
                    currency: billingData ? billingData.currency : 'USD'
                };
            });
        } catch (error) {
            this.logger.error(`Failed to fetch all balances from Sub Billing: ${error.message}`);
            return [];
        }
    }

    async getSubscription(tenantId: string) {
        const customerId = await this.getSubBillingCustomerId(tenantId);
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/pbx/subscription/${customerId}`)
            );
            this.logger.log(`Subscription data for ${customerId}: ${JSON.stringify(response.data)}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch subscription from Sub Billing for ${customerId}: ${error.message}`);
            return null;
        }
    }

    async getCards(tenantId: string) {
        const customerId = await this.getSubBillingCustomerId(tenantId);
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/pbx/cards/${customerId}`)
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch cards from Sub Billing for ${customerId}: ${error.message}`);
            return [];
        }
    }

    async updateAutoRechargeSettings(tenantId: string, enabled: boolean, threshold: number, amount: number) {
        // This could be implemented to call Sub Billing if it supports it, 
        // for now just returns success to avoid breaking frontend.
        return { success: true };
    }

    async checkCustomerExists(customerId: string): Promise<boolean> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/customers/${customerId}`)
            );
            return !!(response.status === 200 && response.data && response.data.success);
        } catch (error) {
            return false;
        }
    }

    async createSubBillingCustomer(customerId: string, email: string, name: string) {
        try {
            // First check if the customer already exists in sub-billing
            try {
                const checkResponse = await firstValueFrom(
                    this.httpService.get(`${this.subBillingUrl}/customers/${customerId}`)
                );
                if (checkResponse.status === 200 && checkResponse.data && checkResponse.data.success) {
                    this.logger.log(`Customer ${customerId} already exists in sub-billing.`);
                    return checkResponse.data.data;
                }
            } catch (checkErr) {
                // If it is 404, we proceed to create. Otherwise log and proceed to create.
                if (checkErr.response?.status !== 404) {
                    this.logger.warn(`Failed to check if customer exists, proceeding to create: ${checkErr.message}`);
                }
            }

            // Create customer in sub-billing
            this.logger.log(`Creating customer ${customerId} in sub-billing.`);
            const response = await firstValueFrom(
                this.httpService.post(`${this.subBillingUrl}/customers`, {
                    customer_id: customerId,
                    fr_cusid: customerId,
                    customer_type: 'individual',
                    first_name: name || 'Demo',
                    last_name: 'Customer',
                    admin_email: email,
                    address_st: '123 Demo Street',
                    city: 'Demo City',
                    state: 'Demo State',
                    country: 'USA'
                })
            );
            return response.data;
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            this.logger.error(`Failed to create customer ${customerId} in sub-billing: ${errorMsg}`);
            throw new BadRequestException(`Failed to create sub-billing customer: ${errorMsg}`);
        }
    }

    async createSubBillingCustomerExtended(data: {
        customerId: string;
        customerType: 'individual' | 'company';
        firstName: string;
        lastName: string;
        companyName?: string;
        companyTaxId?: string;
        email: string;
        phone: string;
        address: string;
        city: string;
        state: string;
        country: string;
        creditLimit?: number;
    }) {
        try {
            // Strict Validation - Throw error immediately instead of using placeholders
            if (!data.customerId) throw new BadRequestException('customerId is required');
            if (!data.customerType || !['individual', 'company'].includes(data.customerType)) {
                throw new BadRequestException('customerType is required and must be either individual or company');
            }
            if (!data.firstName) throw new BadRequestException('firstName is required');
            if (!data.lastName) throw new BadRequestException('lastName is required');
            if (!data.email) throw new BadRequestException('email is required');
            if (!data.phone) throw new BadRequestException('phone is required');
            if (!data.address || data.address.length < 10) {
                throw new BadRequestException('address is required and must be at least 10 characters');
            }
            if (!data.city) throw new BadRequestException('city is required');
            if (!data.state) throw new BadRequestException('state is required');
            if (!data.country) throw new BadRequestException('country is required');

            if (data.customerType === 'company') {
                if (!data.companyName) throw new BadRequestException('companyName is required for company type');
                if (!data.companyTaxId) throw new BadRequestException('companyTaxId is required for company type');
            }

            this.logger.log(`Creating customer ${data.customerId} in sub-billing: ${data.email}`);
            
            let mappedCountry = data.country.toUpperCase();
            const allowedCountries = ['IND', 'USA', 'CAD', 'PAK', 'PHI', 'BNG', 'OTHER'];
            if (!allowedCountries.includes(mappedCountry)) {
                if (mappedCountry === 'INDIA') mappedCountry = 'IND';
                else if (mappedCountry === 'CANADA') mappedCountry = 'CAD';
                else if (mappedCountry === 'PAKISTAN') mappedCountry = 'PAK';
                else if (mappedCountry === 'PHILIPPINES') mappedCountry = 'PHI';
                else if (mappedCountry === 'BANGLADESH') mappedCountry = 'BNG';
                else throw new BadRequestException(`Invalid country code: ${data.country}`);
            }

            const response = await firstValueFrom(
                this.httpService.post(`${this.subBillingUrl}/customers`, {
                    customer_id: data.customerId,
                    fr_cusid: data.customerId,
                    customer_type: data.customerType,
                    company_name: data.customerType === 'company' ? data.companyName : null,
                    company_tax_id: data.customerType === 'company' ? data.companyTaxId : null,
                    first_name: data.firstName,
                    last_name: data.lastName,
                    admin_email: data.email,
                    phone: data.phone,
                    address_st: data.address,
                    city: data.city,
                    state: data.state,
                    country: mappedCountry,
                    credit_limit: data.creditLimit !== undefined ? data.creditLimit : 0
                })
            );
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.message || 'Unknown error');
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            this.logger.error(`Failed to create customer in sub-billing: ${errorMsg}`);
            throw new BadRequestException(`Failed to create sub-billing customer: ${errorMsg}`);
        }
    }

    async createSubBillingSubscription(customerId: string, planId: string) {
        try {
            this.logger.log(`Creating subscription in sub-billing for customer ${customerId} to plan ${planId}`);
            const response = await firstValueFrom(
                this.httpService.post(`${this.subBillingUrl}/subscriptions`, {
                    customer_id: customerId,
                    plan_id: planId,
                    status: 'active',
                    override_balance_check: true
                })
            );
            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.message || 'Unknown error');
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            this.logger.error(`Failed to create sub-billing subscription: ${errorMsg}`);
            throw new BadRequestException(`Failed to create sub-billing subscription: ${errorMsg}`);
        }
    }

    async getSubBillingPlan(planId: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/plans/${planId}`)
            );
            if (response.data && response.data.success) {
                return response.data.data;
            }
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch plan from sub-billing: ${error.message}`);
            return null;
        }
    }

    async getAssets(tenantId: string) {
        const customerId = await this.getSubBillingCustomerId(tenantId);
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.subBillingUrl}/pbx/assets/${customerId}`)
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch assets from sub-billing for ${customerId}: ${error.message}`);
            return { tfns: [], dids: [], extensions: [], totals: { tfns: 0, dids: 0, extensions: 0 } };
        }
    }
}
