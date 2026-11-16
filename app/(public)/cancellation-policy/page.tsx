import { policyRoute } from "@/components/layout/policy-page";

const route = policyRoute("cancellation", "/cancellation-policy");
export const generateMetadata = route.generateMetadata;
export default route.Page;
