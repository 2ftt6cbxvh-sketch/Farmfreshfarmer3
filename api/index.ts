import app, { routesReadyPromise } from "../server/index";

export default async function handler(req: any, res: any) {
  await routesReadyPromise;
  return app(req, res);
}
