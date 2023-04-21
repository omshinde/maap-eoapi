export class Config {
  readonly stage: string;
  readonly version: string;
  readonly tags: Record<string, string>;
  readonly jwksUrl: string;

  constructor() {
    this.stage = process.env.STAGE || "dev";
    this.version = process.env.npm_package_version!; // Set by node.js
    this.tags = {
      created_by: process.env.USER!,
      version: this.version,
      stage: this.stage,
    };
    if (!process.env.JWKS_URL) throw Error("Must provide JWKS_URL");
    this.jwksUrl = process.env.JWKS_URL;
  }

  /**
   * Helper to generate id of stack
   * @param serviceId Identifier of service
   * @returns Full id of stack
   */
  buildStackName = (serviceId: string): string =>
    `MAAP-STAC-${this.stage}-${serviceId}`;
}
