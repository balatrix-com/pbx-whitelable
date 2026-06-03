import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
    constructor(private prisma: PrismaService) { }

    async log(params: {
        action: string;
        category: 'AUTH' | 'TENANT' | 'BILLING' | 'SYSTEM' | 'USER';
        actorId?: string;
        actorType?: 'USER' | 'SYSTEM' | 'API';
        actorEmail?: string;
        targetId?: string;
        targetType?: string;
        metadata?: any;
        ipAddress?: string;
        userAgent?: string;
    }) {
        try {
            return await this.prisma.auditLog.create({
                data: {
                    ...params,
                    actorType: params.actorType || 'USER',
                    metadata: params.metadata || {}
                }
            });
        } catch (error) {
            console.error('Failed to create audit log:', error);
            // Don't throw error to avoid breaking the main flow
        }
    }

    async findAll(query: {
        page?: number;
        limit?: number;
        search?: string;
        category?: string;
        action?: string;
        actorId?: string;
    }) {
        const page = query.page || 1;
        const limit = query.limit || 50;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (query.category) where.category = query.category;
        if (query.action) where.action = query.action;
        if (query.actorId) where.actorId = query.actorId;

        if (query.search) {
            where.OR = [
                { actorEmail: { contains: query.search, mode: 'insensitive' } },
                { action: { contains: query.search, mode: 'insensitive' } },
                { targetId: { contains: query.search } }
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            this.prisma.auditLog.count({ where })
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}
