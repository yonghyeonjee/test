/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AWS Lightsail 배포는 GitHub Actions 에서 STANDALONE=1 로 빌드해 .next/standalone(서버 한 벌)만
  // 서버로 보낸다(deploy/lightsail). Vercel 빌드에는 영향이 없다.
  // 서버 메모리가 512MB 라 쪽 캐시를 메모리에 50MB(기본)씩 두지 않는다 — 디스크(.next/cache)에 둔다.
  ...(process.env.STANDALONE === "1" ? { output: "standalone", cacheMaxMemorySize: 16 * 1024 * 1024 } : {}),
  // 한 쪽을 미리 그리는 데 허용하는 시간(기본 60초). 바깥 API 를 부르는 쪽은
  // force-dynamic 으로 빼 뒀지만, 남은 쪽이 잠깐 느려도 배포가 죽지는 않게
  // 여유를 준다. 호출 자체에는 OPENAPI_TIMEOUT_MS(기본 8초) 제한이 걸려 있다.
  staticPageGenerationTimeout: 180,
  compress: true,
  poweredByHeader: false,
  async redirects() {
    return [
      // 블로그 메뉴를 따로 두면서 옮겼다. 이미 색인된 주소가 죽지 않게.
      { source: "/blog/jeonse-extension", destination: "/story/jeonse-extension", permanent: true },
      // 기업 지원사업 첫 화면에 제 길(/business)을 줬다. 물음표 주소는 정본에서
      // 물음표 뒤가 떨어져 첫 화면의 복제로 보였다. 나머지 조건은 그대로 따라간다.
      { source: "/", has: [{ type: "query", key: "tab", value: "business" }], destination: "/business", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // 배경 영상·포스터는 바뀌지 않는다. 오래 캐시한다.
        source: "/:file(login-bg.mp4|poster.jpg)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};
export default nextConfig;
