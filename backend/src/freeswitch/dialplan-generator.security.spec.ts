import { DialplanGeneratorService } from './dialplan-generator.service';

describe('IVR XML generation boundary', () => {
    const generator = new DialplanGeneratorService();

    it('retains a valid greeting as one play_and_get_digits argument', () => {
        const xml = generator.generateIVRXMLs('ivr1_U0001', '/opt/ivr_audio/U0001/welcome.wav', {});
        expect(xml.get('ivr1_U0001')).toContain('/opt/ivr_audio/U0001/welcome.wav');
        expect(xml.get('ivr1_U0001')).toContain('application="play_and_get_digits"');
    });

    it.each([
        '/opt/ivr_audio/welcome.wav"/><action application="bridge" data="bad',
        '/opt/ivr_audio/welcome.wav extra_argument',
        '/opt/ivr_audio/../other-tenant/greeting.wav',
    ])('rejects an unsafe main greeting path', path => {
        expect(() => generator.generateIVRXMLs('ivr1_U0001', path, {})).toThrow('Invalid IVR greeting audio path');
    });

    it('rejects an unsafe submenu greeting and transfer operand', () => {
        expect(() => generator.generateIVRXMLs('ivr1_U0001', '/opt/ivr_audio/U0001/main.wav', {
            '1': { type: 'submenu', props: { greeting: '/opt/ivr_audio/sub.wav second_argument' } },
        })).toThrow('Invalid IVR greeting audio path');
        expect(() => generator.generateIVRXMLs('ivr1_U0001', '/opt/ivr_audio/U0001/main.wav', {
            '1': { type: 'external', target: '1234 XML public\"/><action application=\"bridge' },
        })).toThrow('Invalid IVR transfer target');
    });

    it('rejects XML and FreeSWITCH operand injection in forwarding targets', () => {
        expect(() => generator.generateDIDForwardXML('fwd1_U0001',
            '15551234567\"/><action application=\"bridge', 'carrier.example.test'))
            .toThrow('Invalid forwarded phone number');
        expect(() => generator.generateExtensionCFUXML('ext1_U0001',
            'U000102,execute_on_answer=bridge'))
            .toThrow('Invalid bridge operand');
    });
});
