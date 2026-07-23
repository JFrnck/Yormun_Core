import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: false,
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    // DbModule crea un pg.Pool (no conecta hasta la primera query), así
    // que basta con una URL sintácticamente válida para que ConfigModule
    // no falle al bootstrapear AppModule en este smoke test — no toca DB.
    env: {
      DATABASE_URL: 'postgres://test:test@localhost:5432/test_not_connected',
    },
  },
  plugins: [swc.vite()],
});
