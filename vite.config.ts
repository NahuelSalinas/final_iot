import { defineConfig, loadEnv, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';

// IP de la red local: el celular necesita una dirección que no sea localhost.
function lanIp(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const n of list ?? []) if (n.family === 'IPv4' && !n.internal) return n.address;
  }
  return 'localhost';
}
const PORT = 5173;

/**
 * Sirve las funciones de `api/` dentro del servidor de desarrollo, con la misma forma que en Vercel.
 * Así el juego completo corre con `npm run dev`, sin cuenta ni CLI de Vercel. En producción se usan
 * las mismas funciones, desplegadas tal cual.
 */
function apiLocal(): Plugin {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const m = req.url?.match(/^\/api\/([a-z]+)(\?|$)/); // los archivos con "_" no son endpoints
        if (!m) return next();
        // Se relee .env.local en cada pedido: se puede cargar la clave sin reiniciar.
        for (const [k, v] of Object.entries(loadEnv(server.config.mode, process.cwd(), ''))) process.env[k] = v;
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`);
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const raw = Buffer.concat(chunks).toString();
          const r = res as ServerResponse & { status(c: number): typeof r; json(o: unknown): typeof r };
          r.status = (c) => ((res.statusCode = c), r);
          r.json = (o) => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(o)), r);
          (req as IncomingMessage & { body?: unknown }).body = raw ? JSON.parse(raw) : undefined;
          await mod.default(req, r);
        } catch (e) {
          server.config.logger.error(`[api] ${String(e)}`);
          if (!res.headersSent) res.statusCode = 500;
          res.end();
        }
      });
    },
  };
}

// HTTPS en desarrollo: iOS exige contexto seguro para leer los sensores.
export default defineConfig({
  plugins: [...(process.env.NO_SSL ? [] : [basicSsl()]), apiLocal()],
  define: { __LAN_ORIGIN__: JSON.stringify(`https://${lanIp()}:${PORT}`) },
  server: { host: true, port: PORT },
  build: {
    rollupOptions: {
      input: {
        host: resolve(__dirname, 'index.html'),
        controller: resolve(__dirname, 'controller.html'),
      },
    },
  },
});
