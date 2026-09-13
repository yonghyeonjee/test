import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}


#DaumWebMasterTool:c5c205ec2131c804e16bafa3971f389b5c56e8e4b4e42a153a178f743f21252d:TTrNsDNWeyJBX4OQHE95rw==
