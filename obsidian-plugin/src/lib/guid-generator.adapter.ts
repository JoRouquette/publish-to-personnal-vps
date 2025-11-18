import { GuidGeneratorPort } from 'core-publishing/src/lib/ports/guid-generator-port';

export class GuidGeneratorAdapter implements GuidGeneratorPort {
  generateGuid(): string {
    return crypto.randomUUID();
  }
}
