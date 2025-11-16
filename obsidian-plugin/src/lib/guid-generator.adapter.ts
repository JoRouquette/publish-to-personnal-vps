import { GuidGeneratorPort } from 'core-publishing/src/lib/ports/guid-generator-port';

export class GuidGeneratorAdapter implements GuidGeneratorPort {
  generateGuid(): string {
    // Simple GUID generator using random numbers and current timestamp
    const randomPart = Math.random().toString(36).substring(2, 10);
    const timestampPart = Date.now().toString(36);
    return `${randomPart}-${timestampPart}`;
  }
}
