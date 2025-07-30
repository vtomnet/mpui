import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import net from "net";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ngrok from '@ngrok/ngrok';
import dotenv from 'dotenv';

dotenv.config();

const DOMAIN = process.env.DOMAIN;

if (typeof DOMAIN !== 'string' || DOMAIN.length < 1) {
  console.error(`Invalid DOMAIN in config file: ${DOMAIN}`)
}

const argv = yargs(hideBin(process.argv))
  .option("dev", {
    alias: 'd',
    type: "number",
    description: "Enable ngrok proxy ('/') to PORT",
    default: false,
  })
  .option("port", {
    alias: 'p',
    type: "number",
    default: 3000,
    description: "Run proxy server on PORT",
  })
  .option('to', {
    type: 'string',
    description: 'Host:port to proxy to (TCP)'
  })
  .strict()
  .parseSync();

const deviceAddr = argv.to || process.env.DEVICE_ADDR;

if (typeof deviceAddr !== 'string' || !deviceAddr.includes(':')) {
  console.error("Device address must be in .env or command line, and include ':'");
  process.exit(1);
}

const [toHost, toPortNumber] = deviceAddr.split(':');

const toPort = Number(toPortNumber);
if (isNaN(toPort) || toPort <= 0 || toPort > 65535) {
  console.error(`Given port ${toPortNumber} is invalid`);
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "1mb" }));

interface DeviceRequest {
  target: string; // "IP:PORT"
  data: string; // string or base64 string for binary
}

/**
 * POST /device
 * { target: "10.106.96.102:12347", data: "..." }
 * Sends raw TCP data to the target and returns the response
 */
app.post("/device", async (req, res) => {
  const body: DeviceRequest = req.body;

  const dataToSend = Buffer.from(body.data); // or base64 decoding if needed

  try {
    const response = await sendTcpMessage(toHost, toPort, dataToSend);
    res.status(200).send(response.toString()); // or res.send(response) for binary
    console.log('Finished sending.');
  } catch (err) {
    console.error("TCP send error:", err);
    res.status(502).json({ error: "TCP connection failed", detail: (err as Error).message });
  }
});

/**
 * Optional dev proxy for `/` → localhost:<frontend>
 */
if (argv.dev) {
  app.use(
    "/",
    createProxyMiddleware({
      target: `http://localhost:${argv.dev}`,
      changeOrigin: true,
    })
  );
  console.log(`Dev mode enabled. Proxying '/' to http://localhost:${argv.dev}`);
}

/**
 * Start server
 */
app.listen(argv.port, () => {
  console.log(`Proxy server listening on port ${argv.port}`);
});

ngrok.connect({ addr: argv.port, domain: DOMAIN, authtoken_from_env: true })
  .then(listener => console.log(`Ingress established at: ${listener.url()}`));

/**
 * Send data over a TCP socket and collect response
 */
function sendTcpMessage(host: string, port: number, data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let response = Buffer.alloc(0);

    client.connect(port, host, () => {
      console.log("Beginning to write data...");
      client.write(data);
      console.log("Wrote data...");
    });

    client.on("data", (chunk) => {
      response = Buffer.concat([response, chunk]);
    });

    client.on("end", () => {
      resolve(response);
    });

    client.on("error", (err) => {
      reject(err);
    });

    // optional timeout
    client.setTimeout(60_000, () => {
      client.destroy();
      reject(new Error("TCP connection timed out"));
    });
  });
}
