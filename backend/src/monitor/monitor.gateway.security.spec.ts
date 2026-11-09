import { MonitorGateway } from './monitor.gateway';

describe('monitor socket authorization lifecycle', () => {
    let gateway: MonitorGateway;
    let currentUser: any;
    let socket: any;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        currentUser = { role: 'ADMIN', tenantId: 'tenant-a', status: 'ACTIVE', monitoringEnabled: false };
        const jwt = { verify: jest.fn().mockImplementation(() => ({
            sub: 'user-a', role: 'ADMIN', tenantId: 'tenant-a', monitoringEnabled: false,
            exp: Math.floor(Date.now() / 1000) + 2,
        })) };
        const prisma = {
            user: { findUnique: jest.fn().mockImplementation(async () => currentUser) },
            tenant: { findUnique: jest.fn().mockResolvedValue({ customerCode: 'U0001', subBillingCustomerId: null }) },
        };
        gateway = new MonitorGateway({} as any, {} as any, jwt as any, prisma as any);
        socket = {
            id: 'socket-a', connected: true, handshake: { auth: { token: 'test-access-token' } }, data: {},
            disconnect: jest.fn().mockImplementation(() => { socket.connected = false; }),
            emit: jest.fn(), join: jest.fn(), leave: jest.fn(),
        };
    });

    afterEach(() => {
        gateway.handleDisconnect(socket);
        jest.useRealTimers();
    });

    it('disconnects an idle socket exactly when its access token expires', async () => {
        await gateway.handleConnection(socket);
        expect(socket.disconnect).not.toHaveBeenCalled();
        jest.advanceTimersByTime(2000);
        expect(socket.disconnect).toHaveBeenCalled();
    });

    it('denies a room join after the user is suspended', async () => {
        await gateway.handleConnection(socket);
        currentUser = { ...currentUser, status: 'SUSPENDED' };
        await gateway.handleJoinRoom('tenant-a', socket);
        expect(socket.disconnect).toHaveBeenCalled();
        expect(socket.join).not.toHaveBeenCalled();
    });

    it('denies a room join after a tenant reassignment', async () => {
        await gateway.handleConnection(socket);
        currentUser = { ...currentUser, tenantId: 'tenant-b' };
        await gateway.handleJoinRoom('tenant-a', socket);
        expect(socket.disconnect).toHaveBeenCalled();
        expect(socket.join).not.toHaveBeenCalled();
    });

    it('disconnects an already joined socket when role or authorization is revoked', async () => {
        await gateway.handleConnection(socket);
        socket.data.joinedTenantIds.add('tenant-a');
        currentUser = { ...currentUser, role: 'SUPPORT', monitoringEnabled: false };
        await (gateway as any).revalidateActiveClients();
        expect(socket.disconnect).toHaveBeenCalled();
    });

    it('allows SUPPORT user with monitoringEnabled: false to connect and join their own tenant room', async () => {
        currentUser = { role: 'SUPPORT', tenantId: 'tenant-a', status: 'ACTIVE', monitoringEnabled: false };
        const jwt = (gateway as any).jwtService;
        jwt.verify.mockReturnValueOnce({
            sub: 'support-user-1', role: 'SUPPORT', tenantId: 'tenant-a', monitoringEnabled: false,
            exp: Math.floor(Date.now() / 1000) + 10,
        });
        await gateway.handleConnection(socket);
        expect(socket.disconnect).not.toHaveBeenCalled();
        await gateway.handleJoinRoom('tenant-a', socket);
        expect(socket.join).toHaveBeenCalledWith('tenant:tenant-a');
        expect(socket.emit).toHaveBeenCalledWith('room_joined', expect.objectContaining({ room: 'tenant:tenant-a' }));
    });

    it('denies SUPPORT user from joining all tenants room (tenant:all)', async () => {
        currentUser = { role: 'SUPPORT', tenantId: 'tenant-a', status: 'ACTIVE', monitoringEnabled: false };
        const jwt = (gateway as any).jwtService;
        jwt.verify.mockReturnValueOnce({
            sub: 'support-user-1', role: 'SUPPORT', tenantId: 'tenant-a', monitoringEnabled: false,
            exp: Math.floor(Date.now() / 1000) + 10,
        });
        await gateway.handleConnection(socket);
        await gateway.handleJoinRoom('all', socket);
        expect(socket.join).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Unauthorized tenant access' });
    });

    it('never joins another tenant room with a valid own-tenant token', async () => {
        await gateway.handleConnection(socket);
        await gateway.handleJoinRoom('tenant-b', socket);
        expect(socket.join).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Unauthorized tenant access' });
    });

    it('allows room join with normalized tenant ID (e.g. 1012 for U1012)', async () => {
        currentUser = { role: 'ADMIN', tenantId: 'U1012', status: 'ACTIVE', monitoringEnabled: true };
        const jwt = (gateway as any).jwtService;
        jwt.verify.mockReturnValueOnce({
            sub: 'user-a', role: 'ADMIN', tenantId: 'U1012', monitoringEnabled: true,
            exp: Math.floor(Date.now() / 1000) + 10,
        });
        await gateway.handleConnection(socket);
        await gateway.handleJoinRoom('1012', socket);
        expect(socket.join).toHaveBeenCalledWith('tenant:1012');
        expect(socket.emit).toHaveBeenCalledWith('room_joined', expect.objectContaining({ room: 'tenant:1012' }));
    });

    it('retains connection during transient database error if token is still unexpired', async () => {
        await gateway.handleConnection(socket);
        const prisma = (gateway as any).prismaService;
        prisma.user.findUnique.mockRejectedValueOnce(new Error('Connection pool timeout'));
        await (gateway as any).revalidateActiveClients();
        expect(socket.disconnect).not.toHaveBeenCalled();
    });
});
