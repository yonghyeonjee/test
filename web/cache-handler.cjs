/**
 * 쪽 캐시 파일을 gzip 으로 저장한다(2026-11-09).
 *
 * 공고 상세 한 쪽이 html 약 160KB + rsc 약 86KB 로 디스크에 그대로 쌓여, AI·수집 봇이 옛 공고까지 훑으면서
 * 하루 6GB 넘게 늘어 38GB 디스크가 찼다(쪽 20초, 503, 배포 실패). 구글이 볼 쪽은 줄이지 않고 저장 크기만 줄인다.
 * gzip 하면 약 44KB, 5~6분의 1 이다.
 *
 * Next 기본 파일 캐시를 그대로 쓰고 읽기·쓰기만 감싼다. 빌드 때 만든 압축 안 된 쪽은 앞 2바이트로 가려 그대로 읽는다.
 * 파일 이름과 .meta 는 그대로라 수정 시각으로 재는 재검증도 같다. 바깥으로 나가는 응답은 전과 같고, 압축은 Next·Caddy 가 따로 한다.
 */
const FileSystemCache = require("next/dist/server/lib/incremental-cache/file-system-cache").default;
const zlib = require("zlib");
const { promisify } = require("util");

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const PACKED = /\.(html|rsc)$/;
const isGzip = (b) => Buffer.isBuffer(b) && b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

class GzipFileCache extends FileSystemCache {
  constructor(ctx) {
    const fs = ctx.fs;
    super({
      ...ctx,
      fs: {
        ...fs,
        readFile: async (f, enc) => {
          if (!PACKED.test(f)) return fs.readFile(f, enc);
          const raw = await fs.readFile(f);
          const out = isGzip(raw) ? await gunzip(raw) : raw;
          return enc ? out.toString(enc) : out;
        },
        writeFile: async (f, d) =>
          PACKED.test(f) ? fs.writeFile(f, await gzip(Buffer.from(d), { level: 6 })) : fs.writeFile(f, d),
      },
    });
  }
}

module.exports = GzipFileCache;
