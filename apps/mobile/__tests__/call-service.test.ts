import { askNotificationPermission, startCallService, stopCallService } from '@/features/call/service';

describe('serviço da call em segundo plano', () => {
  it('sem o módulo nativo (testes, web, iPhone) não faz nada e não quebra', async () => {
    expect(() => startCallService('BRASIL 01')).not.toThrow();
    expect(() => stopCallService()).not.toThrow();
    await expect(askNotificationPermission()).resolves.toBeUndefined();
  });
});

describe('serviço da call no Android com o módulo nativo', () => {
  it('avisa o serviço se a câmera está ligada (microfone + câmera) ou desligada (só microfone)', () => {
    jest.isolateModules(() => {
      const start = jest.fn();
      const stop = jest.fn();
      jest.doMock('expo', () => ({ requireOptionalNativeModule: () => ({ start, stop }) }));
      jest.doMock('react-native', () => ({ Platform: { OS: 'android', Version: 34 }, PermissionsAndroid: { request: jest.fn() } }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const service = require('@/features/call/service') as typeof import('@/features/call/service');
      service.startCallService('BRASIL 01');
      service.startCallService('BRASIL 01', true);
      service.startCallService('BRASIL 01', false);
      service.stopCallService();
      expect(start.mock.calls).toEqual([
        ['NACALL · Em call', 'BRASIL 01', false],
        ['NACALL · Em call', 'BRASIL 01', true],
        ['NACALL · Em call', 'BRASIL 01', false],
      ]);
      expect(stop).toHaveBeenCalledTimes(1);
    });
  });
});
