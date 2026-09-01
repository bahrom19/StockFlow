describe('SwaggerConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SWAGGER_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function loadConfig() {
    jest.resetModules();
    const { swaggerConfig } = await import('../swagger.config');
    return swaggerConfig();
  }

  it('defaults to enabled=false when SWAGGER_ENABLED is undefined', async () => {
    const config = await loadConfig();
    expect(config.enabled).toBe(false);
  });

  it('defaults to enabled=false when SWAGGER_ENABLED is empty string', async () => {
    process.env.SWAGGER_ENABLED = '';
    const config = await loadConfig();
    expect(config.enabled).toBe(false);
  });

  it('respects SWAGGER_ENABLED=true', async () => {
    process.env.SWAGGER_ENABLED = 'true';
    const config = await loadConfig();
    expect(config.enabled).toBe(true);
  });

  it('respects SWAGGER_ENABLED=1', async () => {
    process.env.SWAGGER_ENABLED = '1';
    const config = await loadConfig();
    expect(config.enabled).toBe(true);
  });

  it('respects SWAGGER_ENABLED=false', async () => {
    process.env.SWAGGER_ENABLED = 'false';
    const config = await loadConfig();
    expect(config.enabled).toBe(false);
  });

  it('respects SWAGGER_ENABLED=0', async () => {
    process.env.SWAGGER_ENABLED = '0';
    const config = await loadConfig();
    expect(config.enabled).toBe(false);
  });
});
