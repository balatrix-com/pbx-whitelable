import { Controller, Post, Get, Body, Headers, UnauthorizedException, Param, Delete } from '@nestjs/common';
import { DemoService } from './demo.service';
import { ConfigService } from '@nestjs/config';

@Controller('demo')
export class DemoController {
    constructor(
        private demoService: DemoService,
        private configService: ConfigService
    ) {}

    private verifySyncToken(token: string) {
        const expectedToken = this.configService.get<string>('PBX_SYNC_TOKEN') || 'your-super-secret-jwt-key-change-this-in-production';
        if (token !== expectedToken) {
            throw new UnauthorizedException('Invalid sync token');
        }
    }

    @Get('accounts')
    async getAccounts() {
        return this.demoService.getAccounts();
    }

    @Get('numbers')
    async getAvailableNumbers() {
        return this.demoService.getAvailableNumbers();
    }

    @Get('numbers/all')
    async getAllNumbers() {
        return this.demoService.getAllNumbers();
    }

    @Post('numbers')
    async addNumber(@Body('number') number: string) {
        return this.demoService.addNumber(number);
    }

    @Delete('numbers/:number')
    async deleteNumber(@Param('number') number: string) {
        return this.demoService.deleteNumber(number);
    }


    @Get('activity')
    async getActivity() {
        return this.demoService.getActivity();
    }

    @Get('stats')
    async getStats() {
        return this.demoService.getStats();
    }

    @Post('accounts/:id/assign')
    async assign(@Param('id') id: string, @Body() data: any) {
        return this.demoService.provisionDemo({
            customerCode: id,
            tfnNumber: data.tfnNumber,
            email: data.customerEmail,
            name: data.customerName,
            planId: data.planId,
            freeMinutes: data.freeMinutes
        });
    }

    @Post('accounts/:id/stop')
    async stop(@Param('id') id: string) {
        return this.demoService.stopDemo(id);
    }

    @Post('provision')
    async provision(@Body() data: any, @Headers('x-sync-token') syncToken: string) {
        this.verifySyncToken(syncToken);
        return this.demoService.provisionDemo(data);
    }
}
