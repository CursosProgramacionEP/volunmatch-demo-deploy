import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    testTimeout: 15000, // Te sugiero subirlo un poco a 15s por si acaso
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false, // <--- AGREGA ESTA LÍNEA AQUÍ
  },
});