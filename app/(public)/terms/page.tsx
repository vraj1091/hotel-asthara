import { policyRoute } from "@/components/layout/policy-page";

const route = policyRoute("terms", "/terms");
export const generateMetadata = route.generateMetadata;
export default route.Page;
