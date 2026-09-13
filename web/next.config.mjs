/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 한 쪽을 미리 그리는 데 허용하는 시간(기본 60초). 바깥 API 를 부르는 쪽은
  // force-dynamic 으로 빼 뒀지만, 남은 쪽이 잠깐 느려도 배포가 죽지는 않게
  // 여유를 준다. 호출 자체에는 OPENAPI_TIMEOUT_MS(기본 8초) 제한이 걸려 있다.
  staticPageGenerationTimeout: 180,
  compress: true,
  poweredByHeader: false,
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
