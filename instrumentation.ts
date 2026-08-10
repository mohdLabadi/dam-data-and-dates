import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({ serviceName: "be-my-cupid" });
}
