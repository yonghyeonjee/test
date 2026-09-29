// 확장자 없는 import("./db", "next/cache") 를 .ts / .js 로 이어 준다. 테스트 전용.
//   node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/x.test.mjs
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (!e || e.code !== "ERR_MODULE_NOT_FOUND" || /\\.(ts|js|mjs|json)$/.test(spec)) throw e;
    try { return await next(spec + ".ts", ctx); } catch { return next(spec + ".js", ctx); }
  }
}`), import.meta.url);
