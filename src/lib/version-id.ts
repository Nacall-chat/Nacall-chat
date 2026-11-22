import { createHash } from 'node:crypto';

/** Impressão do commit publicado: muda a cada deploy (o sino detecta a versão nova), mas não revela qual código está no ar. */
export const versionId = (commit: string) => (commit ? createHash('sha256').update(`nacall-version:${commit}`).digest('hex').slice(0, 16) : '');
