# Security Remediation Implementation Plan

This document outlines the step-by-step implementation plan to resolve the three security vulnerabilities identified in the PBX backend: the `RolesGuard` fail-open vulnerability, weak authentication rate limiting, and permissive CORS configuration.

## 1. Remediation: RolesGuard "Fail-Closed" Architecture

### **Context**
Currently, the `RolesGuard` returns `true` if the `@Roles()` decorator is omitted, allowing any authenticated user access to endpoints that were intended to be restricted.

### **Implementation Steps**
1. Modify `src/auth/guards/roles.guard.ts`.
2. Check if `requiredRoles` is undefined or empty. If so, default to `false` (Fail-Closed) unless explicitly marked public for roles.
3. To support endpoints that intentionally allow *any* authenticated user, we will create an explicit `@AnyRole()` decorator or simply rely on `JwtAuthGuard` without `RolesGuard`.

### **Code Changes**

**`src/auth/guards/roles.guard.ts`**
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // FAIL-CLOSED: If RolesGuard is applied but no roles are defined, deny access.
        if (!requiredRoles || requiredRoles.length === 0) {
            throw new ForbiddenException('Access denied: No roles defined for this endpoint.');
        }

        const { user } = context.switchToHttp().getRequest();
        
        if (!user || !user.role) {
            return false;
        }

        return requiredRoles.some((role) => user.role === role);
    }
}
```

### **Testing Strategy**
*   **Unit Test**: Mock `ExecutionContext` with and without `@Roles()` metadata. Verify `canActivate` throws `ForbiddenException` when metadata is missing.
*   **Integration Test**: Remove `@Roles()` from a safe endpoint (e.g., `GET /users`) locally and assert it returns `403 Forbidden` for a Super Admin token.

---

## 2. Remediation: Strict Authentication Rate Limiting

### **Context**
The global rate limit of 300 requests per minute is too high for authentication routes, enabling brute-force password guessing and credential stuffing.

### **Implementation Steps**
1. Import the `@Throttle()` decorator from `@nestjs/throttler` in `auth.controller.ts`.
2. Apply strict limits (e.g., 5 requests per minute) specifically to authentication endpoints (`login`, `forgot-password`, `reset-password`, `signup`).
3. Ensure the app uses the `ThrottlerGuard` globally (already configured in `app.module.ts`).

### **Code Changes**

**`src/auth/auth.controller.ts`**
```typescript
import { Throttle } from '@nestjs/throttler';
// ... existing imports ...

@Controller('auth')
export class AuthController {
    
    // Strict limit: 5 requests per minute per IP for signup
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('signup')
    async signup(@Body() createUserDto: CreateUserDto) {
        return this.authService.signup(createUserDto);
    }

    // Strict limit: 5 login attempts per minute per IP
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(@GetUser() user: User) {
        return this.authService.login(user);
    }

    // Strict limit: 3 password reset requests per minute per IP
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    @Post('forgot-password')
    async forgotPassword(@Body() { email }: { email: string }) {
        return this.authService.forgotPassword(email);
    }
    
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('reset-password')
    async resetPassword(@Body() { token, newPassword }: { token: string; newPassword: string }) {
        return this.authService.resetPassword(token, newPassword);
    }
    
    // ... rest of controller ...
}
```

### **Testing Strategy**
*   **E2E Test**: Write an automated test that fires 6 concurrent POST requests to `/api/auth/login`. Assert that requests 1-5 return `401 Unauthorized` (for bad credentials), but request 6 returns `429 Too Many Requests`.

---

## 3. Remediation: Strict CORS Configuration

### **Context**
`app.enableCors()` with no arguments defaults to `Access-Control-Allow-Origin: *`, exposing the API to cross-origin attacks in production.

### **Implementation Steps**
1. Extract allowed origins from environment variables via `@nestjs/config`.
2. Configure `app.enableCors` in `main.ts` to strictly validate against this list of trusted domains.

### **Code Changes**

**`src/main.ts`**
```typescript
import { ConfigService } from '@nestjs/config';
// ... existing imports ...

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);

  // Parse allowed origins from ENV (e.g. "https://app.com,https://admin.com")
  const rawOrigins = configService.get<string>('ALLOWED_ORIGINS') || 'http://localhost:5173,http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map(url => url.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      // OR if the origin is explicitly in our whitelist
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true, // Allow cookies if needed
    allowedHeaders: 'Content-Type, Authorization, stripe-signature, idempotency-key',
  });

  // ... rest of bootstrap logic ...
}
```

**`.env` file addition**
```env
ALLOWED_ORIGINS=https://your-production-app.com,https://your-admin-panel.com
```

### **Testing Strategy**
*   **Manual Validation**: Use `curl` to simulate a cross-origin request:
    ```bash
    curl -H "Origin: https://malicious-site.com" -I http://localhost:3000/api/auth/me
    ```
    Assert that the response does *not* contain `Access-Control-Allow-Origin: https://malicious-site.com` and throws a CORS error.
*   **E2E Test**: Send a request with a valid origin from the `ALLOWED_ORIGINS` list and assert the `Access-Control-Allow-Origin` header matches the request origin.
