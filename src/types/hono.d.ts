import "hono";

declare module "hono" {
  interface Variables {
    userId: string;
  }
}
