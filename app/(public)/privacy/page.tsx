import { policyRoute } from "@/components/layout/policy-page";

const route = policyRoute("privacy", "/privacy");
export const generateMetadata = route.generateMetadata;
export default route.Page;
