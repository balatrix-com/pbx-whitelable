import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { isIP } from 'node:net';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const method = request.method;
        // Query strings can contain reset/invitation tokens. Never log them.
        const url = request.url.split('?')[0];
        const now = Date.now();
        const forwardedIp = request.headers['x-real-ip'];
        const peer = request.socket?.remoteAddress;
        const isLocalProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer);
        const clientIp = isLocalProxy && typeof forwardedIp === 'string' && isIP(forwardedIp) ? forwardedIp : peer;

        return next
            .handle()
            .pipe(
                tap(() =>
                    this.logger.log(
                        JSON.stringify({ method, path: url, clientIp, userId: request.user?.id, tenantId: request.user?.tenantId, durationMs: Date.now() - now }),
                    ),
                ),
            );
    }
}
