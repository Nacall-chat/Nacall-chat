import { askNotificationPermission, startCallService, stopCallService } from '@/features/call/service';

describe('serviço da call em segundo plano', () => {
  it('sem o módulo nativo (testes, web, iPhone) não faz nada e não quebra', async () => {
    expect(() => startCallService('BRASIL 01')).not.toThrow();
    expect(() => stopCallService()).not.toThrow();
    await expect(askNotificationPermission()).resolves.toBeUndefined();
  });
});
