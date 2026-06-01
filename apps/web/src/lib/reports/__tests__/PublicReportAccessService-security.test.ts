let PublicReportAccessService: typeof import('../PublicReportAccessService').PublicReportAccessService;

const singleMock = jest.fn();
const eqMock: jest.Mock = jest.fn();
eqMock.mockImplementation(() => ({ eq: eqMock, single: singleMock }));
const selectMock = jest.fn(() => ({ eq: eqMock, single: singleMock }));
const fromMock = jest.fn(() => ({ select: selectMock }));

jest.mock('@political-research/shared-utils', () => ({
    createAuditedSupabaseAdminClient: () => ({
        from: fromMock,
    }),
}));

describe('PublicReportAccessService security', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        process.env['PUBLIC_REPORT_SESSION_SECRET'] = 'test-public-report-session-secret';
        ({ PublicReportAccessService } = await import('../PublicReportAccessService'));
    });

    it('validates stateless session token for the same share', () => {
        const service = new PublicReportAccessService();
        const token = service.createPublicSessionToken('share-token-123', 60);

        const result = service.validatePublicSessionToken(token, 'share-token-123');

        expect(result.valid).toBe(true);
    });

    it('rejects stateless session token for a different share', () => {
        const service = new PublicReportAccessService();
        const token = service.createPublicSessionToken('share-token-123', 60);

        const result = service.validatePublicSessionToken(token, 'another-share-token');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Sessão inválida');
    });

    it('rejects expired stateless session token', () => {
        const service = new PublicReportAccessService();
        const token = service.createPublicSessionToken('share-token-123', -5);

        const result = service.validatePublicSessionToken(token, 'share-token-123');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Sessão expirada');
    });

    it('rejects tampered stateless session token', () => {
        const service = new PublicReportAccessService();
        const token = service.createPublicSessionToken('share-token-123', 60);
        const [payload, signature] = token.split('.');
        const tampered = `${payload}x.${signature}`;

        const result = service.validatePublicSessionToken(tampered, 'share-token-123');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Sessão inválida');
    });

    it('hard-blocks validateAccess when share is expired', async () => {
        const service = new PublicReportAccessService();

        singleMock.mockResolvedValueOnce({
            data: {
                id: 'share-id',
                share_token: 'share-token-123',
                is_active: true,
                access_type: 'public',
                expires_at: '2020-01-01T00:00:00.000Z',
            },
        });

        const result = await service.validateAccess('share-token-123');

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Link expirado');
    });
});
