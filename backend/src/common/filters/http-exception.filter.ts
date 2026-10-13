import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse: any =
            exception instanceof HttpException
                ? exception.getResponse()
                : { message: 'Internal server error' };

        // Exception details can contain credentials or tokens.
        const summary = `${request.method} ${request.url.split('?')[0]} Http Status: ${status}`;
        if (status >= 500) {
            this.logger.error(summary);
        } else {
            this.logger.warn(summary);
        }

        const responseBody = typeof exceptionResponse === 'object'
            ? { ...exceptionResponse, timestamp: new Date().toISOString(), path: request.url }
            : { message: exceptionResponse, statusCode: status, timestamp: new Date().toISOString(), path: request.url };

        // Ensure statusCode is consistent with the HTTP status
        responseBody.statusCode = status;

        response.status(status).json(responseBody);
    }
}
