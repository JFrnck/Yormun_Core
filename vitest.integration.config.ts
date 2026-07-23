import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Tests con Postgres real vía testcontainers (AGENTS.md 6.2). Requieren
// Docker corriendo. Timeouts más generosos: levantar un contenedor y
// aplicar migraciones toma segundos, no milisegundos.
export default defineConfig({
  oxc: false,
  test: {
    root: './',
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    testTimeout: 30_000,
    // Con cache frío de Docker, descargar postgres:16.14-alpine puede
    // tardar >80s por sí solo (medido). Generoso para no fallar en CI
    // con la imagen sin cachear.
    hookTimeout: 120_000,
    // Cada archivo levanta su propio contenedor en beforeAll: en
    // paralelo, 3 pulls simultáneos compiten por el mismo ancho de banda
    // en cache frío (justo lo que causó los primeros timeouts). Secuencial
    // es más lento en total pero mucho más confiable, sobre todo en CI.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/generate-contract.ts'],
    },
  },
  plugins: [swc.vite()],
});
